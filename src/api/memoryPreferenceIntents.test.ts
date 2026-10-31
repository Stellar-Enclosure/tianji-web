import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {preferenceIntentCancellation, preferenceIntentQuery, preferenceIntentStatus} from '../test/preferenceIntentFixtures'
import {setAuthFailureHandler} from './client'
import {memoryPreferenceIntentsApi} from './memoryPreferenceIntents'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}})
const query = preferenceIntentQuery()
const command = {...query, commandId: 'cancel-1', expectedRevision: 3}

describe('Owned preference extraction status and cancellation transport', () => {
  beforeEach(() => {
    gatewayAuth.context.invalidate()
    vi.spyOn(gatewayAuth, 'csrf').mockResolvedValue({headerName: 'X-CSRF-TOKEN', token: 'test-csrf', expiresAt: new Date(Date.now() + 60_000).toISOString()})
  })
  afterEach(() => { gatewayAuth.context.invalidate(); setAuthFailureHandler(() => {}); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('uses private cookie/CSRF POST with only source intention and the original cancellation body', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(preferenceIntentStatus())).mockResolvedValueOnce(json(preferenceIntentCancellation())); vi.stubGlobal('fetch', fetcher)
    await expect(memoryPreferenceIntentsApi.status('20', query)).resolves.toEqual(preferenceIntentStatus())
    await expect(memoryPreferenceIntentsApi.cancel('20', command)).resolves.toEqual(preferenceIntentCancellation())
    expect(String(fetcher.mock.calls[0][0])).toMatch(/\/preference-intents\/status$/); expect(String(fetcher.mock.calls[1][0])).toMatch(/\/preference-intents\/cancel$/)
    const [read, write] = fetcher.mock.calls.map(call => call[1] as RequestInit)
    expect(JSON.parse(String(read.body))).toEqual(query); expect(JSON.parse(String(write.body))).toEqual(command)
    expect(write.method).toBe('POST'); expect(write.credentials).toBe('include'); expect(new Headers(write.headers).get('Authorization')).toBeNull()
    expect(new Headers(write.headers).get('X-CSRF-TOKEN')).toBe('test-csrf'); expect(new Headers(write.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
  })

  it('distinguishes not requested and rejects foreign coerced or unrequested status projections', async () => {
    const pending = preferenceIntentStatus(), intent = pending.intent!
    for (const invalid of [{...pending, owner: {type: 'USER', id: 'other'}}, {...pending, scopeId: 'other'}, {...pending, runId: 'other'}, {...query},
      {...pending, intent: {...intent, state: 'UNKNOWN'}}, {...pending, intent: {...intent, revision: '3'}}, {...pending, intent: {...intent, nextIndex: 1}},
      {...pending, intent: {...intent, intentId: '1-1-1-1-1'}}, {...pending, intent: {...intent, closedAt: intent.updatedAt}}, {...pending, ciphertext: 'unrequested'},
      {...pending, intent: {...intent, updatedAt: '2026-10-30T00:00:00Z'}}, {...pending, intent: {...intent, attemptCount: 101}}]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(invalid)))
      await expect(memoryPreferenceIntentsApi.status('20', query)).rejects.toThrow('提取状态无效')
    }
    const absent = {...query, intent: null}; vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(absent)))
    await expect(memoryPreferenceIntentsApi.status('20', query)).resolves.toEqual(absent)
  })

  it('checks the cancellation command scope terminal state and exact revision without replaying an uncertain POST', async () => {
    const result = preferenceIntentCancellation(), intent = result.status.intent!
    for (const invalid of [{...result, commandId: 'other'}, {...result, status: {...result.status, runId: 'other'}}, {...result, status: {...result.status, intent: null}},
      {...result, status: {...result.status, intent: {...intent, revision: 5}}}, {...result, status: {...result.status, intent: {...intent, state: 'REJECTED'}}},
      {...result, status: preferenceIntentStatus('READY')}, {...result, requestSha256: 'caller'}]) {
      const fetcher = vi.fn().mockResolvedValue(json(invalid)); vi.stubGlobal('fetch', fetcher)
      await expect(memoryPreferenceIntentsApi.cancel('20', command)).rejects.toThrow('提取状态无效'); expect(fetcher).toHaveBeenCalledTimes(1)
    }
    const ended = {commandId: command.commandId, status: preferenceIntentStatus('APPLIED', 3)}; vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(ended)))
    await expect(memoryPreferenceIntentsApi.cancel('20', command)).resolves.toEqual(ended)
    const fetcher = vi.fn().mockResolvedValue(json({}, 503)); vi.stubGlobal('fetch', fetcher)
    await expect(memoryPreferenceIntentsApi.cancel('20', command)).rejects.toMatchObject({status: 503}); expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
