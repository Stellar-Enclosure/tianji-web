import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Link, MemoryRouter, Route, Routes} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {casesApi, type ActOnPlanItemCommand, type CaseInstance, type CaseOperationResult} from '../api/cases'
import {useAuth} from '../auth/AuthContext'
import {authorization} from '../test/fixtures'
import {caseInstance, caseOperationResult, casePlanItem} from '../test/caseFixtures'
import CaseDetailPage from './CaseDetailPage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/cases', async () => {
  const actual = await vi.importActual<typeof import('../api/cases')>('../api/cases')
  return {...actual, casesApi: {...actual.casesApi, get: vi.fn(), actPlanItem: vi.fn()}}
})

const LOOKUP = 'tianji.page.cases', DETAIL = 'tianji.page.caseDetail', ACT = 'tianji.button.caseDetail.actPlanItem'
type IdentityChange = Readonly<{tenant?: string; issuer?: string; subject?: string; epoch?: number}>
const auth = (change: IdentityChange = {}, denied: readonly string[] = []) => {
  const value = authorization(change.tenant ?? '20', ['TIANJI_CASE_READ', 'TIANJI_CASE_PLAN_ITEM_ACT'])
  const issuer = change.issuer ?? value.identity.issuer, subject = change.subject ?? value.identity.subject
  return {status: 'ready' as const, authorization: {...value, identity: {...value.identity, issuer, subject},
    snapshot: {...value.snapshot, issuer, subject}, binding: {...value.binding, requestEpoch: change.epoch ?? value.binding.requestEpoch}},
  allows: (resource: string) => [LOOKUP, DETAIL, ACT].includes(resource) && !denied.includes(resource),
  login: () => {}, logout: async () => {}, retry: async () => {}}
}
let currentAuth = auth()
const view = (path = '/cases/case-1') => <MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/cases" element={<CaseDetailPage />} />
  <Route path="/cases/:caseInstanceId" element={<CaseDetailPage />} />
</Routes></MemoryRouter>
const switchView = () => <MemoryRouter initialEntries={['/cases/case-1']}><Link to="/cases/case-2">切换案件</Link><Routes>
  <Route path="/cases/:caseInstanceId" element={<CaseDetailPage />} />
</Routes></MemoryRouter>
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline })
  return {promise, resolve, reject}
}
const activeFor = (action: 'START' | 'TERMINATE' = 'START'): CaseInstance => caseInstance({planItems: [casePlanItem({
  state: action === 'START' ? 'ENABLED' : 'ACTIVE', availableActions: [action],
})]})
const resultFor = (command: ActOnPlanItemCommand, source: CaseInstance): CaseOperationResult => {
  const item = source.planItems.find(value => value.planItemInstanceId === command.planItemInstanceId)!
  return caseOperationResult(command, {planItemDefinitionKey: item.planItemDefinitionKey, releaseVersion: source.releaseVersion,
    definitionKey: source.definitionKey, previousState: item.state})
}
const confirmAction = async (label: string) => {
  fireEvent.click(screen.getByRole('button', {name: label}))
  fireEvent.click(await screen.findByRole('button', {name: '确认执行'}))
}

describe('Current-user formal Case detail', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    currentAuth = auth()
    vi.mocked(useAuth).mockImplementation(() => currentAuth)
    vi.mocked(casesApi.get).mockResolvedValue(caseInstance())
    vi.mocked(casesApi.actPlanItem).mockImplementation(async (_, command, source) => resultFor(command, source))
  })

  it('validates an exact Case ID locally and navigates from lookup without inventing list, start, or history calls', async () => {
    vi.mocked(casesApi.get).mockResolvedValueOnce(caseInstance({caseInstanceId: 'case\u00a0'}))
    render(view('/cases'))
    expect(await screen.findByRole('heading', {name: '案件查询'})).toBeInTheDocument()
    expect(casesApi.get).not.toHaveBeenCalled()
    const input = screen.getByLabelText('案件标识')
    fireEvent.change(input, {target: {value: ' case-1'}})
    fireEvent.click(screen.getByRole('button', {name: '查询案件'}))
    expect(await screen.findByText('请输入有效案件标识')).toBeInTheDocument()
    expect(casesApi.get).not.toHaveBeenCalled()
    fireEvent.change(input, {target: {value: 'case\u00a0'}})
    fireEvent.click(screen.getByRole('button', {name: '查询案件'}))
    await screen.findByText(/\bexpense-1\b/)
    expect(casesApi.get).toHaveBeenCalledWith('20', {caseInstanceId: 'case\u00a0'}, expect.any(AbortSignal))
    expect(Object.keys(casesApi).sort()).toEqual(['actPlanItem', 'get'])
  })

  it('shows only current server facts, raw UTC instants, and the exact server action subset', async () => {
    const current = caseInstance({planItems: [
      casePlanItem({availableActions: ['START']}),
      casePlanItem({planItemInstanceId: 'supplemental-1', planItemDefinitionKey: 'supplementalTask', state: 'DISABLED',
        version: 'd'.repeat(64), availableActions: ['ENABLE']}),
      casePlanItem({planItemInstanceId: 'optional-1', planItemDefinitionKey: 'optionalReview', state: 'ENABLED',
        version: '0'.repeat(64), availableActions: ['DISABLE']}),
      casePlanItem({planItemInstanceId: 'terminate-1', planItemDefinitionKey: 'activeReview', state: 'ACTIVE',
        version: 'e'.repeat(64), availableActions: ['TERMINATE']}),
      casePlanItem({planItemInstanceId: 'milestone-1', planItemDefinitionKey: 'acceptedMilestone', kind: 'MILESTONE',
        state: 'AVAILABLE', version: 'f'.repeat(64), availableActions: []}),
    ]})
    vi.mocked(casesApi.get).mockResolvedValue(current)
    render(view())
    await screen.findByText(/\bexpense-1\b/)
    expect(screen.getByText('案件已提交')).toBeInTheDocument()
    expect(screen.getByText('案件当前进行中')).toBeInTheDocument()
    expect(document.querySelector('time[datetime="2026-11-04T08:00:00.123456789Z"]')).toHaveTextContent(/UTC/)
    expect(screen.getByText(/当前接口不提供完整案件历史/)).toBeInTheDocument()
    const primary = screen.getByText('primaryTask').closest('tr')!
    expect(within(primary).getByText('启动计划项').closest('button')).toBeEnabled()
    expect(within(primary).queryByText('停用计划项')).not.toBeInTheDocument()
    expect(within(screen.getByText('supplementalTask').closest('tr')!).getByText('启用计划项').closest('button')).toBeEnabled()
    expect(within(screen.getByText('optionalReview').closest('tr')!).getByText('停用计划项').closest('button')).toBeEnabled()
    expect(within(screen.getByText('activeReview').closest('tr')!).getByText('终止计划项').closest('button')).toBeEnabled()
    expect(screen.getByText('acceptedMilestone').closest('tr')!.querySelector('button')).toBeNull()
    expect(screen.queryByText(/完成计划项|终止案件/)).not.toBeInTheDocument()
  })

  it('renders sparse and empty terminal snapshots without actions or invented plan-item history', async () => {
    const terminal = caseInstance({status: 'COMPLETED', finishedAt: '2026-11-04T08:30:00.000000001Z',
      planItems: [casePlanItem({state: 'AVAILABLE', availableActions: []})]})
    vi.mocked(casesApi.get).mockResolvedValueOnce(terminal).mockResolvedValueOnce(caseInstance({caseInstanceId: 'case-empty', status: 'TERMINATED',
      finishedAt: '2026-11-04T08:31:00Z', planItems: []}))
    const rendered = render(view())
    await screen.findByText('案件已结束（COMPLETED）')
    expect(document.querySelector('time[datetime="2026-11-04T08:30:00.000000001Z"]')).toHaveTextContent(/UTC/)
    expect(screen.queryByRole('button', {name: /计划项/})).not.toBeInTheDocument()
    expect(screen.queryByText(/计划项发生时间/)).not.toBeInTheDocument()
    rendered.unmount()
    render(view('/cases/case-empty'))
    await screen.findByText('案件已结束（TERMINATED）')
    expect(screen.getByText('暂无当前计划项')).toBeInTheDocument()
  })

  it('intersects server actions with the current write permission and disables an unsent proposal when permission is removed', async () => {
    vi.mocked(casesApi.get).mockResolvedValue(activeFor('START'))
    currentAuth = auth({}, [ACT])
    const rendered = render(view())
    await screen.findByText('primaryTask')
    expect(screen.queryByRole('button', {name: '启动计划项'})).not.toBeInTheDocument()
    currentAuth = auth()
    rendered.rerender(view())
    fireEvent.click(await screen.findByRole('button', {name: '启动计划项'}))
    expect(await screen.findByRole('button', {name: '确认执行'})).toBeInTheDocument()
    currentAuth = auth({}, [ACT])
    rendered.rerender(view())
    expect(await screen.findByRole('button', {name: '确认执行'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button', {name: '确认执行'}))
    expect(casesApi.actPlanItem).not.toHaveBeenCalled()
  })

  it('confirms plan-item termination without claiming whole-Case rollback, then separates receipt from fresh terminal facts', async () => {
    const current = activeFor('TERMINATE')
    const terminal = caseInstance({status: 'COMPLETED', finishedAt: '2026-11-04T08:30:00Z', planItems: []})
    vi.mocked(casesApi.get).mockResolvedValueOnce(current).mockResolvedValueOnce(terminal)
    render(view())
    await screen.findByText('primaryTask')
    fireEvent.click(screen.getByRole('button', {name: '终止计划项'}))
    expect(casesApi.actPlanItem).not.toHaveBeenCalled()
    expect(await screen.findByText(/只终止所选计划项，不表示终止整个案件或完成流程/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '确认执行'}))
    expect(await screen.findByText('本次操作已接受')).toBeInTheDocument()
    expect(screen.getByText(/本页操作回执.*不是完整历史或最新状态/)).toBeInTheDocument()
    expect(await screen.findByText('案件已结束（COMPLETED）')).toBeInTheDocument()
    expect(casesApi.get).toHaveBeenCalledTimes(2)
    expect(casesApi.actPlanItem).toHaveBeenCalledTimes(1)
    const [, sent, captured, signal] = vi.mocked(casesApi.actPlanItem).mock.calls[0]
    expect(sent).toEqual(expect.objectContaining({caseInstanceId: 'case-1', planItemInstanceId: 'primary-1',
      expectedVersion: current.planItems[0].version, action: 'TERMINATE', commandId: expect.any(String)}))
    expect(Object.isFrozen(sent)).toBe(true)
    expect(Object.isFrozen(captured)).toBe(true)
    expect(Object.isFrozen(captured.planItems)).toBe(true)
    expect(Object.isFrozen(captured.planItems[0].availableActions)).toBe(true)
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(screen.queryByRole('button', {name: /计划项/})).not.toBeInTheDocument()
  })

  it('retains an accepted receipt when the following current-state read fails and never resends the write', async () => {
    const current = activeFor('START')
    vi.mocked(casesApi.get).mockResolvedValueOnce(current).mockRejectedValueOnce(new Error('read unavailable'))
    render(view())
    await screen.findByText('primaryTask')
    await confirmAction('启动计划项')
    expect(await screen.findByText('本次操作已接受')).toBeInTheDocument()
    expect(await screen.findByText(/操作已接受，当前状态暂不可用/)).toBeInTheDocument()
    expect(screen.queryByText('primaryTask')).not.toBeInTheDocument()
    expect(casesApi.actPlanItem).toHaveBeenCalledTimes(1)
    expect(casesApi.get).toHaveBeenCalledTimes(2)
  })

  it('clears stale writable facts after a definitive conflict and requires a fresh read', async () => {
    vi.mocked(casesApi.get).mockResolvedValue(activeFor('START'))
    vi.mocked(casesApi.actPlanItem).mockRejectedValueOnce(new ApiError('changed', 409, 'TIANJI_IDEMPOTENCY_CONFLICT'))
    render(view())
    await screen.findByText('primaryTask')
    await confirmAction('启动计划项')
    expect(await screen.findByText(/案件、计划项或当前权限已变化/)).toBeInTheDocument()
    expect(screen.queryByText('primaryTask')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '重试原请求'})).not.toBeInTheDocument()
    expect(casesApi.get).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', {name: '刷新当前状态'}))
    await screen.findByText('primaryTask')
    expect(casesApi.get).toHaveBeenCalledTimes(2)
  })

  it('reports a hidden or changed Case on 404 without claiming that it completed', async () => {
    vi.mocked(casesApi.get).mockRejectedValueOnce(new ApiError('hidden', 404, 'TIANJI_RESOURCE_NOT_FOUND'))
    render(view())
    expect(await screen.findByText(/该案件当前不可见、状态已变化或入口尚未启用/)).toBeInTheDocument()
    expect(screen.queryByText(/案件已结束|COMPLETED|TERMINATED/)).not.toBeInTheDocument()
    expect(screen.queryByText('本次操作已接受')).not.toBeInTheDocument()
  })

  it.each([
    ['408', new ApiError('timeout', 408, 'REQUEST_TIMEOUT')],
    ['429', new ApiError('capacity', 429, 'TIANJI_CAPACITY_EXCEEDED')],
    ['5xx', new ApiError('unavailable', 503, 'TIANJI_DEPENDENCY_UNAVAILABLE')],
    ['network-or-invalid-success', new Error('reply lost or malformed')],
  ])('freezes the frame after an unknown %s outcome and retries the exact command and source only on click', async (_, failure) => {
    const current = activeFor('START')
    vi.mocked(casesApi.get).mockResolvedValue(current)
    vi.mocked(casesApi.actPlanItem).mockRejectedValueOnce(failure).mockImplementationOnce(async (tenant, command, source, signal) => {
      void tenant; void signal
      return resultFor(command, source)
    })
    render(view())
    await screen.findByText('primaryTask')
    await confirmAction('启动计划项')
    expect(await screen.findByText(/操作结果暂时未知/)).toBeInTheDocument()
    expect(casesApi.actPlanItem).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('案件标识')).toBeDisabled()
    expect(screen.getByRole('button', {name: '刷新当前状态'})).toBeDisabled()
    await act(async () => { await Promise.resolve() })
    expect(casesApi.actPlanItem).toHaveBeenCalledTimes(1)
    const first = vi.mocked(casesApi.actPlanItem).mock.calls[0]
    fireEvent.click(screen.getByRole('button', {name: '重试原请求'}))
    expect(await screen.findByText('本次操作已接受')).toBeInTheDocument()
    const second = vi.mocked(casesApi.actPlanItem).mock.calls[1]
    expect(second[1]).toBe(first[1])
    expect(second[2]).toBe(first[2])
    expect(second[0]).toBe(first[0])
  })

  it('keeps an unknown command across act-permission changes and retries it only after permission returns', async () => {
    const current = activeFor('START')
    vi.mocked(casesApi.get).mockResolvedValue(current)
    vi.mocked(casesApi.actPlanItem).mockRejectedValueOnce(new ApiError('unavailable', 503, 'TIANJI_DEPENDENCY_UNAVAILABLE'))
      .mockImplementationOnce(async (_, command, source) => resultFor(command, source))
    const rendered = render(view())
    await screen.findByText('primaryTask')
    await confirmAction('启动计划项')
    expect(await screen.findByText(/操作结果暂时未知/)).toBeInTheDocument()
    const first = vi.mocked(casesApi.actPlanItem).mock.calls[0]
    currentAuth = auth({}, [ACT])
    rendered.rerender(view())
    const disabled = await screen.findByRole('button', {name: '重试原请求'})
    expect(disabled).toBeDisabled()
    fireEvent.click(disabled)
    expect(casesApi.actPlanItem).toHaveBeenCalledTimes(1)
    currentAuth = auth()
    rendered.rerender(view())
    const retry = await screen.findByRole('button', {name: '重试原请求'})
    expect(retry).toBeEnabled()
    fireEvent.click(retry)
    expect(await screen.findByText('本次操作已接受')).toBeInTheDocument()
    const second = vi.mocked(casesApi.actPlanItem).mock.calls[1]
    expect(second[1]).toBe(first[1])
    expect(second[2]).toBe(first[2])
  })

  it.each([
    ['tenant', {tenant: '21'}], ['issuer', {issuer: 'https://other.example/issuer'}], ['subject', {subject: 'other-subject'}], ['epoch', {epoch: 99}],
  ] as const)('aborts and ignores a late read after a %s frame change', async (_, change) => {
    const pending = deferred<CaseInstance>()
    const fresh = caseInstance({businessKey: 'expense-new'})
    vi.mocked(casesApi.get).mockImplementationOnce(() => pending.promise).mockResolvedValueOnce(fresh)
    const rendered = render(view())
    await waitFor(() => expect(casesApi.get).toHaveBeenCalledTimes(1))
    const oldSignal = vi.mocked(casesApi.get).mock.calls[0][2]
    currentAuth = auth(change)
    rendered.rerender(view())
    await waitFor(() => expect(casesApi.get).toHaveBeenCalledTimes(2))
    expect(oldSignal?.aborted).toBe(true)
    await act(async () => { pending.resolve(caseInstance({businessKey: 'expense-old'})); await Promise.resolve() })
    expect(await screen.findByText(/\bexpense-new\b/)).toBeInTheDocument()
    expect(screen.queryByText(/expense-old/)).not.toBeInTheDocument()
  })

  it('aborts a late read on route change and never projects the old Case into the new route', async () => {
    const pending = deferred<CaseInstance>()
    vi.mocked(casesApi.get).mockImplementationOnce(() => pending.promise)
      .mockResolvedValueOnce(caseInstance({caseInstanceId: 'case-2', businessKey: 'expense-2'}))
    render(switchView())
    await waitFor(() => expect(casesApi.get).toHaveBeenCalledTimes(1))
    const oldSignal = vi.mocked(casesApi.get).mock.calls[0][2]
    fireEvent.click(screen.getByRole('link', {name: '切换案件'}))
    await waitFor(() => expect(casesApi.get).toHaveBeenCalledTimes(2))
    expect(oldSignal?.aborted).toBe(true)
    await act(async () => { pending.resolve(caseInstance({businessKey: 'expense-old'})); await Promise.resolve() })
    expect(await screen.findByText(/\bexpense-2\b/)).toBeInTheDocument()
    expect(screen.queryByText(/expense-old/)).not.toBeInTheDocument()
  })

  it('aborts and ignores a late write after identity changes', async () => {
    const pending = deferred<CaseOperationResult>()
    const current = activeFor('START')
    vi.mocked(casesApi.get).mockResolvedValue(current)
    vi.mocked(casesApi.actPlanItem).mockImplementationOnce(() => pending.promise)
    const rendered = render(view())
    await screen.findByText('primaryTask')
    await confirmAction('启动计划项')
    await waitFor(() => expect(casesApi.actPlanItem).toHaveBeenCalledTimes(1))
    const call = vi.mocked(casesApi.actPlanItem).mock.calls[0]
    currentAuth = auth({subject: 'other-subject'})
    rendered.rerender(view())
    expect(call[3]?.aborted).toBe(true)
    await act(async () => { pending.resolve(resultFor(call[1], call[2])); await Promise.resolve() })
    expect(screen.queryByText('本次操作已接受')).not.toBeInTheDocument()
  })

  it('aborts and ignores a pending write when the route read permission is revoked', async () => {
    const pending = deferred<CaseOperationResult>()
    vi.mocked(casesApi.get).mockResolvedValue(activeFor('START'))
    vi.mocked(casesApi.actPlanItem).mockImplementationOnce(() => pending.promise)
    const rendered = render(view())
    await screen.findByText('primaryTask')
    await confirmAction('启动计划项')
    await waitFor(() => expect(casesApi.actPlanItem).toHaveBeenCalledTimes(1))
    const call = vi.mocked(casesApi.actPlanItem).mock.calls[0]
    currentAuth = auth({}, [DETAIL])
    rendered.rerender(view())
    await waitFor(() => expect(call[3]?.aborted).toBe(true))
    await act(async () => { pending.resolve(resultFor(call[1], call[2])); await Promise.resolve() })
    expect(screen.getByText('当前身份不能访问此案件。')).toBeInTheDocument()
    expect(screen.queryByText('本次操作已接受')).not.toBeInTheDocument()
  })

  it('cancels the queued initial load when unmounted synchronously', async () => {
    const rendered = render(view())
    rendered.unmount()
    await act(async () => { await Promise.resolve() })
    expect(casesApi.get).not.toHaveBeenCalled()
  })
})
