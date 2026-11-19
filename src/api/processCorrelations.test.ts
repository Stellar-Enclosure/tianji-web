import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {setAuthFailureHandler} from './client'
import {isProcessCorrelationId, isProcessCorrelationQuery, isProcessCorrelationUtc, processCorrelationsApi,
  type ProcessCorrelationQuery, type ProcessCorrelationReceipt} from './processCorrelations'

const query: ProcessCorrelationQuery = {
  correlationId: 'Expense:1.2', fromInclusive: '2026-11-05T10:00:00.000001Z', toExclusive: '2026-11-05T10:20:00.000002Z',
}
const cursor = 'v1.YW5jaG9y'
const observed = '2026-11-05T10:21:00Z'
const receipt: ProcessCorrelationReceipt = {instanceId: 'instance /+账', releaseVersion: 'v1.0', submittedAt: '2026-11-05T10:00:00.000001Z'}
const snapshot = {instanceId: receipt.instanceId, definitionKey: 'expenseFlow', releaseVersion: receipt.releaseVersion,
  businessKey: 'expense-1', correlationId: query.correlationId, status: 'ACTIVE',
  submittedAt: receipt.submittedAt, finishedAt: null}
const page = (items: readonly unknown[] = [], nextCursor: string | null = null) =>
  ({correlationId: query.correlationId, observedAt: observed, items, nextCursor})
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: {'Content-Type': 'application/json'},
})
const fetchResponse = (response: Response) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response)
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
const without = <T extends object>(value: T, field: keyof T) => {
  const copy: Partial<T> = {...value}
  delete copy[field]
  return copy
}

describe('Owned Process correlation read transport', () => {
  beforeEach(() => { gatewayAuth.context.invalidate() })
  afterEach(() => {
    setAuthFailureHandler(() => {})
    gatewayAuth.context.invalidate()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects a foreign Process correlation receipt page', async () => {
    const fetcher = fetchResponse(json({...page(), correlationId: 'foreign-correlation'}))
    await expect(processCorrelationsApi.list('20', query)).rejects.toThrow('服务返回的流程关联收据无效')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('uses the exact two GETs, current tenant and signal with no body or authority selectors', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(page([receipt]))).mockResolvedValueOnce(json(snapshot))
    vi.stubGlobal('fetch', fetcher)
    const controller = new AbortController()
    await expect(processCorrelationsApi.list('20', {...query, cursor}, controller.signal)).resolves.toEqual(page([receipt]))
    await expect(processCorrelationsApi.detail('20', query.correlationId, receipt, controller.signal)).resolves.toEqual(snapshot)
    expect(Object.keys(processCorrelationsApi)).toEqual(['list', 'detail'])
    expect(fetcher).toHaveBeenCalledTimes(2)
    const prefix = new URL(gatewayAuth.authority('20').apiBaseUrl, 'https://example.test').pathname.replace(/\/$/, '')
    const urls = fetcher.mock.calls.map(([url]) => new URL(String(url), 'https://example.test'))
    expect(urls[0].pathname).toBe(prefix + '/api/tianji/v1/process-instance-correlations')
    expect(urls[0].search).toBe('?correlationId=Expense%3A1.2&fromInclusive=2026-11-05T10%3A00%3A00.000001Z'
      + '&toExclusive=2026-11-05T10%3A20%3A00.000002Z&cursor=v1.YW5jaG9y')
    expect(urls[1].pathname).toBe(prefix + '/api/tianji/v1/process-instances/instance%20%2F%2B%E8%B4%A6')
    expect(urls[1].search).toBe('')
    for (const [, request] of fetcher.mock.calls) {
      expect(request).toMatchObject({method: 'GET', credentials: 'omit', cache: 'no-store'})
      expect(request?.body).toBeUndefined()
      const headers = new Headers(request?.headers)
      expect(headers.get('X-Egon-Tianji-Tenant')).toBe('20')
      expect(headers.get('Authorization')).toBe('Bearer tianji-resource-token')
      expect(headers.get('X-CSRF-TOKEN')).toBeNull()
      expect(request?.signal?.aborted).toBe(true)
    }
    expect(controller.signal.aborted).toBe(false)
  })

  it('requires exact correlation and Gregorian UTC with a strictly positive window up to 31 days', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    expect(isProcessCorrelationId('x'.repeat(128))).toBe(true)
    for (const invalid of ['x'.repeat(129), ' expense', 'expense\n', '*', '', '账', 'expense/1']) {
      expect(isProcessCorrelationId(invalid)).toBe(false)
    }
    for (const valid of ['0001-01-01T00:00:00Z', '2000-02-29T23:59:59.1Z',
      '2026-11-05T00:00:00.000Z', '9999-12-31T23:59:59.999999Z']) expect(isProcessCorrelationUtc(valid)).toBe(true)
    for (const invalid of ['0000-01-01T00:00:00Z', '1900-02-29T00:00:00Z', '2026-02-30T00:00:00Z',
      '2026-11-05T24:00:00Z', '2026-11-05T00:00:60Z', '2026-11-05T00:00:00.0000001Z',
      '2026-11-05T00:00:00+00:00', '2026-11-05T00:00:00', '2026-11-05T00:00:00Z\n']) {
      expect(isProcessCorrelationUtc(invalid), invalid).toBe(false)
    }
    const exact31 = {...query, fromInclusive: '2026-11-01T00:00:00.000001Z', toExclusive: '2026-12-02T00:00:00.000001Z'}
    expect(isProcessCorrelationQuery(exact31)).toBe(true)
    expect(isProcessCorrelationQuery({...exact31, toExclusive: '2026-12-02T00:00:00.000002Z'})).toBe(false)
    expect(isProcessCorrelationQuery({...query, toExclusive: query.fromInclusive})).toBe(false)
    expect(isProcessCorrelationQuery({...query, fromInclusive: query.toExclusive})).toBe(false)
    expect(isProcessCorrelationQuery({...query, cursor: 'v1.' + 'a'.repeat(1197)})).toBe(true)
    expect(isProcessCorrelationQuery({...query, cursor: 'v1.' + 'a'.repeat(1198)})).toBe(false)
    expect(isProcessCorrelationQuery({...query, cursor: 'v1.YQ='})).toBe(false)
    expect(isProcessCorrelationQuery({...query, tenantId: '20'})).toBe(false)
    await expect(processCorrelationsApi.list('20', {...query, correlationId: '*'})).rejects.toThrow('流程关联查询条件无效')
    await expect(processCorrelationsApi.detail('20', query.correlationId, {...receipt, instanceId: '..'})).rejects.toThrow('流程实例收据无效')
    await expect(processCorrelationsApi.list('020', query)).rejects.toThrow('可信租户上下文不可用')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('accepts bounded page facts and preserves exact microseconds and descending unsigned UTF-8 ties', async () => {
    const tied = [{...receipt, instanceId: 'job😀'}, {...receipt, instanceId: 'job\ue000'}]
    const rows = Array.from({length: 20}, (_, index) => ({...receipt, instanceId: 'job-' + String(19 - index).padStart(2, '0')}))
    for (const valid of [page(), page(tied), page(rows, cursor),
      {...page([{...receipt, submittedAt: '2026-11-05T10:20:00.000001Z'}]), observedAt: query.toExclusive}]) {
      const fetcher = fetchResponse(json(valid))
      await expect(processCorrelationsApi.list('20', query)).resolves.toEqual(valid)
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
  })

  it('rejects extra, malformed, duplicate, over-cap, misordered or out-of-window receipts', async () => {
    const first = {...receipt, instanceId: 'job-2'}, second = {...receipt, instanceId: 'job-1'}
    const tiedWrong = [{...receipt, instanceId: 'job\ue000'}, {...receipt, instanceId: 'job😀'}]
    const full = Array.from({length: 20}, (_, index) => ({...receipt, instanceId: 'job-' + String(20 - index).padStart(2, '0')}))
    for (const invalid of [
      [], null, {...page(), total: 0}, without(page(), 'nextCursor'), {...page(), observedAt: '2026-11-05T10:20:00.000001Z'},
      {...page(), items: null}, page([without(first, 'releaseVersion')]), page([{...first, tenantId: '20'}]),
      page([{...first, releaseVersion: ' v1'}]), page([{...first, instanceId: '.'}]), page([first, first]),
      page([second, first]), page(tiedWrong), page([first, {...second, submittedAt: '2026-11-05T10:00:00.000002Z'}]),
      page([{...first, submittedAt: '2026-11-05T10:00:00.000000Z'}]), page([{...first, submittedAt: query.toExclusive}]),
      page([first], cursor), page(full, 'v1.YQ='), page([...full, {...first, instanceId: 'job-00'}]),
    ]) {
      const fetcher = fetchResponse(json(invalid))
      await expect(processCorrelationsApi.list('20', query)).rejects.toThrow('服务返回的流程关联收据无效')
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
    fetchResponse(json(page(full, cursor)))
    await expect(processCorrelationsApi.list('20', {...query, cursor})).rejects.toThrow('服务返回的流程关联收据无效')
  })

  it('validates independent Process detail and rejects wrong source affinity or fabricated fields', async () => {
    const fractional = {...receipt, submittedAt: '2026-11-05T10:10:00.1Z'}
    const completed = {...snapshot, status: 'COMPLETED', businessKey: '.', submittedAt: '2026-11-05T10:10:00.100000Z',
      finishedAt: '2026-11-05T10:20:00.000005Z'}
    fetchResponse(json(completed))
    await expect(processCorrelationsApi.detail('20', query.correlationId, fractional)).resolves.toEqual(completed)
    for (const invalid of [
      {...snapshot, instanceId: 'other'}, {...snapshot, correlationId: 'other'}, {...snapshot, releaseVersion: 'v2'},
      {...snapshot, submittedAt: '2026-11-05T10:00:00.000002Z'}, {...snapshot, status: 'UNKNOWN'},
      {...snapshot, finishedAt: observed}, {...snapshot, status: 'COMPLETED'}, {...snapshot, definitionKey: '1bad'},
      {...snapshot, agentRunId: 'foreign'}, without(snapshot, 'finishedAt'), {...snapshot, businessKey: ' foreign'},
    ]) {
      const fetcher = fetchResponse(json(invalid))
      await expect(processCorrelationsApi.detail('20', query.correlationId, receipt)).rejects.toThrow('服务返回的流程实例详情无效')
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
  })

  it('passes existing service errors through the shared tenant invalidation path without replay', async () => {
    const failureHandler = vi.fn()
    setAuthFailureHandler(failureHandler)
    const conflict = fetchResponse(json({code: 'TIANJI_TENANT_CONTEXT_CHANGED'}, 409))
    await expect(processCorrelationsApi.list('20', query)).rejects.toMatchObject({status: 409, code: 'TIANJI_TENANT_CONTEXT_CHANGED'})
    expect(failureHandler).toHaveBeenCalledExactlyOnceWith('tenant-changed')
    expect(conflict).toHaveBeenCalledTimes(1)
    const unavailable = fetchResponse(json({code: 'TIANJI_DEPENDENCY_UNAVAILABLE'}, 503))
    await expect(processCorrelationsApi.detail('20', query.correlationId, receipt)).rejects.toMatchObject({status: 503})
    expect(unavailable).toHaveBeenCalledTimes(1)
  })
})
