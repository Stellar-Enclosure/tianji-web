import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {run} from '../test/fixtures'
import {agentApi, type CancelCommand} from './agent'
import {setAuthFailureHandler} from './client'
import type {ProcessCorrelationQuery} from './processCorrelations'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value),
  {status, headers: {'Content-Type': 'application/json'}})
const command: CancelCommand = {runId: 'run-1', commandId: 'cancel-1', expectedRevision: 2, reason: 'USER'}

const correlation: ProcessCorrelationQuery = {
  correlationId: 'Expense:1', fromInclusive: '2026-11-05T10:00:00.000001Z', toExclusive: '2026-11-05T10:20:00.000002Z',
}
const owned = {...run(), createdAt: '2026-11-05T10:05:00.123456Z'}
const boundCursor = 'v1.YW5jaG9y'

describe('Agent JSON client', () => {
  beforeEach(() => {
    gatewayAuth.context.invalidate()
  })
  afterEach(() => { gatewayAuth.context.invalidate(); setAuthFailureHandler(() => {}); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('sends an authorized cancellation with the current tenant and Resource Bearer', async () => {
    const result = {runId: 'run-1', accepted: true, status: 'CANCELLED', revision: 3}
    const fetcher = vi.fn().mockResolvedValue(json(result))
    vi.stubGlobal('fetch', fetcher)
    await expect(agentApi.cancel('20', command)).resolves.toEqual(result)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, request] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(new URL(url, 'https://example.test').pathname).toMatch(/\/agent-runs\/run-1\/cancel$/)
    expect(request.method).toBe('POST')
    expect(request.credentials).toBe('omit')
    expect(new Headers(request.headers).get('Authorization')).toBe('Bearer tianji-resource-token')
    expect(new Headers(request.headers).get('X-CSRF-TOKEN')).toBeNull()
    expect(new Headers(request.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
    expect(JSON.parse(String(request.body))).toEqual(command)
  })

  it('does not replay a failed cancellation mutation', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({code: 'TIANJI_DEPENDENCY_UNAVAILABLE'}, 503))
    vi.stubGlobal('fetch', fetcher)
    await expect(agentApi.cancel('20', command)).rejects.toMatchObject({status: 503})
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed responses and unsafe run identifiers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({items: [{runId: 'other'}], nextCursor: null})))
    await expect(agentApi.list('20')).rejects.toThrow('服务返回的数据格式无效')
    await expect(agentApi.get('20', '../foreign')).rejects.toThrow('运行标识无效')
  })

  it('projects existing result usage without forwarding numeric amounts or private references', async () => {
    const base = {runId: 'run-1', status: 'COMPLETED', output: {text: 'final answer'}, errorCode: null, sideEffectOutcome: null}
    const usage = {kind: 'ACTUAL', inputTokens: 0, outputTokens: 7, totalTokens: 7,
      cost: 0, currency: 'USD', priceVersionRef: 'private-price-reference'}
    const fetcher = vi.fn().mockResolvedValue(json({...base, usage}))
    vi.stubGlobal('fetch', fetcher)
    const controller = new AbortController()

    await expect(agentApi.result('20', 'run-1', controller.signal)).resolves.toEqual({...base, usage: {
      kind: 'ACTUAL', inputTokens: 0, outputTokens: 7, totalTokens: 7, costReported: true,
    }})
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, request] = fetcher.mock.calls[0] as [string, RequestInit]
    const path = new URL(url, 'https://example.test')
    const prefix = new URL(gatewayAuth.authority('20').apiBaseUrl, 'https://example.test').pathname.replace(/\/$/, '')
    expect(path.pathname).toBe(prefix + '/api/tianji/v1/agent-runs/run-1/result')
    expect(path.search).toBe('')
    expect(request.method ?? 'GET').toBe('GET')
    expect(request.body).toBeUndefined()
    expect(request.credentials).toBe('omit')
    expect(new Headers(request.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
    expect(request.signal?.aborted).toBe(true)
    expect(controller.signal.aborted).toBe(false)
  })

  it('keeps output available when optional usage is missing, null or malformed', async () => {
    const base = {runId: 'run-1', status: 'FAILED', output: {text: 'still readable'}, errorCode: 'FAILED', sideEffectOutcome: 'UNKNOWN'}
    const usage = {kind: 'ACTUAL', inputTokens: 0, outputTokens: null, totalTokens: null,
      cost: null, currency: null, priceVersionRef: null}
    const fetcher = vi.fn()
    for (const payload of [
      base, {...base, usage: null}, {...base, usage: []}, {...base, usage: {kind: 'ACTUAL'}},
      {...base, usage: {...usage, kind: 'NEW_KIND'}}, {...base, usage: {...usage, inputTokens: -1}},
      {...base, usage: {...usage, inputTokens: '0'}}, {...base, usage: {...usage, inputTokens: 1.5}},
      {...base, usage: {...usage, cost: 0}}, {...base, usage: {...usage, cost: -1, currency: 'USD'}},
      {...base, usage: {...usage, providerRoute: 'never-forwarded'}},
    ]) fetcher.mockResolvedValueOnce(json(payload))
    vi.stubGlobal('fetch', fetcher)
    for (let i = 0; i < 11; i++) await expect(agentApi.result('20', 'run-1')).resolves.toEqual({...base, usage: null})
    expect(fetcher).toHaveBeenCalledTimes(11)
  })

  it('preserves only safe counters and never treats a rounded or underflowed fee as exact', async () => {
    const base = {runId: 'run-1', status: 'COMPLETED', output: {}, errorCode: null, sideEffectOutcome: null}
    const raw = JSON.stringify(base).slice(0, -1)
      + ',"usage":{"kind":"ESTIMATED","inputTokens":9007199254740993,"outputTokens":0,"totalTokens":null,'
      + '"cost":1e-400,"currency":"USD","priceVersionRef":null}}'
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(raw, {headers: {'Content-Type': 'application/json'}}))
      .mockResolvedValueOnce(json({...base, usage: {kind: 'UNKNOWN', inputTokens: 3, outputTokens: 4,
        totalTokens: 7, cost: 4, currency: 'USD', priceVersionRef: null}}))
      .mockResolvedValueOnce(json({...base, runId: 'other'}))
    vi.stubGlobal('fetch', fetcher)
    await expect(agentApi.result('20', 'run-1')).resolves.toEqual({...base, usage: {
      kind: 'ESTIMATED', inputTokens: null, outputTokens: 0, totalTokens: null, costReported: true,
    }})
    await expect(agentApi.result('20', 'run-1')).resolves.toEqual({...base, usage: {
      kind: 'UNKNOWN', inputTokens: null, outputTokens: null, totalTokens: null, costReported: false,
    }})
    await expect(agentApi.result('20', 'run-1')).rejects.toThrow('服务返回的数据格式无效')
  })

  it('rejects an Agent run outside the captured correlation window', async () => {
    const outside = {...run(), createdAt: '2026-11-05T10:20:00.000002Z'}
    const fetcher = vi.fn().mockResolvedValue(json({items: [outside], nextCursor: null}))
    vi.stubGlobal('fetch', fetcher)

    await expect(agentApi.listByCorrelation('20', correlation)).rejects.toThrow('服务返回的 Agent 关联运行无效')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('filters the same GET with only the exact fields and keeps the legacy list request', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({items: [owned], nextCursor: null}))
      .mockResolvedValueOnce(json({items: [run()], nextCursor: 'legacy-token'}))
    vi.stubGlobal('fetch', fetcher)
    const controller = new AbortController()
    await expect(agentApi.listByCorrelation('20', {...correlation, cursor: boundCursor}, controller.signal))
      .resolves.toEqual({items: [owned], nextCursor: null})
    await expect(agentApi.list('20', 'legacy-token', controller.signal)).resolves.toEqual({items: [run()], nextCursor: 'legacy-token'})
    expect(fetcher).toHaveBeenCalledTimes(2)
    const urls = fetcher.mock.calls.map(([url]) => new URL(String(url), 'https://example.test'))
    const prefix = new URL(gatewayAuth.authority('20').apiBaseUrl, 'https://example.test').pathname.replace(/\/$/, '')
    expect(urls[0].pathname).toBe(prefix + '/api/tianji/v1/agent-runs')
    expect(urls[1].pathname).toBe(urls[0].pathname)
    expect(urls[0].search).toBe('?correlationId=Expense%3A1&fromInclusive=2026-11-05T10%3A00%3A00.000001Z'
      + '&toExclusive=2026-11-05T10%3A20%3A00.000002Z&cursor=v1.YW5jaG9y')
    expect(urls[1].search).toBe('?limit=20&cursor=legacy-token')
    const [, request] = fetcher.mock.calls[0]
    expect(request).toMatchObject({method: 'GET', credentials: 'omit', cache: 'no-store'})
    expect(request?.body).toBeUndefined()
    const headers = new Headers(request?.headers)
    expect(headers.get('X-Egon-Tianji-Tenant')).toBe('20')
    expect(headers.get('Authorization')).toBe('Bearer tianji-resource-token')
    expect(headers.get('X-CSRF-TOKEN')).toBeNull()
    controller.abort()
    expect(request?.signal?.aborted).toBe(true)
  })

  it('rejects invalid filter input before fetch and applies the stricter Agent cursor bound', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    for (const invalid of [
      {...correlation, correlationId: ' Expense'}, {...correlation, toExclusive: correlation.fromInclusive},
      {...correlation, fromInclusive: '2026-11-05T10:00:60Z'}, {...correlation, toExclusive: '2026-12-07T10:00:00Z'},
      {...correlation, cursor: 'legacy-token'}, {...correlation, cursor: 'v1.YQ='},
      {...correlation, cursor: 'v1.' + 'a'.repeat(254)}, {...correlation, limit: 20},
    ]) await expect(agentApi.listByCorrelation('20', invalid)).rejects.toThrow('Agent 关联查询条件无效')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('accepts a 20-run page and exact tie order, and rejects corrupt or nonprogressing filtered pages', async () => {
    const rows = Array.from({length: 20}, (_, index) => ({...owned, runId: 'run-' + String(19 - index).padStart(2, '0')}))
    const first = {items: rows, nextCursor: boundCursor}
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(first)))
    await expect(agentApi.listByCorrelation('20', correlation)).resolves.toEqual(first)
    for (const invalid of [
      {items: [], nextCursor: null, total: 2}, {items: [owned]}, {items: [...rows, owned], nextCursor: null},
      {items: [owned, owned], nextCursor: null}, {items: rows.slice().reverse(), nextCursor: null},
      {items: [{...owned, agentResult: 'hidden'}], nextCursor: null},
      {items: [{...owned, runId: 'a'.repeat(65)}], nextCursor: null},
      {items: [{...owned, createdAt: '2026-11-05T10:00:00.000000Z'}], nextCursor: null},
      {items: [owned], nextCursor: boundCursor}, {items: rows, nextCursor: 'v1.YQ='}, first,
    ]) {
      const fetcher = vi.fn().mockResolvedValueOnce(json(invalid))
      vi.stubGlobal('fetch', fetcher)
      await expect(agentApi.listByCorrelation('20', {...correlation, cursor: boundCursor}))
        .rejects.toThrow('服务返回的 Agent 关联运行无效')
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
  })

  it('preserves the existing global authority invalidation on a real filtered LIST 403', async () => {
    const handler = vi.fn()
    setAuthFailureHandler(handler)
    const fetcher = vi.fn().mockResolvedValueOnce(json({code: 'TIANJI_PERMISSION_DENIED'}, 403))
    vi.stubGlobal('fetch', fetcher)
    const epoch = gatewayAuth.context.epoch
    await expect(agentApi.listByCorrelation('20', correlation)).rejects.toMatchObject({status: 403, code: 'TIANJI_PERMISSION_DENIED'})
    expect(handler).toHaveBeenCalledExactlyOnceWith('forbidden')
    expect(gatewayAuth.context.epoch).toBeGreaterThan(epoch)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('clears the context when the verified tenant does not match', async () => {
    const handler = vi.fn()
    setAuthFailureHandler(handler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({code: 'TIANJI_TENANT_CONTEXT_CHANGED'}, 409)))
    const before = gatewayAuth.context.epoch
    await expect(agentApi.get('20', 'run-1')).rejects.toMatchObject({status: 409})
    expect(handler).toHaveBeenCalledWith('tenant-changed')
    expect(gatewayAuth.context.epoch).toBeGreaterThan(before)
  })
})
