import {StrictMode} from 'react'
import {createRoot, type Root} from 'react-dom/client'
import {AdminThemeProvider, I18nProvider, initI18n, injectTokens, type WorkbenchHost} from '@stellar-enclosure/stellar-enclosure-web-shared'
import 'antd/dist/reset.css'
import App, {createConsoleRouter} from './App'
import {gatewayAuth} from './auth/gatewayAuth'
import './styles.css'

injectTokens()
initI18n({defaultNS: 'common', resources: {'zh-CN': {}}})

interface RuntimeWindow extends Window {
  __POWERED_BY_WUJIE__?: boolean
  __WUJIE_MOUNT?: () => void
  __WUJIE_UNMOUNT?: () => void
  __WUJIE?: {mount?: () => void; props?: {workbenchHost?: WorkbenchHost}}
  $wujie?: {props?: {workbenchHost?: WorkbenchHost}}
}
const runtime = window as RuntimeWindow
let root: Root | undefined
let router: ReturnType<typeof createConsoleRouter> | undefined
const resolveWorkbenchHost = (): WorkbenchHost | undefined =>
  runtime.$wujie?.props?.workbenchHost ?? runtime.__WUJIE?.props?.workbenchHost

const mount = () => {
  if (root) return
  const element = document.getElementById('root')
  if (!element) throw new Error('Root element is missing')
  const workbenchHost = resolveWorkbenchHost()
  router = workbenchHost ? undefined : createConsoleRouter()
  root = createRoot(element)
  root.render(
    <StrictMode>
      <I18nProvider>
        <AdminThemeProvider>
          <App router={router} workbenchHost={workbenchHost} />
        </AdminThemeProvider>
      </I18nProvider>
    </StrictMode>,
  )
}
const unmount = () => {
  try {
    root?.unmount()
  } finally {
    if (!resolveWorkbenchHost()) {
      void gatewayAuth.logout().catch(() => gatewayAuth.invalidate())
    }
    router?.dispose()
    router = undefined
    root = undefined
  }
}
if (runtime.__POWERED_BY_WUJIE__) {
  runtime.__WUJIE_MOUNT = mount
  runtime.__WUJIE_UNMOUNT = unmount
  runtime.__WUJIE?.mount?.()
} else mount()
