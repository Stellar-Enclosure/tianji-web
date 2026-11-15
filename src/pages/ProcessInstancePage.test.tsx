import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {useAuth} from '../auth/AuthContext'
import {gatewayAuth} from '../auth/gatewayAuth'
import {authorization} from '../test/fixtures'
import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import type {Authorization} from '../auth/AuthContext'
import type {AutomationInstanceDTO, CancelProcessCommand, CancelProcessResult, NodeExecutionDTO, ProcessControlSnapshotDTO} from '../api/processAutomation'
import type {ProcessGraphProps} from '../components/process/ProcessGraph'
import type {ProcessNodeExecutionPanelProps} from './ProcessNodeExecutionPanel'
import {processAutomationApi} from '../api/processAutomation'
import ProcessInstancePage from './ProcessInstancePage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/processAutomation', async () => {
  const actual = await vi.importActual<typeof import('../api/processAutomation')>('../api/processAutomation')
  return {...actual, processAutomationApi: {
    ...actual.processAutomationApi, get: vi.fn(), getControl: vi.fn(), cancel: vi.fn(),
  }}
})
vi.mock('../api/processEvents', async () => {
  const actual = await vi.importActual<typeof import('../api/processEvents')>('../api/processEvents')
  return {...actual, processEventsApi: {...actual.processEventsApi, getReceipt: vi.fn()}}
})
vi.mock('../components/process/ProcessGraph', () => ({
  ProcessGraph: ({graph, selectedNodeId, onSelectNode}: ProcessGraphProps) =>
    <div aria-label="流程逻辑图">
      {graph.nodes.map(node => <button key={node.id} type="button" aria-pressed={selectedNodeId === node.id}
        onClick={() => onSelectNode(node.id)}>{node.name}</button>)}
    </div>,
}))
vi.mock('../components/process/ProcessGraphList', () => ({
  ProcessGraphList: ({graph, selectedNodeId, onSelectNode}: ProcessGraphProps) =>
    <div aria-label="流程节点列表">
      {graph.nodes.map(node => <button key={node.id} type="button" aria-pressed={selectedNodeId === node.id}
        onClick={() => onSelectNode(node.id)}>{node.name}</button>)}
    </div>,
}))
vi.mock('./ProcessNodeExecutionPanel', () => ({
  ProcessNodeExecutionPanel: ({instanceId, nodeId, stale, onRowsChange, onSelectionChange, onUserSelection,
    onReceiptSelect}: ProcessNodeExecutionPanelProps) => {
    const row: NodeExecutionDTO = {
      nodeId: 'start', occurrenceId: 'occ-1', attempt: 1, nodeExecutionRef: 'node-exec-1', kind: 'EVENT_WAIT',
      state: 'WAITING', inputSha256: 'a'.repeat(64), outputSchemaSha256: 'b'.repeat(64),
      startedAt: '2026-11-14T10:00:00Z', finishedAt: null, deadlineAt: '2026-11-14T11:00:00Z',
      errorCode: null, sideEffectOutcome: 'NONE', agentRunId: null, output: null,
      eventReceiptIds: ['event-receipt-1'], version: 'node-version', availableActions: [],
    }
    return <section aria-label="节点执行面板" data-instance-id={instanceId} data-node-id={nodeId}>
      <span data-testid="node-panel-stale">{String(!!stale)}</span>
      <button type="button" onClick={() => { onRowsChange([row]); onSelectionChange?.(row) }}>
        选择带事件回执的节点
      </button>
      <button type="button" onClick={() => { onRowsChange([row]); onSelectionChange?.(row); onUserSelection?.(row) }}>
        选择节点轮次
      </button>
      <button type="button" onClick={() => onReceiptSelect?.('event-receipt-1')}>查看关联事件</button>
    </section>
  },
}))
vi.mock('./ProcessEventReceiptPanel', () => ({
  ProcessEventReceiptPanel: ({instanceId, receiptId}: {instanceId: string; receiptId?: string}) =>
    receiptId ? <section aria-label="事件回执面板" data-instance-id={instanceId}>{receiptId}</section> : null,
}))

const INSTANCE_PAGE = 'tianji.page.processInstance'
const CANCEL = 'tianji.button.processInstance.cancel'
const INSTANCE_ID = 'pi-1'
const TIME = '2026-11-14T10:30:00.123456Z'
const graph = {
  definitionKey: 'orderFlow',
  nodes: [{id: 'start', kind: 'START', name: '开始'}, {id: 'end', kind: 'END', name: '结束'}],
  edges: [{id: 'to-end', source: 'start', target: 'end', label: null}],
}
const instance: AutomationInstanceDTO = {
  instanceId: INSTANCE_ID, definitionKey: 'orderFlow', releaseVersion: 'auto-7', activationRevision: 4,
  profile: 'AUTOMATION_V2', businessKey: 'order-8', correlationId: 'order-event-8', state: 'ACTIVE',
  version: '1'.repeat(64), configurationSha256: '2'.repeat(64), submittedAt: TIME, finishedAt: null,
  output: null, availableActions: ['CANCEL'], graph,
}
const control: ProcessControlSnapshotDTO = {
  process: {
    instanceId: INSTANCE_ID, definitionKey: 'orderFlow', releaseVersion: 'auto-7',
    businessKey: 'order-8', correlationId: 'order-event-8', status: 'ACTIVE',
    submittedAt: TIME, finishedAt: null,
  },
  activeWaits: [{activityKey: 'waitForSignal', kind: 'TIMER', occurrences: 1}],
  allowedActions: ['CANCEL'], cancellationBlockReason: 'NONE',
  version: '3'.repeat(64), observedAt: TIME,
}
const canceled: CancelProcessResult = {
  instanceId: INSTANCE_ID, commandId: 'cancel-1', accepted: true, status: 'CANCELLED',
  resultingVersion: '4'.repeat(64), finishedAt: TIME, decidedAt: TIME, linkedAgentClosureScheduled: true,
}
let currentAuth: Authorization
let currentAllowed: readonly string[]
const instanceGet = vi.mocked(processAutomationApi.get)
const controlGet = vi.mocked(processAutomationApi.getControl)
const cancel = vi.mocked(processAutomationApi.cancel)

const auth = (allowed: readonly string[] = [INSTANCE_PAGE, CANCEL],
  permissions: readonly string[] = ['TIANJI_PROCESS_READ', 'TIANJI_PROCESS_CANCEL', 'TIANJI_PROCESS_DATA_READ']): Authorization => {
  const frame = authorization('20', [...permissions])
  currentAllowed = allowed
  return {...frame, binding: {...frame.binding, requestEpoch: frame.binding.requestEpoch},
    snapshot: {...frame.snapshot, permissionCodes: [...permissions]}}
}

function RouteAddress() {
  const location = useLocation()
  return <output aria-label="当前地址">{location.pathname + location.search}</output>
}

function Harness({path = `/process-instances/${INSTANCE_ID}`}: {path?: string}) {
  return <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/process-instances/:instanceId" element={<ProcessInstancePage />} />
    </Routes>
    <RouteAddress />
  </MemoryRouter>
}

describe('Process instance page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    gatewayAuth.context.invalidate()
    currentAuth = auth()
    vi.mocked(useAuth).mockImplementation(() => ({
      status: 'ready', authorization: currentAuth,
      allows: (resource: string) => currentAllowed.includes(resource),
      login: () => {}, logout: async () => {}, retry: async () => {},
    }))
    instanceGet.mockResolvedValue(instance)
    controlGet.mockResolvedValue(control)
    cancel.mockImplementation(async (_tenant, _instanceId, command) => ({...canceled, commandId: command.commandId}))
  })

  it('loads the fixed v2 instance projection and draws its safe graph without reading releases', async () => {
    render(<Harness />)
    expect(await screen.findByText('auto-7')).toBeInTheDocument()
    expect(screen.getByText('orderFlow')).toBeInTheDocument()
    expect(screen.getByLabelText('流程逻辑图')).toBeInTheDocument()
    expect(screen.getByLabelText('流程节点列表')).toBeInTheDocument()
    expect(instanceGet).toHaveBeenCalledWith('20', INSTANCE_ID, expect.any(AbortSignal))
    expect(controlGet).not.toHaveBeenCalled()
    expect(screen.getByText('运行中')).toBeInTheDocument()
  })

  it('separates an absent data permission from an empty output', async () => {
    currentAuth = auth([INSTANCE_PAGE], ['TIANJI_PROCESS_OBSERVE'])
    instanceGet.mockResolvedValueOnce({...instance, output: {internal: 'sensitive'}})
    render(<Harness />)
    expect(await screen.findByText('auto-7')).toBeInTheDocument()
    expect(screen.getByText('无数据读取权限')).toBeInTheDocument()
    expect(screen.queryByText('sensitive')).not.toBeInTheDocument()
  })

  it('marks expired instance data stale and disables cancellation after a failed refresh', async () => {
    instanceGet.mockResolvedValueOnce({...instance, output: {internal: 'sensitive'}})
      .mockRejectedValueOnce({status: 503})
    render(<Harness />)
    expect(await screen.findByText('auto-7')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '刷新实例'}))
    expect(await screen.findByText(/实例观察已过期/)).toBeInTheDocument()
    expect(screen.queryByText('sensitive')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '取消流程实例'})).not.toBeInTheDocument()
    expect(screen.getByTestId('node-panel-stale')).toHaveTextContent('true')
  })

  it('clears untrusted visible data when the instance permission is missing', () => {
    currentAuth = auth([], ['TIANJI_PROCESS_CANCEL'])
    render(<Harness />)
    expect(screen.getByText('当前身份不能观察该流程实例。')).toBeInTheDocument()
    expect(instanceGet).not.toHaveBeenCalled()
  })

  it('hides unknown instances without exposing request details', async () => {
    instanceGet.mockRejectedValueOnce(new ApiError('not found', 404, 'TIANJI_RESOURCE_NOT_FOUND'))
    render(<Harness />)
    expect(await screen.findByText('当前无法观察该流程实例。')).toBeInTheDocument()
    expect(screen.queryByText('order-8')).not.toBeInTheDocument()
  })

  it('discards a slow instance reply after an authorization epoch change', async () => {
    let finishOld!: (value: AutomationInstanceDTO) => void
    instanceGet.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve }))
      .mockResolvedValueOnce({...instance, businessKey: 'new-scope'})
    const rendered = render(<Harness />)
    await waitFor(() => expect(instanceGet).toHaveBeenCalledTimes(1))
    const oldSignal = instanceGet.mock.calls[0]?.[2]
    gatewayAuth.context.invalidate()
    const next = auth()
    currentAuth = {...next,
      identity: {...next.identity, subject: 'subject-next'},
      snapshot: {...next.snapshot, subject: 'subject-next'},
      binding: {...next.binding, subject: 'subject-next'}}
    rendered.rerender(<Harness />)
    expect(oldSignal?.aborted).toBe(true)
    expect(await screen.findByText('new-scope')).toBeInTheDocument()
    finishOld({...instance, businessKey: 'old-scope'})
    expect(screen.queryByText('old-scope')).not.toBeInTheDocument()
  })

  it('uses the V1 control version after the user opens cancellation confirmation', async () => {
    render(<Harness />)
    expect(await screen.findByText('auto-7')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '取消流程实例'}))
    expect(await screen.findByText(/waitForSignal/)).toBeInTheDocument()
    expect(controlGet).toHaveBeenCalledWith('20', INSTANCE_ID, expect.any(AbortSignal))
    fireEvent.change(screen.getByLabelText('取消原因'), {target: {value: '停止本次运行'}})
    fireEvent.click(screen.getByRole('button', {name: '确认取消'}))
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1))
    const body = cancel.mock.calls[0]?.[2] as CancelProcessCommand
    expect(body).toMatchObject({
      instanceId: INSTANCE_ID, expectedVersion: control.version, reason: '停止本次运行',
    })
    expect(body.expectedVersion).not.toBe(instance.version)
    expect(body.commandId).toMatch(/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/)
    expect(await screen.findByText('关联 Agent 的关闭请求已安排，停止状态仍需单独观察。')).toBeInTheDocument()
    instanceGet.mockResolvedValueOnce({...instance, state: 'CANCELLED', finishedAt: TIME, availableActions: []})
    fireEvent.click(screen.getByRole('button', {name: '刷新实例'}))
    expect(await screen.findByText('已取消')).toBeInTheDocument()
  })

  it('does not cancel when V1 control says that cancellation is blocked', async () => {
    controlGet.mockResolvedValueOnce({...control, allowedActions: [], cancellationBlockReason: 'MODEL_CONTAINS_CASE_SOURCE'})
    render(<Harness />)
    expect(await screen.findByText('auto-7')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '取消流程实例'}))
    expect(await screen.findByText(/模型包含不支持本次取消的 Case 来源/)).toBeInTheDocument()
    expect(screen.getByRole('button', {name: '确认取消'})).toBeDisabled()
    expect(cancel).not.toHaveBeenCalled()
  })

  it('keeps cancellation disabled until a valid user reason is entered', async () => {
    render(<Harness />)
    expect(await screen.findByText('auto-7')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '取消流程实例'}))
    await waitFor(() => expect(screen.getByLabelText('取消原因')).toBeInTheDocument())
    expect(screen.getByRole('button', {name: '确认取消'})).toBeDisabled()
    expect(cancel).not.toHaveBeenCalled()
  })

  it('keeps an uncertain cancellation attached to its original command and body', async () => {
    cancel.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(canceled)
    render(<Harness />)
    expect(await screen.findByText('auto-7')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '取消流程实例'}))
    expect(await screen.findByText(/waitForSignal/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('取消原因'), {target: {value: '操作超时'}})
    fireEvent.click(screen.getByRole('button', {name: '确认取消'}))
    expect(await screen.findByText('取消结果尚未确认')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '重试原取消请求'}))
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(2))
    expect(cancel.mock.calls[1]?.[2]).toEqual(cancel.mock.calls[0]?.[2])
    expect(cancel.mock.calls[1]?.[0]).toBe(cancel.mock.calls[0]?.[0])
  })

  it('persists the exact cancel intent before sending and recovers only by replaying that command', async () => {
    const seenIntent = vi.fn()
    cancel.mockImplementationOnce(async (tenant, instanceId, command) => {
      expect(tenant).toBe('20')
      expect(instanceId).toBe(INSTANCE_ID)
      seenIntent(sessionStorage.getItem('tianji.process-instance-cancel.v1:20:pi-1'))
      expect(command.instanceId).toBe(INSTANCE_ID)
      throw new TypeError('Failed to fetch')
    }).mockImplementationOnce(async (tenant, instanceId, command) => {
      expect(tenant).toBe('20')
      expect(instanceId).toBe(INSTANCE_ID)
      return {...canceled, commandId: command.commandId}
    })
    const first = render(<Harness />)
    expect(await screen.findByText('auto-7')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', {name: '取消流程实例'})).toBeEnabled())
    fireEvent.click(screen.getByRole('button', {name: '取消流程实例'}))
    expect(await screen.findByText(/waitForSignal/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('取消原因'), {target: {value: '再次核对'}})
    fireEvent.click(screen.getByRole('button', {name: '确认取消'}))
    expect(await screen.findByText('取消结果尚未确认')).toBeInTheDocument()
    const persisted = sessionStorage.getItem('tianji.process-instance-cancel.v1:20:pi-1')
    expect(persisted).not.toBeNull()
    expect(JSON.parse(persisted!)).toMatchObject({
      version: 1, operation: 'PROCESS_CANCEL', tenantId: '20', instanceId: INSTANCE_ID,
      command: {instanceId: INSTANCE_ID, expectedVersion: control.version, reason: '再次核对'},
    })
    expect(seenIntent).toHaveBeenCalledWith(persisted)
    const originalBody = cancel.mock.calls[0]?.[2]
    first.unmount()

    render(<Harness />)
    expect(await screen.findByText('取消结果尚未确认')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '重试原取消请求'}))
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(2))
    expect(cancel.mock.calls[1]?.[2]).toEqual(originalBody)
    expect(await screen.findByText('关联 Agent 的关闭请求已安排，停止状态仍需单独观察。')).toBeInTheDocument()
    expect(sessionStorage.getItem('tianji.process-instance-cancel.v1:20:pi-1')).toBeNull()
  })

  it('requires the selected node row to own the requested event receipt', async () => {
    const first = render(<Harness path={`/process-instances/${INSTANCE_ID}?nodeId=start`} />)
    expect(await screen.findByText('auto-7')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '选择节点轮次'}))
    expect(screen.getByLabelText('当前地址')).toHaveTextContent('?nodeId=start&occurrenceId=occ-1&attempt=1')
    fireEvent.click(screen.getByRole('button', {name: '查看关联事件'}))
    expect(await screen.findByLabelText('事件回执面板')).toHaveTextContent('event-receipt-1')
    first.unmount()

    const invalid = render(<Harness path={`/process-instances/${INSTANCE_ID}?nodeId=start&occurrenceId=occ-1&attempt=1&receiptId=unrelated`} />)
    expect(await screen.findByText('auto-7')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '选择带事件回执的节点'}))
    expect(screen.queryByLabelText('事件回执面板')).not.toBeInTheDocument()
    invalid.unmount()
  })
})
