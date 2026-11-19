import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {setAuthFailureHandler} from './client'
import {AgentStreamError, observeAgentRun} from './agentEvents'
import type {AgentEvent} from './agent'

const event = (sequence: number): AgentEvent => ({eventId: `event-${sequence}`, runId: 'run-1', sequence,
  type: 'TEXT_DELTA', author: 'writer', occurredAt: '2026-10-28T00:00:00Z', payload: {text: `part-${sequence}`}})
const frame = (sequence: number) => `id: ${sequence}\nevent: agent.event\ndata: ${JSON.stringify(event(sequence))}\n\n`
const response = (body: string | Uint8Array, contentType = 'text/event-stream') => {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body
  return new Response(new ReadableStream<Uint8Array>({start(controller) { controller.enqueue(bytes); controller.close() }}),
    {status: 200, headers: {'Content-Type': contentType}})
}
const observe = (signal: AbortSignal, received: AgentEvent[]) => observeAgentRun({tenantId: '20', runId: 'run-1',
  afterSequence: 0, signal, onEvent: value => received.push(value), onState: () => {}})

describe('Agent SSE transport', () => {
  beforeEach(() => gatewayAuth.context.invalidate())
  afterEach(() => { gatewayAuth.context.invalidate(); setAuthFailureHandler(() => {}); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('reconnects using the last delivered sequence and sends only the Tianji Resource Bearer', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(frame(1)))
      .mockResolvedValueOnce(response(frame(1) + frame(2) + 'event: stream.complete\n\n'))
    vi.stubGlobal('fetch', fetcher)
    const received: AgentEvent[] = []
    await observe(new AbortController().signal, received)
    expect(received.map(value => value.sequence)).toEqual([1, 2])
    expect(fetcher).toHaveBeenCalledTimes(2)
    const first = fetcher.mock.calls[0][1] as RequestInit
    const second = fetcher.mock.calls[1][1] as RequestInit
    expect(first.credentials).toBe('omit')
    expect(new Headers(first.headers).get('Authorization')).toBe('Bearer tianji-resource-token')
    expect(new Headers(second.headers).get('Authorization')).toBe('Bearer tianji-resource-token')
    expect(new Headers(first.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
    expect(String(fetcher.mock.calls[1][0])).toContain('afterSequence=1')
    expect(new Headers(second.headers).get('Last-Event-ID')).toBe('1')
  })

  it('stops the old stream immediately when the authentication epoch changes', async () => {
    let cancelled = false
    const fetcher = vi.fn((_url: string, init: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({start(controller) {
        init.signal?.addEventListener('abort', () => { cancelled = true; controller.error(new DOMException('closed', 'AbortError')) }, {once: true})
      }})
      return Promise.resolve(new Response(body, {headers: {'Content-Type': 'text/event-stream'}}))
    })
    vi.stubGlobal('fetch', fetcher)
    const received: AgentEvent[] = []
    const running = observe(new AbortController().signal, received)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    gatewayAuth.context.invalidate()
    await expect(running).rejects.toMatchObject({name: 'AbortError'})
    expect(cancelled).toBe(true)
    expect(received).toEqual([])
  })

  it('reports an expired cursor and rejects a gap or malformed UTF-8', async () => {
    const received: AgentEvent[] = []
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, {status: 410}))
    vi.stubGlobal('fetch', fetcher)
    await expect(observe(new AbortController().signal, received)).rejects.toMatchObject({code: 'CURSOR_EXPIRED'})
    expect(fetcher).toHaveBeenCalledTimes(1)
    fetcher.mockResolvedValueOnce(response(frame(2)))
    await expect(observe(new AbortController().signal, received)).rejects.toMatchObject({code: 'INVALID_STREAM'})
    fetcher.mockResolvedValueOnce(response(new Uint8Array([100, 97, 116, 97, 58, 32, 0xc3, 0x28, 10, 10])))
    await expect(observe(new AbortController().signal, received)).rejects.toMatchObject({code: 'INVALID_STREAM'})
    expect(received).toEqual([])
  })

  it('rotates a healthy idle stream without treating it as a failed run', async () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(1500).mockReturnValue(2000)
    const fetcher = vi.fn().mockResolvedValueOnce(response('event: stream.reconnect\n\n'))
      .mockResolvedValueOnce(response(frame(1) + 'event: stream.complete\n\n'))
    vi.stubGlobal('fetch', fetcher)
    const received: AgentEvent[] = []
    await observe(new AbortController().signal, received)
    expect(received).toEqual([event(1)])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('invalidates the session on a tenant mismatch', async () => {
    const handler = vi.fn()
    setAuthFailureHandler(handler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {status: 409})))
    const epoch = gatewayAuth.context.epoch
    await expect(observe(new AbortController().signal, [])).rejects.toMatchObject({code: 'AUTH_CHANGED'})
    expect(handler).toHaveBeenCalledWith('tenant-changed')
    expect(gatewayAuth.context.epoch).toBeGreaterThan(epoch)
  })

  it.each([[401, 'unauthenticated'], [403, 'forbidden']] as const)(
    'clears authorization on HTTP %s without retrying', async (status, kind) => {
      const handler = vi.fn()
      setAuthFailureHandler(handler)
      const fetcher = vi.fn().mockResolvedValue(new Response(null, {status}))
      vi.stubGlobal('fetch', fetcher)
      await expect(observe(new AbortController().signal, [])).rejects.toMatchObject({code: 'AUTH_CHANGED'})
      expect(handler).toHaveBeenCalledWith(kind)
      expect(fetcher).toHaveBeenCalledTimes(1)
    })

  it('leaves the epoch intact on 503 and exposes service unavailability', async () => {
    const handler = vi.fn()
    setAuthFailureHandler(handler)
    const fetcher = vi.fn().mockResolvedValue(new Response(null, {status: 503}))
    vi.stubGlobal('fetch', fetcher)
    const epoch = gatewayAuth.context.epoch
    await expect(observe(new AbortController().signal, [])).rejects.toMatchObject({code: 'UNAVAILABLE'})
    expect(handler).not.toHaveBeenCalled()
    expect(gatewayAuth.context.epoch).toBe(epoch)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('bounds repeated immediate rotation requests', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response('event: stream.reconnect\n\n')))
    vi.stubGlobal('fetch', fetcher)
    const result = observe(new AbortController().signal, []).catch(error => error as AgentStreamError)
    await vi.runAllTimersAsync()
    expect(await result).toMatchObject({code: 'DISCONNECTED'})
    expect(fetcher).toHaveBeenCalledTimes(6)
  })
})
