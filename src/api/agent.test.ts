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
