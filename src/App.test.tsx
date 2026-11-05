import {render, screen} from '@testing-library/react'
import type {EnterpriseLayoutConfig} from '@stellar-enclosure/stellar-enclosure-web-shared'
import type {ReactNode} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import App from './App'
import {useAuth} from './auth/AuthContext'
import {gatewayAuth} from './auth/gatewayAuth'
import {messages} from './permissions/messages'
import {references} from './permissions/references'
import {resourceRegistry} from './permissions/registry'
import {resources} from './permissions/resources'
import {authorization} from './test/fixtures'

vi.mock('./auth/AuthContext', () => ({AuthProvider: ({children}: {children: ReactNode}) => children, useAuth: vi.fn()}))
vi.mock('@stellar-enclosure/stellar-enclosure-web-shared', async original => {
  const actual = await original<typeof import('@stellar-enclosure/stellar-enclosure-web-shared')>()
  return {...actual, EnterpriseLayout: ({config, children}: {config: EnterpriseLayoutConfig; children: ReactNode}) =>
    <main><nav aria-label="主导航">{(config.navigation ?? []).map(item => <a key={item.key} href={item.path}>{item.label}</a>)}</nav>{children}</main>}
})
vi.mock('./pages/AgentRunsPage', () => ({default: () => <h1>运行记录</h1>}))
vi.mock('./pages/AgentRunDetailPage', () => ({default: () => <h1>运行详情</h1>}))
vi.mock('./pages/MemoryCandidatesPage', () => ({default: () => <h1>候选记忆</h1>}))
vi.mock('./pages/TaskInboxPage', () => ({default: () => <h1>任务箱</h1>}))
vi.mock('./pages/TaskDetailPage', () => ({default: () => <h1>任务详情</h1>}))
vi.mock('./pages/CaseDetailPage', () => ({default: () => <h1>案件查询</h1>}))
vi.mock('./pages/WorkerFailuresPage', () => ({default: () => <h1>Worker 失败观察</h1>}))
vi.mock('./pages/DefinitionReleasePage', () => ({default: () => <h1>流程发布元数据</h1>}))

const auth = (codes: string[]) => {
  const current = authorization('20', codes)
  return {status: 'ready' as const, authorization: current,
    allows: (key: string) => resourceRegistry.canAccessResource(key, current.snapshot, current.binding),
    login: vi.fn(), logout: async () => {}, retry: async () => {}}
}
const open = (path: string, codes: string[]) => {
  window.history.replaceState(null, '', path)
  vi.mocked(useAuth).mockReturnValue(auth(codes))
  return render(<App />)
}

describe('Console routes and owned task resources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    gatewayAuth.context.invalidate()
    window.history.replaceState(null, '', '/')
  })

  it('admits a task-read-only identity to the app and its task landing page', async () => {
    const current = authorization('20', ['TIANJI_TASK_READ'])
    expect(resourceRegistry.canAccessResource('tianji.app.console', current.snapshot, current.binding)).toBe(true)
    open('/', ['TIANJI_TASK_READ'])
    expect(await screen.findByRole('heading', {name: '任务箱'})).toBeInTheDocument()
    expect(window.location.pathname).toBe('/tasks')
    expect(screen.getByRole('link', {name: '任务箱'})).toHaveAttribute('href', '/tasks')
    expect(screen.queryByRole('link', {name: '运行记录'})).not.toBeInTheDocument()
    expect(screen.queryByRole('link', {name: '候选记忆'})).not.toBeInTheDocument()
  })

  it.each([
    [['TIANJI_AGENT_READ'], '/runs', '运行记录'],
    [['TIANJI_MEMORY_READ'], '/memory', '候选记忆'],
    [['TIANJI_AGENT_READ', 'TIANJI_MEMORY_READ', 'TIANJI_TASK_READ'], '/runs', '运行记录'],
    [['TIANJI_MEMORY_READ', 'TIANJI_TASK_READ'], '/memory', '候选记忆'],
    [['TIANJI_AGENT_READ', 'TIANJI_CASE_READ'], '/runs', '运行记录'],
    [['TIANJI_MEMORY_READ', 'TIANJI_CASE_READ'], '/memory', '候选记忆'],
    [['TIANJI_TASK_READ', 'TIANJI_CASE_READ'], '/tasks', '任务箱'],
  ] as const)('keeps the ordered landing for %j', async (codes, route, heading) => {
    open('/', [...codes])
    expect(await screen.findByRole('heading', {name: heading})).toBeInTheDocument()
    expect(window.location.pathname).toBe(route)
  })

  it('guards both direct task routes and independently hides the task menu', async () => {
    const rendered = open('/tasks/task-1', ['TIANJI_MEMORY_READ'])
    expect(await screen.findByText('当前身份不能访问此页面。')).toBeInTheDocument()
    expect(screen.queryByRole('heading', {name: '任务详情'})).not.toBeInTheDocument()
    expect(screen.queryByRole('link', {name: '任务箱'})).not.toBeInTheDocument()
    rendered.unmount()
    open('/tasks', ['TIANJI_MEMORY_READ'])
    expect(await screen.findByText('当前身份不能访问此页面。')).toBeInTheDocument()
    expect(screen.queryByRole('heading', {name: '任务箱'})).not.toBeInTheDocument()
  })

  it('opens an authorized task detail through its own page guard', async () => {
    open('/tasks/task-1', ['TIANJI_TASK_READ'])
    expect(await screen.findByRole('heading', {name: '任务详情'})).toBeInTheDocument()
    expect(window.location.pathname).toBe('/tasks/task-1')
  })

  it('shows a forbidden landing when the ready frame has no accessible page', async () => {
    open('/', [])
    expect(await screen.findByText('没有可访问的页面')).toBeInTheDocument()
    expect(screen.queryByRole('heading', {name: '候选记忆'})).not.toBeInTheDocument()
  })

  it.each([
    ['tianji.button.taskDetail.claim', 'TIANJI_TASK_CLAIM'],
    ['tianji.button.taskDetail.unclaim', 'TIANJI_TASK_CLAIM'],
    ['tianji.button.taskDetail.transfer', 'TIANJI_TASK_TRANSFER'],
    ['tianji.button.taskDetail.complete', 'TIANJI_TASK_COMPLETE'],
  ])('requires both task read and the exact write permission for %s', (key, writeCode) => {
    expect(auth(['TIANJI_TASK_READ', writeCode]).allows(key)).toBe(true)
    expect(auth(['TIANJI_TASK_READ']).allows(key)).toBe(false)
    expect(auth([writeCode]).allows(key)).toBe(false)
  })

  it('declares exact task page/menu/button targets, existing API CALLS and all labels', () => {
    expect(resources).toEqual(expect.arrayContaining([
      expect.objectContaining({key: 'tianji.page.taskInbox', type: 'PAGE', target: {route: '/tasks'}}),
      expect.objectContaining({key: 'tianji.page.taskDetail', type: 'PAGE', target: {route: '/tasks/:taskId'}}),
      expect.objectContaining({key: 'tianji.menu.tasks', type: 'MENU', target: {route: '/tasks', parentKey: 'tianji.app.console'}}),
    ]))
    const taskReferences = references.filter(reference => reference.key.startsWith('tianji.api.process.task.'))
    expect(taskReferences.map(reference => reference.key).sort()).toEqual(['claim', 'complete', 'get', 'query', 'transfer', 'unclaim']
      .map(action => `tianji.api.process.task.${action}`).sort())
    expect(taskReferences.every(reference => reference.usage === 'CALLS')).toBe(true)
    expect(references.some(reference => /adminQuery|approval.*verify/.test(reference.key))).toBe(false)
    for (const resource of resources.filter(resource => /^tianji\.(?:page\.task|menu\.tasks|button\.taskDetail)/.test(resource.key))) {
      const label = messages.find(message => message.pageCode === resource.i18n.pageCode && message.key === resource.i18n.labelKey)
      expect(label).toEqual(expect.objectContaining({defaultLocale: 'zh-CN', defaults: {'zh-CN': expect.any(String), 'en-US': expect.any(String)}}))
    }
  })

  it('admits a Case-read-only identity and lands on the authorized lookup page', async () => {
    const current = authorization('20', ['TIANJI_CASE_READ'])
    expect(resourceRegistry.canAccessResource('tianji.app.console', current.snapshot, current.binding)).toBe(true)
    open('/', ['TIANJI_CASE_READ'])
    expect(await screen.findByRole('heading', {name: '案件查询'})).toBeInTheDocument()
    expect(window.location.pathname).toBe('/cases')
    expect(screen.getByRole('link', {name: '案件查询'})).toHaveAttribute('href', '/cases')
    expect(screen.queryByRole('link', {name: '任务箱'})).not.toBeInTheDocument()
    expect(screen.queryByRole('link', {name: '运行记录'})).not.toBeInTheDocument()
  })

  it.each(['/cases', '/cases/case-1'])('guards the direct Case route %s without Case READ', async path => {
    open(path, ['TIANJI_TASK_READ'])
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
  beforeEach(() => {
    vi.clearAllMocks()
    gatewayAuth.context.invalidate()
    window.history.replaceState(null, '', '/')
  })

  it('opens Worker failure observations only in the existing dual-permission console', async () => {
    open('/operations/worker-failures', ['TIANJI_TASK_READ', 'TIANJI_PROCESS_READ', 'TIANJI_PROCESS_WORKER_RECOVER'])
    expect(await screen.findByRole('heading', {name: 'Worker 失败观察'})).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Worker 失败观察'})).toHaveAttribute('href', '/operations/worker-failures')
  })

  it.each([
    {codes: []},
    {codes: ['TIANJI_PROCESS_READ']},
    {codes: ['TIANJI_PROCESS_WORKER_RECOVER']},
  ])(
    'guards the direct Worker route and menu when the existing console user has only $codes', async ({codes}) => {
      open('/operations/worker-failures', ['TIANJI_TASK_READ', ...codes])
      expect(await screen.findByText('当前身份不能访问此页面。')).toBeInTheDocument()
      expect(screen.queryByRole('heading', {name: 'Worker 失败观察'})).not.toBeInTheDocument()
      expect(screen.queryByRole('link', {name: 'Worker 失败观察'})).not.toBeInTheDocument()
    })

  it('keeps the existing app permission and default landing', async () => {
    const pair = ['TIANJI_PROCESS_READ', 'TIANJI_PROCESS_WORKER_RECOVER']
    const current = authorization('20', pair)
    expect(resourceRegistry.canAccessResource('tianji.app.console', current.snapshot, current.binding)).toBe(false)
    open('/', ['TIANJI_TASK_READ', ...pair])
    expect(await screen.findByRole('heading', {name: '任务箱'})).toBeInTheDocument()
    expect(window.location.pathname).toBe('/tasks')
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

  beforeEach(() => {
    vi.clearAllMocks()
    gatewayAuth.context.invalidate()
    window.history.replaceState(null, '', '/')
  })

  it('opens release metadata with the existing release read permission', async () => {
    open(route, ['TIANJI_TASK_READ', releaseRead])
    expect(await screen.findByRole('heading', {name: '流程发布元数据'})).toBeInTheDocument()
    expect(screen.getByRole('link', {name: '流程发布元数据'})).toHaveAttribute('href', route)
  })

  it('denies the new route and menu without release read even with Worker permissions', async () => {
    open(route, ['TIANJI_TASK_READ', 'TIANJI_PROCESS_READ', 'TIANJI_PROCESS_WORKER_RECOVER'])
    expect(await screen.findByText('当前身份不能访问此页面。')).toBeInTheDocument()
    expect(screen.queryByRole('heading', {name: '流程发布元数据'})).not.toBeInTheDocument()
    expect(screen.queryByRole('link', {name: '流程发布元数据'})).not.toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Worker 失败观察'})).toBeInTheDocument()
  })

  it('preserves existing APP and landing with release read', async () => {
    expect(auth([releaseRead]).allows('tianji.app.console')).toBe(false)
    open('/', ['TIANJI_TASK_READ', releaseRead])
    expect(await screen.findByRole('heading', {name: '任务箱'})).toBeInTheDocument()
    expect(window.location.pathname).toBe('/tasks')
  })

  it('declares exact release page, menu, labels and existing GET reference only', () => {
    const requirement = {mode: 'ALL', codes: [releaseRead]}
    expect(resources.filter(item => item.key.endsWith('processReleases'))).toEqual([
      {key: 'tianji.page.processReleases', type: 'PAGE', target: {route}, requirement,
        i18n: {pageCode: 'tianji.web.permissions', labelKey: 'page.processReleases'}},
      {key: 'tianji.menu.processReleases', type: 'MENU', target: {route, parentKey: 'tianji.app.console'}, requirement,
        i18n: {pageCode: 'tianji.web.permissions', labelKey: 'menu.processReleases'}},
    ])
    expect(references.filter(item => item.key.startsWith('tianji.api.process.release.'))).toEqual([
      {key: 'tianji.api.process.release.get', usage: 'CALLS'},
    ])
    for (const label of messages.filter(item => item.key.endsWith('processReleases'))) {
      expect(label.defaults).toEqual({'zh-CN': '流程发布元数据', 'en-US': 'Process release metadata'})
    }
    expect(messages.filter(item => item.key.endsWith('processReleases'))).toHaveLength(2)
  })
})
