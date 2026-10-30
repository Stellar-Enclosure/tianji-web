import {isMemoryIdentifier} from './memory'
import {requestJson} from './client'

const OUTCOMES = ['ELIGIBLE', 'RUN_NOT_COMPLETED', 'SOURCE_NOT_APPROVED', 'SOURCE_NOT_USER_INPUT', 'SOURCE_LIMIT', 'QUOTED_SOURCE',
  'UNSUPPORTED_PREFERENCE', 'CONFLICTING_PREFERENCE', 'BATCH_LIMIT', 'NO_DECLARATION'] as const
export type PreferenceOutcome = typeof OUTCOMES[number]
export type PreferenceSource = Readonly<{owner: Readonly<{type: 'USER'; id: string}>; scopeId: string; runId: string; sourceEventId: string}>
export type PreferenceCommand = PreferenceSource & Readonly<{bindingId: string; policyRef: string}>
export type PreferencePreparation = Readonly<{command: PreferenceCommand; outcome: PreferenceOutcome; candidateCount: number; preferenceKeys: readonly string[]; sensitivity: 'CONFIDENTIAL' | 'RESTRICTED'}>
export type PreferenceReceipt = Readonly<{commandId: string; owner: PreferenceSource['owner']; scopeId: string; memoryId: string; revision: number
  outcome: 'CREATED' | 'DEDUPLICATED'; stateAtMutation: 'CANDIDATE' | 'ACTIVE'; occurredAt: string}>
export type PreferenceResult = PreferenceCommand & Readonly<{outcome: PreferenceOutcome; items: readonly Readonly<{preferenceKey: string; receipt: PreferenceReceipt}>[]}>

const BASE = '/api/tianji/v1/memories'
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const keys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => Object.keys(value).every(key => allowed.includes(key))
const id = (value: unknown, max = 128): value is string => typeof value === 'string' && isMemoryIdentifier(value, max)
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max
const owner = (value: unknown): value is PreferenceSource['owner'] => record(value) && keys(value, ['type', 'id']) && value.type === 'USER' && id(value.id, 256)
const source = (value: unknown): value is PreferenceSource & Record<string, unknown> => record(value) && owner(value.owner) && id(value.scopeId) && id(value.runId, 64) && id(value.sourceEventId)
const commandKeys = ['owner', 'scopeId', 'runId', 'sourceEventId', 'bindingId', 'policyRef'] as const
const command = (value: unknown): value is PreferenceCommand => record(value) && keys(value, commandKeys) && source(value) && id(value.bindingId)
  && typeof value.policyRef === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}@[1-9][0-9]{0,18}#[0-9a-f]{64}$/.test(value.policyRef)
const sameSource = (left: PreferenceSource, right: PreferenceSource): boolean => left.owner.id === right.owner.id && left.owner.type === right.owner.type
  && left.scopeId === right.scopeId && left.runId === right.runId && left.sourceEventId === right.sourceEventId
const outcome = (value: unknown): value is PreferenceOutcome => typeof value === 'string' && OUTCOMES.includes(value as PreferenceOutcome)
const preferenceKey = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9_.-]{0,63}$/.test(value)
const invalid = (): never => { throw new Error('服务返回的偏好提取信息无效') }
const receipt = (value: unknown, expected: PreferenceCommand): value is PreferenceReceipt => record(value)
  && keys(value, ['commandId', 'owner', 'scopeId', 'memoryId', 'revision', 'outcome', 'stateAtMutation', 'occurredAt'])
  && typeof value.commandId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.commandId)
  && owner(value.owner) && value.owner.id === expected.owner.id && value.scopeId === expected.scopeId && id(value.memoryId) && integer(value.revision, 1)
  && (value.outcome === 'CREATED' && value.revision === 1 && value.stateAtMutation === 'CANDIDATE'
    || value.outcome === 'DEDUPLICATED' && (value.stateAtMutation === 'CANDIDATE' || value.stateAtMutation === 'ACTIVE'))
  && typeof value.occurredAt === 'string' && Number.isFinite(Date.parse(value.occurredAt))

export const memoryPreferencesApi = {
  async prepare(tenant: string, query: PreferenceSource, signal?: AbortSignal): Promise<PreferencePreparation> {
    if (!record(query) || !keys(query, ['owner', 'scopeId', 'runId', 'sourceEventId']) || !source(query)) throw new Error('偏好来源范围无效')
    const value = await requestJson<unknown>(`${BASE}/prepare-preferences`, tenant, {method: 'POST', body: JSON.stringify(query), signal})
    if (!record(value) || !keys(value, ['command', 'outcome', 'candidateCount', 'preferenceKeys', 'sensitivity']) || !command(value.command) || !sameSource(query, value.command)
      || !outcome(value.outcome) || !integer(value.candidateCount, 0, 32) || !Array.isArray(value.preferenceKeys) || value.preferenceKeys.length !== value.candidateCount
      || !value.preferenceKeys.every(preferenceKey) || new Set(value.preferenceKeys).size !== value.preferenceKeys.length
      || (value.outcome === 'ELIGIBLE') !== (value.candidateCount > 0) || value.sensitivity !== 'CONFIDENTIAL' && value.sensitivity !== 'RESTRICTED') return invalid()
    return value as PreferencePreparation
  },
  async extract(tenant: string, selected: PreferenceCommand, expectedKeys: readonly string[], signal?: AbortSignal): Promise<PreferenceResult> {
    if (!command(selected) || expectedKeys.length < 1 || expectedKeys.length > 32 || !expectedKeys.every(preferenceKey) || new Set(expectedKeys).size !== expectedKeys.length) throw new Error('偏好提取请求无效')
    const value = await requestJson<unknown>(`${BASE}/extract-preferences`, tenant, {method: 'POST', body: JSON.stringify(selected), signal})
    if (!record(value) || !keys(value, [...commandKeys, 'outcome', 'items']) || !source(value) || !sameSource(selected, value)
      || value.bindingId !== selected.bindingId || value.policyRef !== selected.policyRef || !outcome(value.outcome) || !Array.isArray(value.items) || value.items.length > 32
      || (value.outcome === 'ELIGIBLE') !== (value.items.length > 0)) return invalid()
    const seenKeys = new Set<string>(), seenCommands = new Set<string>()
    for (const item of value.items) {
      if (!record(item) || !keys(item, ['preferenceKey', 'receipt']) || !preferenceKey(item.preferenceKey) || !expectedKeys.includes(item.preferenceKey) || seenKeys.has(item.preferenceKey)
        || !receipt(item.receipt, selected) || seenCommands.has(item.receipt.commandId)) return invalid()
      seenKeys.add(item.preferenceKey); seenCommands.add(item.receipt.commandId)
    }
    if (value.outcome === 'ELIGIBLE' && seenKeys.size !== expectedKeys.length) return invalid()
    return value as PreferenceResult
  },
}
