import {gatewayAuth} from '../auth/gatewayAuth'
import {TENANT_HEADER, isCanonicalTenant, notifyAuthFailure} from './client'
import {eventPath, isAgentEvent, type AgentEvent} from './agent'

const MAX_FRAME = 2_097_152
const MAX_FAILURES = 5
const CONNECT_TIMEOUT = 15_000
const IDLE_TIMEOUT = 15_000
type ConnectionState = 'connecting' | 'live' | 'reconnecting'
type Outcome = 'complete' | 'rotate' | 'disconnected'

export class AgentStreamError extends Error {
  constructor(readonly code: 'CURSOR_EXPIRED' | 'INVALID_STREAM' | 'DISCONNECTED' | 'AUTH_CHANGED' | 'NOT_FOUND') {
    super(code)
    this.name = 'AgentStreamError'
  }
}

/** Cookie-only SSE reader; closing this subscription never sends a run cancellation. */
export async function observeAgentRun(options: Readonly<{
  tenantId: string
  runId: string
  afterSequence: number
  signal: AbortSignal
  onEvent: (event: AgentEvent) => void
  onState: (state: ConnectionState) => void
}>): Promise<void> {
  if (!isCanonicalTenant(options.tenantId)
      || !Number.isSafeInteger(options.afterSequence) || options.afterSequence < 0) {
    throw new AgentStreamError('INVALID_STREAM')
  }
  let cursor = options.afterSequence
  let failures = 0
  while (!options.signal.aborted) {
    const captured = gatewayAuth.context.capture(options.signal)
    options.onState(failures === 0 ? 'connecting' : 'reconnecting')
    const connection = new AbortController()
    const idle = new AbortController()
    let connectTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => connection.abort(), CONNECT_TIMEOUT)
    let idleTimer: ReturnType<typeof setTimeout> | undefined
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => idle.abort(), IDLE_TIMEOUT)
    }
    const started = performance.now()
    let progressed = false
    let outcome: Outcome
    try {
      const response = await fetch(gatewayAuth.applicationBaseUrl + eventPath(options.runId, cursor), {
        method: 'GET', credentials: 'include', redirect: 'error', cache: 'no-store',
        headers: {Accept: 'text/event-stream', [TENANT_HEADER]: options.tenantId,
          ...(cursor > 0 ? {'Last-Event-ID': String(cursor)} : {})},
        signal: AbortSignal.any([captured.signal, connection.signal, idle.signal]),
      })
      clearTimeout(connectTimer)
      connectTimer = undefined
      captured.assertCurrent()
      if (response.status === 401) {
        gatewayAuth.context.invalidate()
        notifyAuthFailure('unauthenticated')
        throw new AgentStreamError('AUTH_CHANGED')
      }
      if (response.status === 403 || response.status === 409) {
        notifyAuthFailure(response.status === 403 ? 'forbidden' : 'tenant-changed')
        throw new AgentStreamError('AUTH_CHANGED')
      }
      if (response.status === 410) throw new AgentStreamError('CURSOR_EXPIRED')
      if (response.status === 404) throw new AgentStreamError('NOT_FOUND')
      if (response.status === 400 || response.status === 422) throw new AgentStreamError('INVALID_STREAM')
      if (!response.ok) throw new Error('stream unavailable')
      if (response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'text/event-stream'
        || !response.body) throw new AgentStreamError('INVALID_STREAM')
      options.onState('live')
      resetIdle()
      const parser = new EventParser(options.runId, () => cursor, event => {
        captured.assertCurrent()
        options.onEvent(event)
        cursor = event.sequence
        progressed = true
      })
      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8', {fatal: true})
      try {
        while (true) {
          const part = await reader.read()
          captured.assertCurrent()
          if (part.done) {
            outcome = parser.feed(decoder.decode())
            break
          }
          resetIdle()
          if (part.value.byteLength > MAX_FRAME * 2) throw new AgentStreamError('INVALID_STREAM')
          outcome = parser.feed(decoder.decode(part.value, {stream: true}))
          if (outcome !== 'disconnected') break
        }
      } catch (failure) {
        if (failure instanceof TypeError) throw new AgentStreamError('INVALID_STREAM')
        throw failure
      } finally {
        await reader.cancel().catch(() => {})
      }
      if (outcome === 'complete') return
      if (outcome === 'rotate' && performance.now() - started >= 1_000) {
        failures = 0
        await pause(250, captured.signal)
        continue
      }
    } catch (failure) {
      if (failure instanceof AgentStreamError && failure.code === 'AUTH_CHANGED') throw failure
      captured.assertCurrent()
      if (failure instanceof AgentStreamError) throw failure
    } finally {
      if (connectTimer) clearTimeout(connectTimer)
      if (idleTimer) clearTimeout(idleTimer)
    }
    if (progressed) failures = 0
    failures += 1
    if (failures > MAX_FAILURES) throw new AgentStreamError('DISCONNECTED')
    options.onState('reconnecting')
    await pause(Math.min(4_000, 250 * 2 ** (failures - 1)), captured.signal)
  }
}

class EventParser {
  private pending = ''
  private name: string | undefined
  private id: string | undefined
  private data: string[] = []
  private frameLength = 0
  private frameBytes = 0
  private readonly encoder = new TextEncoder()
  private duplicates = 0

  constructor(private readonly runId: string, private readonly cursor: () => number,
              private readonly deliver: (event: AgentEvent) => void) { }

  feed(chunk: string): Outcome {
    this.pending += chunk
    if (this.pending.length > MAX_FRAME * 2) throw new AgentStreamError('INVALID_STREAM')
    let newline: number
    while ((newline = this.pending.indexOf('\n')) >= 0) {
      let line = this.pending.slice(0, newline)
      this.pending = this.pending.slice(newline + 1)
      if (line.endsWith('\r')) line = line.slice(0, -1)
      this.frameLength += line.length + 1
      this.frameBytes += this.encoder.encode(line).byteLength + 1
      if (line.length > MAX_FRAME || this.frameLength > MAX_FRAME || this.frameBytes > MAX_FRAME) {
        throw new AgentStreamError('INVALID_STREAM')
      }
      if (!line) {
        const outcome = this.dispatch()
        this.name = undefined
        this.id = undefined
        this.data = []
        this.frameLength = 0
        this.frameBytes = 0
        if (outcome !== 'disconnected') return outcome
        continue
      }
      if (line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon < 0 ? line : line.slice(0, colon)
      let value = colon < 0 ? '' : line.slice(colon + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'event') this.name = value
      else if (field === 'id') this.id = value
      else if (field === 'data') this.data.push(value)
    }
    if (this.pending.length > MAX_FRAME) throw new AgentStreamError('INVALID_STREAM')
    return 'disconnected'
  }

  private dispatch(): Outcome {
    if (this.name === 'stream.complete' || this.name === 'stream.reconnect') {
      if (this.id !== undefined || this.data.length > 0) throw new AgentStreamError('INVALID_STREAM')
      return this.name === 'stream.complete' ? 'complete' : 'rotate'
    }
    if (this.data.length === 0) return 'disconnected'
    if (this.name !== undefined && this.name !== 'agent.event') throw new AgentStreamError('INVALID_STREAM')
    let value: unknown
    try { value = JSON.parse(this.data.join('\n')) as unknown }
    catch { throw new AgentStreamError('INVALID_STREAM') }
    if (!isAgentEvent(value) || value.runId !== this.runId || this.id !== String(value.sequence)) {
      throw new AgentStreamError('INVALID_STREAM')
    }
    if (value.sequence <= this.cursor()) {
      if (++this.duplicates > 1000) throw new AgentStreamError('INVALID_STREAM')
      return 'disconnected'
    }
    if (value.sequence !== this.cursor() + 1) throw new AgentStreamError('INVALID_STREAM')
    this.deliver(value)
    this.duplicates = 0
    return 'disconnected'
  }
}

const pause = (milliseconds: number, signal: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException('Subscription closed', 'AbortError')); return }
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, milliseconds)
  const abort = () => { clearTimeout(timer); reject(new DOMException('Subscription closed', 'AbortError')) }
  signal.addEventListener('abort', abort, {once: true})
})
