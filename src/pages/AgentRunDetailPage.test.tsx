import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter, Route, Routes} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {agentApi, type AgentResult, type AgentResultUsage} from '../api/agent'
import {AgentStreamError, observeAgentRun} from '../api/agentEvents'
import {useAuth} from '../auth/AuthContext'
import {authorization, run} from '../test/fixtures'
import AgentRunDetailPage from './AgentRunDetailPage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/agent', async original => {
  const actual = await original<typeof import('../api/agent')>()
  return {...actual, agentApi: {list: vi.fn(), start: vi.fn(), get: vi.fn(), result: vi.fn(), cancel: vi.fn()}}
})
vi.mock('../api/agentEvents', async original => {
  const actual = await original<typeof import('../api/agentEvents')>()
  return {...actual, observeAgentRun: vi.fn()}
})

const auth = (canCancel = true) => ({status: 'ready' as const, authorization: authorization(),
  allows: (key: string) => key !== 'tianji.button.runDetail.cancel' || canCancel, login: () => {},
  logout: async () => {}, retry: async () => {}})
const view = () => <MemoryRouter initialEntries={['/runs/run-1']}><Routes>
  <Route path="/runs/:runId" element={<AgentRunDetailPage />} /><Route path="/runs" element={<div>列表</div>} />
</Routes></MemoryRouter>

const terminalResult = (usage: AgentResultUsage | null = null, text = 'final answer'): AgentResult => ({
  runId: 'run-1', status: 'COMPLETED', output: {text}, errorCode: null, sideEffectOutcome: null, usage,
})

const toolHash = 'a'.repeat(64)
const hostInvocationId = 'a702401a-326d-4501-a688-6abb6dac9c8a'
const toolRef = {key: 'expense.lookup', version: 3, contentSha256: toolHash}
const reportedTool = {toolRef, hostInvocationId, state: 'UNKNOWN', dispatchEpoch: 2,
  accountingState: 'PENDING', errorCode: 'TIANJI_PRIVATE_ERROR'}
const testEvent = (sequence: number, type: string, payload: Readonly<Record<string, unknown>>,
                   occurredAt = '2026-11-05T10:20:30.123456Z') => ({
  eventId: 'evt-' + sequence, runId: 'run-1', sequence, type, author: 'private-tool-author', occurredAt, payload,
})
const streamEvents = () => {
  let receive: Parameters<typeof observeAgentRun>[0]['onEvent'] | undefined
  vi.mocked(observeAgentRun).mockImplementation(options => {
    receive = options.onEvent
    return new Promise(resolve => options.signal.addEventListener('abort', () => resolve(), {once: true}))
  })
  return async (...events: Parameters<Parameters<typeof observeAgentRun>[0]['onEvent']>[0][]) => {
    await waitFor(() => expect(receive).toBeDefined())
    await act(async () => { events.forEach(event => receive?.(event)) })
  }
}

describe('Agent run detail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue(auth())
    vi.mocked(agentApi.get).mockResolvedValue(run())
    vi.mocked(observeAgentRun).mockImplementation(({signal}) => new Promise(resolve => {
      signal.addEventListener('abort', () => resolve(), {once: true})
    }))
  })

  it('does not show a cancel action without its permission', async () => {
    vi.mocked(useAuth).mockReturnValue(auth(false))
    render(view())
    expect(await screen.findByText('research')).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '取消运行'})).not.toBeInTheDocument()
  })

  it('sends only one cancellation and shows that a running task is still stopping', async () => {
    let finish: ((value: {runId: string; accepted: boolean; status: 'RUNNING'; revision: number}) => void) | undefined
    vi.mocked(agentApi.cancel).mockImplementation(() => new Promise(resolve => {finish = resolve}))
    vi.mocked(agentApi.get).mockResolvedValueOnce(run()).mockResolvedValue({...run(), cancelRequested: true})
    render(view())
    const button = await screen.findByRole('button', {name: '取消运行'})
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(agentApi.cancel).toHaveBeenCalledTimes(1))
    await act(async () => {finish?.({runId: 'run-1', accepted: true, status: 'RUNNING', revision: 3}); await Promise.resolve()})
    expect((await screen.findAllByText(/取消请求已记录/)).length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getByRole('button', {name: /取消运行/})).toBeDisabled())
  })

  it('aborts its event subscription when the page is closed', async () => {
    let signal: AbortSignal | undefined
    vi.mocked(observeAgentRun).mockImplementation(options => {
      signal = options.signal
      return new Promise(resolve => signal?.addEventListener('abort', () => resolve(), {once: true}))
    })
    const rendered = render(view())
    await waitFor(() => expect(signal).toBeDefined())
    rendered.unmount()
    expect(signal?.aborted).toBe(true)
  })

  it('keeps the cancellation command stable after an unknown outcome', async () => {
    vi.mocked(agentApi.cancel).mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce({runId: 'run-1', accepted: true, status: 'RUNNING', revision: 3})
    render(view())
    fireEvent.click(await screen.findByRole('button', {name: '取消运行'}))
    expect(await screen.findByText(/取消结果暂时未知/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', {name: /重试取消请求/})).toBeEnabled())
    fireEvent.click(screen.getByRole('button', {name: /重试取消请求/}))
    await waitFor(() => expect(agentApi.cancel).toHaveBeenCalledTimes(2))
    expect(vi.mocked(agentApi.cancel).mock.calls[0][1]).toEqual(vi.mocked(agentApi.cancel).mock.calls[1][1])
  })

  it('preserves a confirmed cancellation if refreshing the run fails', async () => {
    vi.mocked(agentApi.cancel).mockResolvedValue({runId: 'run-1', accepted: true, status: 'RUNNING', revision: 3})
    vi.mocked(agentApi.get).mockResolvedValueOnce(run()).mockRejectedValueOnce(new Error('connection lost'))
    render(view())
    fireEvent.click(await screen.findByRole('button', {name: '取消运行'}))
    expect(await screen.findByText(/状态更新暂时不可用/)).toBeInTheDocument()
    expect(screen.getAllByText(/取消请求已记录/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', {name: /取消运行/})).toBeDisabled()
    expect(screen.queryByText(/取消结果暂时未知/)).not.toBeInTheDocument()
    expect(agentApi.cancel).toHaveBeenCalledTimes(1)
  })

  it('refreshes the snapshot when the event cursor has expired', async () => {
    vi.mocked(observeAgentRun).mockRejectedValue(new AgentStreamError('CURSOR_EXPIRED'))
    render(view())
    expect(await screen.findByText(/部分历史事件已过期/)).toBeInTheDocument()
    await waitFor(() => expect(agentApi.get).toHaveBeenCalledTimes(2))
  })

  it('shows unknown usage and fees for an existing terminal result without usage', async () => {
    vi.mocked(agentApi.get).mockResolvedValue(run('run-1', 'COMPLETED'))
    vi.mocked(agentApi.result).mockResolvedValue(terminalResult())
    render(view())
    expect(await screen.findByText('final answer')).toBeInTheDocument()
    expect(screen.getByText('用量未知')).toBeInTheDocument()
    expect(screen.getByText('费用未知')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    expect(agentApi.result).toHaveBeenCalledTimes(1)
  })

  it.each([['ACTUAL', '已报告实测'], ['ESTIMATED', '已报告估算']] as const)(
    'shows exact safe counters and a nonnumeric fee state for %s usage', async (kind, label) => {
      vi.mocked(agentApi.get).mockResolvedValue(run('run-1', 'COMPLETED'))
      vi.mocked(agentApi.result).mockResolvedValue(terminalResult({
        kind, inputTokens: 0, outputTokens: null, totalTokens: 7, costReported: true,
      }))
      render(view())
      expect(await screen.findByText(label)).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('未知')).toBeInTheDocument()
      expect(screen.getByText('7')).toBeInTheDocument()
      expect(screen.getByText('暂无可核验金额')).toBeInTheDocument()
      expect(screen.queryByText('费用未知')).not.toBeInTheDocument()
      expect(agentApi.result).toHaveBeenCalledTimes(1)
    },
  )

  it('does not request or show terminal usage while the current run is active', async () => {
    render(view())
    expect(await screen.findByText('research')).toBeInTheDocument()
    expect(screen.queryByText('用量与费用')).not.toBeInTheDocument()
    expect(agentApi.result).not.toHaveBeenCalled()
  })

  it('does not render usage or output returned by the prior tenant after a tenant change', async () => {
    let finishOld: ((result: AgentResult) => void) | undefined
    let oldSignal: AbortSignal | undefined
    vi.mocked(agentApi.get).mockResolvedValue(run('run-1', 'COMPLETED'))
    vi.mocked(agentApi.result).mockImplementationOnce((_tenant, _runId, signal) => {
      oldSignal = signal
      return new Promise(resolve => { finishOld = resolve })
    }).mockResolvedValueOnce(terminalResult(null, 'current tenant answer'))
    const rendered = render(view())
    await waitFor(() => expect(finishOld).toBeDefined())

    vi.mocked(useAuth).mockReturnValue({...auth(), authorization: authorization('21')})
    rendered.rerender(view())
    expect(await screen.findByText('current tenant answer')).toBeInTheDocument()
    expect(oldSignal?.aborted).toBe(true)
    await act(async () => { finishOld?.(terminalResult({
      kind: 'ACTUAL', inputTokens: 12345, outputTokens: 0, totalTokens: 12345, costReported: true,
    }, 'prior tenant answer')) })
    expect(screen.getByText('费用未知')).toBeInTheDocument()
    expect(screen.queryByText('prior tenant answer')).not.toBeInTheDocument()
    expect(screen.queryByText('12345')).not.toBeInTheDocument()
    expect(screen.queryByText('暂无可核验金额')).not.toBeInTheDocument()
  })

  it('shows persisted Tool event state without raw governance identifiers', async () => {
    const send = streamEvents()
    render(view())
    await send(
      testEvent(1, 'TOOL_STARTED', {toolRef, hostInvocationId, state: 'REQUESTED', dispatchEpoch: 0}),
      testEvent(2, 'TOOL_FINISHED', reportedTool),
      testEvent(3, 'TOOL_FINISHED', {toolRef, hostInvocationId, state: 'AWAITING_APPROVAL', dispatchEpoch: 0, accountingState: 'PENDING'}),
      testEvent(4, 'TOOL_FINISHED', {toolRef, hostInvocationId, state: 'SUCCEEDED', accountingState: 'SETTLED'}),
      testEvent(5, 'TOOL_FINISHED', {toolRef, hostInvocationId, state: 'UNAVAILABLE', errorCode: 'TIANJI_PRIVATE_ERROR'}),
    )
    expect(screen.getByText('已记录请求')).toBeInTheDocument()
    expect(screen.getByText('结果未知，需核对')).toBeInTheDocument()
    expect(screen.getByText('等待审批')).toBeInTheDocument()
    expect(screen.getByText('已报告成功')).toBeInTheDocument()
    expect(screen.getByText('工具结果暂不可用')).toBeInTheDocument()
    expect(screen.getAllByText('记账待确认')).toHaveLength(2)
    expect(screen.getByText('记账已结算')).toBeInTheDocument()
    expect(screen.getAllByText('expense.lookup')).toHaveLength(5)
    expect(screen.getAllByText('版本 3')).toHaveLength(5)
    expect(screen.getByText('#2 工具事件')).toBeInTheDocument()
    expect(document.querySelectorAll('time[datetime="2026-11-05T10:20:30.123456Z"]')).toHaveLength(5)
    for (const raw of [hostInvocationId, toolHash, 'dispatchEpoch', 'TIANJI_PRIVATE_ERROR', 'private-tool-author']) {
      expect(screen.queryByText(raw, {exact: false})).not.toBeInTheDocument()
    }
    expect(agentApi.result).not.toHaveBeenCalled()
  })

  it('hides malformed and unrecognized Tool payloads without a raw fallback', async () => {
    const send = streamEvents()
    render(view())
    await send(
      testEvent(1, 'TOOL_FINISHED', {...reportedTool, credential: 'never-display-secret'}),
      testEvent(2, 'TOOL_STARTED', {...reportedTool, state: 'REQUESTED'}),
      testEvent(3, 'TOOL_FINISHED', {...reportedTool, toolRef: {...toolRef, internal: 'hidden-in-ref'}}),
      testEvent(4, 'TOOL_FINISHED', {...reportedTool, state: 'AWAITING_APPROVAL'}),
      testEvent(5, 'TOOL_FINISHED', {...reportedTool, dispatchEpoch: 2.5}),
      testEvent(6, 'TOOL_PRIVATE_UNKNOWN', {secret: 'unknown-type-secret'}),
      testEvent(7, 'TOOL_FINISHED', reportedTool, '2026-11-05T10:20:30+00:00'),
    )
    expect(screen.getAllByText('工具事件详情未验证')).toHaveLength(6)
    expect(screen.getByText('工具事件时间未验证')).toBeInTheDocument()
    expect(screen.getByText('结果未知，需核对')).toBeInTheDocument()
    for (const raw of ['never-display-secret', 'hidden-in-ref', 'unknown-type-secret', 'TOOL_PRIVATE_UNKNOWN',
      hostInvocationId, toolHash, '2026-11-05T10:20:30+00:00']) {
      expect(screen.queryByText(raw, {exact: false})).not.toBeInTheDocument()
    }
  })

  it('keeps generic timeline facts and current run result independent of a malformed Tool event', async () => {
    const send = streamEvents()
    vi.mocked(agentApi.get).mockResolvedValueOnce(run()).mockResolvedValue(run('run-1', 'COMPLETED'))
    vi.mocked(agentApi.result).mockResolvedValue({...terminalResult(null, '现有执行结果'), sideEffectOutcome: 'UNKNOWN'})
    render(view())
    await send(
      testEvent(1, 'TOOL_FINISHED', {...reportedTool, rawResult: 'private raw result'}),
      {...testEvent(2, 'RUN_STATUS_CHANGED', {from: 'RUNNING', status: 'COMPLETED'}), author: null},
    )
    expect(await screen.findByText('现有执行结果')).toBeInTheDocument()
    expect(screen.getByText('#2 RUN_STATUS_CHANGED')).toBeInTheDocument()
    expect(screen.getByText(/外部操作结果待核对/)).toBeInTheDocument()
    expect(screen.getByText('工具事件详情未验证')).toBeInTheDocument()
    expect(screen.queryByText('private raw result', {exact: false})).not.toBeInTheDocument()
    expect(agentApi.result).toHaveBeenCalledTimes(1)
  })

  it('enables preference extraction only after the matching actual completed status event arrives', async () => {
    vi.mocked(agentApi.get).mockResolvedValue({...run('run-1', 'COMPLETED'), finishedAt: '2026-10-31T00:00:00Z'})
    vi.mocked(agentApi.result).mockResolvedValue(terminalResult())
    let receive: Parameters<typeof observeAgentRun>[0]['onEvent'] | undefined
    vi.mocked(observeAgentRun).mockImplementation(options => { receive = options.onEvent; return new Promise(resolve => options.signal.addEventListener('abort', () => resolve(), {once: true})) })
    render(view()); await waitFor(() => expect(receive).toBeDefined())
    expect(screen.getByRole('button', {name: '提取偏好候选'})).toBeDisabled()
    await act(async () => { receive?.({eventId: 'actual-terminal', runId: 'run-1', sequence: 1, type: 'RUN_STATUS_CHANGED', occurredAt: '2026-10-31T00:00:00Z', author: null, payload: {status: 'COMPLETED'}}) })
    expect(screen.getByRole('button', {name: '提取偏好候选'})).toBeEnabled()
  })
})
