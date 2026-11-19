import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {processStartReceiptsApi, type ProcessStartReceipt, type ProcessStartReceiptQuery} from './processStartReceipts'

const query: ProcessStartReceiptQuery = {commandId: 'intent:abc-01', requestSha256: 'a'.repeat(64)}
const receipt: ProcessStartReceipt = {instanceId: 'instance-1', status: 'APPLIED', recordedAt: '2026-11-05T10:20:30.123456Z'}
const stub = (value: unknown, status = 200) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(value),
    {status, headers: {'Content-Type': 'application/json'}}))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

describe('Process owner START receipt client', () => {
  beforeEach(() => { gatewayAuth.context.invalidate() })
  afterEach(() => { gatewayAuth.context.invalidate(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('rejects a START response without exact applied evidence', async () => {
    const fetcher = stub({...receipt, status: 'PENDING'})
    await expect(processStartReceiptsApi.get('20', query)).rejects.toThrow('服务返回的 START 回执无效')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('uses only the exact encoded receipt GET and current tenant', async () => {
    const fetcher = stub(receipt)
    const controller = new AbortController()
    await expect(processStartReceiptsApi.get('20', query, controller.signal)).resolves.toEqual(receipt)
    const prefix = new URL(gatewayAuth.authority('20').apiBaseUrl, 'https://example.test').pathname.replace(/\/$/, '')
    const [url, request] = fetcher.mock.calls[0]
    const uri = new URL(String(url), 'https://example.test')
    expect(uri.pathname).toBe(prefix + '/api/tianji/v1/process-start-receipts')
    expect(uri.search).toBe('?commandId=intent%3Aabc-01&requestSha256=' + query.requestSha256)
    expect(request).toMatchObject({method: 'GET', cache: 'no-store', credentials: 'omit'})
    expect(request?.body).toBeUndefined()
    expect(new Headers(request?.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
    controller.abort()
    expect(request?.signal?.aborted).toBe(true)
  })

  it('rejects malformed inputs and overbroad receipt bodies', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    for (const invalid of [{...query, commandId: ' intent:abc-01'}, {...query, commandId: 'intent:abc-01\n'},
      {...query, commandId: '../intent'}, {...query, requestSha256: 'A'.repeat(64)}, {...query, requestSha256: 'a'.repeat(65)}]) {
      await expect(processStartReceiptsApi.get('20', invalid)).rejects.toThrow('START 回执查询条件无效')
    }
    expect(fetcher).not.toHaveBeenCalled()
    for (const invalid of [{...receipt, requestSha256: query.requestSha256}, {...receipt, instanceId: '..'},
      {...receipt, recordedAt: '2026-02-30T10:20:30Z'}, {...receipt, recordedAt: '2026-11-05T10:20:30+00:00'},
      {...receipt, recordedAt: '2026-11-05T10:20:30.1234567Z'}, {...receipt, status: null}]) {
      stub(invalid)
      await expect(processStartReceiptsApi.get('20', query)).rejects.toThrow('服务返回的 START 回执无效')
    }
  })

  it('preserves 404 as a read failure without inventing a receipt', async () => {
    const fetcher = stub({code: 'TIANJI_RESOURCE_NOT_FOUND', correlationId: null}, 404)
    await expect(processStartReceiptsApi.get('20', query)).rejects.toMatchObject({status: 404})
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('uses the same owner GET to recover a V2 request by its original digest without replaying START', async () => {
    const original = {
      commandId: 'start:v2-receipt',
      requestSha256: '7cfa4c0086eaadc9837ce74cbf54d7420a290d50fdad3d30db4ed485ff411323',
    }
    const fetcher = stub(receipt)
    const controller = new AbortController()
    await expect(processStartReceiptsApi.get('20', original, controller.signal)).resolves.toEqual(receipt)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0]
    const uri = new URL(String(url), 'https://example.test')
    expect(uri.pathname).toMatch(/\/api\/tianji\/v1\/process-start-receipts$/)
    expect(Object.fromEntries(uri.searchParams)).toEqual(original)
    expect(init).toMatchObject({method: 'GET', cache: 'no-store'})
    expect(init?.body).toBeUndefined()
    controller.abort()
    expect(init?.signal?.aborted).toBe(true)

    const unknown = stub({code: 'TIANJI_RESOURCE_NOT_FOUND', correlationId: null}, 404)
    await expect(processStartReceiptsApi.get('20', original)).rejects.toMatchObject({status: 404})
    expect(unknown).toHaveBeenCalledTimes(1)
    expect(unknown.mock.calls[0][1]?.method).toBe('GET')

    for (const invalid of [
      {...receipt, profile: 'AUTOMATION_V2'},
      {...receipt, requestSha256: original.requestSha256},
      {...receipt, variables: {amount: '1.00'}},
      {...receipt, status: 'RECEIVED'},
    ]) {
      stub(invalid)
      await expect(processStartReceiptsApi.get('20', original)).rejects.toThrow('服务返回的 START 回执无效')
    }
  })

})
