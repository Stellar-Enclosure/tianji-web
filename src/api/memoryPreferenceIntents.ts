import {isMemoryIdentifier} from './memory'
import {requestJson} from './client'

const STATES = ['RESERVED', 'READY', 'CLAIMED', 'APPLIED', 'SKIPPED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'DEAD'] as const
export type PreferenceIntentState = typeof STATES[number]
export type PreferenceIntentQuery = Readonly<{owner: Readonly<{type: 'USER'; id: string}>; scopeId: string; runId: string}>
export type PreferenceIntent = Readonly<{intentId: string; bindingId: string; policyRef: string; state: PreferenceIntentState; revision: number
  nextIndex: number; totalCount: number | null; attemptCount: number; reasonCode: string | null; createdAt: string; updatedAt: string; closedAt: string | null}>
export type PreferenceIntentStatus = PreferenceIntentQuery & Readonly<{intent: PreferenceIntent | null}>
export type CancelPreferenceIntent = PreferenceIntentQuery & Readonly<{commandId: string; expectedRevision: number}>
export type PreferenceIntentCancellation = Readonly<{commandId: string; status: PreferenceIntentStatus}>

const BASE = '/api/tianji/v1/memories/preference-intents'
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const keys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => Object.keys(value).every(key => allowed.includes(key))
const id = (value: unknown, max = 128): value is string => typeof value === 'string' && isMemoryIdentifier(value, max)
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max
const instant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const queryKeys = ['owner', 'scopeId', 'runId'] as const
const source = (value: unknown): value is PreferenceIntentQuery & Record<string, unknown> => record(value) && record(value.owner) && keys(value.owner, ['type', 'id'])
  && value.owner.type === 'USER' && id(value.owner.id, 256) && id(value.scopeId) && id(value.runId, 64)
export const isPreferenceIntentTerminal = (state: PreferenceIntentState): boolean => !['RESERVED', 'READY', 'CLAIMED'].includes(state)
const intent = (value: unknown): value is PreferenceIntent => record(value)
  && keys(value, ['intentId', 'bindingId', 'policyRef', 'state', 'revision', 'nextIndex', 'totalCount', 'attemptCount', 'reasonCode', 'createdAt', 'updatedAt', 'closedAt'])
  && typeof value.intentId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.intentId) && id(value.bindingId)
  && typeof value.policyRef === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}@[1-9][0-9]{0,18}#[0-9a-f]{64}$/.test(value.policyRef)
  && typeof value.state === 'string' && STATES.includes(value.state as PreferenceIntentState) && integer(value.revision, 1) && integer(value.nextIndex, 0, 32)
  && (value.totalCount === null && value.nextIndex === 0 || integer(value.totalCount, value.nextIndex, 32)) && integer(value.attemptCount, 0, 100)
  && (value.reasonCode === null || typeof value.reasonCode === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(value.reasonCode))
  && instant(value.createdAt) && instant(value.updatedAt) && Date.parse(value.updatedAt) >= Date.parse(value.createdAt)
  && (isPreferenceIntentTerminal(value.state as PreferenceIntentState) ? instant(value.closedAt) && Date.parse(value.closedAt) >= Date.parse(value.createdAt) && Date.parse(value.closedAt) <= Date.parse(value.updatedAt) : value.closedAt === null)
  && (value.state !== 'APPLIED' || integer(value.totalCount, 1, 32) && value.nextIndex === value.totalCount)
const status = (value: unknown, expected: PreferenceIntentQuery): value is PreferenceIntentStatus => record(value) && keys(value, [...queryKeys, 'intent']) && source(value)
  && value.owner.id === expected.owner.id && value.scopeId === expected.scopeId && value.runId === expected.runId && (value.intent === null || intent(value.intent))
const invalid = (): never => { throw new Error('服务返回的提取状态无效') }

export const memoryPreferenceIntentsApi = {
  async status(tenant: string, query: PreferenceIntentQuery, signal?: AbortSignal): Promise<PreferenceIntentStatus> {
    if (!source(query) || !keys(query, queryKeys)) throw new Error('提取来源范围无效')
    const value = await requestJson<unknown>(`${BASE}/status`, tenant, {method: 'POST', body: JSON.stringify(query), signal})
    return status(value, query) ? value : invalid()
  },
  async cancel(tenant: string, command: CancelPreferenceIntent, signal?: AbortSignal): Promise<PreferenceIntentCancellation> {
    if (!source(command) || !keys(command, [...queryKeys, 'commandId', 'expectedRevision']) || !id(command.commandId) || !integer(command.expectedRevision, 1)) throw new Error('停止提取请求无效')
    const value = await requestJson<unknown>(`${BASE}/cancel`, tenant, {method: 'POST', body: JSON.stringify(command), signal})
    if (!record(value) || !keys(value, ['commandId', 'status']) || value.commandId !== command.commandId || !status(value.status, command)
      || !value.status.intent || !isPreferenceIntentTerminal(value.status.intent.state)) return invalid()
    if (value.status.intent.revision !== command.expectedRevision + (value.status.intent.state === 'CANCELLED' ? 1 : 0)) return invalid()
    return value as PreferenceIntentCancellation
  },
}
