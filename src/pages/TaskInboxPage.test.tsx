import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {humanTasksApi, type HumanTaskPage, type ListHumanTasksQuery} from '../api/humanTasks'
import {useAuth} from '../auth/AuthContext'
import {authorization} from '../test/fixtures'
import {humanTask, humanTaskPage} from '../test/humanTaskFixtures'
import TaskInboxPage from './TaskInboxPage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/humanTasks', async () => {
  const actual = await vi.importActual<typeof import('../api/humanTasks')>('../api/humanTasks')
  return {...actual, humanTasksApi: {...actual.humanTasksApi, query: vi.fn()}}
})
const READ = 'tianji.page.taskInbox', DETAIL = 'tianji.page.taskDetail', CASE = 'tianji.page.caseDetail'
type IdentityChange = Readonly<{tenant?: string; issuer?: string; subject?: string; epoch?: number}>
const auth = (change: IdentityChange = {}, denied: readonly string[] = []) => {
  const value = authorization(change.tenant ?? '20', ['TIANJI_TASK_READ', 'TIANJI_CASE_READ'])
  const issuer = change.issuer ?? value.identity.issuer, subject = change.subject ?? value.identity.subject
  return {status: 'ready' as const, authorization: {...value, identity: {...value.identity, issuer, subject},
    snapshot: {...value.snapshot, issuer, subject}, binding: {...value.binding, requestEpoch: change.epoch ?? value.binding.requestEpoch}},
  allows: (resource: string) => [READ, DETAIL, CASE].includes(resource) && !denied.includes(resource),
  login: () => {}, logout: async () => {}, retry: async () => {}}
}
let currentAuth = auth()
const view = () => <MemoryRouter><TaskInboxPage /></MemoryRouter>
const choose = async (label: string, option: string) => {
  fireEvent.mouseDown(screen.getByLabelText(label))
  fireEvent.click(await screen.findByText(option, {selector: '.ant-select-item-option-content'}))
}
const defaults: ListHumanTasksQuery = {scopeType: 'PROCESS', selection: 'ASSIGNED', releaseVersion: null, scopeId: null,
  taskDefinitionKey: null, afterTaskId: null, limit: 20}
const pageFor = (query: ListHumanTasksQuery, name = '当前可见任务'): HumanTaskPage => humanTaskPage({scopeType: query.scopeType,
  selection: query.selection, nextAfterTaskId: null, items: [humanTask({name, scopeType: query.scopeType,
    taskId: query.afterTaskId === null ? 'task-1' : `${query.afterTaskId}-next`,
    scopeId: query.scopeId ?? (query.scopeType === 'CASE' ? 'case-1' : 'process-1'), releaseVersion: query.releaseVersion ?? 'release-1',
    taskDefinitionKey: query.taskDefinitionKey ?? 'managerReview', assigned: query.selection !== 'CANDIDATE', assignedToMe: query.selection === 'ASSIGNED',
    ...(query.scopeType === 'CASE' ? {kind: 'ACTION' as const, approvalField: null, formSchema: {}} : {})})]})

describe('Current-user task inbox', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    currentAuth = auth()
    vi.mocked(useAuth).mockImplementation(() => currentAuth)
    vi.mocked(humanTasksApi.query).mockImplementation(async (_, query) => pageFor(query))
  })

  it('opens with PROCESS/ASSIGNED/20 and displays current facts and UTC time without treating a process ID as an Agent run', async () => {
    render(view())
    expect(screen.getByRole('heading', {name: '任务箱'})).toBeVisible()
    await screen.findByText('当前可见任务')
    expect(humanTasksApi.query).toHaveBeenCalledWith('20', defaults, expect.any(AbortSignal))
    expect(screen.getByText('process-1')).toBeVisible()
    expect(document.querySelector('a[href="/runs/process-1"]')).toBeNull()
    expect(screen.getByRole('link', {name: '查看任务'})).toHaveAttribute('href', '/tasks/task-1')
    const due = document.querySelector('time[datetime="2026-11-05T16:00:00.123456789+08:00"]')
    expect(due).not.toBeNull()
    expect(due).toHaveTextContent(/08:00:00.*UTC/)
  })

  it('queries both scopes and all three ordinary visibility selections through the same current-user query method', async () => {
    render(view())
    await screen.findByText('当前可见任务')
    await choose('任务范围', '案件任务')
    await waitFor(() => expect(vi.mocked(humanTasksApi.query).mock.calls.at(-1)?.[1]).toMatchObject({scopeType: 'CASE', selection: 'ASSIGNED', afterTaskId: null}))
    await choose('任务选择', '候选任务')
    await waitFor(() => expect(vi.mocked(humanTasksApi.query).mock.calls.at(-1)?.[1]).toMatchObject({scopeType: 'CASE', selection: 'CANDIDATE', afterTaskId: null}))
    await choose('任务选择', '全部可见')
    await waitFor(() => expect(vi.mocked(humanTasksApi.query).mock.calls.at(-1)?.[1]).toMatchObject({scopeType: 'CASE', selection: 'ALL', afterTaskId: null}))
    expect(screen.getByText(/当前身份.*可见/)).toBeVisible()
    expect(screen.queryByText(/管理员任务/)).not.toBeInTheDocument()
  })

  it('continues an empty page with a nonnull cursor and preserves previous-page cursor navigation', async () => {
    vi.mocked(humanTasksApi.query).mockImplementation(async (_, query) => query.afterTaskId === null
      ? humanTaskPage({scopeType: query.scopeType, selection: query.selection, items: [], nextAfterTaskId: 'task-mid'})
      : humanTaskPage({scopeType: query.scopeType, selection: query.selection, items: [humanTask({taskId: 'task-z', name: '后续可见任务'})], nextAfterTaskId: null}))
    render(view())
    await screen.findByText(/后续可能还有可见任务/)
    expect(screen.getByRole('button', {name: '下一页'})).toBeEnabled()
    fireEvent.click(screen.getByRole('button', {name: '下一页'}))
    await screen.findByText('后续可见任务')
    expect(vi.mocked(humanTasksApi.query).mock.calls.at(-1)?.[1].afterTaskId).toBe('task-mid')
    expect(screen.getByRole('button', {name: '下一页'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button', {name: '上一页'}))
    await screen.findByText(/后续可能还有可见任务/)
    expect(vi.mocked(humanTasksApi.query).mock.calls.at(-1)?.[1].afterTaskId).toBeNull()
    expect(screen.getByRole('button', {name: '上一页'})).toBeDisabled()
  })

  it('applies explicit filters and resets a later cursor on filter changes and refresh', async () => {
    vi.mocked(humanTasksApi.query).mockImplementation(async (_, query) => ({...pageFor(query), nextAfterTaskId: query.afterTaskId === null ? 'task-z' : null}))
    render(view())
    await screen.findByText('当前可见任务')
    fireEvent.click(screen.getByRole('button', {name: '下一页'}))
    await waitFor(() => expect(vi.mocked(humanTasksApi.query).mock.calls.at(-1)?.[1].afterTaskId).toBe('task-z'))
    fireEvent.change(screen.getByLabelText('发布版本'), {target: {value: 'release-2'}})
    fireEvent.change(screen.getByLabelText('范围标识'), {target: {value: 'scope-2\u00a0'}})
    fireEvent.change(screen.getByLabelText('任务定义标识'), {target: {value: 'secondaryReview'}})
    fireEvent.change(screen.getByLabelText('每页数量'), {target: {value: '10'}})
    fireEvent.click(screen.getByRole('button', {name: '查询任务'}))
    await waitFor(() => expect(vi.mocked(humanTasksApi.query).mock.calls.at(-1)?.[1]).toEqual({...defaults,
      releaseVersion: 'release-2', scopeId: 'scope-2\u00a0', taskDefinitionKey: 'secondaryReview', limit: 10}))
    fireEvent.click(screen.getByRole('button', {name: '下一页'}))
    await waitFor(() => expect(vi.mocked(humanTasksApi.query).mock.calls.at(-1)?.[1].afterTaskId).toBe('task-z'))
    fireEvent.click(screen.getByRole('button', {name: /^刷\s*新$/}))
    await waitFor(() => expect(vi.mocked(humanTasksApi.query).mock.calls.at(-1)?.[1].afterTaskId).toBeNull())
  })

  it('clears stale rows and exposes read failure instead of treating an error as an empty result', async () => {
    render(view())
    await screen.findByText('当前可见任务')
    vi.mocked(humanTasksApi.query).mockRejectedValueOnce(new Error('unavailable'))
    fireEvent.click(screen.getByRole('button', {name: /^刷\s*新$/}))
    await screen.findByText(/无法读取任务/)
    expect(screen.queryByText('当前可见任务')).not.toBeInTheDocument()
    expect(screen.getByRole('button', {name: '下一页'})).toBeDisabled()
    expect(screen.queryByRole('link', {name: '查看任务'})).not.toBeInTheDocument()
  })

  it('aborts a superseded filter read and ignores its late response in the same identity frame', async () => {
    let finish: ((value: HumanTaskPage) => void) | undefined
    vi.mocked(humanTasksApi.query).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    render(view())
    await waitFor(() => expect(finish).toBeDefined())
    const oldSignal = vi.mocked(humanTasksApi.query).mock.calls[0][2]
    fireEvent.change(screen.getByLabelText('范围标识'), {target: {value: 'current-scope'}})
    fireEvent.click(screen.getByRole('button', {name: '查询任务'}))
    await screen.findByText('当前可见任务')
    expect(oldSignal?.aborted).toBe(true)
    await act(async () => { finish?.(pageFor(defaults, '旧筛选响应')); await Promise.resolve() })
    expect(screen.queryByText('旧筛选响应')).not.toBeInTheDocument()
    expect(screen.getByText('current-scope')).toBeVisible()
  })

  it.each([
    ['tenant', {tenant: '21'}], ['issuer', {issuer: 'https://different-idp.example/tenant20'}],
    ['subject', {subject: 'other-user'}], ['epoch', {epoch: 99999}],
  ] as const)('aborts old reads and resets scope data after a %s change', async (_, change) => {
    let finish: ((value: HumanTaskPage) => void) | undefined
    vi.mocked(humanTasksApi.query).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const current = render(view())
    await waitFor(() => expect(finish).toBeDefined())
    fireEvent.change(screen.getByLabelText('范围标识'), {target: {value: 'old draft'}})
    const oldSignal = vi.mocked(humanTasksApi.query).mock.calls[0][2]
    currentAuth = auth(change)
    current.rerender(view())
    await screen.findByText('当前可见任务')
    expect(oldSignal?.aborted).toBe(true)
    expect(screen.getByLabelText('范围标识')).toHaveValue('')
    expect(vi.mocked(humanTasksApi.query).mock.calls.at(-1)?.slice(0, 2)).toEqual(['tenant' in change ? change.tenant : '20', defaults])
    await act(async () => { finish?.(pageFor(defaults, '旧身份任务')); await Promise.resolve() })
    expect(screen.queryByText('旧身份任务')).not.toBeInTheDocument()
  })

  it('hides unauthorized detail links and shows a CASE link only with its page resource', async () => {
    currentAuth = auth({}, [DETAIL, CASE])
    const current = render(view())
    await screen.findByText('当前可见任务')
    await choose('任务范围', '案件任务')
    await screen.findByText('case-1')
    expect(screen.queryByRole('link', {name: '查看任务'})).not.toBeInTheDocument()
    expect(document.querySelector('a[href="/cases/case-1"]')).toBeNull()
    currentAuth = auth()
    current.rerender(view())
    expect(screen.getByRole('link', {name: '查看任务'})).toHaveAttribute('href', '/tasks/task-1')
    expect(document.querySelector('a[href="/cases/case-1"]')).not.toBeNull()
  })

  it.each(['\u1680', 'before\0after', '\ud800'])('rejects an invalid scope filter locally (%#)', async scopeId => {
    render(view())
    await screen.findByText('当前可见任务')
    fireEvent.change(screen.getByLabelText('范围标识'), {target: {value: scopeId}})
    fireEvent.click(screen.getByRole('button', {name: '查询任务'}))
    const feedback = await screen.findByText('请输入有效的范围标识')
    await waitFor(() => expect(feedback).toBeVisible())
    expect(humanTasksApi.query).toHaveBeenCalledTimes(1)
  })

  it.each(['scope\u00a0', 'scope\ufeff', ' scope-1 '])('preserves Java-compatible scope identifiers after ASCII normalization (%#)', async input => {
    render(view())
    await screen.findByText('当前可见任务')
    fireEvent.change(screen.getByLabelText('范围标识'), {target: {value: input}})
    fireEvent.click(screen.getByRole('button', {name: '查询任务'}))
    await waitFor(() => expect(vi.mocked(humanTasksApi.query).mock.calls.at(-1)?.[1].scopeId).toBe(input === ' scope-1 ' ? 'scope-1' : input))
    expect(screen.queryByText('请输入有效的范围标识')).not.toBeInTheDocument()
  })

  it('stops reading when its current read permission disappears and ignores a late reply', async () => {
    let finish: ((value: HumanTaskPage) => void) | undefined
    vi.mocked(humanTasksApi.query).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const current = render(view())
    await waitFor(() => expect(finish).toBeDefined())
    const oldSignal = vi.mocked(humanTasksApi.query).mock.calls[0][2]
    currentAuth = auth({}, [READ])
    current.rerender(view())
    expect(oldSignal?.aborted).toBe(true)
    await act(async () => { finish?.(pageFor(defaults, '无权后到响应')); await Promise.resolve() })
    expect(screen.queryByText('无权后到响应')).not.toBeInTheDocument()
    expect(humanTasksApi.query).toHaveBeenCalledTimes(1)
  })
})
