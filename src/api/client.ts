import {ApiError, createHttpClient, PublicOAuthError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {gatewayAuth} from '../auth/gatewayAuth'

export const TENANT_HEADER = 'X-Egon-Tianji-Tenant'
export const isCanonicalTenant = (value: string): boolean => /^[1-9][0-9]{0,18}$/.test(value)
  && BigInt(value) <= 9_223_372_036_854_775_807n
export type AuthFailure = 'unauthenticated' | 'forbidden' | 'tenant-changed'
let authFailureHandler: (failure: AuthFailure) => void = () => {}

export const setAuthFailureHandler = (handler: (failure: AuthFailure) => void): void => { authFailureHandler = handler }
export const notifyAuthFailure = (failure: AuthFailure): void => {
  if (failure === 'tenant-changed') gatewayAuth.invalidate()
  else if (failure === 'forbidden') gatewayAuth.context.invalidate()
  authFailureHandler(failure)
}

const fetchResponse: typeof fetch = (...args) => globalThis.fetch(...args)
export const createTianjiTransport = (tenantId: string, timeout?: number, fetcher: typeof fetch = fetchResponse) => {
  const authority = gatewayAuth.authority(tenantId)
  return createHttpClient({baseUrl: authority.apiBaseUrl, authority, timeout, fetch: fetcher,
    onAuthError: status => notifyAuthFailure(status === 401 ? 'unauthenticated' : 'forbidden')})
}

export const requestJson = async <T>(
  path: string, tenantId: string, init: RequestInit = {}, expectedStatus?: number,
): Promise<T> => {
  if (!isCanonicalTenant(tenantId)) throw new Error('可信租户上下文不可用')
  const headers = new Headers(init.headers)
  headers.set(TENANT_HEADER, tenantId)
  let actualStatus = 0
  try {
    const client = createTianjiTransport(tenantId, undefined, expectedStatus === undefined ? fetchResponse : async (...args) => {
      const response = await fetchResponse(...args)
      actualStatus = response.status
      return response
    })
    const result = await client.request<T>(path, {...init, headers})
    if (expectedStatus !== undefined && actualStatus !== expectedStatus) {
      throw new ApiError('服务返回的 HTTP 状态不符合接口约定', actualStatus, 'INVALID_RESPONSE', {retryable: false})
    }
    return result
  } catch (failure) {
    if (failure instanceof PublicOAuthError && failure.code === 'AUTHORIZATION_REQUIRED') {
      notifyAuthFailure('unauthenticated')
      throw new ApiError('需要为当前资源重新授权', 401, failure.code, {retryable: false})
    }
    if (failure instanceof ApiError && failure.status === 409 && failure.code === 'TIANJI_TENANT_CONTEXT_CHANGED') {
      notifyAuthFailure('tenant-changed')
    }
    throw failure
  }
}
