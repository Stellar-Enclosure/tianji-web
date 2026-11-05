import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {setAuthFailureHandler} from './client'
import {isProcessInstanceId, processWorkerFailuresApi, type ProcessWorkerFailure} from './processWorkerFailures'

const INSTANCE = 'expense-1'
const OBSERVED = '2026-11-04T08:00:00.123456789Z'
const VERSION = '1a'.repeat(32)
const INVALID = '服务返回的 Worker 失败快照无效'
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}})
const snapshot = (failures: readonly unknown[] = [], instanceId = INSTANCE) =>
  ({instanceId, observedAt: OBSERVED, failures})
const retry = (overrides: Partial<ProcessWorkerFailure> = {}): ProcessWorkerFailure => ({
  jobId: 'job-1', activityId: 'workerStep', nativeDeadletter: true, status: 'RETRY_AVAILABLE',
  reason: 'NONE', reportedFailure: 'RETRYABLE', expectedVersion: VERSION, ...overrides,
})
const manual = (overrides: Partial<ProcessWorkerFailure> = {}): ProcessWorkerFailure => ({
  jobId: 'job-2', activityId: null, nativeDeadletter: true, status: 'MANUAL_REVIEW',
  reason: 'BINDING_UNVERIFIED', reportedFailure: 'UNVERIFIED', expectedVersion: null, ...overrides,
})
const history = (overrides: Partial<ProcessWorkerFailure> = {}): ProcessWorkerFailure => ({
  jobId: 'job-3', activityId: null, nativeDeadletter: false, status: 'HISTORICAL_FAILURE',
  reason: 'NO_NATIVE_DEADLETTER', reportedFailure: 'UNKNOWN', expectedVersion: null, ...overrides,
})
const mockFetch = (response: Response) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response)
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
const rejectsSnapshot = async (value: unknown) => {
  const fetcher = mockFetch(json(value))
  await expect(processWorkerFailuresApi.get('20', INSTANCE)).rejects.toThrow(INVALID)
  expect(fetcher).toHaveBeenCalledTimes(1)
}
const without = <T extends object>(value: T, key: keyof T) => {
  const copy: Partial<T> = {...value}
  delete copy[key]
  return copy
}

describe('Worker failure observations through current gateway transport', () => {
  beforeEach(() => { gatewayAuth.context.invalidate() })
  afterEach(() => {
    setAuthFailureHandler(() => {})
    gatewayAuth.context.invalidate()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects a foreign instance snapshot', async () => {
    await rejectsSnapshot(snapshot([], 'another-instance'))
  })

  it('issues only the encoded GET with current tenant, cookie credentials, and caller abort', async () => {
    const exact = 'expense /+账 %2F'
    const result = snapshot([retry(), manual(), history()], exact)
    const fetcher = mockFetch(json(result))
    const csrf = vi.spyOn(gatewayAuth, 'csrf')
    const controller = new AbortController()

    await expect(processWorkerFailuresApi.get('20', exact, controller.signal)).resolves.toEqual(result)

    expect(Object.keys(processWorkerFailuresApi)).toEqual(['get'])
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, request] = fetcher.mock.calls[0]
    const prefix = new URL(gatewayAuth.applicationBaseUrl, 'https://example.test').pathname.replace(/\/$/, '')
    const target = new URL(String(url), 'https://example.test')
    expect(target.pathname).toBe(prefix + '/api/tianji/v1/process-instances/expense%20%2F%2B%E8%B4%A6%20%252F/worker-failures')
    expect(target.search).toBe('')
    expect(target.hash).toBe('')
    expect(request).toMatchObject({method: 'GET', credentials: 'include', cache: 'no-store', redirect: 'error'})
    expect(request?.body).toBeUndefined()
    const headers = new Headers(request?.headers)
    expect(headers.get('X-Egon-Tianji-Tenant')).toBe('20')
    expect(headers.get('Authorization')).toBeNull()
    expect(headers.get('X-CSRF-TOKEN')).toBeNull()
    expect(csrf).not.toHaveBeenCalled()
    expect(request?.signal).toBeInstanceOf(AbortSignal)
    expect(request?.signal?.aborted).toBe(false)
    controller.abort()
    expect(request?.signal?.aborted).toBe(true)
  })

  it('rejects invalid IDs and untrusted tenants before fetch, preserving Java UTF-16 boundaries', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    const invalid = ['', '.', '..', ' expense', 'expense ', 'a\0b', 'a\tb', 'a\u007fb',
      '\u1680\u2000', 'a\ud800b', 'a\udfffb', 'a'.repeat(256), 'a'.repeat(254) + '😀']
    for (const value of invalid) {
      expect(isProcessInstanceId(value), value).toBe(false)
      await expect(processWorkerFailuresApi.get('20', value)).rejects.toThrow('流程实例标识无效')
    }
    expect(isProcessInstanceId(null)).toBe(false)
    expect(isProcessInstanceId(20)).toBe(false)
    expect(isProcessInstanceId('a'.repeat(253) + '😀')).toBe(true)
    expect(isProcessInstanceId('\u00a0')).toBe(true)
    expect(isProcessInstanceId('\u2000expense')).toBe(true)
    await expect(processWorkerFailuresApi.get('020', INSTANCE)).rejects.toThrow('可信租户上下文不可用')
    await expect(processWorkerFailuresApi.get('9223372036854775808', INSTANCE)).rejects.toThrow('可信租户上下文不可用')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('requires closed envelope and row keys, explicit nulls, and strict values', async () => {
    const valid = snapshot([retry()])
    for (const value of [
      null, [], {}, {...valid, rawDebug: 'not public'}, without(valid, 'observedAt'),
      {...valid, failures: {}}, {...valid, failures: null}, {...valid, instanceId: null},
      snapshot([null]), snapshot([[]]), snapshot([{...retry(), tenantId: '20'}]),
      snapshot([without(manual(), 'activityId')]), snapshot([without(history(), 'expectedVersion')]),
      snapshot([{...retry(), nativeDeadletter: 'true'}]), snapshot([{...history(), nativeDeadletter: 0}]),
      snapshot([{...retry(), status: 'retry_available'}]), snapshot([{...retry(), reason: 'OTHER'}]),
      snapshot([{...retry(), reportedFailure: 'SUCCEEDED'}]), snapshot([{...history(), reportedFailure: null}]),
      snapshot([retry({jobId: ''})]), snapshot([retry({jobId: ' job'})]), snapshot([retry({jobId: '\ud800'})]),
      snapshot([retry({jobId: 'a'.repeat(256)})]), snapshot([retry({activityId: 'a'.repeat(129)})]),
      snapshot([retry({activityId: 'x\u007fy'})]), snapshot([{...retry(), expectedVersion: 17}]),
    ]) await rejectsSnapshot(value)
  })

  it('preserves canonical UTC dates and precision and rejects invalid dates, times, and fractions', async () => {
    for (const observedAt of [
      '2026-11-04T08:00:00Z', '2026-11-04T08:00:00.001Z', '2026-11-04T08:00:00.000001Z',
      OBSERVED, '2000-02-29T23:59:59.000000001Z',
    ]) {
      const value = {...snapshot(), observedAt}
      const fetcher = mockFetch(json(value))
      await expect(processWorkerFailuresApi.get('20', INSTANCE)).resolves.toEqual(value)
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
    for (const observedAt of [
      1793779200, null, '2026-11-04T08:00:00', '2026-11-04T08:00:00+00:00', '2026-11-04T08:00:00z',
      '2026-11-04T08:00:00Z ', '2026-11-04T08:00:00.1Z', '2026-11-04T08:00:00.1234Z',
      '2026-11-04T08:00:00.1234567890Z', '2026-11-04T08:00:00.000Z',
      '2026-11-04T08:00:00.123000Z', '2026-11-04T08:00:00.123456000Z',
      '0000-11-04T08:00:00Z', '+10000-11-04T08:00:00Z', '1900-02-29T08:00:00Z',
      '2026-00-04T08:00:00Z', '2026-11-00T08:00:00Z', '2026-11-31T08:00:00Z',
      '2026-11-04T24:00:00Z', '2026-11-04T08:60:00Z', '2026-11-04T08:00:60Z',
    ]) await rejectsSnapshot({...snapshot(), observedAt})
  })

  it('uses unsigned UTF-8 order, rejects duplicates, and caps rows at exactly 128', async () => {
    const utf8Ordered = ['j', 'j\u0080', 'j\ue000', 'j😀'].map(jobId => history({jobId}))
    const atLimit = Array.from({length: 128}, (_, index) =>
      retry({jobId: 'job-' + String(index).padStart(3, '0')}))
    const fullLength = [retry({jobId: 'a'.repeat(255), activityId: 'b'.repeat(128)})]
    for (const rows of [utf8Ordered, atLimit, fullLength]) {
      const value = snapshot(rows)
      const fetcher = mockFetch(json(value))
      await expect(processWorkerFailuresApi.get('20', INSTANCE)).resolves.toEqual(value)
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
    await rejectsSnapshot(snapshot([utf8Ordered[0], utf8Ordered[3], utf8Ordered[2]]))
    await rejectsSnapshot(snapshot([utf8Ordered[1], utf8Ordered[1]]))
    await rejectsSnapshot(snapshot([...atLimit, retry({jobId: 'job-128'})]))
  })

  it('keeps report facts independent while enforcing provider row cross-rules', async () => {
    const value = snapshot([
      retry(),
      manual({reason: 'UNKNOWN_OUTCOME', reportedFailure: 'UNKNOWN'}),
      history(),
      history({jobId: 'job-4', reason: 'BUSINESS_REJECTED', reportedFailure: 'BUSINESS_REJECTED'}),
      history({jobId: 'job-5', reason: 'HISTORY_INCOMPLETE', reportedFailure: 'NONE'}),
    ])
    const fetcher = mockFetch(json(value))
    await expect(processWorkerFailuresApi.get('20', INSTANCE)).resolves.toEqual(value)
    expect(fetcher).toHaveBeenCalledTimes(1)
    for (const invalid of [
      retry({nativeDeadletter: false}), retry({activityId: null}), retry({reason: 'ACTIVE_LEASE'}),
      retry({reportedFailure: 'UNKNOWN'}), retry({expectedVersion: null}),
      retry({expectedVersion: VERSION.toUpperCase()}), retry({expectedVersion: VERSION.slice(1)}),
      manual({nativeDeadletter: false}), manual({expectedVersion: VERSION}), manual({reason: 'NONE'}),
      manual({reason: 'NO_NATIVE_DEADLETTER'}), manual({reason: 'UNKNOWN_OUTCOME', reportedFailure: 'UNVERIFIED'}),
      manual({reason: 'BUSINESS_REJECTED', reportedFailure: 'NONE'}),
      history({nativeDeadletter: true}), history({expectedVersion: VERSION}), history({reason: 'ACTIVE_LEASE'}),
      history({reason: 'UNKNOWN_OUTCOME', reportedFailure: 'NONE'}),
    ]) await rejectsSnapshot(snapshot([invalid]))
  })

  it('rejects a malformed JSON response and an empty transport success', async () => {
    const malformed = mockFetch(new Response('{"instanceId":', {headers: {'Content-Type': 'application/json'}}))
    await expect(processWorkerFailuresApi.get('20', INSTANCE)).rejects.toMatchObject({code: 'INVALID_RESPONSE'})
    expect(malformed).toHaveBeenCalledTimes(1)
    const empty = mockFetch(new Response(null, {status: 204}))
    await expect(processWorkerFailuresApi.get('20', INSTANCE)).rejects.toThrow(INVALID)
    expect(empty).toHaveBeenCalledTimes(1)
  })

  it.each([
    [400, 'TIANJI_INVALID_COMMAND', null],
    [401, 'TIANJI_UNAUTHENTICATED', 'unauthenticated'],
    [403, 'TIANJI_PERMISSION_DENIED', 'forbidden'],
    [404, 'TIANJI_RESOURCE_NOT_FOUND', null],
    [409, 'TIANJI_TENANT_CONTEXT_CHANGED', 'tenant-changed'],
    [500, 'TIANJI_INTERNAL_ERROR', null],
    [503, 'TIANJI_DEPENDENCY_UNAVAILABLE', null],
  ] as const)('retains status %s and current shared auth handling without replay', async (status, code, authFailure) => {
    const handler = vi.fn()
    setAuthFailureHandler(handler)
    const captured = gatewayAuth.context.capture()
    const fetcher = mockFetch(json({code, message: 'test transport failure'}, status))
    await expect(processWorkerFailuresApi.get('20', INSTANCE)).rejects.toMatchObject({status, code})
    expect(fetcher).toHaveBeenCalledTimes(1)
    if (authFailure) {
      expect(handler).toHaveBeenCalledExactlyOnceWith(authFailure)
      expect(captured.signal.aborted).toBe(true)
    } else {
      expect(handler).not.toHaveBeenCalled()
      expect(captured.signal.aborted).toBe(false)
    }
  })
})
