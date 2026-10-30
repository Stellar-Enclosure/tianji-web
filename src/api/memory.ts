import {requestJson} from './client'

export const MEMORY_KINDS = ['FACT', 'PREFERENCE', 'EXPERIENCE'] as const
export type MemoryKind = typeof MEMORY_KINDS[number]
export type MemoryOwner = Readonly<{type: 'USER' | 'TEAM'; id: string}>
export type MemoryContent = Readonly<{text: string | null; facts: Readonly<Record<string, string>>}>
export type MemorySource = Readonly<{reference: string; evidenceSha256: string; sourceRunId: string | null; sourceEventId: string | null}>
export type MemoryCandidate = Readonly<{
  owner: MemoryOwner; scopeId: string; memoryId: string; kind: MemoryKind; revision: number; supersedesRevision: number | null
  state: 'CANDIDATE'; confirmed: false; content: MemoryContent; contentSha256: string; source: MemorySource; confidence: number
  sensitivity: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'; retentionPolicyRef: string
  effectiveAt: string; expiresAt: string | null; createdAt: string; updatedAt: string
}>
export type MemoryActiveFact = Omit<MemoryCandidate, 'state' | 'confirmed'> & Readonly<{state: 'ACTIVE'; confirmed: true}>
export type MemoryCandidateQuery = Readonly<{owner: MemoryOwner; scopeId: string; kind: MemoryKind | null; afterMemoryId: string | null; limit: number}>
export type MemoryCandidatePage = Readonly<{owner: MemoryOwner; scopeId: string; items: readonly MemoryCandidate[]; nextAfterMemoryId: string | null}>
export type ReviewCommand = Readonly<{
  commandId: string; owner: MemoryOwner; scopeId: string; memoryId: string; expectedRevision: number
  content: MemoryContent; source: MemorySource; confidence: number; reasonCode: 'USER_CONFIRMED'
}>
export type RejectCommand = Readonly<{commandId: string; owner: MemoryOwner; scopeId: string; memoryId: string; expectedRevision: number; reasonCode: 'USER_REJECTED_CANDIDATE'}>
export type MemoryReceipt = Readonly<{commandId: string; owner: MemoryOwner; scopeId: string; memoryId: string; revision: number
  outcome: 'CORRECTED' | 'FORGOTTEN'; stateAtMutation: 'ACTIVE' | 'FORGOTTEN'; occurredAt: string}>

const BASE = '/api/tianji/v1/memories'
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const keys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => Object.keys(value).every(key => allowed.includes(key))
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
export const isMemoryIdentifier = (value: string, max = 128): boolean => text(value, max) && value.trim() === value && !/[\p{Cc}\p{Cs}]/u.test(value)
const integer = (value: unknown, min: number): value is number => Number.isSafeInteger(value) && (value as number) >= min
const instant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const hash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const owner = (value: unknown): value is MemoryOwner => record(value) && keys(value, ['type', 'id'])
  && (value.type === 'USER' || value.type === 'TEAM') && typeof value.id === 'string' && isMemoryIdentifier(value.id, 256)
const sameOwner = (left: MemoryOwner, right: MemoryOwner): boolean => left.type === right.type && left.id === right.id
const kind = (value: unknown): value is MemoryKind => typeof value === 'string' && MEMORY_KINDS.includes(value as MemoryKind)
const optionalId = (value: unknown): value is string | null => value === null || typeof value === 'string' && isMemoryIdentifier(value)
const contentText = (value: unknown, max: number): value is string => typeof value === 'string' && !/\p{Cs}/u.test(value)
  && ![...value].some(character => { const code = character.codePointAt(0)!; return code < 32 && ![9, 10, 13].includes(code) || code >= 127 && code <= 159 })
  && new TextEncoder().encode(value).length <= max && value.normalize('NFC') === value
const content = (value: unknown): value is MemoryContent => {
  if (!record(value) || !keys(value, ['text', 'facts']) || !(value.text === null || contentText(value.text, 16_384) && value.text.trim().length > 0) || !record(value.facts) || Object.keys(value.facts).length > 64) return false
  let bytes = typeof value.text === 'string' ? new TextEncoder().encode(value.text).length : 0
  for (const [key, item] of Object.entries(value.facts)) {
    if (!isMemoryIdentifier(key) || key.normalize('NFC') !== key || !contentText(item, 4096)) return false
    bytes += new TextEncoder().encode(key + item).length
  }
  return bytes > 0 && bytes <= 16_384
}
const source = (value: unknown): value is MemorySource => record(value) && keys(value, ['reference', 'evidenceSha256', 'sourceRunId', 'sourceEventId'])
  && typeof value.reference === 'string' && isMemoryIdentifier(value.reference, 512) && hash(value.evidenceSha256)
  && (value.sourceRunId === null || typeof value.sourceRunId === 'string' && isMemoryIdentifier(value.sourceRunId, 64)) && optionalId(value.sourceEventId)
  && (value.sourceRunId === null) === (value.sourceEventId === null)
const candidateKeys = ['owner', 'scopeId', 'memoryId', 'kind', 'revision', 'supersedesRevision', 'state', 'confirmed', 'content', 'contentSha256', 'source', 'confidence',
  'sensitivity', 'retentionPolicyRef', 'effectiveAt', 'expiresAt', 'createdAt', 'updatedAt'] as const
const memoryEntry = (value: unknown, state: 'CANDIDATE' | 'ACTIVE'): value is MemoryCandidate | MemoryActiveFact => record(value) && keys(value, candidateKeys) && owner(value.owner)
  && typeof value.scopeId === 'string' && isMemoryIdentifier(value.scopeId) && typeof value.memoryId === 'string' && isMemoryIdentifier(value.memoryId)
  && kind(value.kind) && integer(value.revision, 1) && (value.supersedesRevision === null || integer(value.supersedesRevision, 1) && value.supersedesRevision < value.revision)
  && value.state === state && value.confirmed === (state === 'ACTIVE') && content(value.content) && hash(value.contentSha256) && source(value.source)
  && typeof value.confidence === 'number' && Number.isFinite(value.confidence) && value.confidence >= 0 && value.confidence <= 1
  && typeof value.sensitivity === 'string' && ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].includes(value.sensitivity)
  && typeof value.retentionPolicyRef === 'string' && isMemoryIdentifier(value.retentionPolicyRef, 256) && instant(value.effectiveAt)
  && (value.expiresAt === null || instant(value.expiresAt) && Date.parse(value.expiresAt) > Date.parse(value.effectiveAt))
  && instant(value.createdAt) && instant(value.updatedAt) && Date.parse(value.updatedAt) >= Date.parse(value.createdAt)
export const isMemoryCandidate = (value: unknown): value is MemoryCandidate => memoryEntry(value, 'CANDIDATE')
export const isMemoryActiveFact = (value: unknown): value is MemoryActiveFact => memoryEntry(value, 'ACTIVE')

export const compareMemoryIdentifiers = (left: string, right: string): number => {
  const a = new TextEncoder().encode(left), b = new TextEncoder().encode(right)
  for (let index = 0; index < Math.min(a.length, b.length); index++) if (a[index] !== b[index]) return a[index] - b[index]
  return a.length - b.length
}
const invalid = (): never => { throw new Error('服务返回的候选记忆格式无效') }
const receipt = (value: unknown, command: ReviewCommand | RejectCommand, operation: MemoryReceipt['outcome']): MemoryReceipt => {
  if (!record(value) || !keys(value, ['commandId', 'owner', 'scopeId', 'memoryId', 'revision', 'outcome', 'stateAtMutation', 'occurredAt'])
    || value.commandId !== command.commandId || !owner(value.owner) || !sameOwner(value.owner, command.owner) || value.scopeId !== command.scopeId || value.memoryId !== command.memoryId
    || !integer(value.revision, 1) || value.revision - command.expectedRevision !== 1 || value.outcome !== operation
    || value.stateAtMutation !== (operation === 'CORRECTED' ? 'ACTIVE' : 'FORGOTTEN') || !instant(value.occurredAt)) return invalid()
  return value as MemoryReceipt
}

export const memoryApi = {
  async candidates(tenant: string, query: MemoryCandidateQuery, signal?: AbortSignal): Promise<MemoryCandidatePage> {
    if (!owner(query.owner) || !isMemoryIdentifier(query.scopeId) || !integer(query.limit, 1) || query.limit > 50 || !optionalId(query.afterMemoryId) || query.kind !== null && !kind(query.kind)) throw new Error('候选查询范围无效')
    const value = await requestJson<unknown>(`${BASE}/candidates`, tenant, {method: 'POST', body: JSON.stringify(query), signal})
    if (!record(value) || !keys(value, ['owner', 'scopeId', 'items', 'nextAfterMemoryId']) || !owner(value.owner) || !sameOwner(value.owner, query.owner) || value.scopeId !== query.scopeId
      || !Array.isArray(value.items) || value.items.length > query.limit || !value.items.every(isMemoryCandidate) || !optionalId(value.nextAfterMemoryId)) return invalid()
    let previous = query.afterMemoryId
    for (const item of value.items) {
      if (!sameOwner(item.owner, query.owner) || item.scopeId !== query.scopeId || query.kind !== null && item.kind !== query.kind || previous !== null && compareMemoryIdentifiers(previous, item.memoryId) >= 0) return invalid()
      previous = item.memoryId
    }
    if (value.nextAfterMemoryId !== null && (value.items.length === 0 || value.items.at(-1)?.memoryId !== value.nextAfterMemoryId)) return invalid()
    return {owner: value.owner, scopeId: value.scopeId, items: value.items, nextAfterMemoryId: value.nextAfterMemoryId}
  },
  async confirm(tenant: string, command: ReviewCommand, signal?: AbortSignal): Promise<MemoryReceipt> {
    return receipt(await requestJson<unknown>(`${BASE}/correct`, tenant, {method: 'POST', body: JSON.stringify(command), signal}), command, 'CORRECTED')
  },
  async reject(tenant: string, command: RejectCommand, signal?: AbortSignal): Promise<MemoryReceipt> {
    return receipt(await requestJson<unknown>(`${BASE}/forget`, tenant, {method: 'POST', body: JSON.stringify(command), signal}), command, 'FORGOTTEN')
  },
}
