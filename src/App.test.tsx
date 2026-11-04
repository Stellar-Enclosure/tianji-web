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
