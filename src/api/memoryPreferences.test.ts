import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {preferencePreparation, preferenceResult} from '../test/preferenceFixtures'
import {setAuthFailureHandler} from './client'
import {memoryPreferencesApi} from './memoryPreferences'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}})
const prepared = preferencePreparation()
const {owner, scopeId, runId, sourceEventId} = prepared.command
const query = {owner, scopeId, runId, sourceEventId}

describe('Preference preparation and extraction transport', () => {
  beforeEach(() => {
    gatewayAuth.context.invalidate()
    vi.spyOn(gatewayAuth, 'csrf').mockResolvedValue({headerName: 'X-CSRF-TOKEN', token: 'test-csrf', expiresAt: new Date(Date.now() + 60_000).toISOString()})
  })
  afterEach(() => { gatewayAuth.context.invalidate(); setAuthFailureHandler(() => {}); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('keeps preparation read-only and submits only the opaque source command over cookie/CSRF POST', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(prepared)).mockResolvedValueOnce(json(preferenceResult())); vi.stubGlobal('fetch', fetcher)
    await expect(memoryPreferencesApi.prepare('20', query)).resolves.toEqual(prepared)
    await expect(memoryPreferencesApi.extract('20', prepared.command, prepared.preferenceKeys)).resolves.toEqual(preferenceResult())
    expect(String(fetcher.mock.calls[0][0])).toMatch(/\/memories\/prepare-preferences$/); expect(String(fetcher.mock.calls[1][0])).toMatch(/\/memories\/extract-preferences$/)
    const [first, second] = fetcher.mock.calls.map(call => call[1] as RequestInit)
    expect(JSON.parse(String(first.body))).toEqual(query); expect(JSON.parse(String(second.body))).toEqual(prepared.command)
    expect(second.method).toBe('POST'); expect(second.credentials).toBe('include'); expect(new Headers(second.headers).get('Authorization')).toBeNull()
    expect(new Headers(second.headers).get('X-CSRF-TOKEN')).toBe('test-csrf'); expect(new Headers(second.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
  })

  it('rejects foreign or malformed preparation and never treats it as a write command', async () => {
    for (const invalid of [{...prepared, command: {...prepared.command, owner: {type: 'USER', id: 'other'}}}, {...prepared, command: {...prepared.command, sourceEventId: 'other'}},
      {...prepared, candidateCount: '1'}, {...prepared, candidateCount: 2}, {...prepared, sensitivity: 'PUBLIC'}, {...prepared, preferenceKeys: [123]}, {...prepared, text: 'unrequested-source-body'}]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(invalid)))
      await expect(memoryPreferencesApi.prepare('20', query)).rejects.toThrow('偏好提取信息无效')
    }
  })

  it('rejects promoted, foreign or unrequested receipts and never replays a partial or uncertain write', async () => {
    const result = preferenceResult(), item = result.items[0]
    for (const invalid of [{...result, sourceEventId: 'other'}, {...result, policyRef: 'foreign'}, {...result, items: [{...item, preferenceKey: 'unrequested'}]},
      {...result, items: [{...item, receipt: {...item.receipt, stateAtMutation: 'ACTIVE'}}]}, {...result, items: [{...item, receipt: {...item.receipt, revision: 1.5}}]}, {...result, items: [item, item]}]) {
      const fetcher = vi.fn().mockResolvedValue(json(invalid)); vi.stubGlobal('fetch', fetcher)
      await expect(memoryPreferencesApi.extract('20', prepared.command, prepared.preferenceKeys)).rejects.toThrow('偏好提取信息无效'); expect(fetcher).toHaveBeenCalledTimes(1)
    }
    const fetcher = vi.fn().mockResolvedValue(json({}, 503)); vi.stubGlobal('fetch', fetcher)
    await expect(memoryPreferencesApi.extract('20', prepared.command, prepared.preferenceKeys)).rejects.toMatchObject({status: 503}); expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
