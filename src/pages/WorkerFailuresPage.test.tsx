import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {processWorkerFailuresApi} from '../api/processWorkerFailures'
import {useAuth} from '../auth/AuthContext'
import {authorization} from '../test/fixtures'
import WorkerFailuresPage from './WorkerFailuresPage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/processWorkerFailures', async () => {
  const actual = await vi.importActual<typeof import('../api/processWorkerFailures')>('../api/processWorkerFailures')
  return {...actual, processWorkerFailuresApi: {...actual.processWorkerFailuresApi, get: vi.fn()}}
})

const PAGE = 'tianji.page.workerFailures'
const PROCESS_INSTANCE_PAGE = 'tianji.page.processInstance'
const QUERY = '查询失败快照'
const INPUT = '流程实例标识'
const EMPTY = '此快照未返回 Worker 失败记录。'
const INVALID = '请输入有效的流程实例标识。'
const DENIED = '当前身份不能访问此页面。'
const LOADING = '正在查询 Worker 失败快照'
const NOT_VISIBLE = '当前无法观察该流程实例。'
const UNAVAILABLE = '暂时无法读取 Worker 失败快照。'
const OBSERVED = '2026-11-04T08:00:00.123456789Z'
const VERSION = 'a'.repeat(64)
const INSTANCE = 'expense /+ 1'
type Snapshot = Awaited<ReturnType<typeof processWorkerFailuresApi.get>>
type Failure = Snapshot['failures'][number]
type IdentityChange = Readonly<{tenant?: string; issuer?: string; subject?: string; epoch?: number}>

const auth = (change: IdentityChange = {}, allowed = true, processInstance = false): ReturnType<typeof useAuth> => {
  const value = authorization(change.tenant ?? '20', ['TIANJI_PROCESS_READ', 'TIANJI_PROCESS_WORKER_RECOVER'])
  const issuer = change.issuer ?? value.identity.issuer
  const subject = change.subject ?? value.identity.subject
  return {
    status: 'ready',
    authorization: {...value, identity: {...value.identity, issuer, subject},
      snapshot: {...value.snapshot, issuer, subject},
      binding: {...value.binding, issuer, subject, requestEpoch: change.epoch ?? value.binding.requestEpoch}},
    allows: (resource: string) => resource === PAGE ? allowed : resource === PROCESS_INSTANCE_PAGE && processInstance,
    login: () => {}, logout: async () => {}, retry: async () => {},
  }
}
let currentAuth = auth()
const view = (path = '/operations/worker-failures') =>
  <MemoryRouter initialEntries={[path]}><WorkerFailuresPage /></MemoryRouter>
const snapshot = (instanceId = INSTANCE, failures: readonly Failure[] = []): Snapshot =>
  ({instanceId, observedAt: OBSERVED, failures})
const visibleFailure = (jobId = 'job-ready'): Failure => ({
  jobId, activityId: 'workerStep', nativeDeadletter: true, status: 'RETRY_AVAILABLE',
  reason: 'NONE', reportedFailure: 'RETRYABLE', expectedVersion: VERSION,
})
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(accept => { resolve = accept })
  return {promise, resolve}
}
const input = () => screen.getByLabelText(INPUT)
const edit = (value: string) => fireEvent.change(input(), {target: {value}})
const submit = () => fireEvent.click(screen.getByRole('button', {name: QUERY}))
const observe = (instanceId: string) => { edit(instanceId); submit() }

describe('Worker failure observations', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    currentAuth = auth()
    vi.mocked(useAuth).mockImplementation(() => currentAuth)
    vi.mocked(processWorkerFailuresApi.get).mockImplementation(async (_, instanceId) => snapshot(instanceId))
  })

  it('renders only an explicit worker failure lookup', () => {
    render(view('/operations/worker-failures?instanceId=untrusted-prefill'))
    expect(processWorkerFailuresApi.get).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', {name: QUERY})).toBeInTheDocument()
    expect(screen.getByRole('heading', {name: 'Worker 失败观察'})).toBeInTheDocument()
    expect(input()).toHaveValue('')
  })

  it('rejects nonexact input locally and submits the exact identifier only on manual action', async () => {
    render(view())
    edit(' expense-1')
    submit()
    expect(await screen.findByText(INVALID)).toBeInTheDocument()
    expect(processWorkerFailuresApi.get).not.toHaveBeenCalled()
    expect(input()).toHaveValue(' expense-1')

    edit(INSTANCE)
    expect(processWorkerFailuresApi.get).not.toHaveBeenCalled()
    submit()
    expect(await screen.findByText(EMPTY)).toBeInTheDocument()
    expect(processWorkerFailuresApi.get).toHaveBeenCalledWith('20', INSTANCE, expect.any(AbortSignal))
    submit()
    await waitFor(() => expect(processWorkerFailuresApi.get).toHaveBeenCalledTimes(2))
    expect(processWorkerFailuresApi.get).toHaveBeenNthCalledWith(2, '20', INSTANCE, expect.any(AbortSignal))
  })

  it('shows exact current snapshot facts, independent UNKNOWN, history, and a neutral retry mark', async () => {
    const history: Failure = {jobId: 'job-history', activityId: null, nativeDeadletter: false,
      status: 'HISTORICAL_FAILURE', reason: 'NO_NATIVE_DEADLETTER', reportedFailure: 'UNKNOWN', expectedVersion: null}
    const manual: Failure = {jobId: 'job-manual', activityId: 'bindWorker', nativeDeadletter: true,
      status: 'MANUAL_REVIEW', reason: 'BINDING_UNVERIFIED', reportedFailure: 'UNVERIFIED', expectedVersion: null}
    vi.mocked(processWorkerFailuresApi.get).mockResolvedValueOnce(snapshot(INSTANCE, [history, manual, visibleFailure()]))
    render(view())
    observe(INSTANCE)

    const historical = (await screen.findByText('job-history')).closest('tr')!
    const pending = screen.getByText('job-manual').closest('tr')!
    const ready = screen.getByText('job-ready').closest('tr')!
    expect(within(historical).getByText('历史失败记录')).toBeInTheDocument()
    expect(within(historical).getByText('当前未见原生 deadletter')).toBeInTheDocument()
    expect(within(historical).getByText('结果未知，需核对')).toBeInTheDocument()
    expect(within(historical).getByText('—')).toBeInTheDocument()
    expect(within(pending).getByText('需人工核对')).toBeInTheDocument()
    expect(within(pending).getByText('来源绑定尚未验证')).toBeInTheDocument()
    expect(within(pending).getByText('报告结果尚未验证')).toBeInTheDocument()
    expect(within(ready).getByText('服务端快照标记可重试')).toBeInTheDocument()
    expect(within(ready).getByText('已报告可重试')).toBeInTheDocument()
    expect(within(ready).getByText('workerStep')).toBeInTheDocument()
    expect(screen.getByText(INSTANCE, {exact: false})).toBeInTheDocument()
    const time = document.querySelector('time[datetime="' + OBSERVED + '"]')
    expect(time).toHaveTextContent(/123456789.*UTC|UTC.*123456789/)
    expect(historical.compareDocumentPosition(pending) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(pending.compareDocumentPosition(ready) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText(VERSION, {exact: false})).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: /恢复|取消|重试/})).not.toBeInTheDocument()
    expect(processWorkerFailuresApi.get).toHaveBeenCalledTimes(1)
  })

  it('links an observed Worker snapshot to its instance when the instance page is readable', async () => {
    currentAuth = auth({}, true, true)
    vi.mocked(processWorkerFailuresApi.get).mockResolvedValueOnce(snapshot('pi-1', [visibleFailure()]))
    render(view())
    observe('pi-1')

    expect(await screen.findByRole('link', {name: '查看流程实例'})).toHaveAttribute('href', '/process-instances/pi-1')
    expect(screen.getByText('已报告可重试')).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: /恢复|取消|重试/})).not.toBeInTheDocument()
    expect(processWorkerFailuresApi.get).toHaveBeenCalledExactlyOnceWith('20', 'pi-1', expect.any(AbortSignal))
  })

  it('does not turn Worker recovery permission into instance observation permission', async () => {
    vi.mocked(processWorkerFailuresApi.get).mockResolvedValueOnce(snapshot('pi-1', [visibleFailure()]))
    render(view())
    observe('pi-1')

    expect(await screen.findByText('job-ready')).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: '查看流程实例'})).toBeNull()
    expect(screen.getByText('已报告可重试')).toBeInTheDocument()
    expect(processWorkerFailuresApi.get).toHaveBeenCalledExactlyOnceWith('20', 'pi-1', expect.any(AbortSignal))
  })

  it('distinguishes an empty observation from not-visible and unavailable reads', async () => {
    const privateText = 'private error details'
    vi.mocked(processWorkerFailuresApi.get)
      .mockResolvedValueOnce(snapshot())
      .mockRejectedValueOnce(new ApiError(privateText, 404, 'TIANJI_RESOURCE_NOT_FOUND'))
      .mockRejectedValueOnce(new ApiError(privateText, 503, 'TIANJI_DEPENDENCY_UNAVAILABLE'))
      .mockRejectedValueOnce(new Error(privateText))
      .mockRejectedValueOnce(new ApiError(privateText, 400, 'TIANJI_INVALID_COMMAND'))
    render(view())
    observe(INSTANCE)
    expect(await screen.findByText(EMPTY)).toBeInTheDocument()
    expect(document.querySelector('time[datetime="' + OBSERVED + '"]')).toHaveTextContent(/UTC/)

    submit()
    expect(await screen.findByText(NOT_VISIBLE)).toBeInTheDocument()
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument()
    expect(document.querySelector('time[datetime="' + OBSERVED + '"]')).toBeNull()
    submit()
    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument()
    expect(screen.queryByText(NOT_VISIBLE)).not.toBeInTheDocument()
    submit()
    await waitFor(() => expect(processWorkerFailuresApi.get).toHaveBeenCalledTimes(4))
    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument()
    submit()
    expect(await screen.findByText(INVALID)).toBeInTheDocument()
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument()
    expect(screen.queryByText(privateText)).not.toBeInTheDocument()
  })

  it('clears rows when a refreshed body fails the consumer decoder', async () => {
    vi.mocked(processWorkerFailuresApi.get).mockResolvedValueOnce(snapshot(INSTANCE, [visibleFailure()]))
      .mockRejectedValueOnce(new Error('untrusted foreign response body'))
    render(view())
    observe(INSTANCE)
    await screen.findByText('job-ready')
    submit()
    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument()
    expect(screen.queryByText('job-ready')).not.toBeInTheDocument()
    expect(screen.queryByText('untrusted foreign response body')).not.toBeInTheDocument()
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument()
    expect(processWorkerFailuresApi.get).toHaveBeenCalledTimes(2)
  })

  it.each([
    [401, 'TIANJI_UNAUTHENTICATED', 'signed-out'],
    [403, 'TIANJI_PERMISSION_DENIED', 'forbidden'],
    [409, 'TIANJI_TENANT_CONTEXT_CHANGED', 'forbidden'],
  ] as const)('discards prior results when shared auth invalidates a %s response', async (status, code, nextAuth) => {
    vi.mocked(processWorkerFailuresApi.get).mockResolvedValueOnce(snapshot(INSTANCE, [visibleFailure()]))
      .mockRejectedValueOnce(new ApiError('private session failure', status, code))
    const rendered = render(view())
    observe(INSTANCE)
    await screen.findByText('job-ready')
    submit()
    await waitFor(() => expect(processWorkerFailuresApi.get).toHaveBeenCalledTimes(2))

    currentAuth = {...currentAuth, status: nextAuth, authorization: undefined, allows: () => false}
    rendered.rerender(view())
    expect(screen.queryByText('job-ready')).not.toBeInTheDocument()
    expect(screen.queryByText('private session failure')).not.toBeInTheDocument()
    currentAuth = auth()
    rendered.rerender(view())
    expect(input()).toHaveValue('')
    expect(screen.queryByText('job-ready')).not.toBeInTheDocument()
    expect(processWorkerFailuresApi.get).toHaveBeenCalledTimes(2)
  })

  it('suppresses a duplicate pending submission and ignores a late response after editing the ID', async () => {
    const old = deferred<Snapshot>()
    const current = deferred<Snapshot>()
    vi.mocked(processWorkerFailuresApi.get).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    render(view())
    observe(INSTANCE)
    await waitFor(() => expect(processWorkerFailuresApi.get).toHaveBeenCalledTimes(1))
    const firstSignal = vi.mocked(processWorkerFailuresApi.get).mock.calls[0][2]!
    expect(screen.getByText(LOADING)).toBeInTheDocument()
    expect(screen.getByRole('button', {name: QUERY})).toBeDisabled()
    submit()
    await act(async () => { await Promise.resolve() })
    expect(processWorkerFailuresApi.get).toHaveBeenCalledTimes(1)
    expect(firstSignal.aborted).toBe(false)

    edit('expense-2')
    await waitFor(() => expect(firstSignal.aborted).toBe(true))
    expect(processWorkerFailuresApi.get).toHaveBeenCalledTimes(1)
    submit()
    await waitFor(() => expect(processWorkerFailuresApi.get).toHaveBeenCalledTimes(2))
    expect(processWorkerFailuresApi.get).toHaveBeenNthCalledWith(2, '20', 'expense-2', expect.any(AbortSignal))
    await act(async () => { old.resolve(snapshot(INSTANCE, [visibleFailure('job-stale')])) })
    expect(screen.queryByText('job-stale')).not.toBeInTheDocument()
    await act(async () => { current.resolve(snapshot('expense-2', [visibleFailure('job-current')])) })
    expect(await screen.findByText('job-current')).toBeInTheDocument()
  })

  const frameChanges: Array<[string, IdentityChange, boolean]> = [
    ['issuer', {issuer: 'https://other.example/tenant/20'}, true],
    ['tenant', {tenant: '21'}, true],
    ['subject', {subject: 'different-owner'}, true],
    ['request epoch', {epoch: 9}, true],
    ['page grant', {}, false],
  ]

  it.each(frameChanges)('clears the form and discards a late request after %s changes', async (_, change, allowed) => {
    const old = deferred<Snapshot>()
    vi.mocked(processWorkerFailuresApi.get).mockReturnValueOnce(old.promise)
    const rendered = render(view())
    observe(INSTANCE)
    await waitFor(() => expect(processWorkerFailuresApi.get).toHaveBeenCalledTimes(1))
    const signal = vi.mocked(processWorkerFailuresApi.get).mock.calls[0][2]!

    currentAuth = auth(change, allowed)
    rendered.rerender(view())
    await waitFor(() => expect(signal.aborted).toBe(true))
    if (allowed) expect(input()).toHaveValue('')
    else expect(screen.getByText(DENIED)).toBeInTheDocument()
    await act(async () => { old.resolve(snapshot(INSTANCE, [visibleFailure('job-other-frame')])) })
    expect(screen.queryByText('job-other-frame')).not.toBeInTheDocument()
    expect(processWorkerFailuresApi.get).toHaveBeenCalledTimes(1)

    if (!allowed) {
      currentAuth = auth()
      rendered.rerender(view())
      expect(input()).toHaveValue('')
      expect(screen.queryByText('job-other-frame')).not.toBeInTheDocument()
    }
  })

  it('aborts on unmount and starts a fresh empty form when the route is mounted again', async () => {
    const old = deferred<Snapshot>()
    vi.mocked(processWorkerFailuresApi.get).mockReturnValueOnce(old.promise)
    const rendered = render(view())
    observe(INSTANCE)
    await waitFor(() => expect(processWorkerFailuresApi.get).toHaveBeenCalledTimes(1))
    const signal = vi.mocked(processWorkerFailuresApi.get).mock.calls[0][2]!
    rendered.unmount()
    expect(signal.aborted).toBe(true)

    render(view())
    expect(input()).toHaveValue('')
    await act(async () => { old.resolve(snapshot(INSTANCE, [visibleFailure('job-left-route')])) })
    expect(screen.queryByText('job-left-route')).not.toBeInTheDocument()
    expect(processWorkerFailuresApi.get).toHaveBeenCalledTimes(1)
  })
})
