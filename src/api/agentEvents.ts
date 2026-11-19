import {ApiError, PublicOAuthError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {gatewayAuth} from '../auth/gatewayAuth'
import {TENANT_HEADER, createTianjiTransport, isCanonicalTenant, notifyAuthFailure} from './client'
import {eventPath, isAgentEvent, type AgentEvent} from './agent'

const MAX_FRAME = 2_097_152
const MAX_FAILURES = 5
const CONNECT_TIMEOUT = 15_000
const IDLE_TIMEOUT = 15_000
type ConnectionState = 'connecting' | 'live' | 'reconnecting'
type Outcome = 'complete' | 'rotate' | 'disconnected'

export class AgentStreamError extends Error {
  constructor(readonly code: 'CURSOR_EXPIRED' | 'INVALID_STREAM' | 'DISCONNECTED' | 'AUTH_CHANGED' | 'NOT_FOUND' | 'UNAVAILABLE') {
    super(code)
    this.name = 'AgentStreamError'
  }
}

/** Reads persisted events under one resource authorization until the reader closes or the epoch changes. */
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
  if (options.signal.aborted) return
  const captured = gatewayAuth.context.capture(options.signal)
  const transport = (() => {
    try { return createTianjiTransport(options.tenantId, CONNECT_TIMEOUT) }
    catch (failure) { throwStreamFailure(failure); throw failure }
  })()
  let cursor = options.afterSequence
  let failures = 0
  while (!options.signal.aborted) {
    captured.assertCurrent()
    options.onState(failures === 0 ? 'connecting' : 'reconnecting')
    const idle = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const resetIdle = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => idle.abort(), IDLE_TIMEOUT)
    }
    const started = performance.now()
    let progressed = false
    try {
      const outcome = await transport.withEventStream(eventPath(options.runId, cursor), async (response, signal) => {
        if (!response.body) throw new AgentStreamError('INVALID_STREAM')
        options.onState('live')
        resetIdle()
        const parser = new EventParser(options.runId, () => cursor, event => {
          captured.assertCurrent()
          signal.throwIfAborted()
          options.onEvent(event)
          cursor = event.sequence
          progressed = true
        })
        return readEvents(response.body, parser, signal, resetIdle)
      }, {method: 'GET', headers: {[TENANT_HEADER]: options.tenantId,
        ...(cursor > 0 ? {'Last-Event-ID': String(cursor)} : {})},
      signal: AbortSignal.any([captured.signal, idle.signal])})
      if (outcome === 'complete') return
      if (outcome === 'rotate' && performance.now() - started >= 1_000) {
        failures = 0
        await pause(250, captured.signal)
        continue
      }
    } catch (failure) {
      throwStreamFailure(failure)
      captured.assertCurrent()
    } finally {
      if (timer) clearTimeout(timer)
    }
    if (progressed) failures = 0
    failures += 1
    if (failures > MAX_FAILURES) throw new AgentStreamError('DISCONNECTED')
    options.onState('reconnecting')
    await pause(Math.min(4_000, 250 * 2 ** (failures - 1)), captured.signal)
  }
}

function throwStreamFailure(failure: unknown): void {
  if (failure instanceof AgentStreamError) throw failure
  if (failure instanceof PublicOAuthError && failure.code === 'AUTHORIZATION_REQUIRED') {
    notifyAuthFailure('unauthenticated')
    throw new AgentStreamError('AUTH_CHANGED')
  }
  if (!(failure instanceof ApiError)) return
  switch (failure.status) {
    case 401:
    case 403: throw new AgentStreamError('AUTH_CHANGED')
    case 409:
      notifyAuthFailure('tenant-changed')
      throw new AgentStreamError('AUTH_CHANGED')
    case 410: throw new AgentStreamError('CURSOR_EXPIRED')
    case 404: throw new AgentStreamError('NOT_FOUND')
    case 503: throw new AgentStreamError('UNAVAILABLE')
    case 400:
    case 422: throw new AgentStreamError('INVALID_STREAM')
  }
  if (failure.code === 'INVALID_RESPONSE') throw new AgentStreamError('INVALID_STREAM')
}

async function readEvents(body: ReadableStream<Uint8Array>, parser: EventParser, signal: AbortSignal,
  resetIdle: () => void): Promise<Outcome> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8', {fatal: true})
  const release = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', release, {once: true})
  try {
    for (;;) {
      signal.throwIfAborted()
      const part = await reader.read()
      signal.throwIfAborted()
      if (part.done) return parser.feed(decoder.decode())
      resetIdle()
      if (part.value.byteLength > MAX_FRAME * 2) throw new AgentStreamError('INVALID_STREAM')
      const outcome = parser.feed(decoder.decode(part.value, {stream: true}))
      if (outcome !== 'disconnected') return outcome
    }
  } catch (failure) {
    signal.throwIfAborted()
    if (failure instanceof TypeError) throw new AgentStreamError('INVALID_STREAM')
    throw failure
  } finally {
    signal.removeEventListener('abort', release)
    await reader.cancel().catch(() => {})
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
