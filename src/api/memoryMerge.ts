import {requestJson} from './client'
import {compareMemoryIdentifiers, isMemoryActiveFact, isMemoryCandidate, isMemoryIdentifier, type MemoryActiveFact, type MemoryCandidate, type MemoryOwner} from './memory'

export const MERGE_RELATIONS = ['DIFFERING_FIELDS', 'SHARED_VALUES', 'RELATED_CONTENT'] as const
export type MemoryMergeRelation = typeof MERGE_RELATIONS[number]
export type MemoryMergeHit = Readonly<{hit: Readonly<{entry: MemoryActiveFact; score: number | null}>; relation: MemoryMergeRelation}>
export type MemoryMergePage = Readonly<{candidate: MemoryCandidate; semantic: boolean; items: readonly MemoryMergeHit[]; nextAfterMemoryId: string | null}>
export type MemoryMergeQuery = Readonly<{owner: MemoryOwner; scopeId: string; memoryId: string; expectedRevision: number; semantic: boolean; afterMemoryId: string | null; limit: number; minimumScore: number | null}>

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const keys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => Object.keys(value).every(key => allowed.includes(key))
const sameOwner = (left: MemoryOwner, right: MemoryOwner): boolean => left.type === right.type && left.id === right.id
const cursor = (value: unknown): value is string | null => value === null || typeof value === 'string' && isMemoryIdentifier(value)
const invalid = (): never => { throw new Error('服务返回的记忆比较结果无效') }

export const memoryMergeApi = {
  async compare(tenant: string, query: MemoryMergeQuery, expectedContentSha256: string, signal?: AbortSignal): Promise<MemoryMergePage> {
    if (!isMemoryIdentifier(query.scopeId) || !isMemoryIdentifier(query.memoryId) || !Number.isSafeInteger(query.expectedRevision) || query.expectedRevision < 1
      || !isMemoryIdentifier(query.owner.id, 256) || !['USER', 'TEAM'].includes(query.owner.type) || !Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 10 || !cursor(query.afterMemoryId)
      || typeof query.semantic !== 'boolean' || query.semantic && (query.afterMemoryId !== null || query.minimumScore === null || !Number.isFinite(query.minimumScore) || query.minimumScore < 0 || query.minimumScore > 1)
      || !query.semantic && query.minimumScore !== null || !/^[0-9a-f]{64}$/.test(expectedContentSha256)) throw new Error('记忆比较范围无效')
    const value = await requestJson<unknown>('/api/tianji/v1/memories/merge-suggestions', tenant, {method: 'POST', body: JSON.stringify(query), signal})
    if (!record(value) || !keys(value, ['candidate', 'semantic', 'items', 'nextAfterMemoryId']) || !isMemoryCandidate(value.candidate)
      || !sameOwner(value.candidate.owner, query.owner) || value.candidate.scopeId !== query.scopeId || value.candidate.memoryId !== query.memoryId
      || value.candidate.revision !== query.expectedRevision || value.candidate.contentSha256 !== expectedContentSha256 || value.semantic !== query.semantic
      || !Array.isArray(value.items) || value.items.length > query.limit || !cursor(value.nextAfterMemoryId) || query.semantic && value.nextAfterMemoryId !== null) return invalid()
    const ids = new Set<string>(); let previous = query.afterMemoryId; let previousScore: number | undefined
    for (const item of value.items) {
      if (!record(item) || !keys(item, ['hit', 'relation']) || typeof item.relation !== 'string' || !MERGE_RELATIONS.includes(item.relation as MemoryMergeRelation)
        || !record(item.hit) || !keys(item.hit, ['entry', 'score']) || !isMemoryActiveFact(item.hit.entry)) return invalid()
      const entry = item.hit.entry, score = item.hit.score
      if (!sameOwner(entry.owner, query.owner) || entry.scopeId !== query.scopeId || entry.kind !== value.candidate.kind || entry.memoryId === query.memoryId || ids.has(entry.memoryId)) return invalid()
      ids.add(entry.memoryId)
      if (query.semantic) {
        if (typeof score !== 'number' || !Number.isFinite(score) || score < (query.minimumScore ?? 0) || score > 1 || previousScore !== undefined && score > previousScore) return invalid()
        previousScore = score
      } else if (score !== null || item.relation === 'RELATED_CONTENT' || previous !== null && compareMemoryIdentifiers(previous, entry.memoryId) >= 0) return invalid()
      previous = entry.memoryId
    }
    if (value.nextAfterMemoryId !== null && (query.afterMemoryId !== null && compareMemoryIdentifiers(query.afterMemoryId, value.nextAfterMemoryId) >= 0
      || previous !== null && compareMemoryIdentifiers(previous, value.nextAfterMemoryId) > 0)) return invalid()
    return value as MemoryMergePage
  },
}
