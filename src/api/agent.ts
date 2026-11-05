import {requestJson} from './client'

export const RUN_STATUSES = ['CREATED', 'QUEUED', 'RUNNING', 'WAITING', 'SUSPENDED',
  'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'] as const
export type RunStatus = typeof RUN_STATUSES[number]
export type AgentRun = Readonly<{
  runId: string
  definitionKey: string
  definitionVersion: number
  sessionId: string | null
  status: RunStatus
  waitReason: string | null
  cancelRequested: boolean
  attempt: number
  revision: number
  lastEventSequence: number
  deadlineAt: string | null
  createdAt: string
  finishedAt: string | null
}>
export type AgentRunPage = Readonly<{items: readonly AgentRun[]; nextCursor: string | null}>
export type AgentEvent = Readonly<{
  eventId: string
  runId: string
  sequence: number
  type: string
  occurredAt: string
  author: string | null
  payload: Readonly<Record<string, unknown>>
}>
export type AgentResultUsage = Readonly<{
  kind: 'ACTUAL' | 'ESTIMATED' | 'UNKNOWN'
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  costReported: boolean
}>
export type AgentResult = Readonly<{
  runId: string
  status: RunStatus
  output: Readonly<Record<string, unknown>>
  errorCode: string | null
  sideEffectOutcome: string | null
  usage: AgentResultUsage | null
}>
export type StartCommand = Readonly<{
  definitionKey: string
  definitionVersion: number
  idempotencyKey: string
  input: Readonly<{text: string; artifactRefs: readonly string[]; taskData: Readonly<Record<string, never>>}>
  sessionId: null
  businessKey: null
  correlationId: null
  policyOverride: null
}>
export type CancelCommand = Readonly<{runId: string; commandId: string; expectedRevision: number; reason: string}>
export type CancelResult = Readonly<{runId: string; accepted: boolean; status: RunStatus; revision: number}>

const BASE = '/api/tianji/v1/agent-runs'
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
const optionalText = (value: unknown, max: number): value is string | null => value === null || text(value, max)
const integer = (value: unknown, min: number): value is number => Number.isSafeInteger(value) && (value as number) >= min
const instant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const optionalInstant = (value: unknown): value is string | null => value === null || instant(value)
export const isRunId = (value: string): boolean => /^[A-Za-z0-9_-]{1,128}$/.test(value)
export const isTerminal = (status: RunStatus): boolean => ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(status)

export const isAgentRun = (value: unknown): value is AgentRun => record(value) && text(value.runId, 128) && isRunId(value.runId)
  && text(value.definitionKey, 128) && integer(value.definitionVersion, 1) && optionalText(value.sessionId, 128)
  && typeof value.status === 'string' && RUN_STATUSES.includes(value.status as RunStatus)
  && optionalText(value.waitReason, 128) && typeof value.cancelRequested === 'boolean'
  && integer(value.attempt, 0) && integer(value.revision, 0) && integer(value.lastEventSequence, 0)
  && optionalInstant(value.deadlineAt) && instant(value.createdAt) && optionalInstant(value.finishedAt)

export const isAgentEvent = (value: unknown): value is AgentEvent => record(value) && text(value.eventId, 128)
  && text(value.runId, 128) && isRunId(value.runId) && integer(value.sequence, 1) && text(value.type, 128)
  && instant(value.occurredAt) && optionalText(value.author, 128) && record(value.payload)

const isAgentResult = (value: unknown): value is Omit<AgentResult, 'usage'> & {usage?: unknown} => record(value) && text(value.runId, 128)
  && isRunId(value.runId) && typeof value.status === 'string' && RUN_STATUSES.includes(value.status as RunStatus)
  && record(value.output) && optionalText(value.errorCode, 128) && optionalText(value.sideEffectOutcome, 128)

const resultUsageFields = ['kind', 'inputTokens', 'outputTokens', 'totalTokens', 'cost', 'currency', 'priceVersionRef'] as const
const usageCounter = (value: unknown): number | null | undefined => {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return undefined
  return Number.isSafeInteger(value) ? value : null
}

const resultUsage = (value: unknown): AgentResultUsage | null => {
  if (!record(value) || Object.keys(value).length !== resultUsageFields.length
      || !resultUsageFields.every(field => Object.hasOwn(value, field))) return null
  const {kind, cost, currency, priceVersionRef} = value
  if ((kind !== 'ACTUAL' && kind !== 'ESTIMATED' && kind !== 'UNKNOWN')
      || !(cost === null || (typeof cost === 'number' && cost >= 0 && text(currency, 3)))
      || !optionalText(currency, 3) || !optionalText(priceVersionRef, 256)) return null
  const inputTokens = usageCounter(value.inputTokens)
  const outputTokens = usageCounter(value.outputTokens)
  const totalTokens = usageCounter(value.totalTokens)
  if (inputTokens === undefined || outputTokens === undefined || totalTokens === undefined) return null
  if (kind === 'UNKNOWN') return {kind, inputTokens: null, outputTokens: null, totalTokens: null, costReported: false}
  // The shared JSON reader has already converted the server's BigDecimal to Number.
  return {kind, inputTokens, outputTokens, totalTokens, costReported: cost !== null}
}

const pathFor = (runId: string): string => {
  if (!isRunId(runId)) throw new Error('运行标识无效')
  return `${BASE}/${encodeURIComponent(runId)}`
}
const invalid = (): never => { throw new Error('服务返回的数据格式无效') }

export const agentApi = {
  async list(tenant: string, cursor?: string, signal?: AbortSignal): Promise<AgentRunPage> {
    const query = new URLSearchParams({limit: '20'})
    if (cursor) query.set('cursor', cursor)
    const value = await requestJson<unknown>(`${BASE}?${query}`, tenant, {signal})
    if (!record(value) || !Array.isArray(value.items) || value.items.length > 100
      || !value.items.every(isAgentRun) || !(value.nextCursor === null || text(value.nextCursor, 256))) return invalid()
    return {items: value.items, nextCursor: value.nextCursor}
  },
  async get(tenant: string, runId: string, signal?: AbortSignal): Promise<AgentRun> {
    const value = await requestJson<unknown>(pathFor(runId), tenant, {signal})
    if (!isAgentRun(value) || value.runId !== runId) return invalid()
    return value
  },
  async result(tenant: string, runId: string, signal?: AbortSignal): Promise<AgentResult> {
    const value = await requestJson<unknown>(`${pathFor(runId)}/result`, tenant, {signal})
    if (!isAgentResult(value) || value.runId !== runId) return invalid()
    const {status, output, errorCode, sideEffectOutcome, usage} = value
    return {runId, status, output, errorCode, sideEffectOutcome, usage: resultUsage(usage)}
  },
  async start(tenant: string, command: StartCommand, signal?: AbortSignal): Promise<AgentRun> {
    const value = await requestJson<unknown>(BASE, tenant, {method: 'POST', body: JSON.stringify(command), signal})
    if (!isAgentRun(value)) return invalid()
    return value
  },
  async cancel(tenant: string, command: CancelCommand, signal?: AbortSignal): Promise<CancelResult> {
    const value = await requestJson<unknown>(`${pathFor(command.runId)}/cancel`, tenant,
      {method: 'POST', body: JSON.stringify(command), signal})
    if (!record(value) || value.runId !== command.runId || typeof value.accepted !== 'boolean'
      || typeof value.status !== 'string' || !RUN_STATUSES.includes(value.status as RunStatus)
      || !integer(value.revision, 0)) return invalid()
    return {runId: command.runId, accepted: value.accepted, status: value.status as RunStatus, revision: value.revision}
  },
}

export const eventPath = (runId: string, cursor: number): string => `${pathFor(runId)}/events?afterSequence=${cursor}&limit=100`
