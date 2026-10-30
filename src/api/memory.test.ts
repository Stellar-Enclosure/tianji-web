import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {candidate} from '../test/memoryFixtures'
import {setAuthFailureHandler} from './client'
import {memoryApi, type MemoryCandidateQuery, type ReviewCommand} from './memory'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}})
const query: MemoryCandidateQuery = {owner: {type: 'USER', id: 'subject-20'}, scopeId: 'research', kind: null, afterMemoryId: null, limit: 20}
const entry = candidate()
const command: ReviewCommand = {commandId: 'review-1', owner: entry.owner, scopeId: entry.scopeId, memoryId: entry.memoryId, expectedRevision: entry.revision,
  content: entry.content, source: {reference: 'human-review:candidate-1', evidenceSha256: entry.contentSha256, sourceRunId: null, sourceEventId: null}, confidence: 1, reasonCode: 'USER_CONFIRMED'}
const receipt = {commandId: command.commandId, owner: entry.owner, scopeId: entry.scopeId, memoryId: entry.memoryId, revision: 2,
  outcome: 'CORRECTED', stateAtMutation: 'ACTIVE', occurredAt: '2026-10-31T00:00:00Z'}

describe('Memory review transport', () => {
  beforeEach(() => {
    gatewayAuth.context.invalidate()
    vi.spyOn(gatewayAuth, 'csrf').mockResolvedValue({headerName: 'X-CSRF-TOKEN', token: 'test-csrf', expiresAt: new Date(Date.now() + 60_000).toISOString()})
  })
  afterEach(() => { gatewayAuth.context.invalidate(); setAuthFailureHandler(() => {}); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('keeps the owner/query in a cookie and CSRF protected body with an expected tenant', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({owner: query.owner, scopeId: query.scopeId, items: [entry], nextAfterMemoryId: null})); vi.stubGlobal('fetch', fetcher)
    await expect(memoryApi.candidates('20', query)).resolves.toMatchObject({items: [entry]})
    expect(String(fetcher.mock.calls[0][0])).toMatch(/\/api\/tianji\/v1\/memories\/candidates$/)
    const request = fetcher.mock.calls[0][1] as RequestInit
    expect(request.method).toBe('POST'); expect(request.credentials).toBe('include'); expect(JSON.parse(String(request.body))).toEqual(query)
    expect(new Headers(request.headers).get('Authorization')).toBeNull(); expect(new Headers(request.headers).get('X-CSRF-TOKEN')).toBe('test-csrf'); expect(new Headers(request.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
  })

  it('rejects confirmed, foreign, malformed and oversized pages before review can use them', async () => {
    for (const items of [[{...entry, state: 'ACTIVE', confirmed: true}], [{...entry, owner: {type: 'USER', id: 'other'}}],
      [{...entry, revision: 1.5}], [{...entry, content: {text: null, facts: {unsafe: 12}}}], [{...entry, confidence: '0.5'}], [{...entry, unknown: true}]]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({owner: query.owner, scopeId: query.scopeId, items, nextAfterMemoryId: null})))
      await expect(memoryApi.candidates('20', query)).rejects.toThrow('候选记忆格式无效')
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({owner: query.owner, scopeId: query.scopeId, items: [candidate('b'), candidate('a')], nextAfterMemoryId: null})))
    await expect(memoryApi.candidates('20', query)).rejects.toThrow('候选记忆格式无效')
  })

  it('binds a receipt to its exact command/operation/revision and never replays an uncertain write', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(receipt)).mockResolvedValueOnce(json({...receipt, commandId: 'foreign'})).mockResolvedValueOnce(json({code: 'TIANJI_DEPENDENCY_UNAVAILABLE'}, 503))
    vi.stubGlobal('fetch', fetcher)
    await expect(memoryApi.confirm('20', command)).resolves.toEqual(receipt)
    await expect(memoryApi.confirm('20', command)).rejects.toThrow('候选记忆格式无效')
    await expect(memoryApi.confirm('20', command)).rejects.toMatchObject({status: 503})
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('preserves the service contract for a candidate without an expiry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({owner: query.owner, scopeId: query.scopeId, items: [{...entry, expiresAt: null}], nextAfterMemoryId: null})))
    await expect(memoryApi.candidates('20', query)).resolves.toMatchObject({items: [{expiresAt: null}]})
  })
})
