import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {agentRecoveryApi, type RecoveryDisposition} from './agentRecovery'

const fixture: RecoveryDisposition = {runId: 'run-1', observedAt: '2026-11-05T10:20:00.000005Z',
  lifecycle: 'STALLED', reason: 'LEASE_EXPIRED', agentEffect: 'UNVERIFIED',
  toolEvidence: {coverage: 'TRUNCATED', hasDispatching: true, hasUnknownResult: null, hasUnresolvedWrite: true, hasLocalReceipt: null},
  evidenceConflict: false}
const response = (value: unknown) => new Response(JSON.stringify(value), {headers: {'Content-Type': 'application/json'}})
const stub = (value: unknown) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(value))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

describe('Agent owner recovery evidence client', () => {
  beforeEach(() => { gatewayAuth.context.invalidate() })
  afterEach(() => { gatewayAuth.context.invalidate(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('rejects recovery evidence belonging to a different run', async () => {
    const fetcher = stub({...fixture, runId: 'run-2'})
    await expect(agentRecoveryApi.get('20', 'run-1')).rejects.toThrow('服务返回的恢复证据无效')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('reads only the exact owner GET with tenant binding, abort and no-store', async () => {
    const fetcher = stub(fixture)
    const controller = new AbortController()
    await expect(agentRecoveryApi.get('20', 'run-1', controller.signal)).resolves.toEqual(fixture)
    const prefix = new URL(gatewayAuth.applicationBaseUrl, 'https://example.test').pathname.replace(/\/$/, '')
    const [url, request] = fetcher.mock.calls[0]
    const target = new URL(String(url), 'https://example.test')
    expect(target.pathname).toBe(prefix + '/api/tianji/v1/agent-runs/run-1/recovery-disposition')
    expect(target.search).toBe('')
    expect(request).toMatchObject({method: 'GET', cache: 'no-store', credentials: 'include'})
    expect(new Headers(request?.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
    expect(new Headers(request?.headers).get('Authorization')).toBeNull()
    controller.abort()
    expect(request?.signal?.aborted).toBe(true)
  })

  it('fails closed on malformed evidence and an unsupported run identifier', async () => {
    for (const value of [
      {...fixture, hostInvocationId: 'private'},
      {...fixture, observedAt: '2026-11-05T10:20:00+00:00'},
      {...fixture, lifecycle: 'TERMINAL'},
      {...fixture, agentEffect: 'RECORDED_NONE'},
      {...fixture, toolEvidence: {...fixture.toolEvidence, hasDispatching: null}},
      {...fixture, toolEvidence: {...fixture.toolEvidence, hasUnknownResult: false}},
      {...fixture, toolEvidence: {...fixture.toolEvidence, coverage: 'COMPLETE'}},
      {...fixture, toolEvidence: {...fixture.toolEvidence, coverage: 'UNAVAILABLE'}},
      {...fixture, evidenceConflict: true},
    ]) {
      stub(value)
      await expect(agentRecoveryApi.get('20', 'run-1')).rejects.toThrow('服务返回的恢复证据无效')
    }
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    for (const runId of ['', '../run', 'a'.repeat(65), 'run-1\n']) {
      await expect(agentRecoveryApi.get('20', runId)).rejects.toThrow('运行标识无效')
    }
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('keeps confirmed conflict and wholly unavailable tool evidence distinct', async () => {
    const conflict: RecoveryDisposition = {...fixture, lifecycle: 'TERMINAL', reason: 'TERMINAL_RECORDED',
      agentEffect: 'RECORDED_NONE', evidenceConflict: true}
    const unavailable: RecoveryDisposition = {...fixture, toolEvidence: {coverage: 'UNAVAILABLE',
      hasDispatching: null, hasUnknownResult: null, hasUnresolvedWrite: null, hasLocalReceipt: null}}
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(conflict)).mockResolvedValueOnce(response(unavailable))
    vi.stubGlobal('fetch', fetcher)
    await expect(agentRecoveryApi.get('20', 'run-1')).resolves.toEqual(conflict)
    await expect(agentRecoveryApi.get('20', 'run-1')).resolves.toEqual(unavailable)
  })
})
