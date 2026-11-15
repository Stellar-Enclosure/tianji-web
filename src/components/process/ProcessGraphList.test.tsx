import {fireEvent, render, screen, within} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import type {GraphVO, NodeExecutionDTO} from '../../api/processAutomation'
import {ProcessGraph} from './ProcessGraph'
import {ProcessGraphList} from './ProcessGraphList'

const graph: GraphVO = {
  definitionKey: 'flow',
  nodes: [{id: 'start', kind: 'HUMAN', name: '开始'}, {id: 'end', kind: 'END', name: '结束'}],
  edges: [
    {id: 'advance', source: 'start', target: 'end', label: null},
    {id: 'return', source: 'end', target: 'start', label: '<img src=x>'},
  ],
}

const execution = (occurrenceId: string, attempt: number, state: NodeExecutionDTO['state']): NodeExecutionDTO => ({
  nodeId: 'start', occurrenceId, attempt, state,
  nodeExecutionRef: `${occurrenceId}-${attempt}`, kind: 'HUMAN',
  inputSha256: 'a'.repeat(64), outputSchemaSha256: 'b'.repeat(64),
  startedAt: '2026-11-15T00:00:00Z', finishedAt: null, deadlineAt: '2026-11-15T00:10:00Z',
  errorCode: null, sideEffectOutcome: 'NONE', agentRunId: null, output: null,
  eventReceiptIds: [], version: 'version-1', availableActions: [],
})

describe('ProcessGraphList', () => {
  it('matches graph selection and summarizes latest observed attempts per occurrence', () => {
    const onSelectNode = vi.fn()
    const executions = [
      execution('first', 2, 'RUNNING'),
      execution('second', 1, 'COMPLETED'),
      execution('first', 1, 'FAILED'),
    ]
    const view = (selectedNodeId: string) => {
      const props = {graph, executions, selectedNodeId, onSelectNode}
      return <><ProcessGraph {...props} /><ProcessGraphList {...props} /></>
    }
    const {rerender} = render(view('start'))
    const svg = screen.getByLabelText('流程逻辑图')
    const list = screen.getByRole('list', {name: '流程节点'})
    const svgStart = within(svg).getByRole('button', {name: /开始/})
    const listStart = within(list).getByRole('button', {name: /开始/})
    expect(within(svgStart).getByText('活动 1')).toBeInTheDocument()

    for (const node of [svgStart, listStart]) {
      expect(node).toHaveAttribute('aria-pressed', 'true')
      expect(node).toHaveAccessibleName(/执行中、已完成.*活动 1.*第 2 次尝试/)
      expect(node).not.toHaveAccessibleName(/失败/)
    }
    const listEnd = within(list).getByRole('button', {name: /结束.*状态未知/})
    expect(within(svg).getByRole('button', {name: /结束.*状态未知/})).toBeInTheDocument()
    expect(listEnd).toBeInstanceOf(HTMLButtonElement)
    listEnd.focus()
    expect(listEnd).toHaveFocus()
    fireEvent.click(listEnd, {detail: 0})
    expect(onSelectNode).toHaveBeenCalledExactlyOnceWith('end')

    rerender(view('end'))
    expect(listEnd).toHaveAttribute('aria-pressed', 'true')
    expect(listStart).toHaveAttribute('aria-pressed', 'false')
    expect(within(svg).getByRole('button', {name: /结束/})).toHaveAttribute('aria-pressed', 'true')
  })

  it('lets the fallback select the same node with the graph collapsed', () => {
    const props = {graph, executions: [], onSelectNode: vi.fn()}
    const {container} = render(<><ProcessGraph {...props} /><ProcessGraphList {...props} /></>)
    const chart = container.querySelector('details')
    expect(chart).toHaveAttribute('open')
    fireEvent.click(screen.getByText('流程图', {selector: 'summary'}))
    expect(chart).not.toHaveAttribute('open')
    const list = screen.getByRole('list', {name: '流程节点'})
    fireEvent.click(within(list).getByRole('button', {name: /开始/}))
    expect(props.onSelectNode).toHaveBeenCalledExactlyOnceWith('start')
  })

  it('retains all edge directions and renders optional labels and long names as text', () => {
    const selected = vi.fn()
    const longName = '复杂流程节点'.repeat(40)
    const {container} = render(<ProcessGraphList graph={{...graph, nodes: [
      {id: 'start', kind: 'HUMAN', name: longName}, graph.nodes[1],
    ]}} executions={[]} onSelectNode={selected} />)
    const edges = screen.getByRole('list', {name: '流程连线'})
    expect(within(edges).getAllByRole('listitem')).toHaveLength(2)
    expect(edges).toHaveTextContent('start → end')
    expect(edges).toHaveTextContent('end → start')
    expect(edges).toHaveTextContent('<img src=x>')
    expect(screen.getByText(longName)).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
    expect(selected).not.toHaveBeenCalled()
  })

  it('states when there are no graph nodes or sequences', () => {
    render(<ProcessGraphList graph={{...graph, nodes: [], edges: []}} executions={[]} onSelectNode={vi.fn()} />)
    expect(screen.getByText('暂无流程图节点')).toBeInTheDocument()
    expect(screen.getByText('暂无流程连线')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
