import {requestJson} from './client'
import {isProcessReleaseVersion} from './processReleases'
import {isProcessInstanceId} from './processWorkerFailures'

export type ProcessCorrelationQuery = Readonly<{
  correlationId: string
  fromInclusive: string
  toExclusive: string
  cursor?: string
}>

export type ProcessCorrelationReceipt = Readonly<{
  instanceId: string
  releaseVersion: string
  submittedAt: string
}>

export type ProcessCorrelationPage = Readonly<{
  correlationId: string
  observedAt: string
  items: readonly ProcessCorrelationReceipt[]
  nextCursor: string | null
}>

export type ProcessInstanceSnapshot = Readonly<{
  instanceId: string
  definitionKey: string
  releaseVersion: string
  businessKey: string
  correlationId: string
  status: 'ACTIVE' | 'SUSPENDED' | 'COMPLETED' | 'CANCELLED'
  submittedAt: string
  finishedAt: string | null
}>

const CORRELATION = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}(?![\s\S])/
const DEFINITION = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}(?![\s\S])/
const CURSOR = /^v1\.[A-Za-z0-9_-]{1,1197}(?![\s\S])/
const UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?Z(?![\s\S])/
const WINDOW_LIMIT = 31n * 24n * 60n * 60n * 1_000_000n
const PAGE_SIZE = 20
const QUERY_KEYS = ['correlationId', 'fromInclusive', 'toExclusive']
const PAGE_KEYS = ['correlationId', 'observedAt', 'items', 'nextCursor']
const RECEIPT_KEYS = ['instanceId', 'releaseVersion', 'submittedAt']
const DETAIL_KEYS = ['instanceId', 'definitionKey', 'releaseVersion', 'businessKey',
  'correlationId', 'status', 'submittedAt', 'finishedAt']
const utf8 = new TextEncoder()
const invalidPage = (): never => { throw new Error('服务返回的流程关联收据无效') }
const invalidDetail = (): never => { throw new Error('服务返回的流程实例详情无效') }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

export function isProcessCorrelationId(value: unknown): value is string {
  return typeof value === 'string' && CORRELATION.test(value)
}

function utcMicros(value: unknown): bigint | undefined {
  if (typeof value !== 'string') return undefined
  const match = UTC.exec(value)
  if (!match) return undefined
  const [, yearText, monthText, dayText, hour, minute, second, fraction] = match
  const year = Number(yearText), month = Number(monthText), day = Number(dayText)
  if (year < 1 || month < 1 || month > 12 || day < 1 || Number(hour) > 23
      || Number(minute) > 59 || Number(second) > 59) return undefined
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const lastDay = month === 2 ? (leap ? 29 : 28) : ([4, 6, 9, 11].includes(month) ? 30 : 31)
  if (day > lastDay) return undefined
  const millis = Date.parse(value.slice(0, 19) + 'Z')
  if (!Number.isFinite(millis)) return undefined
  return BigInt(millis) * 1_000n + BigInt((fraction ?? '').padEnd(6, '0'))
}

export function isProcessCorrelationUtc(value: unknown): value is string {
  return utcMicros(value) !== undefined
}

function isCursor(value: unknown): value is string {
  return typeof value === 'string' && CURSOR.test(value)
}

export function isProcessCorrelationQuery(value: unknown): value is ProcessCorrelationQuery {
  if (!(exactObject(value, QUERY_KEYS) || exactObject(value, [...QUERY_KEYS, 'cursor']))
      || !isProcessCorrelationId(value.correlationId)
      || (value.cursor !== undefined && !isCursor(value.cursor))) return false
  const from = utcMicros(value.fromInclusive), to = utcMicros(value.toExclusive)
  return from !== undefined && to !== undefined && from < to && to - from <= WINDOW_LIMIT
}

function isReceipt(value: unknown): value is ProcessCorrelationReceipt {
  return exactObject(value, RECEIPT_KEYS) && isProcessInstanceId(value.instanceId)
    && isProcessReleaseVersion(value.releaseVersion) && isProcessCorrelationUtc(value.submittedAt)
}

function compareBytes(first: Uint8Array, second: Uint8Array): number {
  for (let index = 0; index < Math.min(first.length, second.length); index++) {
    if (first[index] !== second[index]) return first[index] - second[index]
  }
  return first.length - second.length
}

function parsePage(value: unknown, query: ProcessCorrelationQuery, from: bigint, to: bigint): ProcessCorrelationPage {
  if (!exactObject(value, PAGE_KEYS) || value.correlationId !== query.correlationId
      || !Array.isArray(value.items) || value.items.length > PAGE_SIZE) return invalidPage()
  const {observedAt, items, nextCursor} = value
  const observed = utcMicros(observedAt)
  if (typeof observedAt !== 'string' || observed === undefined || observed < to
      || (nextCursor !== null && (!isCursor(nextCursor) || items.length !== PAGE_SIZE || nextCursor === query.cursor))) {
    return invalidPage()
  }

  const rows: ProcessCorrelationReceipt[] = []
  const ids = new Set<string>()
  let previousTime: bigint | undefined
  let previousId: Uint8Array | undefined
  for (const item of items) {
    if (!isReceipt(item) || ids.has(item.instanceId)) return invalidPage()
    const time = utcMicros(item.submittedAt)
    const encodedId = utf8.encode(item.instanceId)
    if (time === undefined || time < from || time >= to
        || (previousTime !== undefined && (time > previousTime
            || (time === previousTime && previousId && compareBytes(previousId, encodedId) <= 0)))) return invalidPage()
    ids.add(item.instanceId)
    previousTime = time
    previousId = encodedId
    rows.push({instanceId: item.instanceId, releaseVersion: item.releaseVersion, submittedAt: item.submittedAt})
  }
  return {correlationId: query.correlationId, observedAt, items: rows, nextCursor}
}

function parseDetail(value: unknown, correlationId: string, receipt: ProcessCorrelationReceipt): ProcessInstanceSnapshot {
  if (!exactObject(value, DETAIL_KEYS)) return invalidDetail()
  const {instanceId, releaseVersion, definitionKey, businessKey, status, submittedAt, finishedAt} = value
  if (instanceId !== receipt.instanceId || releaseVersion !== receipt.releaseVersion || value.correlationId !== correlationId
      || typeof definitionKey !== 'string' || !DEFINITION.test(definitionKey)
      || !(businessKey === '.' || businessKey === '..' || isProcessInstanceId(businessKey))
      || !isProcessCorrelationUtc(submittedAt) || utcMicros(submittedAt) !== utcMicros(receipt.submittedAt)
      || (status !== 'ACTIVE' && status !== 'SUSPENDED' && status !== 'COMPLETED' && status !== 'CANCELLED')
      || ((status === 'COMPLETED' || status === 'CANCELLED')
        ? !isProcessCorrelationUtc(finishedAt) : finishedAt !== null)) return invalidDetail()
  return {instanceId: receipt.instanceId, releaseVersion: receipt.releaseVersion, definitionKey, businessKey,
    correlationId, status, submittedAt, finishedAt: typeof finishedAt === 'string' ? finishedAt : null}
}

export const processCorrelationsApi = {
  async list(tenant: string, query: ProcessCorrelationQuery, signal?: AbortSignal): Promise<ProcessCorrelationPage> {
    if (!isProcessCorrelationQuery(query)) throw new Error('流程关联查询条件无效')
    const captured = {...query}
    const parameters = new URLSearchParams({
      correlationId: captured.correlationId, fromInclusive: captured.fromInclusive, toExclusive: captured.toExclusive,
    })
    if (captured.cursor !== undefined) parameters.set('cursor', captured.cursor)
    const payload = await requestJson<unknown>('/api/tianji/v1/process-instance-correlations?' + parameters.toString(),
      tenant, {method: 'GET', cache: 'no-store', signal})
    return parsePage(payload, captured, utcMicros(captured.fromInclusive)!, utcMicros(captured.toExclusive)!)
  },

  async detail(tenant: string, correlationId: string, receipt: ProcessCorrelationReceipt, signal?: AbortSignal): Promise<ProcessInstanceSnapshot> {
    if (!isProcessCorrelationId(correlationId) || !isReceipt(receipt)) throw new Error('流程实例收据无效')
    const captured = {...receipt}
    const payload = await requestJson<unknown>('/api/tianji/v1/process-instances/' + encodeURIComponent(captured.instanceId),
      tenant, {method: 'GET', cache: 'no-store', signal})
    return parseDetail(payload, correlationId, captured)
  },
}
