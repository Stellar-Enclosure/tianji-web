import {requestJson} from './client'
import {isProcessCorrelationUtc} from './processCorrelations'
import {isProcessInstanceId} from './processWorkerFailures'

const DISPATCH_STATES = ['PENDING', 'SUBMITTED', 'ACKNOWLEDGED', 'CLOSING', 'CLOSED'] as const
const INBOX_STATES = ['RUN_NOT_CONFIRMED', 'NOT_OBSERVED', 'RECEIVED', 'APPLIED', 'IGNORED_LATE', 'DEAD'] as const
const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'] as const

export type ProcessAgentOutcome = Readonly<{
  activityId: string
  dispatchState: typeof DISPATCH_STATES[number]
  inboxState: typeof INBOX_STATES[number]
  terminalStatus: typeof TERMINAL_STATUSES[number] | null
  dispatchRecordedAt: string
  receivedAt: string | null
  decidedAt: string | null
}>

export type ProcessAgentOutcomePage = Readonly<{
  instanceId: string
  observedAt: string
  items: readonly ProcessAgentOutcome[]
  nextCursor: string | null
}>

const PAGE_SIZE = 20
const CURSOR = /^v1\.[0-9a-f]{64}(?![\s\S])/
const ACTIVITY = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}(?![\s\S])/
const PAGE_KEYS = ['instanceId', 'observedAt', 'items', 'nextCursor']
const ITEM_KEYS = ['activityId', 'dispatchState', 'inboxState', 'terminalStatus', 'dispatchRecordedAt', 'receivedAt', 'decidedAt']
const invalidResponse = (): never => { throw new Error('服务返回的 Process Agent 结果记录无效') }

function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

function enumValue<T extends string>(choices: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (choices as readonly string[]).includes(value)
}

function isCursor(value: unknown): value is string {
  return typeof value === 'string' && CURSOR.test(value)
}

function utcSortKey(value: string): string {
  const [seconds, fraction = ''] = value.slice(0, -1).split('.')
  return seconds + '.' + fraction.padEnd(6, '0')
}

function parseItem(value: unknown, observed: string): ProcessAgentOutcome {
  if (!exactObject(value, ITEM_KEYS)) return invalidResponse()
  const {activityId, dispatchState, inboxState, terminalStatus, dispatchRecordedAt, receivedAt, decidedAt} = value
  if (typeof activityId !== 'string' || !ACTIVITY.test(activityId)
      || !enumValue(DISPATCH_STATES, dispatchState) || !enumValue(INBOX_STATES, inboxState)
      || (terminalStatus !== null && !enumValue(TERMINAL_STATUSES, terminalStatus))
      || !isProcessCorrelationUtc(dispatchRecordedAt)
      || (receivedAt !== null && !isProcessCorrelationUtc(receivedAt))
      || (decidedAt !== null && !isProcessCorrelationUtc(decidedAt))) return invalidResponse()

  const hasReceipt = inboxState !== 'RUN_NOT_CONFIRMED' && inboxState !== 'NOT_OBSERVED'
  const decided = hasReceipt && inboxState !== 'RECEIVED'
  if (hasReceipt !== (receivedAt !== null) || decided !== (decidedAt !== null)
      || (terminalStatus !== null && !hasReceipt)
      || (hasReceipt && inboxState !== 'DEAD' && terminalStatus === null)) return invalidResponse()

  const dispatched = utcSortKey(dispatchRecordedAt)
  const received = receivedAt === null ? null : utcSortKey(receivedAt)
  const decidedTime = decidedAt === null ? null : utcSortKey(decidedAt)
  if (dispatched > observed || (received !== null && (received < dispatched || received > observed))
      || (decidedTime !== null && (received === null || decidedTime < received || decidedTime > observed))) return invalidResponse()

  return {activityId, dispatchState, inboxState, terminalStatus, dispatchRecordedAt, receivedAt, decidedAt}
}

function parsePage(value: unknown, instanceId: string, cursor?: string): ProcessAgentOutcomePage {
  if (!exactObject(value, PAGE_KEYS) || value.instanceId !== instanceId || !isProcessCorrelationUtc(value.observedAt)
      || !Array.isArray(value.items) || value.items.length > PAGE_SIZE
      || (value.nextCursor !== null && (!isCursor(value.nextCursor)
        || value.items.length !== PAGE_SIZE || value.nextCursor === cursor))) return invalidResponse()
  const {observedAt, items, nextCursor} = value
  const observed = utcSortKey(observedAt)
  return {instanceId, observedAt, items: items.map(item => parseItem(item, observed)), nextCursor}
}

export const processAgentOutcomesApi = {
  async list(tenant: string, instanceId: string, cursor?: string, signal?: AbortSignal): Promise<ProcessAgentOutcomePage> {
    if (!isProcessInstanceId(instanceId) || (cursor !== undefined && !isCursor(cursor))) {
      throw new Error('Process Agent 结果查询条件无效')
    }
    const suffix = cursor === undefined ? '' : '?' + new URLSearchParams({cursor}).toString()
    const value = await requestJson<unknown>(
      '/api/tianji/v1/process-instances/' + encodeURIComponent(instanceId) + '/agent-outcomes' + suffix,
      tenant, {method: 'GET', cache: 'no-store', signal})
    return parsePage(value, instanceId, cursor)
  },
}
