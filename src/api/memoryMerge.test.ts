import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {activeMemory, memoryMergePage} from '../test/memoryMergeFixtures'
import {setAuthFailureHandler} from './client'
import {memoryMergeApi, type MemoryMergeQuery} from './memoryMerge'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}})
const page = memoryMergePage(), source = page.candidate
const query: MemoryMergeQuery = {owner: source.owner, scopeId: source.scopeId, memoryId: source.memoryId, expectedRevision: source.revision, semantic: false, afterMemoryId: null, limit: 5, minimumScore: null}

describe('Scoped memory comparison transport', () => {
  beforeEach(() => { gatewayAuth.context.invalidate(); vi.spyOn(gatewayAuth, 'csrf').mockResolvedValue({headerName: 'X-CSRF-TOKEN', token: 'test-csrf', expiresAt: new Date(Date.now() + 60_000).toISOString()}) })
  afterEach(() => { gatewayAuth.context.invalidate(); setAuthFailureHandler(() => {}); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('keeps the comparison private and preserves continuation through a nonmatching page', async () => {
    const partial = {...page, items: [], nextAfterMemoryId: 'scanned'}
    const fetcher = vi.fn().mockResolvedValue(json(partial)); vi.stubGlobal('fetch', fetcher)
    await expect(memoryMergeApi.compare('20', query, source.contentSha256)).resolves.toEqual(partial)
    const request = fetcher.mock.calls[0][1] as RequestInit
    expect(String(fetcher.mock.calls[0][0])).toMatch(/\/memories\/merge-suggestions$/); expect(request.method).toBe('POST'); expect(request.credentials).toBe('include')
    expect(JSON.parse(String(request.body))).toEqual(query); expect(new Headers(request.headers).get('Authorization')).toBeNull()
    expect(new Headers(request.headers).get('X-CSRF-TOKEN')).toBe('test-csrf'); expect(new Headers(request.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
  })

  it('rejects changed candidates, promoted source states, foreign targets and ambiguous fact cursors', async () => {
    const item = page.items[0]
    for (const invalid of [{...page, candidate: {...source, contentSha256: 'b'.repeat(64)}}, {...page, candidate: {...source, revision: 2}}, {...page, candidate: {...source, state: 'ACTIVE', confirmed: true}},
      {...page, items: [{...item, hit: {...item.hit, entry: {...item.hit.entry, owner: {type: 'USER', id: 'other'}}}}]}, {...page, items: [{...item, hit: {...item.hit, entry: {...item.hit.entry, confirmed: false}}}]},
      {...page, items: [{...item, relation: 'RELATED_CONTENT'}]}, {...page, items: [{...item, hit: {...item.hit, score: 0.9}}]}, {...page, items: [item, item]}, {...page, nextAfterMemoryId: undefined}, {...page, extra: true}]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(invalid)))
      await expect(memoryMergeApi.compare('20', query, source.contentSha256)).rejects.toThrow('记忆比较结果无效')
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({...page, items: [], nextAfterMemoryId: 'before'})))
    await expect(memoryMergeApi.compare('20', {...query, afterMemoryId: 'before'}, source.contentSha256)).rejects.toThrow('记忆比较结果无效')
  })

  it('uses UTF-8 C order for fact pages and keeps transient semantic scores separate from source confidence', async () => {
    const first = {hit: {entry: activeMemory('\uE000'), score: null}, relation: 'SHARED_VALUES'}, second = {hit: {entry: activeMemory('😀'), score: null}, relation: 'SHARED_VALUES'}
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({...page, items: [first, second]})))
    await expect(memoryMergeApi.compare('20', query, source.contentSha256)).resolves.toMatchObject({items: [first, second]})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({...page, items: [second, first]})))
    await expect(memoryMergeApi.compare('20', query, source.contentSha256)).rejects.toThrow('记忆比较结果无效')
    const semantic = {...page, semantic: true, items: [{...page.items[0], hit: {...page.items[0].hit, score: 0.9}}]}
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(semantic)))
    const result = await memoryMergeApi.compare('20', {...query, semantic: true, minimumScore: 0.7}, source.contentSha256)
    expect(result.items[0].hit.score).toBe(0.9); expect(result.items[0].hit.entry.confidence).toBe(0.25)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({...semantic, items: [{...semantic.items[0], hit: {...semantic.items[0].hit, score: 0.6}}]})))
    await expect(memoryMergeApi.compare('20', {...query, semantic: true, minimumScore: 0.7}, source.contentSha256)).rejects.toThrow('记忆比较结果无效')
  })

  it('returns an unavailable comparison as an error and never silently falls back or retries it', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({}, 503)); vi.stubGlobal('fetch', fetcher)
    await expect(memoryMergeApi.compare('20', query, source.contentSha256)).rejects.toMatchObject({status: 503}); expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
