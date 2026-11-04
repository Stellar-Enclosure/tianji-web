import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {MemoryRouter, Route, Routes} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {humanTasksApi, type HumanTask, type HumanTaskAction, type HumanTaskActionReceipt} from '../api/humanTasks'
import {useAuth} from '../auth/AuthContext'
import {authorization} from '../test/fixtures'
import {humanTask, humanTaskReceipt} from '../test/humanTaskFixtures'
import TaskDetailPage from './TaskDetailPage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/humanTasks', async () => {
  const actual = await vi.importActual<typeof import('../api/humanTasks')>('../api/humanTasks')
  return {...actual, humanTasksApi: {...actual.humanTasksApi, get: vi.fn(), claim: vi.fn(), unclaim: vi.fn(), transfer: vi.fn(), complete: vi.fn()}}
})
const READ = 'tianji.page.taskDetail', CLAIM = 'tianji.button.taskDetail.claim', UNCLAIM = 'tianji.button.taskDetail.unclaim'
const TRANSFER = 'tianji.button.taskDetail.transfer', COMPLETE = 'tianji.button.taskDetail.complete', CASE = 'tianji.page.caseDetail'
type IdentityChange = Readonly<{tenant?: string; issuer?: string; subject?: string; epoch?: number}>
const auth = (change: IdentityChange = {}, denied: readonly string[] = []) => {
  const value = authorization(change.tenant ?? '20', ['TIANJI_TASK_READ', 'TIANJI_TASK_CLAIM', 'TIANJI_TASK_TRANSFER', 'TIANJI_TASK_COMPLETE'])
  const issuer = change.issuer ?? value.identity.issuer, subject = change.subject ?? value.identity.subject
  return {status: 'ready' as const, authorization: {...value, identity: {...value.identity, issuer, subject}, snapshot: {...value.snapshot, issuer, subject},
    binding: {...value.binding, requestEpoch: change.epoch ?? value.binding.requestEpoch}},
  allows: (resource: string) => [READ, CLAIM, UNCLAIM, TRANSFER, COMPLETE, CASE].includes(resource) && !denied.includes(resource),
  login: () => {}, logout: async () => {}, retry: async () => {}}
}
let currentAuth = auth()
const view = (taskId = 'task-1') => <MemoryRouter><Routes location={`/tasks/${taskId}`}>
  <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
</Routes></MemoryRouter>
const choose = async (label: string | RegExp, option: string) => {
  fireEvent.mouseDown(screen.getByLabelText(label))
  fireEvent.click(await screen.findByText(option, {selector: '.ant-select-item-option-content'}))
}
const confirm = async () => {
  const button = await screen.findByRole('button', {name: '确认提交'})
  fireEvent.click(button)
}
const proposeComplete = async (decision = '拒绝') => {
  await choose(/approved/, decision)
  fireEvent.change(screen.getByLabelText('comment'), {target: {value: '人工审阅'}})
  fireEvent.change(screen.getByLabelText('amount'), {target: {value: '7'}})
  fireEvent.click(screen.getByRole('button', {name: '提交处理结果'}))
  await screen.findByRole('button', {name: '确认提交'})
}
const actionReceipt = (action: HumanTaskAction, commandId: string, source: HumanTask, overrides: Partial<HumanTaskActionReceipt> = {}): HumanTaskActionReceipt =>
  humanTaskReceipt(action, {commandId, taskId: source.taskId, scopeType: source.scopeType, scopeId: source.scopeId,
    releaseVersion: source.releaseVersion, definitionKey: source.definitionKey, taskDefinitionKey: source.taskDefinitionKey,
    kind: source.kind, lane: source.lane, previousVersion: source.version, approvalReceiptId: action === 'COMPLETE' && source.kind === 'APPROVAL' ? 'approval-1' : null,
    approved: action === 'COMPLETE' && source.kind === 'APPROVAL' ? false : null, ...overrides})
const unavailable = (name: string) => {
  const button = screen.queryByRole('button', {name})
  if (button) expect(button).toBeDisabled()
}

describe('Current-user task detail and approval', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    currentAuth = auth()
    vi.mocked(useAuth).mockImplementation(() => currentAuth)
    vi.mocked(humanTasksApi.get).mockResolvedValue(humanTask())
    vi.mocked(humanTasksApi.claim).mockImplementation(async (_, command, source) => actionReceipt('CLAIM', command.commandId, source))
    vi.mocked(humanTasksApi.unclaim).mockImplementation(async (_, command, source) => actionReceipt('UNCLAIM', command.commandId, source))
    vi.mocked(humanTasksApi.transfer).mockImplementation(async (_, command, source) => actionReceipt('TRANSFER', command.commandId, source, {lane: command.targetLane}))
    vi.mocked(humanTasksApi.complete).mockImplementation(async (_, command, source) => actionReceipt('COMPLETE', command.commandId, source,
      {approved: source.kind === 'APPROVAL' && source.approvalField !== null ? command.form[source.approvalField] as boolean : null}))
  })

  it('reads a current task with UTC source time and never infers terminal state from an old due date', async () => {
    vi.mocked(humanTasksApi.get).mockResolvedValue(humanTask({dueAt: '2000-01-01T08:00:00+08:00'}))
    render(view())
    await screen.findByText('费用审批')
    expect(humanTasksApi.get).toHaveBeenCalledWith('20', {taskId: 'task-1'}, expect.any(AbortSignal))
    expect(screen.getByText('process-1')).toBeVisible()
    expect(document.querySelector('a[href="/runs/process-1"]')).toBeNull()
    expect(document.querySelector('time[datetime="2026-11-04T08:00:00.123456789Z"]')).toHaveTextContent(/UTC/)
    expect(document.querySelector('time[datetime="2000-01-01T08:00:00+08:00"]')).toHaveTextContent(/00:00:00.*UTC/)
    expect(screen.getByRole('button', {name: '提交处理结果'})).toBeEnabled()
    expect(screen.queryByText(/已超时|已完成|已取消/)).not.toBeInTheDocument()
    expect(screen.getByText(/申请人.*审批|申请.*审批.*分离/)).toBeVisible()
  })

  it('requires confirmation to claim an unassigned task with its opaque version and re-reads after acceptance', async () => {
    const source = humanTask({assigned: false, assignedToMe: false})
    vi.mocked(humanTasksApi.get).mockResolvedValueOnce(source).mockResolvedValue(humanTask({version: 'b'.repeat(64)}))
    render(view())
    await screen.findByText('费用审批')
    fireEvent.click(screen.getByRole('button', {name: '认领任务'}))
    expect(humanTasksApi.claim).not.toHaveBeenCalled()
    await confirm()
    await waitFor(() => expect(humanTasksApi.get).toHaveBeenCalledTimes(2))
    expect(humanTasksApi.claim).toHaveBeenCalledWith('20', {commandId: expect.any(String), taskId: 'task-1', expectedVersion: 'a'.repeat(64)},
      source, expect.any(AbortSignal))
    expect(screen.getByText(/操作已接受/)).toBeVisible()
    expect(screen.getByRole('button', {name: '归还任务'})).toBeEnabled()
  })

  it('returns only an assigned-to-me task and submits no caller-provided assignee or role identity', async () => {
    const source = humanTask()
    vi.mocked(humanTasksApi.get).mockResolvedValueOnce(source).mockResolvedValue(humanTask({assigned: false, assignedToMe: false, version: 'b'.repeat(64)}))
    render(view())
    await screen.findByText('费用审批')
    fireEvent.click(screen.getByRole('button', {name: '归还任务'}))
    await confirm()
    await waitFor(() => expect(humanTasksApi.unclaim).toHaveBeenCalledTimes(1))
    expect(Object.keys(vi.mocked(humanTasksApi.unclaim).mock.calls[0][1]).sort()).toEqual(['commandId', 'expectedVersion', 'taskId'])
    expect(vi.mocked(humanTasksApi.unclaim).mock.calls[0][2]).toEqual(source)
  })

  it.each([
    ['unassigned', {assigned: false, assignedToMe: false, suspended: false}],
    ['assigned to someone else', {assigned: true, assignedToMe: false, suspended: false}],
    ['suspended', {assigned: true, assignedToMe: true, suspended: true}],
  ] as const)('guards actions using %s facts without inventing an assignee identity', async (_, flags) => {
    vi.mocked(humanTasksApi.get).mockResolvedValue(humanTask(flags))
    render(view())
    await screen.findByText('费用审批')
    if (flags.assigned || flags.suspended) unavailable('认领任务')
    if (!flags.assignedToMe || flags.suspended) {
      unavailable('归还任务')
      unavailable('提交处理结果')
    }
    if (flags.suspended) unavailable('转交任务')
    expect(screen.queryByLabelText(/受让人|用户标识|角色标识/)).not.toBeInTheDocument()
    expect(humanTasksApi.claim).not.toHaveBeenCalled()
    expect(humanTasksApi.complete).not.toHaveBeenCalled()
  })

  it('offers only released target lanes and passes the original source when transferring', async () => {
    const source = humanTask()
    vi.mocked(humanTasksApi.get).mockResolvedValue(source)
    render(view())
    await screen.findByText('费用审批')
    await choose('目标队列', 'manager')
    fireEvent.click(screen.getByRole('button', {name: '转交任务'}))
    expect(humanTasksApi.transfer).not.toHaveBeenCalled()
    await confirm()
    await waitFor(() => expect(humanTasksApi.transfer).toHaveBeenCalledTimes(1))
    expect(humanTasksApi.transfer).toHaveBeenCalledWith('20', {commandId: expect.any(String), taskId: 'task-1', expectedVersion: source.version, targetLane: 'manager'},
      source, expect.any(AbortSignal))
    expect(screen.queryByLabelText(/受让人|用户标识|角色标识/)).not.toBeInTheDocument()
  })

  it('confirms an explicit rejection and submits only current schema keys with boolean false', async () => {
    render(view())
    await screen.findByText('费用审批')
    await proposeComplete()
    expect(screen.getByRole('dialog')).toHaveTextContent(/拒绝/)
    expect(humanTasksApi.complete).not.toHaveBeenCalled()
    await confirm()
    await waitFor(() => expect(humanTasksApi.complete).toHaveBeenCalledTimes(1))
    const [, command, source] = vi.mocked(humanTasksApi.complete).mock.calls[0]
    expect(command).toEqual({commandId: expect.any(String), taskId: source.taskId, expectedVersion: source.version,
      form: {approved: false, comment: '人工审阅', amount: 7}})
    expect(Object.keys(command.form).sort()).toEqual(['amount', 'approved', 'comment'])
  })

  it('completes an ACTION with an empty released form rather than adding an approval decision', async () => {
    const source = humanTask({kind: 'ACTION', approvalField: null, formSchema: {}})
    vi.mocked(humanTasksApi.get).mockResolvedValue(source)
    render(view())
    await screen.findByText('费用审批')
    expect(screen.queryByLabelText(/approved/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '提交处理结果'}))
    await confirm()
    await waitFor(() => expect(humanTasksApi.complete).toHaveBeenCalledTimes(1))
    expect(vi.mocked(humanTasksApi.complete).mock.calls[0][1].form).toEqual({})
  })

  it('prevents double confirmation while one mutation is in flight', async () => {
    let finish: ((value: HumanTaskActionReceipt) => void) | undefined
    vi.mocked(humanTasksApi.complete).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    render(view())
    await screen.findByText('费用审批')
    await proposeComplete()
    const button = screen.getByRole('button', {name: '确认提交'})
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(finish).toBeDefined())
    expect(humanTasksApi.complete).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', {name: /^刷\s*新$/})).toBeDisabled()
    const [, command, source] = vi.mocked(humanTasksApi.complete).mock.calls[0]
    await act(async () => { finish?.(actionReceipt('COMPLETE', command.commandId, source)); await Promise.resolve() })
    await screen.findByText(/操作已接受/)
  })

  it.each([
    ['408', () => new ApiError('timeout', 408, 'REQUEST_TIMEOUT')],
    ['429', () => new ApiError('capacity', 429, 'TIANJI_CAPACITY_EXCEEDED')],
    ['503', () => new ApiError('unavailable', 503, 'TIANJI_DEPENDENCY_UNAVAILABLE')],
    ['network', () => new Error('connection lost')],
    ['invalid success', () => new Error('服务返回的任务数据无效')],
  ] as const)('freezes all related controls after %s and manually reuses the exact original command and source', async (_, failure) => {
    vi.mocked(humanTasksApi.complete).mockRejectedValueOnce(failure())
    render(view())
    await screen.findByText('费用审批')
    await proposeComplete()
    await confirm()
    await screen.findByText(/结果暂时未知/)
    expect(humanTasksApi.complete).toHaveBeenCalledTimes(1)
    expect(humanTasksApi.get).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText(/approved/)).toBeDisabled()
    expect(screen.getByLabelText('comment')).toBeDisabled()
    expect(screen.getByLabelText('amount')).toBeDisabled()
    expect(screen.getByLabelText('目标队列')).toBeDisabled()
    expect(screen.getByRole('button', {name: /^刷\s*新$/})).toBeDisabled()
    unavailable('提交处理结果')
    unavailable('归还任务')
    unavailable('转交任务')
    const [, firstCommand, firstSource] = vi.mocked(humanTasksApi.complete).mock.calls[0]
    fireEvent.click(screen.getByRole('button', {name: '重试原请求'}))
    await waitFor(() => expect(humanTasksApi.complete).toHaveBeenCalledTimes(2))
    const [, retriedCommand, retriedSource] = vi.mocked(humanTasksApi.complete).mock.calls[1]
    expect(retriedCommand).toBe(firstCommand)
    expect(retriedSource).toBe(firstSource)
    expect(retriedCommand).toEqual({commandId: firstCommand.commandId, taskId: 'task-1', expectedVersion: 'a'.repeat(64),
      form: {approved: false, comment: '人工审阅', amount: 7}})
  })

  it.each([400, 401, 403, 404, 409])('clears a definitively rejected %i command and old writable facts until a fresh read', async status => {
    vi.mocked(humanTasksApi.complete).mockRejectedValueOnce(new ApiError('rejected', status, status === 409 ? 'TIANJI_IDEMPOTENCY_CONFLICT' : 'TIANJI_PERMISSION_DENIED'))
    render(view())
    await screen.findByText('费用审批')
    await proposeComplete()
    await confirm()
    await screen.findByText(/重新读取|重新查询|重新验证/)
    expect(screen.queryByRole('button', {name: '重试原请求'})).not.toBeInTheDocument()
    expect(screen.queryByLabelText('comment')).not.toBeInTheDocument()
    unavailable('提交处理结果')
    expect(humanTasksApi.complete).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', {name: /^刷\s*新$/}))
    await screen.findByLabelText('comment')
    expect(humanTasksApi.get).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('comment')).toHaveValue('')
  })

  it('keeps an accepted receipt distinct from unavailable current state and never re-sends the successful command', async () => {
    vi.mocked(humanTasksApi.get).mockResolvedValueOnce(humanTask()).mockRejectedValueOnce(new ApiError('not found', 404, 'TIANJI_RESOURCE_NOT_FOUND'))
    render(view())
    await screen.findByText('费用审批')
    await proposeComplete()
    await confirm()
    await screen.findByText(/操作已接受/)
    await screen.findByText(/当前不可见|入口尚未启用|当前状态暂不可用/)
    expect(screen.queryByLabelText('comment')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '重试原请求'})).not.toBeInTheDocument()
    expect(screen.queryByText(/该任务已完成|任务已超时|任务已取消/)).not.toBeInTheDocument()
    expect(humanTasksApi.complete).toHaveBeenCalledTimes(1)
    expect(humanTasksApi.get).toHaveBeenCalledTimes(2)
  })

  it('clears editable facts before a successor read resolves after acceptance', async () => {
    let finish: ((value: HumanTask) => void) | undefined
    vi.mocked(humanTasksApi.get).mockResolvedValueOnce(humanTask()).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    render(view())
    await screen.findByText('费用审批')
    await proposeComplete()
    await confirm()
    await waitFor(() => expect(finish).toBeDefined())
    expect(screen.queryByLabelText('comment')).not.toBeInTheDocument()
    unavailable('归还任务')
    unavailable('提交处理结果')
    await act(async () => { finish?.(humanTask({version: 'b'.repeat(64), formSchema: {approved: 'BOOLEAN', newField: 'STRING'}})); await Promise.resolve() })
    expect(await screen.findByLabelText('newField')).toHaveValue('')
    expect(screen.queryByLabelText('comment')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/approved/)).toHaveValue('')
  })

  it('requires current action permission again at confirmation and at an unknown retry', async () => {
    const current = render(view())
    await screen.findByText('费用审批')
    await proposeComplete()
    currentAuth = auth({}, [COMPLETE])
    current.rerender(view())
    fireEvent.click(screen.getByRole('button', {name: '确认提交'}))
    expect(humanTasksApi.complete).not.toHaveBeenCalled()
    currentAuth = auth()
    current.rerender(view())
    vi.mocked(humanTasksApi.complete).mockRejectedValueOnce(new ApiError('unknown', 408, 'REQUEST_TIMEOUT'))
    await confirm()
    await screen.findByText(/结果暂时未知/)
    currentAuth = auth({}, [COMPLETE])
    current.rerender(view())
    const retry = screen.queryByRole('button', {name: '重试原请求'})
    if (retry) fireEvent.click(retry)
    expect(humanTasksApi.complete).toHaveBeenCalledTimes(1)
  })

  it('hides action controls independently from readable task facts', async () => {
    currentAuth = auth({}, [CLAIM, UNCLAIM, TRANSFER, COMPLETE])
    render(view())
    await screen.findByText('费用审批')
    for (const name of ['认领任务', '归还任务', '转交任务', '提交处理结果']) expect(screen.queryByRole('button', {name})).not.toBeInTheDocument()
    expect(screen.queryByLabelText('目标队列')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('comment')).not.toBeInTheDocument()
  })

  it('resets a form draft on a new version and schema even when the task ID stays the same', async () => {
    vi.mocked(humanTasksApi.get).mockResolvedValueOnce(humanTask()).mockResolvedValue(humanTask({version: 'b'.repeat(64),
      formSchema: {approved: 'BOOLEAN', replacement: 'STRING'}}))
    render(view())
    await screen.findByText('费用审批')
    fireEvent.change(screen.getByLabelText('comment'), {target: {value: 'old draft'}})
    await choose(/approved/, '批准')
    fireEvent.click(screen.getByRole('button', {name: /^刷\s*新$/}))
    expect(await screen.findByLabelText('replacement')).toHaveValue('')
    expect(screen.queryByLabelText('comment')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/approved/)).toHaveValue('')
  })

  it.each([
    ['tenant', {tenant: '21'}], ['issuer', {issuer: 'https://other-idp.example/tenant20'}],
    ['subject', {subject: 'other-user'}], ['epoch', {epoch: 99999}],
  ] as const)('aborts an old read and ignores its late response after a %s change', async (_, change) => {
    let finish: ((value: HumanTask) => void) | undefined
    vi.mocked(humanTasksApi.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const current = render(view())
    await waitFor(() => expect(finish).toBeDefined())
    const oldSignal = vi.mocked(humanTasksApi.get).mock.calls[0][2]
    currentAuth = auth(change)
    current.rerender(view())
    await screen.findByText('费用审批')
    expect(oldSignal?.aborted).toBe(true)
    await act(async () => { finish?.(humanTask({name: '旧身份后到任务'})); await Promise.resolve() })
    expect(screen.queryByText('旧身份后到任务')).not.toBeInTheDocument()
    expect(screen.getByLabelText('comment')).toHaveValue('')
  })

  it.each([
    ['tenant', {tenant: '21'}], ['issuer', {issuer: 'https://other-idp.example/tenant20'}],
    ['subject', {subject: 'other-user'}], ['epoch', {epoch: 99999}],
  ] as const)('aborts an old write and never projects its receipt or pending form after a %s change', async (_, change) => {
    let finish: ((value: HumanTaskActionReceipt) => void) | undefined
    vi.mocked(humanTasksApi.complete).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const current = render(view())
    await screen.findByText('费用审批')
    await proposeComplete()
    await confirm()
    await waitFor(() => expect(finish).toBeDefined())
    const [, command, source, signal] = vi.mocked(humanTasksApi.complete).mock.calls[0]
    currentAuth = auth(change)
    current.rerender(view())
    await screen.findByLabelText('comment')
    expect(signal?.aborted).toBe(true)
    expect(screen.getByLabelText('comment')).toHaveValue('')
    expect(screen.queryByRole('button', {name: '确认提交'})).not.toBeInTheDocument()
    await act(async () => { finish?.(actionReceipt('COMPLETE', command.commandId, source)); await Promise.resolve() })
    expect(screen.queryByText(/操作已接受/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '重试原请求'})).not.toBeInTheDocument()
  })

  it('aborts the previous task read and clears drafts when the route task ID changes', async () => {
    let finish: ((value: HumanTask) => void) | undefined
    vi.mocked(humanTasksApi.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockResolvedValue(humanTask({taskId: 'task-2', name: '第二项任务'}))
    const current = render(view())
    await waitFor(() => expect(finish).toBeDefined())
    const signal = vi.mocked(humanTasksApi.get).mock.calls[0][2]
    current.rerender(view('task-2'))
    await screen.findByText('第二项任务')
    expect(signal?.aborted).toBe(true)
    expect(vi.mocked(humanTasksApi.get).mock.calls.at(-1)?.[1]).toEqual({taskId: 'task-2'})
    await act(async () => { finish?.(humanTask({name: '旧路由任务'})); await Promise.resolve() })
    expect(screen.queryByText('旧路由任务')).not.toBeInTheDocument()
  })

  it('aborts a pending operation when read permission is removed and ignores the old receipt', async () => {
    let finish: ((value: HumanTaskActionReceipt) => void) | undefined
    vi.mocked(humanTasksApi.complete).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const current = render(view())
    await screen.findByText('费用审批')
    await proposeComplete()
    await confirm()
    await waitFor(() => expect(finish).toBeDefined())
    const [, command, source, signal] = vi.mocked(humanTasksApi.complete).mock.calls[0]
    currentAuth = auth({}, [READ])
    current.rerender(view())
    expect(signal?.aborted).toBe(true)
    expect(screen.queryByLabelText('comment')).not.toBeInTheDocument()
    await act(async () => { finish?.(actionReceipt('COMPLETE', command.commandId, source)); await Promise.resolve() })
    expect(screen.queryByText(/操作已接受/)).not.toBeInTheDocument()
    expect(humanTasksApi.get).toHaveBeenCalledTimes(1)
  })

  it('links a CASE scope only when the independent Case page resource is allowed', async () => {
    vi.mocked(humanTasksApi.get).mockResolvedValue(humanTask({scopeType: 'CASE', scopeId: 'case-1', kind: 'ACTION', approvalField: null, formSchema: {}}))
    currentAuth = auth({}, [CASE])
    const current = render(view())
    await screen.findByText('费用审批')
    expect(document.querySelector('a[href="/cases/case-1"]')).toBeNull()
    currentAuth = auth()
    current.rerender(view())
    expect(document.querySelector('a[href="/cases/case-1"]')).not.toBeNull()
  })
})
