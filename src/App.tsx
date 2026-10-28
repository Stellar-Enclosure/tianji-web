import {AppstoreOutlined, LogoutOutlined} from '@ant-design/icons'
import {EnterpriseLayout, type EnterpriseLayoutConfig} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Result, Spin, Tag} from 'antd'
import type {ReactNode} from 'react'
import {BrowserRouter, Navigate, Outlet, Route, Routes} from 'react-router-dom'
import {AuthProvider, useAuth} from './auth/AuthContext'
import AgentRunDetailPage from './pages/AgentRunDetailPage'
import AgentRunsPage from './pages/AgentRunsPage'

const configuredBase: string = import.meta.env.VITE_BASE_PATH ?? '/'
if (!configuredBase.startsWith('/') || configuredBase.startsWith('//') || /[\\?#%]/.test(configuredBase)
    || /\/{2,}/.test(configuredBase) || [...configuredBase].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    || configuredBase.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('Invalid VITE_BASE_PATH')
const basePath = configuredBase === '/' ? '/' : configuredBase.replace(/\/?$/, '/')

export default function App() {
  return <AuthProvider><BrowserRouter basename={basePath}><SessionRoutes /></BrowserRouter></AuthProvider>
}

function SessionRoutes() {
  const {status, error, login, retry} = useAuth()
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
  return <Routes>
    <Route element={<Shell />}>
      <Route index element={<Navigate to="/runs" replace />} />
      <Route path="/runs" element={<RequireResource resource="tianji.page.runs"><AgentRunsPage /></RequireResource>} />
      <Route path="/runs/:runId" element={<RequireResource resource="tianji.page.runDetail"><AgentRunDetailPage /></RequireResource>} />
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
    navigation: allows('tianji.menu.runs') ? [{key: 'runs', label: '运行记录', path: '/runs',
      activePathPrefixes: ['/runs'], icon: <AppstoreOutlined />}] : [],
    actions: <Tag color="success">会话已验证</Tag>,
    user: {name: authorization.identity.subject, description: `租户 ${authorization.identity.tenantId}`,
      menu: [{key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: () => void logout()}]},
    footer: {version: '0.0.1'},
    labels: {mainMenu: '主导航', userMenu: '用户菜单', openNavigation: '打开导航', version: '版本'},
    ...(embedded ? {hideHeader: true, hideFooter: true} : {}),
  }
  return <EnterpriseLayout config={config}><Outlet /></EnterpriseLayout>
}
