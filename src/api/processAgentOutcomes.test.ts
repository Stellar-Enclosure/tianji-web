import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {setAuthFailureHandler} from './client'
import {processAgentOutcomesApi, type ProcessAgentOutcome} from './processAgentOutcomes'

const id = 'process /+账'
const observed = '2026-11-05T10:20:00.000005Z'
const dispatched = '2026-11-05T10:20:00.000001Z'
const received = '2026-11-05T10:20:00.000002Z'
const decided = '2026-11-05T10:20:00.000003Z'
const cursor = 'v1.' + 'a'.repeat(64)
const next = 'v1.' + 'b'.repeat(64)
const pending: ProcessAgentOutcome = {activityId: 'agentTask', dispatchState: 'PENDING', inboxState: 'RUN_NOT_CONFIRMED',
  terminalStatus: null, dispatchRecordedAt: dispatched, receivedAt: null, decidedAt: null}
const recorded: ProcessAgentOutcome = {...pending, dispatchState: 'SUBMITTED', inboxState: 'RECEIVED',
  terminalStatus: 'COMPLETED', receivedAt: received}
const applied: ProcessAgentOutcome = {...recorded, dispatchState: 'ACKNOWLEDGED', inboxState: 'APPLIED', decidedAt: decided}
const page = (items: readonly unknown[] = [], nextCursor: string | null = null) =>
  ({instanceId: id, observedAt: observed, items, nextCursor})
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: {'Content-Type': 'application/json'},
})
const stub = (response: Response) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response)
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
const without = <T extends object>(value: T, field: keyof T) => {
  const copy: Partial<T> = {...value}
  delete copy[field]
  return copy
}

describe('Process-local Agent outcome reads', () => {
  beforeEach(() => { gatewayAuth.context.invalidate() })
  afterEach(() => {
    setAuthFailureHandler(() => {})
    gatewayAuth.context.invalidate()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects a foreign Process Agent outcome page', async () => {
    const fetcher = stub(json({...page(), instanceId: 'other-instance'}))
    await expect(processAgentOutcomesApi.list('20', id)).rejects.toThrow('服务返回的 Process Agent 结果记录无效')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('uses only the exact encoded GET and optional cursor with the current tenant and abort', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(page())).mockResolvedValueOnce(json(page([applied])))
    vi.stubGlobal('fetch', fetcher)
    const controller = new AbortController()
    await expect(processAgentOutcomesApi.list('20', id, undefined, controller.signal)).resolves.toEqual(page())
    await expect(processAgentOutcomesApi.list('20', id, cursor, controller.signal)).resolves.toEqual(page([applied]))
    expect(Object.keys(processAgentOutcomesApi)).toEqual(['list'])
    expect(fetcher).toHaveBeenCalledTimes(2)
    const prefix = new URL(gatewayAuth.applicationBaseUrl, 'https://example.test').pathname.replace(/\/$/, '')
    const urls = fetcher.mock.calls.map(([url]) => new URL(String(url), 'https://example.test'))
    for (const url of urls) expect(url.pathname).toBe(prefix + '/api/tianji/v1/process-instances/process%20%2F%2B%E8%B4%A6/agent-outcomes')
    expect(urls[0].search).toBe('')
    expect(urls[1].search).toBe('?cursor=' + cursor)
    for (const [, request] of fetcher.mock.calls) {
      expect(request).toMatchObject({method: 'GET', credentials: 'include', cache: 'no-store'})
      expect(request?.body).toBeUndefined()
      const headers = new Headers(request?.headers)
      expect(headers.get('X-Egon-Tianji-Tenant')).toBe('20')
      expect(headers.get('Authorization')).toBeNull()
      expect(headers.get('X-CSRF-TOKEN')).toBeNull()
      expect(request?.signal?.aborted).toBe(false)
    }
    controller.abort()
    expect(fetcher.mock.calls.every(([, request]) => request?.signal?.aborted)).toBe(true)
  })

  it('rejects malformed instance IDs and non-outcome cursor syntax before dispatch', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    for (const instanceId of ['', '.', '..', ' process', 'process ', 'x'.repeat(256), 'process\u0000', 'process\ud800']) {
      await expect(processAgentOutcomesApi.list('20', instanceId)).rejects.toThrow('Process Agent 结果查询条件无效')
    }
    for (const invalid of ['', 'v1.YW5jaG9y', 'v1.' + 'a'.repeat(63), 'v1.' + 'a'.repeat(65),
      'v1.' + 'A'.repeat(64), cursor + '\n', 'v2.' + 'a'.repeat(64)]) {
      await expect(processAgentOutcomesApi.list('20', id, invalid)).rejects.toThrow('Process Agent 结果查询条件无效')
    }
    await expect(processAgentOutcomesApi.list('020', id)).rejects.toThrow('可信租户上下文不可用')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('preserves producer order and repeated activity IDs across all genuine Process-local states', async () => {
    const rows: ProcessAgentOutcome[] = [
      applied,
      {...pending, dispatchRecordedAt: '2026-11-05T10:20:00.000004Z'},
      {...pending, dispatchState: 'CLOSING', inboxState: 'NOT_OBSERVED'},
      recorded,
      {...applied, dispatchState: 'CLOSED', inboxState: 'IGNORED_LATE', terminalStatus: 'FAILED'},
      {...applied, inboxState: 'DEAD', terminalStatus: null},
      {...applied, inboxState: 'DEAD', terminalStatus: 'TIMED_OUT'},
      {...applied, inboxState: 'DEAD', terminalStatus: 'CANCELLED'},
    ]
    const fetcher = stub(json(page(rows)))
    await expect(processAgentOutcomesApi.list('20', id)).resolves.toEqual(page(rows))
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('requires the closed public shape and valid optional evidence chronology and states', async () => {
    for (const invalid of [
      null, [], {...page(), runId: 'foreign-agent-run'}, without(page(), 'nextCursor'), {...page(), items: null},
      {...page(), observedAt: '2026-11-05T10:20:00+00:00'},
      page([null]), page([without(pending, 'terminalStatus')]), page([{...pending, activityId: '1bad'}]),
      page([{...pending, dispatchState: 'ACTIVE'}]), page([{...pending, inboxState: 'UNKNOWN'}]),
      page([{...pending, terminalStatus: 'COMPLETED'}]), page([{...pending, receivedAt: received}]),
      page([{...recorded, terminalStatus: 'RUNNING'}]), page([{...recorded, terminalStatus: null}]),
      page([{...recorded, decidedAt: decided}]), page([{...applied, receivedAt: null}]),
      page([{...applied, decidedAt: null}]), page([{...applied, receivedAt: '2026-11-05T10:20:00.000000Z'}]),
      page([{...applied, decidedAt: dispatched}]), page([{...applied, decidedAt: '2026-11-05T10:20:00.000006Z'}]),
      page([{...pending, dispatchRecordedAt: '2026-11-05T10:20:00.000006Z'}]),
      page([{...pending, receivedAt: 0}]), page([{...pending, ownerIssuer: 'private'}]),
    ]) {
      const fetcher = stub(json(invalid))
      await expect(processAgentOutcomesApi.list('20', id)).rejects.toThrow('服务返回的 Process Agent 结果记录无效')
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
  })

  it('enforces the exact 20-row page cap and only a non-repeating cursor on a full page', async () => {
    const full = Array.from({length: 20}, () => pending)
    stub(json(page(full, next)))
    await expect(processAgentOutcomesApi.list('20', id, cursor)).resolves.toEqual(page(full, next))
    for (const invalid of [page([...full, pending]), page([], next), page([pending], next),
      page(full, 'v1.YQ'), page(full, cursor)]) {
      stub(json(invalid))
      await expect(processAgentOutcomesApi.list('20', id, cursor)).rejects.toThrow('服务返回的 Process Agent 结果记录无效')
    }
  })

  it('retains existing global authority behavior and never replays an unavailable or denied GET', async () => {
    const handler = vi.fn()
    setAuthFailureHandler(handler)
    const unavailable = stub(json({code: 'TIANJI_RESOURCE_NOT_FOUND'}, 404))
    await expect(processAgentOutcomesApi.list('20', id)).rejects.toMatchObject({status: 404})
    expect(unavailable).toHaveBeenCalledTimes(1)
    expect(handler).not.toHaveBeenCalled()

    const denied = stub(json({code: 'TIANJI_PERMISSION_DENIED'}, 403))
    const epoch = gatewayAuth.context.epoch
    await expect(processAgentOutcomesApi.list('20', id)).rejects.toMatchObject({status: 403})
    expect(handler).toHaveBeenCalledExactlyOnceWith('forbidden')
    expect(gatewayAuth.context.epoch).toBeGreaterThan(epoch)
    expect(denied).toHaveBeenCalledTimes(1)
  })
})
