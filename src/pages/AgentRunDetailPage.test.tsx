import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter, Route, Routes} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {agentApi} from '../api/agent'
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

  it('enables preference extraction only after the matching actual completed status event arrives', async () => {
    vi.mocked(agentApi.get).mockResolvedValue({...run('run-1', 'COMPLETED'), finishedAt: '2026-10-31T00:00:00Z'})
    vi.mocked(agentApi.result).mockResolvedValue({runId: 'run-1', status: 'COMPLETED', output: {}, errorCode: null, sideEffectOutcome: null})
    let receive: Parameters<typeof observeAgentRun>[0]['onEvent'] | undefined
    vi.mocked(observeAgentRun).mockImplementation(options => { receive = options.onEvent; return new Promise(resolve => options.signal.addEventListener('abort', () => resolve(), {once: true})) })
    render(view()); await waitFor(() => expect(receive).toBeDefined())
    expect(screen.getByRole('button', {name: '提取偏好候选'})).toBeDisabled()
    await act(async () => { receive?.({eventId: 'actual-terminal', runId: 'run-1', sequence: 1, type: 'RUN_STATUS_CHANGED', occurredAt: '2026-10-31T00:00:00Z', author: null, payload: {status: 'COMPLETED'}}) })
    expect(screen.getByRole('button', {name: '提取偏好候选'})).toBeEnabled()
  })
})
