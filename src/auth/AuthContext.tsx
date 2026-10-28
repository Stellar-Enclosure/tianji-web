import {createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react'
import type {GatewayIdentityResult} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {isPermissionSnapshot, snapshotContext, type PermissionSnapshot,
  type PermissionSnapshotContext} from '@stellar-enclosure/stellar-enclosure-web-shared/permissions'
import {isCanonicalTenant, setAuthFailureHandler} from '../api/client'
import {resourceRegistry} from '../permissions/registry'
import {gatewayAuth} from './gatewayAuth'

export type Authorization = Readonly<{
  identity: GatewayIdentityResult
  snapshot: PermissionSnapshot
  binding: PermissionSnapshotContext
}>
type AuthStatus = 'loading' | 'signed-out' | 'forbidden' | 'ready' | 'error'
type AuthValue = Readonly<{
  status: AuthStatus
  authorization?: Authorization
  error?: string
  allows: (resource: string) => boolean
  login: () => void
  logout: () => Promise<void>
  retry: () => Promise<void>
}>

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({children}: {children: ReactNode}) {
  const [authorization, setAuthorization] = useState<Authorization>()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string>()
  const sequence = useRef(0)
  const pending = useRef<AbortController | null>(null)

  const retry = useCallback(async () => {
    gatewayAuth.context.invalidate()
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    const serial = ++sequence.current
    setAuthorization(undefined)
    setStatus('loading')
    setError(undefined)
    try {
      const identity = await gatewayAuth.identity(controller.signal)
      if (serial !== sequence.current) return
      const captured = gatewayAuth.context.capture(controller.signal)
      const snapshot = await gatewayAuth.bootstrap<unknown>('/api/v1/authorization/effective-permissions', captured.signal)
      captured.assertCurrent()
      const namespace = import.meta.env.VITE_PERMISSION_NAMESPACE ?? ''
      const environment = import.meta.env.VITE_PERMISSION_ENVIRONMENT ?? ''
      if (!namespace || !environment || !isCanonicalTenant(identity.tenantId) || !isPermissionSnapshot(snapshot)
        || snapshot.issuer !== identity.issuer || snapshot.subject !== identity.subject
        || snapshot.catalogScope.tenantId !== identity.tenantId || snapshot.catalogScope.businessCode !== 'xingyuan'
        || snapshot.catalogScope.applicationCode !== 'tianji' || snapshot.catalogScope.namespaceCode !== namespace
        || snapshot.catalogScope.environment !== environment || Date.parse(snapshot.snapshotExpiresAt) <= Date.now()) {
        throw new Error('权限范围或登录身份不匹配')
      }
      if (serial !== sequence.current) return
      const binding = snapshotContext(snapshot, captured.epoch)
      setAuthorization({identity, snapshot, binding})
      setStatus(resourceRegistry.canAccessResource('tianji.app.console', snapshot, binding) ? 'ready' : 'forbidden')
    } catch (failure) {
      if (controller.signal.aborted || serial !== sequence.current) return
      setAuthorization(undefined)
      if (typeof failure === 'object' && failure !== null && 'status' in failure && failure.status === 401) {
        setStatus('signed-out')
      } else {
        setStatus('error')
        setError('无法验证当前会话或权限范围，请检查连接与配置后重试。')
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    const unsubscribe = gatewayAuth.context.subscribe(() => {
      sequence.current += 1
      pending.current?.abort()
      setAuthorization(undefined)
      setStatus('signed-out')
    })
    setAuthFailureHandler(failure => {
      setAuthorization(undefined)
      setStatus(failure === 'unauthenticated' ? 'signed-out' : 'forbidden')
      setError(failure === 'tenant-changed' ? '租户会话已变化，请重新验证。' : undefined)
    })
    queueMicrotask(() => { if (active) void retry() })
    return () => {
      active = false
      unsubscribe()
      sequence.current += 1
      pending.current?.abort()
      setAuthFailureHandler(() => {})
    }
  }, [retry])

  useEffect(() => {
    if (!authorization) return
    const delay = Math.max(1, Math.min(Date.parse(authorization.snapshot.snapshotExpiresAt) - Date.now(), 2_147_483_647))
    const timer = setTimeout(() => gatewayAuth.context.invalidate(), delay)
    return () => clearTimeout(timer)
  }, [authorization])

  const login = useCallback(() => gatewayAuth.login(), [])
  const logout = useCallback(async () => {
    try {
      const result = await gatewayAuth.logout()
      if (result.remoteState !== 'CONFIRMED') setError('本地会话已关闭，远端退出状态尚未确认。')
    } catch {
      setError('退出操作未完成，请重试。')
    }
  }, [])
  const allows = useCallback((resource: string) => !!authorization
    && authorization.binding.requestEpoch === gatewayAuth.context.epoch
    && resourceRegistry.canAccessResource(resource, authorization.snapshot, authorization.binding), [authorization])
  const value = useMemo(() => ({status, authorization, error, allows, login, logout, retry}),
    [status, authorization, error, allows, login, logout, retry])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthValue => {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
