import {fireEvent, render, screen, within} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import type {GraphVO} from '../../api/processAutomation'
import {ProcessGraph} from './ProcessGraph'

const graph: GraphVO = {
  definitionKey: 'flow',
  nodes: [
    {id: 'done', kind: 'END', name: '结束'},
    {id: 'start', kind: 'START', name: '开始'},
    {id: 'choose', kind: 'XOR_GATEWAY', name: '判断'},
    {id: 'left', kind: 'HUMAN', name: '人工处理'},
    {id: 'right', kind: 'LOOP', name: '<img src=x>'},
    {id: 'isolated', kind: 'SUBPROCESS', name: '独立节点'},
  ],
  edges: [
    {id: 'start-choose', source: 'start', target: 'choose', label: null},
    {id: 'choose-left', source: 'choose', target: 'left', label: '通过'},
    {id: 'choose-right', source: 'choose', target: 'right', label: '<script>'},
    {id: 'left-done', source: 'left', target: 'done', label: null},
    {id: 'right-done', source: 'right', target: 'done', label: null},
    {id: 'right-choose', source: 'right', target: 'choose', label: '再试一次'},
    {id: 'right-right', source: 'right', target: 'right', label: null},
  ],
}

describe('ProcessGraph', () => {
  it('draws only the supplied nodes and directed edges, with names and labels as text', () => {
    const {container} = render(<ProcessGraph graph={graph} executions={[]} onSelectNode={vi.fn()} />)
    const svg = screen.getByLabelText('流程逻辑图')
    expect(within(svg).getAllByRole('button')).toHaveLength(graph.nodes.length)
    expect(svg.querySelectorAll('[data-edge-id]')).toHaveLength(graph.edges.length)
    expect(within(svg).getByText('<img src=x>', {selector: 'text'})).toBeInTheDocument()
    expect(within(svg).getByText('<script>', {selector: 'text'})).toBeInTheDocument()
    expect(container.querySelectorAll('script, foreignObject, image, img, use, a[href]')).toHaveLength(0)
    expect(svg.querySelector('[data-edge-id="start-choose"] path[marker-end]')).toBeInTheDocument()
  })

  it('lays out forks and joins topologically and draws backward and self edges as return paths', () => {
    const {container, rerender} = render(<ProcessGraph graph={graph} executions={[]} onSelectNode={vi.fn()} />)
    const position = (id: string) => {
      const transform = container.querySelector(`[data-node-id="${id}"]`)?.getAttribute('transform')
      return transform?.match(/-?\d+/g)?.map(Number)
    }
    expect(position('start')?.[1]).toBeLessThan(position('choose')![1])
    expect(position('choose')?.[1]).toBeLessThan(position('left')![1])
    expect(position('left')?.[1]).toBe(position('right')?.[1])
    expect(position('left')?.[0]).not.toBe(position('right')?.[0])
    expect(position('left')?.[1]).toBeLessThan(position('done')![1])
    const isolated = position('isolated')
    expect(isolated).toBeDefined()
    const returnPath = (id: string) => container.querySelector(`[data-edge-id="${id}"][data-flow="return"] path`)
    expect(returnPath('right-choose')).toHaveAttribute('d', expect.stringMatching(/^M .+ C .+/))
    expect(returnPath('right-right')).toHaveAttribute('d', expect.stringMatching(/^M .+ C .+/))

    rerender(<ProcessGraph graph={graph} executions={[]} selectedNodeId="isolated" onSelectNode={vi.fn()} />)
    expect(position('isolated')).toEqual(isolated)
  })

  it('selects the same node IDs by click, Enter and Space including disconnected nodes', () => {
    const select = vi.fn()
    const {rerender} = render(<ProcessGraph graph={graph} executions={[]} selectedNodeId="start" onSelectNode={select} />)
    const start = screen.getByRole('button', {name: /开始/})
    const isolated = screen.getByRole('button', {name: /独立节点/})
    expect(start).toHaveAttribute('aria-pressed', 'true')
    expect(isolated).toHaveAttribute('tabindex', '0')
    isolated.focus()
    expect(isolated).toHaveFocus()
    fireEvent.keyDown(isolated, {key: 'Enter'})
    fireEvent.keyDown(start, {key: ' '})
    fireEvent.click(screen.getByRole('button', {name: /结束/}))
    expect(select.mock.calls).toEqual([['isolated'], ['start'], ['done']])
    expect(isolated).toHaveAttribute('aria-pressed', 'false')

    rerender(<ProcessGraph graph={graph} executions={[]} selectedNodeId="isolated" onSelectNode={select} />)
    expect(isolated).toHaveAttribute('aria-pressed', 'true')
    expect(start).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps a wide graph inside a dedicated scroll container and renders an explicit empty state', () => {
    const wideGraph = {...graph, edges: [], nodes: Array.from({length: 32}, (_, index) =>
      ({id: `node-${index}`, kind: 'HUMAN', name: `节点 ${index}`}))}
    const {container, rerender} = render(<ProcessGraph graph={wideGraph} executions={[]} onSelectNode={vi.fn()} />)
    const viewport = container.querySelector('.process-graph-canvas')
    const svg = screen.getByLabelText('流程逻辑图')
    expect(viewport).toContainElement(svg)
    expect(Number(svg.getAttribute('width'))).toBeGreaterThan(1200)
    expect(Number(svg.getAttribute('height'))).toBeGreaterThan(0)

    rerender(<ProcessGraph graph={{...graph, nodes: [], edges: []}} executions={[]} onSelectNode={vi.fn()} />)
    expect(screen.getByText('暂无流程图节点')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
