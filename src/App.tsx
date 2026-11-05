import {AppstoreOutlined, AuditOutlined, FileTextOutlined, FolderOpenOutlined, InboxOutlined, LogoutOutlined, WarningOutlined} from '@ant-design/icons'
import {EnterpriseLayout, type EnterpriseLayoutConfig} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Result, Spin, Tag} from 'antd'
import type {ReactNode} from 'react'
import {BrowserRouter, Navigate, Outlet, Route, Routes} from 'react-router-dom'
import {AuthProvider, useAuth} from './auth/AuthContext'
import AgentRunDetailPage from './pages/AgentRunDetailPage'
import AgentRunsPage from './pages/AgentRunsPage'
import MemoryCandidatesPage from './pages/MemoryCandidatesPage'
import CaseDetailPage from './pages/CaseDetailPage'
import TaskDetailPage from './pages/TaskDetailPage'
import TaskInboxPage from './pages/TaskInboxPage'
import WorkerFailuresPage from './pages/WorkerFailuresPage'
import DefinitionReleasePage from './pages/DefinitionReleasePage'
import ExecutionTimelinePage from './pages/ExecutionTimelinePage'

const configuredBase: string = import.meta.env.VITE_BASE_PATH ?? '/'
if (!configuredBase.startsWith('/') || configuredBase.startsWith('//') || /[\\?#%]/.test(configuredBase)
    || /\/{2,}/.test(configuredBase) || [...configuredBase].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    || configuredBase.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('Invalid VITE_BASE_PATH')
const basePath = configuredBase === '/' ? '/' : configuredBase.replace(/\/?$/, '/')

export default function App() {
  return <AuthProvider><BrowserRouter basename={basePath}><SessionRoutes /></BrowserRouter></AuthProvider>
}

function SessionRoutes() {
  const {status, error, login, retry, allows} = useAuth()
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
  const landing = ([['tianji.page.runs', '/runs'], ['tianji.page.memoryCandidates', '/memory'], ['tianji.page.taskInbox', '/tasks'],
    ['tianji.page.cases', '/cases']] as const)
    .find(([resource]) => allows(resource))?.[1]
  return <Routes>
    <Route element={<Shell />}>
      <Route index element={landing ? <Navigate to={landing} replace /> : <Result status="403" title="没有可访问的页面" />} />
      <Route path="/runs" element={<RequireResource resource="tianji.page.runs"><AgentRunsPage /></RequireResource>} />
      <Route path="/runs/:runId" element={<RequireResource resource="tianji.page.runDetail"><AgentRunDetailPage /></RequireResource>} />
      <Route path="/memory" element={<RequireResource resource="tianji.page.memoryCandidates"><MemoryCandidatesPage /></RequireResource>} />
      <Route path="/tasks" element={<RequireResource resource="tianji.page.taskInbox"><TaskInboxPage /></RequireResource>} />
      <Route path="/tasks/:taskId" element={<RequireResource resource="tianji.page.taskDetail"><TaskDetailPage /></RequireResource>} />
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
      ...(allows('tianji.menu.runs') ? [{key: 'runs', label: '运行记录', path: '/runs', activePathPrefixes: ['/runs'], icon: <AppstoreOutlined />}] : []),
      ...(allows('tianji.menu.memoryCandidates') ? [{key: 'memory', label: '候选记忆', path: '/memory', activePathPrefixes: ['/memory'], icon: <AuditOutlined />}] : []),
      ...(allows('tianji.menu.tasks') ? [{key: 'tasks', label: '任务箱', path: '/tasks', activePathPrefixes: ['/tasks'], icon: <InboxOutlined />}] : []),
      ...(allows('tianji.menu.cases') ? [{key: 'cases', label: '案件查询', path: '/cases', activePathPrefixes: ['/cases'], icon: <FolderOpenOutlined />}] : []),
      ...(allows('tianji.menu.workerFailures') ? [{key: 'workerFailures', label: 'Worker 失败观察', path: '/operations/worker-failures',
        activePathPrefixes: ['/operations/worker-failures'], icon: <WarningOutlined />}] : []),
      ...(allows('tianji.menu.processReleases') ? [{key: 'processReleases', label: '流程发布元数据', path: '/operations/process-releases',
        activePathPrefixes: ['/operations/process-releases'], icon: <FileTextOutlined />}] : []),
      ...(allows('tianji.menu.processCorrelations') ? [{key: 'processCorrelations', label: '流程关联查询', path: '/operations/process-correlations',
        activePathPrefixes: ['/operations/process-correlations'], icon: <AuditOutlined />}] : []),
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
