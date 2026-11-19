import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import type {EnterpriseLayoutConfig} from '@stellar-enclosure/stellar-enclosure-web-shared'
import type {ReactNode} from 'react'
import {Link} from 'react-router-dom'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import App, {createConsoleRouter} from './App'
import {processDraftsApi} from './api/processDrafts'
import {useAuth} from './auth/AuthContext'
import {gatewayAuth} from './auth/gatewayAuth'
import {messages} from './permissions/messages'
import {references} from './permissions/references'
import {resourceRegistry} from './permissions/registry'
import {resources} from './permissions/resources'
import {authorization} from './test/fixtures'

const {enterAuth} = vi.hoisted(() => ({enterAuth: vi.fn()}))
vi.mock('./auth/AuthContext', () => ({
  AuthProvider: ({children}: {children: ReactNode}) => { enterAuth(); return children },
  useAuth: vi.fn(),
}))
vi.mock('@stellar-enclosure/stellar-enclosure-web-shared', async original => {
  const actual = await original<typeof import('@stellar-enclosure/stellar-enclosure-web-shared')>()
  return {...actual, EnterpriseLayout: ({config, children}: {config: EnterpriseLayoutConfig; children: ReactNode}) =>
    <main><nav aria-label="主导航">{config.navigation?.map(item => item.path
      && <Link key={item.key} to={item.path}>{item.label}</Link>)}</nav>{children}</main>}
})
vi.mock('./pages/AgentRunsPage', () => ({default: () => <h1>运行记录</h1>}))
vi.mock('./pages/AgentRunDetailPage', () => ({default: () => <h1>运行详情</h1>}))
vi.mock('./pages/CaseDetailPage', () => ({default: () => <h1>案件查询</h1>}))
vi.mock('./pages/WorkerFailuresPage', () => ({default: () => <h1>Worker 失败观察</h1>}))
vi.mock('./pages/DefinitionReleasePage', () => ({default: () => <h1>流程发布元数据</h1>}))
vi.mock('./pages/ExecutionTimelinePage', () => ({default: () => <h1>流程关联查询</h1>}))
vi.mock('./pages/ProcessInstancePage', () => ({default: () => <h1>流程实例</h1>}))

const publish = 'TIANJI_PROCESS_RELEASE_PUBLISH'
const releaseRead = 'TIANJI_PROCESS_RELEASE_READ'
const processRead = 'TIANJI_PROCESS_READ'
const observe = 'TIANJI_PROCESS_OBSERVE'
const agentRead = 'TIANJI_AGENT_READ'
const caseRead = 'TIANJI_CASE_READ'
const routers: ReturnType<typeof createConsoleRouter>[] = []

beforeEach(() => {
  vi.clearAllMocks()
  gatewayAuth.context.invalidate()
  window.history.replaceState(null, '', '/')
  sessionStorage.clear()
  vi.spyOn(processDraftsApi, 'list').mockResolvedValue({items: [], nextCursor: null, observedAt: '2026-11-12T08:00:00Z'})
})

afterEach(() => {
  for (const router of routers.splice(0)) router.dispose()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

const auth = (codes: string[]) => {
  const current = authorization('20', codes)
  const allows = (key: string) => resourceRegistry.canAccessResource(key, current.snapshot, current.binding)
  return {status: allows('tianji.app.console') ? 'ready' as const : 'forbidden' as const, authorization: current,
    allows,
    login: vi.fn(), logout: async () => {}, retry: async () => {}}
}
const open = (path: string, codes: string[], ready = false) => {
  window.history.replaceState(null, '', path)
  const current = auth(codes)
  vi.mocked(useAuth).mockReturnValue(ready ? {...current, status: 'ready'} : current)
  const router = createConsoleRouter()
  routers.push(router)
  return {router, ...render(<App router={router} />)}
}

it.each([['/auth/oidc/callback/test', false], ['/auth/oidc/popup/test', true]] as const)(
  'processes the PUBLIC callback %s before starting the protected console', async (path, popup) => {
    const complete = vi.spyOn(gatewayAuth, 'completeCallback').mockResolvedValueOnce(undefined)
    open(path, [])
    expect(await screen.findByText('授权已返回')).toBeInTheDocument()
    expect(complete).toHaveBeenCalledWith(expect.stringContaining(path), popup)
    expect(enterAuth).not.toHaveBeenCalled()
  })

describe('Console entry and Process route ownership', () => {
  it.each([
    [[publish], '/process-definitions', '流程设计'],
    [[releaseRead], '/operations/process-releases', '流程发布元数据'],
    [[processRead], '/operations/process-correlations', '流程关联查询'],
    [[observe], '/process-instances', '流程实例查找'],
    [[publish, releaseRead, processRead, observe, agentRead, caseRead], '/process-definitions', '流程设计'],
    [[releaseRead, processRead, observe, agentRead, caseRead], '/operations/process-releases', '流程发布元数据'],
    [[processRead, observe, agentRead, caseRead], '/operations/process-correlations', '流程关联查询'],
    [[observe, agentRead, caseRead], '/process-instances', '流程实例查找'],
    [[agentRead, caseRead], '/runs', '运行记录'],
    [[caseRead], '/cases', '案件查询'],
  ] as const)('lands on the first allowed page for %j', async (codes, route, heading) => {
    expect(auth([...codes]).allows('tianji.app.console')).toBe(true)
    open('/', [...codes])
    expect(await screen.findByRole('heading', {name: heading})).toBeInTheDocument()
    expect(window.location.pathname).toBe(route)
  })

  it.each([
    'TIANJI_PROCESS_RELEASE_ACTIVATE', 'TIANJI_PROCESS_DATA_READ', 'TIANJI_PROCESS_DIAGNOSTIC_READ',
    'TIANJI_PROCESS_NODE_RETRY', 'TIANJI_PROCESS_START', 'TIANJI_PROCESS_CANCEL',
  ])('denies APP when %s is the only permission', async code => {
    expect(auth([code]).allows('tianji.app.console')).toBe(false)
    open('/process-instances/pi-private', [code])
    expect(await screen.findByText('没有访问权限')).toBeInTheDocument()
    expect(screen.queryByRole('heading', {name: '流程实例'})).not.toBeInTheDocument()
  })

  it.each([
    ['/process-definitions', observe],
    ['/process-definitions/new', observe],
    ['/process-definitions/drafts/pd-private', observe],
    ['/process-instances', publish],
    ['/process-instances/pi-private', publish],
  ])('applies PAGE authorization to the direct route %s', async (route, code) => {
    const readDraft = vi.spyOn(processDraftsApi, 'get')
    open(route, [code])
    expect(await screen.findByText('当前身份不能访问此页面。')).toBeInTheDocument()
    expect(readDraft).not.toHaveBeenCalled()
    expect(processDraftsApi.list).not.toHaveBeenCalled()
  })

  it.each([processRead, observe])('opens the instance lookup and detail as %s', async code => {
    open('/process-instances', [code])
    const input = await screen.findByRole('textbox', {name: '流程实例标识'})
    fireEvent.change(input, {target: {value: 'pi-1'}})
    fireEvent.click(screen.getByRole('button', {name: '查询实例'}))
    expect(await screen.findByRole('heading', {name: '流程实例'})).toBeInTheDocument()
    expect(window.location.pathname).toBe('/process-instances/pi-1')
  })

  it('opens the owned creation route', async () => {
    open('/process-definitions/new', [publish])
    expect(await screen.findByRole('heading', {name: '新建草稿'})).toBeInTheDocument()
    expect(window.location.pathname).toBe('/process-definitions/new')
  })

  it('orders Process menus before compatibility pages and omits retired workflow menus', async () => {
    open('/', [publish, releaseRead, processRead, observe, agentRead, caseRead])
    expect(await screen.findByRole('heading', {name: '流程设计'})).toBeInTheDocument()
    const menu = within(screen.getByRole('navigation', {name: '主导航'}))
    expect(menu.getAllByRole('link').map(link => link.textContent)).toEqual([
      '流程设计', '流程发布元数据', '流程关联查询', '流程实例查找', '运行记录', '案件查询',
    ])
  })

  it.each(['/tasks', '/tasks/task-private-42', '/memory'])('shows only the direct legacy handoff for %s', async path => {
    const request = vi.spyOn(globalThis, 'fetch')
    open(path, [agentRead])
    expect(await screen.findByText('此能力由业务平台提供')).toBeInTheDocument()
    expect(screen.queryByText(/task-private-42|subject-20/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(enterAuth).not.toHaveBeenCalled()
    expect(useAuth).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
    expect(processDraftsApi.list).not.toHaveBeenCalled()
  })

  it.each(['/tasks/task-1/notes', '/memory/results', '/tasks-other'])('does not treat %s as a legacy bookmark', async path => {
    open(path, [agentRead])
    expect(await screen.findByText('页面不存在')).toBeInTheDocument()
    expect(enterAuth).toHaveBeenCalled()
    expect(screen.queryByText('此能力由业务平台提供')).not.toBeInTheDocument()
  })

  it('recognizes a direct legacy bookmark beneath the configured basename', async () => {
    vi.stubEnv('VITE_BASE_PATH', '/console')
    open('/console/tasks/private-id', [agentRead])
    expect(await screen.findByText('此能力由业务平台提供')).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: '返回控制台'})).not.toBeInTheDocument()
    expect(enterAuth).not.toHaveBeenCalled()
  })

  it('offers console return only from an in-app handoff with current APP authorization', async () => {
    const view = open('/runs', [agentRead])
    expect(await screen.findByRole('heading', {name: '运行记录'})).toBeInTheDocument()
    await act(async () => { await view.router.navigate('/tasks/task-private-42') })
    expect(await screen.findByText('此能力由业务平台提供')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: '返回控制台'})).toHaveAttribute('href', '/')
    expect(screen.queryByText(/task-private-42|subject-20/)).not.toBeInTheDocument()

    vi.mocked(useAuth).mockReturnValue(auth(['TIANJI_PROCESS_NODE_RETRY']))
    await act(async () => { await view.router.navigate('/tasks/task-private-42?view=handoff', {replace: true}) })
    expect(screen.queryByRole('link', {name: '返回控制台'})).not.toBeInTheDocument()
    expect(screen.getByText('此能力由业务平台提供')).toBeInTheDocument()
  })

  it('keeps a dirty draft on browser Back until the user confirms under the configured basename', async () => {
    vi.stubEnv('VITE_BASE_PATH', '/console')
    const draftId = 'pd-1'
    const getDraft = vi.spyOn(processDraftsApi, 'get').mockResolvedValue({
      draftId, definitionKey: 'orders', title: 'Saved order', baseReleaseVersion: null, state: 'EDITING',
      revision: 4, contentSha256: 'a'.repeat(64), publishedReleaseVersion: null,
      createdAt: '2026-11-12T08:00:00Z', updatedAt: '2026-11-12T08:00:00Z',
      availableActions: ['SAVE'], baseSourceManifestSha256: null,
      content: {models: [], inputSchemaSource: '', outputSchemaSource: '',
        nodeBindingsSource: null, eventRoutesSource: null},
      lastCommandId: 'save-4', publication: null, commandReceipt: null,
    })
    const {router} = open('/console/process-definitions', [publish])
    expect(await screen.findByRole('heading', {name: '流程设计'})).toBeInTheDocument()
    expect(screen.getByRole('link', {name: '流程设计'})).toHaveAttribute('href', '/console/process-definitions')

    await act(async () => { await router.navigate('/process-definitions/drafts/' + draftId) })
    const title = await screen.findByRole('textbox', {name: '草稿标题'})
    expect(getDraft).toHaveBeenCalledWith('20', draftId, undefined, expect.any(AbortSignal))
    fireEvent.change(title, {target: {value: 'Unsaved title'}})
    const draftPath = '/console/process-definitions/drafts/' + draftId
    act(() => window.history.back())
    const isNavigationBlocked = () => [...router.state.blockers.values()].some(blocker => blocker.state === 'blocked')
    await waitFor(() => expect(isNavigationBlocked()).toBe(true))
    expect(await screen.findByRole('dialog', {name: '离开草稿编辑'})).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe(draftPath))
    fireEvent.click(screen.getByRole('button', {name: '留在此页'}))
    await waitFor(() => expect(isNavigationBlocked()).toBe(false))
    expect(title).toHaveValue('Unsaved title')
    expect(window.location.pathname).toBe(draftPath)

    act(() => window.history.back())
    await waitFor(() => expect(isNavigationBlocked()).toBe(true))
    expect(await screen.findByRole('dialog', {name: '离开草稿编辑'})).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe(draftPath))
    fireEvent.click(screen.getByRole('button', {name: '离开此页'}))
    expect(await screen.findByRole('heading', {name: '流程设计'})).toBeInTheDocument()
    expect(window.location.pathname).toBe('/console/process-definitions')
  })

  it('shows a forbidden landing when the ready frame has no accessible page', async () => {
    open('/', [], true)
    expect(await screen.findByText('没有可访问的页面')).toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('keeps the retired business resources and API calls out of the active permission catalog', () => {
    const catalogRoot = 'tianji.'
    const retiredResources = [
      catalogRoot + 'page.' + 'memoryCandidates', catalogRoot + 'menu.' + 'memoryCandidates',
      catalogRoot + 'button.' + 'memoryCandidates.confirm', catalogRoot + 'button.' + 'memoryCandidates.reject',
      catalogRoot + 'button.' + 'memoryCandidates.compare', catalogRoot + 'button.' + 'runDetail.extractPreferences',
      catalogRoot + 'button.' + 'runDetail.preferenceIntentStatus', catalogRoot + 'button.' + 'runDetail.cancelPreferenceIntent',
      catalogRoot + 'page.' + 'taskInbox', catalogRoot + 'page.' + 'taskDetail', catalogRoot + 'menu.' + 'tasks',
      catalogRoot + 'button.' + 'taskDetail.claim', catalogRoot + 'button.' + 'taskDetail.unclaim',
      catalogRoot + 'button.' + 'taskDetail.transfer', catalogRoot + 'button.' + 'taskDetail.complete',
      catalogRoot + 'button.' + 'runs.start',
    ]
    for (const key of retiredResources) expect(resources.some(resource => resource.key === key)).toBe(false)
    const retiredCalls = references.filter(reference => {
      const segments = reference.key.split('.')
      return segments[0] === 'tianji' && segments[1] === 'api'
        && (segments[2] === 'memory' || segments[2] === 'process' && segments[3] === 'task'
          || segments[2] === 'agent' && segments[3] === 'start')
    })
    expect(retiredCalls).toEqual([])
    const retiredMessages = [
      'page.memoryCandidates', 'menu.memoryCandidates', 'button.memoryConfirm', 'button.memoryReject',
      'button.memoryCompare', 'button.extractPreferences', 'button.preferenceIntentStatus',
      'button.cancelPreferenceIntent', 'page.taskInbox', 'page.taskDetail', 'menu.tasks',
      'button.taskClaim', 'button.taskUnclaim', 'button.taskTransfer', 'button.taskComplete', 'button.start',
    ]
    for (const key of retiredMessages) expect(messages.some(message => message.key === key)).toBe(false)
  })

  it('admits a Case-read-only identity and lands on the authorized lookup page', async () => {
    const current = authorization('20', ['TIANJI_CASE_READ'])
    expect(resourceRegistry.canAccessResource('tianji.app.console', current.snapshot, current.binding)).toBe(true)
    open('/', ['TIANJI_CASE_READ'])
    expect(await screen.findByRole('heading', {name: '案件查询'})).toBeInTheDocument()
    expect(window.location.pathname).toBe('/cases')
    expect(screen.getByRole('link', {name: '案件查询'})).toHaveAttribute('href', '/cases')
    expect(screen.queryByRole('link', {name: '运行记录'})).not.toBeInTheDocument()
  })

  it.each(['/cases', '/cases/case-1'])('guards the direct Case route %s without Case READ', async path => {
    open(path, [agentRead])
    expect(await screen.findByText('当前身份不能访问此页面。')).toBeInTheDocument()
    expect(screen.queryByRole('heading', {name: '案件查询'})).not.toBeInTheDocument()
    expect(screen.queryByRole('link', {name: '案件查询'})).not.toBeInTheDocument()
  })

  it('opens a known Case ID through its own authorized detail resource', async () => {
    open('/cases/case-1', ['TIANJI_CASE_READ'])
    expect(await screen.findByRole('heading', {name: '案件查询'})).toBeInTheDocument()
    expect(window.location.pathname).toBe('/cases/case-1')
  })

  it('keeps Case observation separate from the plan-item action permission', () => {
    const read = auth(['TIANJI_CASE_READ'])
    expect(read.allows('tianji.page.cases')).toBe(true)
    expect(read.allows('tianji.page.caseDetail')).toBe(true)
    expect(read.allows('tianji.button.caseDetail.actPlanItem')).toBe(false)
    expect(auth(['TIANJI_CASE_READ', 'TIANJI_CASE_PLAN_ITEM_ACT']).allows('tianji.button.caseDetail.actPlanItem')).toBe(true)
    expect(auth(['TIANJI_CASE_PLAN_ITEM_ACT']).allows('tianji.button.caseDetail.actPlanItem')).toBe(false)
    expect(auth(['TIANJI_CASE_PLAN_ITEM_ACT']).allows('tianji.app.console')).toBe(false)
  })

  it('declares only lookup and finite Case action resources with both locale labels', () => {
    expect(resources).toEqual(expect.arrayContaining([
      expect.objectContaining({key: 'tianji.page.cases', type: 'PAGE', target: {route: '/cases'}}),
      expect.objectContaining({key: 'tianji.page.caseDetail', type: 'PAGE', target: {route: '/cases/:caseInstanceId'}}),
      expect.objectContaining({key: 'tianji.menu.cases', type: 'MENU', target: {route: '/cases', parentKey: 'tianji.app.console'}}),
      expect.objectContaining({key: 'tianji.button.caseDetail.actPlanItem', type: 'BUTTON', target: {component: 'src/pages/CaseDetailPage.tsx', action: 'actPlanItem'}}),
    ]))
    expect(references.filter(reference => reference.key.startsWith('tianji.api.process.case.')).map(reference => reference.key).sort())
      .toEqual(['tianji.api.process.case.actPlanItem', 'tianji.api.process.case.get'])
    for (const key of ['tianji.page.cases', 'tianji.page.caseDetail', 'tianji.menu.cases', 'tianji.button.caseDetail.actPlanItem']) {
      const resource = resources.find(resource => resource.key === key)
      expect(resource).toBeDefined()
      const label = messages.find(message => message.pageCode === resource?.i18n.pageCode && message.key === resource?.i18n.labelKey)
      expect(label).toEqual(expect.objectContaining({defaultLocale: 'zh-CN', defaults: {'zh-CN': expect.any(String), 'en-US': expect.any(String)}}))
    }
  })
})

describe('Worker failure observations route', () => {
  it('opens Worker failure observations only in the existing dual-permission console', async () => {
    open('/operations/worker-failures', [processRead, 'TIANJI_PROCESS_WORKER_RECOVER'])
    expect(await screen.findByRole('heading', {name: 'Worker 失败观察'})).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Worker 失败观察'})).toHaveAttribute('href', '/operations/worker-failures')
  })

  it.each([
    {codes: []},
    {codes: ['TIANJI_PROCESS_READ']},
    {codes: ['TIANJI_PROCESS_WORKER_RECOVER']},
  ])(
    'guards the direct Worker route and menu when the existing console user has only $codes', async ({codes}) => {
      open('/operations/worker-failures', [agentRead, ...codes])
      expect(await screen.findByText('当前身份不能访问此页面。')).toBeInTheDocument()
      expect(screen.queryByRole('heading', {name: 'Worker 失败观察'})).not.toBeInTheDocument()
      expect(screen.queryByRole('link', {name: 'Worker 失败观察'})).not.toBeInTheDocument()
    })

  it('uses the Process correlation landing while keeping the permitted Worker menu', async () => {
    const pair = ['TIANJI_PROCESS_READ', 'TIANJI_PROCESS_WORKER_RECOVER']
    const current = authorization('20', pair)
    expect(resourceRegistry.canAccessResource('tianji.app.console', current.snapshot, current.binding)).toBe(true)
    open('/', pair)
    expect(await screen.findByRole('heading', {name: '流程关联查询'})).toBeInTheDocument()
    expect(window.location.pathname).toBe('/operations/process-correlations')
    expect(screen.getByRole('link', {name: 'Worker 失败观察'})).toHaveAttribute('href', '/operations/worker-failures')
  })

  it('declares only the Worker observation page, menu, labels and existing GET reference', () => {
    const route = '/operations/worker-failures'
    const requirement = {mode: 'ALL', codes: ['TIANJI_PROCESS_READ', 'TIANJI_PROCESS_WORKER_RECOVER']}
    const labels = {defaultLocale: 'zh-CN', defaults: {'zh-CN': 'Worker 失败观察', 'en-US': 'Worker failure observations'}}
    expect(resources.filter(resource => resource.key.endsWith('workerFailures'))).toEqual([
      {key: 'tianji.page.workerFailures', type: 'PAGE', target: {route}, requirement,
        i18n: {pageCode: 'tianji.web.permissions', labelKey: 'page.workerFailures'}},
      {key: 'tianji.menu.workerFailures', type: 'MENU', target: {route, parentKey: 'tianji.app.console'}, requirement,
        i18n: {pageCode: 'tianji.web.permissions', labelKey: 'menu.workerFailures'}},
    ])
    expect(messages.filter(message => message.key.endsWith('workerFailures'))).toEqual([
      {pageCode: 'tianji.web.permissions', key: 'page.workerFailures', ...labels},
      {pageCode: 'tianji.web.permissions', key: 'menu.workerFailures', ...labels},
    ])
    expect(references.filter(reference => reference.key.startsWith('tianji.api.process.instance.worker-'))).toEqual([
      {key: 'tianji.api.process.instance.worker-failures', usage: 'CALLS'},
    ])
  })
})

describe('Process release metadata routes', () => {
  const route = '/operations/process-releases'
  const releaseRead = 'TIANJI_PROCESS_RELEASE_READ'

  it('opens release metadata with the existing release read permission', async () => {
    open(route, [releaseRead])
    expect(await screen.findByRole('heading', {name: '流程发布元数据'})).toBeInTheDocument()
    expect(screen.getByRole('link', {name: '流程发布元数据'})).toHaveAttribute('href', route)
  })

  it('denies the new route and menu without release read even with Worker permissions', async () => {
    open(route, [processRead, 'TIANJI_PROCESS_WORKER_RECOVER'])
    expect(await screen.findByText('当前身份不能访问此页面。')).toBeInTheDocument()
    expect(screen.queryByRole('heading', {name: '流程发布元数据'})).not.toBeInTheDocument()
    expect(screen.queryByRole('link', {name: '流程发布元数据'})).not.toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Worker 失败观察'})).toBeInTheDocument()
  })

  it('declares exact release page, menu, labels and both release read references', () => {
    const requirement = {mode: 'ALL', codes: [releaseRead]}
    expect(resources.filter(item => item.key.endsWith('processReleases'))).toEqual([
      {key: 'tianji.page.processReleases', type: 'PAGE', target: {route}, requirement,
        i18n: {pageCode: 'tianji.web.permissions', labelKey: 'page.processReleases'}},
      {key: 'tianji.menu.processReleases', type: 'MENU', target: {route, parentKey: 'tianji.app.console'}, requirement,
        i18n: {pageCode: 'tianji.web.permissions', labelKey: 'menu.processReleases'}},
    ])
    expect(references).toEqual(expect.arrayContaining([
      {key: 'tianji.api.process.release.get', usage: 'CALLS'},
      {key: 'tianji.api.process.release.get.v2', usage: 'CALLS'},
    ]))
    for (const label of messages.filter(item => item.key.endsWith('processReleases'))) {
      expect(label.defaults).toEqual({'zh-CN': '流程发布元数据', 'en-US': 'Process release metadata'})
    }
    expect(messages.filter(item => item.key.endsWith('processReleases'))).toHaveLength(2)
  })
})

describe('Owned Process correlation routes', () => {
  const route = '/operations/process-correlations'
  const read = 'TIANJI_PROCESS_READ'

  it('opens Process correlation lookup with the existing Process read permission', async () => {
    open(route, [read])
    expect(await screen.findByRole('heading', {name: '流程关联查询'})).toBeInTheDocument()
    expect(screen.getByRole('link', {name: '流程关联查询'})).toHaveAttribute('href', route)
    expect(screen.queryByRole('link', {name: 'Worker 失败观察'})).not.toBeInTheDocument()
  })

  it('keeps Process correlation route and menu hidden without Process read', async () => {
    open(route, [releaseRead, 'TIANJI_PROCESS_WORKER_RECOVER'])
    expect(await screen.findByText('当前身份不能访问此页面。')).toBeInTheDocument()
    expect(screen.queryByRole('heading', {name: '流程关联查询'})).not.toBeInTheDocument()
    expect(screen.queryByRole('link', {name: '流程关联查询'})).not.toBeInTheDocument()
  })

  it('declares the exact correlation resources, labels and read references', () => {
    const requirement = {mode: 'ALL', codes: [read]}
    expect(resources.filter(item => item.key.endsWith('processCorrelations'))).toEqual([
      {key: 'tianji.page.processCorrelations', type: 'PAGE', target: {route}, requirement,
        i18n: {pageCode: 'tianji.web.permissions', labelKey: 'page.processCorrelations'}},
      {key: 'tianji.menu.processCorrelations', type: 'MENU', target: {route, parentKey: 'tianji.app.console'}, requirement,
        i18n: {pageCode: 'tianji.web.permissions', labelKey: 'menu.processCorrelations'}},
    ])
    expect(references.filter(item => ['tianji.api.process.instance.correlations', 'tianji.api.process.instance.get'].includes(item.key)))
      .toEqual([
        {key: 'tianji.api.process.instance.correlations', usage: 'CALLS'},
        {key: 'tianji.api.process.instance.get', usage: 'CALLS'},
      ])
    const labels = messages.filter(item => item.key.endsWith('processCorrelations'))
    expect(labels).toHaveLength(2)
    for (const label of labels) {
      expect(label.defaults).toEqual({'zh-CN': '流程关联查询', 'en-US': 'Process correlation lookup'})
    }
  })
})
