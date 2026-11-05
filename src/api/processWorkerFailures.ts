import {requestJson} from './client'

const STATUS = ['RETRY_AVAILABLE', 'MANUAL_REVIEW', 'HISTORICAL_FAILURE'] as const
const REASONS = [
  'NONE', 'NO_NATIVE_DEADLETTER', 'UNKNOWN_OUTCOME', 'BUSINESS_REJECTED', 'RESTORE_LIMIT_REACHED',
  'UNSUPPORTED_NATIVE_JOB', 'PROCESS_INACTIVE', 'EVIDENCE_CONFLICT', 'ACTIVE_LEASE', 'BINDING_UNVERIFIED',
  'HISTORY_INCOMPLETE', 'UNSUPPORTED_EFFECT',
] as const
const REPORTED = ['NONE', 'RETRYABLE', 'BUSINESS_REJECTED', 'UNKNOWN', 'UNVERIFIED'] as const
const HISTORICAL_REASONS = new Set<typeof REASONS[number]>([
  'NO_NATIVE_DEADLETTER', 'UNKNOWN_OUTCOME', 'BUSINESS_REJECTED', 'HISTORY_INCOMPLETE',
])

export type ProcessWorkerFailure = Readonly<{
  jobId: string
  activityId: string | null
  nativeDeadletter: boolean
  status: typeof STATUS[number]
  reason: typeof REASONS[number]
  reportedFailure: typeof REPORTED[number]
  expectedVersion: string | null
}>

export type ProcessWorkerFailures = Readonly<{
  instanceId: string
  observedAt: string
  failures: readonly ProcessWorkerFailure[]
}>

const ROW_KEYS = ['jobId', 'activityId', 'nativeDeadletter', 'status', 'reason', 'reportedFailure', 'expectedVersion']
const SNAPSHOT_KEYS = ['instanceId', 'observedAt', 'failures']
const VERSION = /^[0-9a-f]{64}$/
const JAVA_BLANK = /^[ \u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]*$/u
const UNPAIRED_SURROGATE = /[\ud800-\udfff]/u
const UTC_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}(?:\d{3}){0,2}))?Z$/
const utf8 = new TextEncoder()

const invalidResponse = (): never => { throw new Error('服务返回的 Worker 失败快照无效') }

function safeId(value: unknown, max: number): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max
      || value.startsWith(' ') || value.endsWith(' ') || JAVA_BLANK.test(value) || UNPAIRED_SURROGATE.test(value)) return false
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code < 32 || code === 127) return false
  }
  return true
}

export function isProcessInstanceId(value: unknown): value is string {
  return safeId(value, 255) && value !== '.' && value !== '..'
}

function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

function enumValue<T extends string>(choices: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (choices as readonly string[]).includes(value)
}

function canonicalUtc(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = UTC_INSTANT.exec(value)
  if (!match) return false
  const [, y, m, d, h, min, sec, fraction] = match
  const year = Number(y), month = Number(m), day = Number(d)
  if (year < 1 || month < 1 || month > 12 || day < 1 || Number(h) > 23 || Number(min) > 59 || Number(sec) > 59
      || fraction?.endsWith('000')) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = month === 2 ? (leap ? 29 : 28) : ([4, 6, 9, 11].includes(month) ? 30 : 31)
  return day <= days
}

function parseRow(value: unknown): ProcessWorkerFailure {
  if (!exactObject(value, ROW_KEYS)) return invalidResponse()
  const {jobId, activityId, nativeDeadletter, status, reason, reportedFailure, expectedVersion} = value
  if (!safeId(jobId, 255) || (activityId !== null && !safeId(activityId, 128))
      || typeof nativeDeadletter !== 'boolean' || !enumValue(STATUS, status)
      || !enumValue(REASONS, reason) || !enumValue(REPORTED, reportedFailure)
      || (expectedVersion !== null && (typeof expectedVersion !== 'string' || !VERSION.test(expectedVersion)))) {
    return invalidResponse()
  }
  if ((reason === 'UNKNOWN_OUTCOME' && reportedFailure !== 'UNKNOWN')
      || (reason === 'BUSINESS_REJECTED' && reportedFailure !== 'BUSINESS_REJECTED')) return invalidResponse()
  switch (status) {
    case 'RETRY_AVAILABLE':
      if (!nativeDeadletter || activityId === null || reason !== 'NONE' || reportedFailure !== 'RETRYABLE'
          || expectedVersion === null) return invalidResponse()
      break
    case 'MANUAL_REVIEW':
      if (!nativeDeadletter || expectedVersion !== null || reason === 'NONE' || reason === 'NO_NATIVE_DEADLETTER') {
        return invalidResponse()
      }
      break
    case 'HISTORICAL_FAILURE':
      if (nativeDeadletter || expectedVersion !== null || !HISTORICAL_REASONS.has(reason)) return invalidResponse()
  }
  return {jobId, activityId, nativeDeadletter, status, reason, reportedFailure, expectedVersion}
}

function compareBytes(first: Uint8Array, second: Uint8Array): number {
  for (let index = 0; index < Math.min(first.length, second.length); index++) {
    if (first[index] !== second[index]) return first[index] - second[index]
  }
  return first.length - second.length
}

function parseSnapshot(value: unknown, expectedId: string): ProcessWorkerFailures {
  if (!exactObject(value, SNAPSHOT_KEYS)) return invalidResponse()
  const {instanceId, observedAt, failures} = value
  if (!isProcessInstanceId(instanceId) || instanceId !== expectedId || !canonicalUtc(observedAt)
      || !Array.isArray(failures) || failures.length > 128) return invalidResponse()
  let previous: Uint8Array | undefined
  const rows: ProcessWorkerFailure[] = []
  for (const row of failures) {
    const parsed = parseRow(row)
    const next = utf8.encode(parsed.jobId)
    if (previous && compareBytes(previous, next) >= 0) return invalidResponse()
    rows.push(parsed)
    previous = next
  }
  return {instanceId, observedAt, failures: rows}
}

export const processWorkerFailuresApi = {
  async get(tenant: string, instanceId: string, signal?: AbortSignal): Promise<ProcessWorkerFailures> {
    if (!isProcessInstanceId(instanceId)) throw new Error('流程实例标识无效')
    const value = await requestJson<unknown>(
      `/api/tianji/v1/process-instances/${encodeURIComponent(instanceId)}/worker-failures`,
      tenant, {method: 'GET', cache: 'no-store', signal},
    )
    return parseSnapshot(value, instanceId)
  },
}
