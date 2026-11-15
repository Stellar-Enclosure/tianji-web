import {useId} from 'react'
import type {GraphVO, NodeExecutionDTO} from '../../api/processAutomation'

export type ProcessGraphProps = Readonly<{
  graph: GraphVO
  executions: readonly NodeExecutionDTO[]
  selectedNodeId?: string | null
  onSelectNode: (nodeId: string) => void
}>

type GraphNode = GraphVO['nodes'][number]
type GraphEdge = GraphVO['edges'][number]
type NodeState = NodeExecutionDTO['state']

const nodeKinds: Readonly<Record<string, readonly [string, string]>> = {
  START: ['▶', '开始事件'],
  END: ['■', '结束事件'],
  HUMAN: ['●', '人工任务'],
  SERVICE: ['⚙', '服务任务'],
  RULE: ['≡', '规则任务'],
  AGENT: ['✦', 'Agent 任务'],
  EVENT_WAIT: ['◇', '事件等待'],
  TIMER: ['◷', '定时器'],
  SUBPROCESS: ['⊞', '子流程'],
  LOOP: ['↶', '循环'],
  MULTI_INSTANCE: ['▦', '多实例'],
  XOR_GATEWAY: ['◇', '排他分支'],
  AND_SPLIT: ['⊕', '并行分支'],
  AND_JOIN: ['⊕', '并行汇合'],
}

const executionLabels: Readonly<Record<NodeState, string>> = {
  RUNNING: '执行中',
  WAIT_RECOVERY: '待恢复',
  WAITING: '等待中',
  SCHEDULED: '待调度',
  RESULT_ACCEPTED: '已接收结果',
  FAILED: '失败',
  TIMED_OUT: '已超时',
  CANCELLED: '已取消',
  COMPLETED: '已完成',
}
const executionStateOrder = Object.keys(executionLabels) as NodeState[]
const finishedStates = new Set<NodeState>(['COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED'])

export function describeGraphNodes(nodes: GraphVO['nodes'], executions: readonly NodeExecutionDTO[]) {
  const occurrencesByNode = new Map<string, Map<string, NodeExecutionDTO>>()
  for (const execution of executions) {
    let occurrences = occurrencesByNode.get(execution.nodeId)
    if (!occurrences) {
      occurrences = new Map()
      occurrencesByNode.set(execution.nodeId, occurrences)
    }
    const previous = occurrences.get(execution.occurrenceId)
    if (!previous || execution.attempt > previous.attempt) occurrences.set(execution.occurrenceId, execution)
  }

  return nodes.map(node => {
    const occurrences = occurrencesByNode.get(node.id)
    const states = new Set<NodeState>()
    let activeCount = 0
    let highestAttempt = 0
    for (const execution of occurrences?.values() ?? []) {
      states.add(execution.state)
      if (!finishedStates.has(execution.state)) activeCount += 1
      highestAttempt = Math.max(highestAttempt, execution.attempt)
    }
    const observedStates = executionStateOrder
      .filter(state => states.has(state)).map(state => executionLabels[state])
    const status = observedStates.join('、') || '状态未知'
    const activity = occurrences
      ? `${status} · 活动 ${activeCount} · ${occurrences.size > 1 ? '最高' : ''}第 ${highestAttempt} 次尝试`
      : status
    const [icon, kind] = nodeKinds[node.kind] ?? ['◇', node.kind]
    const name = node.name.trim() || node.id
    return {node, icon, kind, name, status, activity, activeCount: occurrences ? activeCount : null,
      accessibleName: `${name}，${kind}，${activity}`}
  })
}

const nodeWidth = 208
const nodeHeight = 84
const columnWidth = 260
const rowHeight = 144
const padding = 28

type NodePosition = Readonly<{x: number; y: number; rank: number}>

function graphLayout(graph: GraphVO) {
  const outgoing = new Map(graph.nodes.map(node => [node.id, [] as GraphEdge[]]))
  const incoming = new Set(graph.edges.map(edge => edge.target))
  for (const edge of graph.edges) outgoing.get(edge.source)?.push(edge)

  const visited = new Set<string>()
  const active = new Set<string>()
  const returnEdges = new Set<string>()
  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    active.add(id)
    for (const edge of outgoing.get(id) ?? []) {
      if (active.has(edge.target)) returnEdges.add(edge.id)
      else visit(edge.target)
    }
    active.delete(id)
  }
  // Begin at real entrances so a loop is drawn as a return to the earlier rank.
  for (const node of graph.nodes) {
    if (node.kind === 'START' || !incoming.has(node.id)) visit(node.id)
  }
  for (const node of graph.nodes) visit(node.id)

  const ranks = new Map(graph.nodes.map(node => [node.id, 0]))
  const unplacedPredecessors = new Map(ranks)
  for (const edge of graph.edges) {
    if (!returnEdges.has(edge.id)) unplacedPredecessors.set(edge.target, (unplacedPredecessors.get(edge.target) ?? 0) + 1)
  }
  const ready = graph.nodes.filter(node => unplacedPredecessors.get(node.id) === 0).map(node => node.id)
  for (const id of ready) {
    for (const edge of outgoing.get(id) ?? []) {
      if (returnEdges.has(edge.id)) continue
      ranks.set(edge.target, Math.max(ranks.get(edge.target) ?? 0, (ranks.get(id) ?? 0) + 1))
      const remaining = (unplacedPredecessors.get(edge.target) ?? 1) - 1
      unplacedPredecessors.set(edge.target, remaining)
      if (remaining === 0) ready.push(edge.target)
    }
  }

  const layers: GraphNode[][] = []
  for (const node of graph.nodes) {
    const rank = ranks.get(node.id) ?? 0
    layers[rank] ??= []
    layers[rank].push(node)
  }
  const widest = Math.max(1, ...layers.map(layer => layer.length))
  const right = padding + (widest - 1) * columnWidth + nodeWidth
  const positions = new Map<string, NodePosition>()
  layers.forEach((layer, rank) => layer.forEach((node, column) => {
    positions.set(node.id, {
      x: padding + ((widest - layer.length) / 2 + column) * columnWidth,
      y: padding + rank * rowHeight,
      rank,
    })
  }))
  return {positions, returnEdges, right, height: padding * 2 + (layers.length - 1) * rowHeight + nodeHeight}
}

function edgeGeometry(edge: GraphEdge, source: NodePosition, target: NodePosition, returning: boolean, sideX: number) {
  const fromX = source.x + nodeWidth / 2
  const toX = target.x + nodeWidth / 2
  const fromY = source.y + nodeHeight
  const toY = target.y
  if (!returning && target.rank - source.rank === 1) {
    const middle = (fromY + toY) / 2
    return {path: `M ${fromX} ${fromY} C ${fromX} ${middle} ${toX} ${middle} ${toX} ${toY}`,
      labelX: (fromX + toX) / 2, labelY: middle - 5}
  }
  if (edge.source === edge.target) {
    // A separate arc remains visible even if other nodes share this rank.
    const right = source.x + nodeWidth
    return {path: `M ${right} ${source.y + 20} C ${right + 46} ${source.y + 20} ${right + 46} ${fromY - 20} ${right} ${fromY - 20}`,
      labelX: right + 14, labelY: source.y + nodeHeight / 2 - 4}
  }
  // Long and return edges bypass intervening rows through the outside lane.
  const outgoingLaneY = fromY + 20
  const incomingLaneY = toY - 18
  return {
    path: `M ${fromX} ${fromY} C ${fromX} ${outgoingLaneY} ${fromX + 12} ${outgoingLaneY} ${fromX + 22} ${outgoingLaneY}`
      + ` H ${sideX} V ${incomingLaneY} H ${toX + 22} C ${toX + 12} ${incomingLaneY} ${toX} ${incomingLaneY} ${toX} ${toY}`,
    labelX: sideX + 8,
    labelY: (outgoingLaneY + incomingLaneY) / 2 - 5,
  }
}

function shortText(value: string, limit: number) {
  const chars = Array.from(value)
  return chars.length > limit ? chars.slice(0, limit - 1).join('') + '…' : value
}

export function ProcessGraph({graph, executions, selectedNodeId, onSelectNode}: ProcessGraphProps) {
  const markerId = useId()
  if (graph.nodes.length === 0) return <p>暂无流程图节点</p>

  const {positions, returnEdges, right, height} = graphLayout(graph)
  let sideLaneCount = 0
  const edges = graph.edges.flatMap(edge => {
    const source = positions.get(edge.source)
    const target = positions.get(edge.target)
    if (!source || !target) return []
    const returning = returnEdges.has(edge.id)
    const sideEdge = returning || target.rank - source.rank !== 1
    const sideX = right + 36 + (sideEdge ? sideLaneCount++ % 5 : 0) * 14
    return [{edge, returning, sideEdge: sideEdge && edge.source !== edge.target,
      ...edgeGeometry(edge, source, target, returning, sideX)}]
  })
  const width = right + (sideLaneCount ? 244 : padding)

  return <details open className="process-graph">
    <summary>流程图</summary>
    <div className="process-graph-canvas" tabIndex={0} role="region" aria-label="流程图滚动区">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="流程逻辑图">
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 Z" fill="#64748b" />
          </marker>
        </defs>
        {edges.map(({edge, returning, sideEdge, path, labelX, labelY}) =>
          <g key={edge.id} data-edge-id={edge.id} data-flow={returning ? 'return' : 'forward'} aria-hidden="true">
            <title>{edge.label === null ? `${edge.source} → ${edge.target}` : `${edge.source} → ${edge.target}，${edge.label}`}</title>
            <path d={path} fill="none" stroke="#64748b" strokeWidth="1.5"
              strokeDasharray={returning ? '5 4' : undefined} markerEnd={`url(#${markerId})`} />
            {edge.label !== null && <text x={labelX} y={labelY} textAnchor={sideEdge ? 'start' : 'middle'}
              fontSize="12" fill="#394a5e" stroke="white" strokeWidth="3" paintOrder="stroke">{shortText(edge.label, 13)}</text>}
          </g>)}
        {describeGraphNodes(graph.nodes, executions).map(({node, icon, kind, name, status, activeCount, accessibleName}) => {
          const position = positions.get(node.id)
          if (!position) return null
          const selected = selectedNodeId === node.id
          return <g key={node.id} className="process-graph-node" data-node-id={node.id}
            transform={`translate(${position.x} ${position.y})`} role="button" tabIndex={0}
            aria-pressed={selected} aria-label={accessibleName} onClick={() => onSelectNode(node.id)}
            onKeyDown={event => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              if (!event.repeat) onSelectNode(node.id)
            }}>
            <title>{accessibleName}</title>
            <rect className="process-graph-node-shape" rx="8" width={nodeWidth} height={nodeHeight}
              fill={selected ? '#eaf4ff' : '#ffffff'} stroke={selected ? '#1677ff' : '#b6c2d1'}
              strokeWidth={selected ? 2 : 1} />
            <g aria-hidden="true">
              <rect x="12" y="12" width="24" height="24" rx="5" fill="#e7f0fa" />
              <text x="24" y="29" textAnchor="middle" fontSize="13" fill="#175b9e">{icon}</text>
              <text x="46" y="29" fontSize="14" fontWeight="600" fill="#172638">{shortText(name, 11)}</text>
              <text x="12" y="50" fontSize="12" fill="#394a5e">{shortText(kind, 15)}</text>
              <text x="12" y="69" fontSize="12" fill="#394a5e">{shortText(status, 9)}</text>
              {activeCount !== null && <text x={nodeWidth - 12} y="69" textAnchor="end" fontSize="12"
                fill="#394a5e">活动 {activeCount}</text>}
            </g>
          </g>
        })}
      </svg>
    </div>
  </details>
}
