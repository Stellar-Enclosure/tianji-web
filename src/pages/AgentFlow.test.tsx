import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter, Route, Routes} from 'react-router-dom'
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import type {AgentRun} from '../api/agent'
import {useAuth} from '../auth/AuthContext'
import {authorization, run} from '../test/fixtures'
import AgentRunDetailPage from './AgentRunDetailPage'
import AgentRunsPage from './AgentRunsPage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))

const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'Content-Type': 'application/json'}})
const event = (sequence: number, type: string, payload: Record<string, unknown>) =>
  `id: ${sequence}\nevent: agent.event\ndata: ${JSON.stringify({eventId: `event-${sequence}`, runId: 'run-1',
    sequence, type, author: null, occurredAt: '2026-10-28T00:00:00Z', payload})}\n\n`

beforeEach(() => {
  sessionStorage.clear()
  gatewayAuth.context.invalidate()
  vi.mocked(useAuth).mockReturnValue({status: 'ready', authorization: authorization(), allows: () => true,
    login: () => {}, logout: async () => {}, retry: async () => {}})
})
afterEach(() => { gatewayAuth.context.invalidate(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('opens an existing run and observes its persisted events and cancellation', async () => {
  let current: AgentRun = {...run(), status: 'QUEUED', attempt: 0, revision: 0, lastEventSequence: 1}
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined
  const encoder = new TextEncoder()
  const fetcher = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input), 'https://example.test')
    const method = init?.method ?? 'GET'
    if (url.pathname.endsWith('/agent-runs') && method === 'GET') return Promise.resolve(json({items: [current], nextCursor: null}))
    if (url.pathname.endsWith('/run-1/events')) {
      return Promise.resolve(new Response(new ReadableStream<Uint8Array>({start(controller) {
        stream = controller
        controller.enqueue(encoder.encode(event(1, 'RUN_QUEUED', {status: 'QUEUED'})))
      }}), {headers: {'Content-Type': 'text/event-stream'}}))
    }
    if (url.pathname.endsWith('/run-1/cancel')) {
      current = {...current, status: 'CANCELLED', revision: 1, lastEventSequence: 2,
        finishedAt: '2026-10-28T00:01:00Z'}
      stream?.enqueue(encoder.encode(event(2, 'RUN_STATUS_CHANGED', {from: 'QUEUED', status: 'CANCELLED'})
        + 'event: stream.complete\n\n'))
      stream?.close()
      return Promise.resolve(json({runId: 'run-1', accepted: true, status: 'CANCELLED', revision: 1,
        requestedAt: '2026-10-28T00:01:00Z'}))
    }
    if (url.pathname.endsWith('/run-1/result')) return Promise.resolve(json({runId: 'run-1', status: 'CANCELLED',
      output: {}, artifactRef: null, outputSchemaVersion: null, usage: null, errorCode: null, sideEffectOutcome: 'NONE'}))
    if (url.pathname.endsWith('/run-1')) return Promise.resolve(json(current))
    throw new Error('Unexpected test request')
  })
  vi.stubGlobal('fetch', fetcher)
  render(<MemoryRouter initialEntries={['/runs']}><Routes>
    <Route path="/runs" element={<AgentRunsPage />} /><Route path="/runs/:runId" element={<AgentRunDetailPage />} />
  </Routes></MemoryRouter>)
  expect(await screen.findByText('research')).toBeInTheDocument()
  expect(screen.queryByRole('button', {name: '启动运行'})).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', {name: '查看'}))
  expect(await screen.findByText(/#1 RUN_QUEUED/)).toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button', {name: '取消运行'}))
  await waitFor(() => expect(screen.getByText('已取消')).toBeInTheDocument())
  expect(await screen.findByText(/#2 RUN_STATUS_CHANGED/)).toBeInTheDocument()
  const requests = fetcher.mock.calls.map(([, init]) => init as RequestInit)
  expect(fetcher.mock.calls.some(([input, init]) => new URL(String(input), 'https://example.test').pathname.endsWith('/agent-runs')
    && init?.method === 'POST')).toBe(false)
  expect(requests.every(request => request.credentials === 'omit')).toBe(true)
  expect(requests.every(request => new Headers(request.headers).get('Authorization') === 'Bearer tianji-resource-token')).toBe(true)
  expect(requests.every(request => new Headers(request.headers).get('X-Egon-Tianji-Tenant') === '20')).toBe(true)
  expect(requests.filter(request => request.method === 'POST')
    .every(request => new Headers(request.headers).get('X-CSRF-TOKEN') === null)).toBe(true)
})

it('resumes the last observed event after reauthorization only for the same verified actor and run', async () => {
  const observed: {cursor: string | null; lastEventId: string | null}[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input))
    expect(init?.method ?? 'GET').toBe('GET')
    if (!url.pathname.endsWith('/events')) return json(run())
    const cursor = url.searchParams.get('afterSequence')
    observed.push({cursor, lastEventId: new Headers(init?.headers).get('Last-Event-ID')})
    return new Response(event(Number(cursor) + 1, 'RUN_QUEUED', {status: 'QUEUED'}) + 'event: stream.complete\n\n',
      {headers: {'Content-Type': 'text/event-stream'}})
  }
  vi.stubGlobal('fetch', fetcher)
  const openRun = () => render(<MemoryRouter initialEntries={['/runs/run-1']}><Routes>
    <Route path="/runs/:runId" element={<AgentRunDetailPage />} />
  </Routes></MemoryRouter>)

  const beforeReauthorization = openRun()
  await screen.findByText(/#1 RUN_QUEUED/)
  beforeReauthorization.unmount()

  const sameActor = openRun()
  await screen.findByText(/#2 RUN_QUEUED/)
  expect(screen.queryByText(/#1 RUN_QUEUED/)).not.toBeInTheDocument()
  sameActor.unmount()

  const signed = authorization()
  vi.mocked(useAuth).mockReturnValue({...vi.mocked(useAuth)(), authorization: {
    ...signed, identity: {...signed.identity, subject: 'another-operator'},
  }})
  openRun()
  await screen.findByText(/#1 RUN_QUEUED/)
  expect(observed).toEqual([
    {cursor: '0', lastEventId: null},
    {cursor: '1', lastEventId: '1'},
    {cursor: '0', lastEventId: null},
  ])
})
