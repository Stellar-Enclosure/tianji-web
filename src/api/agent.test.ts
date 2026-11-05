import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {run} from '../test/fixtures'
import {agentApi, type StartCommand} from './agent'
import {setAuthFailureHandler} from './client'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value),
  {status, headers: {'Content-Type': 'application/json'}})
const command: StartCommand = {definitionKey: 'research', definitionVersion: 1, idempotencyKey: 'request-1',
  input: {text: 'question', artifactRefs: [], taskData: {}}, sessionId: null, businessKey: null,
  correlationId: null, policyOverride: null}

describe('Agent JSON client', () => {
  beforeEach(() => {
    gatewayAuth.context.invalidate()
    vi.spyOn(gatewayAuth, 'csrf').mockResolvedValue({headerName: 'X-CSRF-TOKEN', token: 'test-csrf',
      expiresAt: new Date(Date.now() + 60_000).toISOString()})
  })
  afterEach(() => { gatewayAuth.context.invalidate(); setAuthFailureHandler(() => {}); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('sends one cookie and CSRF protected mutation without an Authorization header', async () => {
    const fetcher = vi.fn().mockResolvedValue(json(run()))
    vi.stubGlobal('fetch', fetcher)
    await expect(agentApi.start('20', command)).resolves.toEqual(run())
    expect(fetcher).toHaveBeenCalledTimes(1)
    const request = fetcher.mock.calls[0][1] as RequestInit
    expect(request.credentials).toBe('include')
    expect(new Headers(request.headers).get('Authorization')).toBeNull()
    expect(new Headers(request.headers).get('X-CSRF-TOKEN')).toBe('test-csrf')
    expect(new Headers(request.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
    expect(JSON.parse(String(request.body))).toEqual(command)
  })

  it('does not replay a failed mutation', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({code: 'TIANJI_DEPENDENCY_UNAVAILABLE'}, 503))
    vi.stubGlobal('fetch', fetcher)
    await expect(agentApi.start('20', command)).rejects.toMatchObject({status: 503})
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
    const prefix = new URL(gatewayAuth.applicationBaseUrl, 'https://example.test').pathname.replace(/\/$/, '')
    expect(path.pathname).toBe(prefix + '/api/tianji/v1/agent-runs/run-1/result')
    expect(path.search).toBe('')
    expect(request.method ?? 'GET').toBe('GET')
    expect(request.body).toBeUndefined()
    expect(request.credentials).toBe('include')
    expect(new Headers(request.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
    expect(request.signal?.aborted).toBe(false)
    controller.abort()
    expect(request.signal?.aborted).toBe(true)
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
