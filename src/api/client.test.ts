import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {requestJson, setAuthFailureHandler} from './client'

const scheduled = {outcome: 'SCHEDULED'}
const retryPath = '/api/tianji/v2/process-instances/pi-1/node-retries'
const json = (status: number, value: unknown): Response => new Response(JSON.stringify(value), {
  status,
  headers: {'Content-Type': 'application/json'},
})

describe('authenticated API client', () => {
  beforeEach(() => gatewayAuth.context.invalidate())
  afterEach(() => {
    setAuthFailureHandler(() => {})
    gatewayAuth.context.invalidate()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('requires the requested success status for the same JSON and sends the Tianji Resource Bearer', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(202, scheduled))
      .mockResolvedValueOnce(json(200, scheduled)).mockResolvedValueOnce(json(200, scheduled))
    vi.stubGlobal('fetch', fetcher)

    const init = {method: 'POST', body: JSON.stringify({commandId: 'node-retry-1'})}

    await expect(requestJson(retryPath, '20', init, 202)).resolves.toEqual(scheduled)
    await expect(requestJson(retryPath, '20', init, 202)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE', status: 200, retryable: false,
    })
    await expect(requestJson(retryPath, '20', init)).resolves.toEqual(scheduled)
    expect(fetcher).toHaveBeenCalledTimes(3)
    for (const [, request] of fetcher.mock.calls) {
      expect(request).toMatchObject({...init, cache: 'no-store', redirect: 'error', credentials: 'omit'})
      const headers = new Headers(request?.headers)
      expect(headers.get('X-CSRF-TOKEN')).toBeNull()
      expect(headers.get('Authorization')).toBe('Bearer tianji-resource-token')
      expect(headers.get('X-Egon-Tianji-Tenant')).toBe('20')
    }
  })

  it('keeps application failures and tenant invalidation intact', async () => {
    const onAuthFailure = vi.fn()
    setAuthFailureHandler(onAuthFailure)
    vi.stubGlobal('fetch', vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(404, {code: 'TIANJI_RESOURCE_NOT_FOUND'}))
      .mockResolvedValueOnce(json(409, {code: 'TIANJI_TENANT_CONTEXT_CHANGED'}))
      .mockResolvedValueOnce(json(401, {code: 'NOT_LOGGED_IN'})))

    await expect(requestJson('/resource', '20', {}, 200)).rejects.toMatchObject({
      status: 404, code: 'TIANJI_RESOURCE_NOT_FOUND',
    })
    await expect(requestJson('/resource', '20', {}, 200)).rejects.toMatchObject({
      status: 409, code: 'TIANJI_TENANT_CONTEXT_CHANGED',
    })
    await expect(requestJson('/resource', '20', {}, 200)).rejects.toMatchObject({
      status: 401, code: 'NOT_LOGGED_IN',
    })
    expect(onAuthFailure.mock.calls).toEqual([['tenant-changed'], ['unauthenticated']])
  })

  it('keeps 503 distinct and dispatches a write once', async () => {
    const handler = vi.fn()
    setAuthFailureHandler(handler)
    const fetcher = vi.fn().mockResolvedValue(json(503, {code: 'TIANJI_DEPENDENCY_UNAVAILABLE'}))
    vi.stubGlobal('fetch', fetcher)
    const epoch = gatewayAuth.context.epoch
    await expect(requestJson(retryPath, '20', {method: 'POST'}, 202)).rejects.toMatchObject({
      status: 503, code: 'TIANJI_DEPENDENCY_UNAVAILABLE',
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(handler).not.toHaveBeenCalled()
    expect(gatewayAuth.context.epoch).toBe(epoch)
  })

  it('propagates a caller abort while the resource request is still in flight', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn<typeof fetch>((_, request) => new Promise((_resolve, reject) => {
      const signal = request!.signal!
      expect(signal.aborted).toBe(false)
      signal.addEventListener('abort', () => reject(signal.reason), {once: true})
    }))
    vi.stubGlobal('fetch', fetcher)
    const pending = requestJson('/resource', '20', {signal: controller.signal})
    expect(fetcher).toHaveBeenCalledTimes(1)
    controller.abort()
    await expect(pending).rejects.toMatchObject({name: 'AbortError'})
  })

  it('isolates response status across concurrent requests', async () => {
    let finishFirst!: (response: Response) => void
    let finishSecond!: (response: Response) => void
    const first = new Promise<Response>(resolve => { finishFirst = resolve })
    const second = new Promise<Response>(resolve => { finishSecond = resolve })
    vi.stubGlobal('fetch', vi.fn<typeof fetch>()
      .mockReturnValueOnce(first).mockReturnValueOnce(second))

    const retry = requestJson('/retry', '20', {}, 202)
    const query = requestJson('/query', '20', {}, 200)
    finishSecond(json(202, scheduled))
    await expect(query).rejects.toMatchObject({status: 202, code: 'INVALID_RESPONSE'})
    finishFirst(json(202, scheduled))
    await expect(retry).resolves.toEqual(scheduled)
  })
})
