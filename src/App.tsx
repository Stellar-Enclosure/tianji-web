import {AppstoreOutlined, AuditOutlined, FileSearchOutlined, FileTextOutlined, FolderOpenOutlined, LogoutOutlined, WarningOutlined} from '@ant-design/icons'
import {EnterpriseLayout, type EnterpriseLayoutConfig} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Result, Spin, Tag} from 'antd'
import {useState, type ReactNode} from 'react'
import {createBrowserRouter, Link, matchPath, Navigate, Outlet, Route, RouterProvider, Routes, useLocation} from 'react-router-dom'
import {AuthProvider, useAuth} from './auth/AuthContext'
import AgentRunDetailPage from './pages/AgentRunDetailPage'
import AgentRunsPage from './pages/AgentRunsPage'
import CaseDetailPage from './pages/CaseDetailPage'
import WorkerFailuresPage from './pages/WorkerFailuresPage'
import DefinitionReleasePage from './pages/DefinitionReleasePage'
import ExecutionTimelinePage from './pages/ExecutionTimelinePage'
import ProcessDefinitionWorkspacePage from './pages/ProcessDefinitionWorkspacePage'
import ProcessDraftEditorPage from './pages/ProcessDraftEditorPage'
import ProcessInstanceLookupPage from './pages/ProcessInstanceLookupPage'
import ProcessInstancePage from './pages/ProcessInstancePage'

const legacyBookmarks = ['/tasks', '/tasks/:taskId', '/memory'] as const
const landingPages = [
  ['tianji.page.processDefinitions', '/process-definitions'],
  ['tianji.page.processReleases', '/operations/process-releases'],
  ['tianji.page.processCorrelations', '/operations/process-correlations'],
  ['tianji.page.processInstances', '/process-instances'],
  ['tianji.page.runs', '/runs'],
  ['tianji.page.cases', '/cases'],
] as const

export function createConsoleRouter() {
  const configuredBase: string = import.meta.env.VITE_BASE_PATH ?? '/'
  if (!configuredBase.startsWith('/') || configuredBase.startsWith('//') || /[\\?#%]/.test(configuredBase)
      || /\/{2,}/.test(configuredBase) || [...configuredBase].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
      || configuredBase.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('Invalid VITE_BASE_PATH')
  const basename = configuredBase === '/' ? '/' : configuredBase.replace(/\/?$/, '/')
  return createBrowserRouter([{path: '*', element: <ConsoleEntry />}], {basename})
}

export default function App({router}: {router: ReturnType<typeof createConsoleRouter>}) {
  return <RouterProvider router={router} />
}

function ConsoleEntry() {
  const {pathname} = useLocation()
  const legacy = legacyBookmarks.some(path => matchPath({path, caseSensitive: true, end: true}, pathname) !== null)
  const [sessionStarted, setSessionStarted] = useState(!legacy)
  if (!sessionStarted) {
    if (legacy) return <LegacyBusinessHandoff />
    setSessionStarted(true)
  }
  return <AuthProvider><SessionRoutes legacy={legacy} /></AuthProvider>
}

function LegacyBusinessHandoff({canReturn = false}: {canReturn?: boolean}) {
  return <main className="auth-shell"><Card variant="borderless" className="auth-card">
    <Result status="info" title="此能力由业务平台提供"
      extra={canReturn ? <Link to="/">返回控制台</Link> : undefined} />
  </Card></main>
}

function SessionRoutes({legacy}: {legacy: boolean}) {
  const {status, error, login, retry, allows} = useAuth()
  if (legacy) return <LegacyBusinessHandoff canReturn={status === 'ready' && allows('tianji.app.console')} />
  if (status === 'loading') return <Spin fullscreen description="正在验证会话" />
  if (status !== 'ready') {
    return <main className="auth-shell"><Card variant="borderless" className="auth-card">
      <Result status={status === 'forbidden' ? '403' : status === 'error' ? 'error' : 'info'}
        title={status === 'forbidden' ? '没有访问权限' : status === 'error' ? '暂时无法验证' : '登录天机'}
        subTitle={error ?? (status === 'forbidden' ? '当前身份没有访问天机控制台的权限。' : '使用平台账号继续。')}
        extra={status === 'signed-out' ? <Button type="primary" onClick={login}>登录</Button>
          : <Button type="primary" onClick={() => void retry()}>重新验证</Button>} />
    </Card></main>
  }
  const landing = landingPages.find(([resource]) => allows(resource))?.[1]
  return <Routes>
    <Route element={<Shell />}>
      <Route index element={landing ? <Navigate to={landing} replace /> : <Result status="403" title="没有可访问的页面" />} />
      <Route path="/process-definitions" element={<RequireResource resource="tianji.page.processDefinitions"><ProcessDefinitionWorkspacePage /></RequireResource>} />
      <Route path="/process-definitions/new" element={<RequireResource resource="tianji.page.processDefinitions"><ProcessDefinitionWorkspacePage /></RequireResource>} />
      <Route path="/process-definitions/drafts/:draftId" element={<RequireResource resource="tianji.page.processDraftEditor"><ProcessDraftEditorPage /></RequireResource>} />
      <Route path="/process-instances" element={<RequireResource resource="tianji.page.processInstances"><ProcessInstanceLookupPage /></RequireResource>} />
      <Route path="/process-instances/:instanceId" element={<RequireResource resource="tianji.page.processInstance"><ProcessInstancePage /></RequireResource>} />
      <Route path="/runs" element={<RequireResource resource="tianji.page.runs"><AgentRunsPage /></RequireResource>} />
      <Route path="/runs/:runId" element={<RequireResource resource="tianji.page.runDetail"><AgentRunDetailPage /></RequireResource>} />
      <Route path="/cases" element={<RequireResource resource="tianji.page.cases"><CaseDetailPage /></RequireResource>} />
      <Route path="/cases/:caseInstanceId" element={<RequireResource resource="tianji.page.caseDetail"><CaseDetailPage /></RequireResource>} />
      <Route path="/operations/worker-failures" element={<RequireResource resource="tianji.page.workerFailures"><WorkerFailuresPage /></RequireResource>} />
      <Route path="/operations/process-releases" element={<RequireResource resource="tianji.page.processReleases"><DefinitionReleasePage /></RequireResource>} />
      <Route path="/operations/process-correlations" element={<RequireResource resource="tianji.page.processCorrelations"><ExecutionTimelinePage /></RequireResource>} />
      <Route path="*" element={<Result status="404" title="页面不存在" />} />
    </Route>
  </Routes>
}

function RequireResource({resource, children}: {resource: string; children: ReactNode}) {
  const {allows} = useAuth()
  return allows(resource) ? children : <Alert type="warning" showIcon message="当前身份不能访问此页面。" />
}

function Shell() {
  const {authorization, allows, logout} = useAuth()
  if (!authorization) return null
  const embedded = (window as Window & {$wujie?: {props?: {embedded?: boolean}}}).$wujie?.props?.embedded === true
  const config: EnterpriseLayoutConfig = {
    platformName: '天机 · 智能编排',
    navigation: [
      ...(allows('tianji.menu.processDefinitions') ? [{key: 'processDefinitions', label: '流程设计', path: '/process-definitions',
        activePathPrefixes: ['/process-definitions'], icon: <FolderOpenOutlined />}] : []),
      ...(allows('tianji.menu.processReleases') ? [{key: 'processReleases', label: '流程发布元数据', path: '/operations/process-releases',
        activePathPrefixes: ['/operations/process-releases'], icon: <FileTextOutlined />}] : []),
      ...(allows('tianji.menu.processCorrelations') ? [{key: 'processCorrelations', label: '流程关联查询', path: '/operations/process-correlations',
        activePathPrefixes: ['/operations/process-correlations'], icon: <AuditOutlined />}] : []),
      ...(allows('tianji.menu.processInstances') ? [{key: 'processInstances', label: '流程实例查找', path: '/process-instances',
        activePathPrefixes: ['/process-instances'], icon: <FileSearchOutlined />}] : []),
      ...(allows('tianji.menu.workerFailures') ? [{key: 'workerFailures', label: 'Worker 失败观察', path: '/operations/worker-failures',
        activePathPrefixes: ['/operations/worker-failures'], icon: <WarningOutlined />}] : []),
      ...(allows('tianji.menu.runs') ? [{key: 'runs', label: '运行记录', path: '/runs', activePathPrefixes: ['/runs'], icon: <AppstoreOutlined />}] : []),
      ...(allows('tianji.menu.cases') ? [{key: 'cases', label: '案件查询', path: '/cases', activePathPrefixes: ['/cases'], icon: <FolderOpenOutlined />}] : []),
    ],
    actions: <Tag color="success">会话已验证</Tag>,
    user: {name: authorization.identity.subject, description: `租户 ${authorization.identity.tenantId}`,
      menu: [{key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: () => void logout()}]},
    footer: {version: '0.0.1'},
    labels: {mainMenu: '主导航', userMenu: '用户菜单', openNavigation: '打开导航', version: '版本'},
    ...(embedded ? {hideHeader: true, hideFooter: true} : {}),
  }
  return <EnterpriseLayout config={config}><Outlet /></EnterpriseLayout>
}
