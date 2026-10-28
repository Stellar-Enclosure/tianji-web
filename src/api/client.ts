import {ApiError, createHttpClient} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {gatewayAuth} from '../auth/gatewayAuth'

export const TENANT_HEADER = 'X-Egon-Tianji-Tenant'
export const isCanonicalTenant = (value: string): boolean => /^[1-9][0-9]{0,18}$/.test(value)
  && BigInt(value) <= 9_223_372_036_854_775_807n
export type AuthFailure = 'unauthenticated' | 'forbidden' | 'tenant-changed'
let authFailureHandler: (failure: AuthFailure) => void = () => {}

export const setAuthFailureHandler = (handler: (failure: AuthFailure) => void): void => { authFailureHandler = handler }
export const notifyAuthFailure = (failure: AuthFailure): void => {
  if (failure !== 'unauthenticated') gatewayAuth.context.invalidate()
  authFailureHandler(failure)
}

const transport = createHttpClient({
  baseUrl: gatewayAuth.applicationBaseUrl,
  credentials: 'include',
  context: gatewayAuth.context,
  getCsrf: signal => gatewayAuth.csrf(signal),
  fetch: (...args) => globalThis.fetch(...args),
  onAuthError: status => notifyAuthFailure(status === 401 ? 'unauthenticated' : 'forbidden'),
})

export const requestJson = async <T>(path: string, tenantId: string, init: RequestInit = {}): Promise<T> => {
  if (!isCanonicalTenant(tenantId)) throw new Error('可信租户上下文不可用')
  const headers = new Headers(init.headers)
  headers.set(TENANT_HEADER, tenantId)
  try {
    return await transport.request<T>(path, {...init, headers})
  } catch (failure) {
    if (failure instanceof ApiError && failure.status === 409 && failure.code === 'TIANJI_TENANT_CONTEXT_CHANGED') {
      notifyAuthFailure('tenant-changed')
    }
    throw failure
  }
}
