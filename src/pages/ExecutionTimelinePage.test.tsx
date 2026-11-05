import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {processCorrelationsApi, type ProcessCorrelationPage, type ProcessInstanceSnapshot} from '../api/processCorrelations'
import {useAuth} from '../auth/AuthContext'
import {authorization} from '../test/fixtures'
import ExecutionTimelinePage from './ExecutionTimelinePage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/processCorrelations', async () => {
  const actual = await vi.importActual<typeof import('../api/processCorrelations')>('../api/processCorrelations')
  return {...actual, processCorrelationsApi: {list: vi.fn(), detail: vi.fn()}}
})

const PAGE = 'tianji.page.processCorrelations'
const FROM = '2026-11-05T10:00:00.001Z'
const UNTIL = '2026-11-05T11:00:00Z'
const CORRELATION = 'trace:expense-1'
const receipt = {instanceId: 'instance-1', releaseVersion: 'release-1', submittedAt: '2026-11-05T10:30:00.123456Z'}
const page = (correlationId = CORRELATION): ProcessCorrelationPage =>
  ({correlationId, observedAt: '2026-11-05T11:00:01.123456Z', items: [receipt], nextCursor: null})
const auth = (tenant = '20', allowed = true, epoch?: number): ReturnType<typeof useAuth> => {
  const frame = authorization(tenant, ['TIANJI_PROCESS_READ'])
  return {status: 'ready', authorization: {...frame, binding: {...frame.binding, requestEpoch: epoch ?? frame.binding.requestEpoch}},
    allows: resource => resource === PAGE && allowed, login: () => {}, logout: async () => {}, retry: async () => {}}
}
const snapshot = (): ProcessInstanceSnapshot => ({
  ...receipt, definitionKey: 'expense', businessKey: 'business-1', correlationId: CORRELATION,
  status: 'ACTIVE', finishedAt: null,
})
let current = auth()
const edit = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), {target: {value}})
const submit = () => fireEvent.click(screen.getByRole('button', {name: '查询关联'}))
const fillWindow = (correlationId = CORRELATION, fromInclusive = FROM, toExclusive = UNTIL) => {
  edit('关联标识', correlationId)
  edit('开始时间（UTC，含）', fromInclusive)
  edit('结束时间（UTC，不含）', toExclusive)
}

describe('Process correlation page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    current = auth()
    vi.mocked(useAuth).mockImplementation(() => current)
    vi.mocked(processCorrelationsApi.list).mockImplementation(async (_, query) => page(query.correlationId))
  })

  it('submits an exact current-tenant correlation window only on explicit query', async () => {
    render(<ExecutionTimelinePage />)
    expect(processCorrelationsApi.list).not.toHaveBeenCalled()
    expect(processCorrelationsApi.detail).not.toHaveBeenCalled()
    expect(screen.getByLabelText('关联标识')).toHaveValue('')
    fillWindow()
    expect(processCorrelationsApi.list).not.toHaveBeenCalled()
    submit()
    await waitFor(() => expect(processCorrelationsApi.list).toHaveBeenCalledExactlyOnceWith('20',
      {correlationId: CORRELATION, fromInclusive: FROM, toExclusive: UNTIL}, expect.any(AbortSignal)))
  })
  it('blocks access before rendering the lookup or issuing reads', () => {
    current = auth('20', false)
    render(<ExecutionTimelinePage />)
    expect(screen.getByText('当前身份不能访问此页面。')).toBeInTheDocument()
    expect(screen.queryByLabelText('关联标识')).not.toBeInTheDocument()
    expect(processCorrelationsApi.list).not.toHaveBeenCalled()
    expect(processCorrelationsApi.detail).not.toHaveBeenCalled()
  })

  it('rejects malformed exact inputs and invalid UTC windows before any read', async () => {
    render(<ExecutionTimelinePage />)
    fillWindow(' trace:expense-1')
    submit()
    expect(await screen.findByText('请输入有效的关联标识。')).toBeInTheDocument()
    fillWindow(CORRELATION, '2026-11-05T10:00:00+08:00')
    submit()
    expect(await screen.findByText('请输入有效的 UTC 时间。')).toBeInTheDocument()
    fillWindow(CORRELATION, UNTIL, FROM)
    submit()
    expect(await screen.findByText('请输入有效且不超过 31 天的 UTC 查询时间窗。')).toBeInTheDocument()
    fillWindow(CORRELATION, FROM, '2026-12-07T10:00:00.001Z')
    submit()
    expect(await screen.findByText('请输入有效且不超过 31 天的 UTC 查询时间窗。')).toBeInTheDocument()
    expect(processCorrelationsApi.list).not.toHaveBeenCalled()
  })

  it('requests only the returned next cursor and replaces rather than accumulates rows', async () => {
    const items = Array.from({length: 20}, (_, index) =>
      ({...receipt, instanceId: 'instance-' + String(20 - index).padStart(2, '0')}))
    vi.mocked(processCorrelationsApi.list).mockResolvedValueOnce({...page(), items, nextCursor: 'v1.YQ'})
      .mockResolvedValueOnce({...page(), items: []})
    render(<ExecutionTimelinePage />)
    fillWindow()
    submit()
    expect(await screen.findByText('instance-20')).toBeInTheDocument()
    expect(screen.getAllByText('查看详情')).toHaveLength(20)
    fireEvent.click(screen.getByText('下一页'))
    expect(await screen.findByText('当前时间窗无流程启动回执')).toBeInTheDocument()
    expect(processCorrelationsApi.list).toHaveBeenNthCalledWith(2, '20',
      {correlationId: CORRELATION, fromInclusive: FROM, toExclusive: UNTIL, cursor: 'v1.YQ'}, expect.any(AbortSignal))
    expect(screen.queryByText('instance-20')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '下一页'})).not.toBeInTheDocument()
    expect(processCorrelationsApi.detail).not.toHaveBeenCalled()
  })

  it('reads a detail only for the selected current receipt and labels its separate source', async () => {
    vi.mocked(processCorrelationsApi.detail).mockResolvedValueOnce(snapshot())
    render(<ExecutionTimelinePage />)
    fillWindow()
    submit()
    expect(await screen.findByText('来源：Process START 回执')).toBeInTheDocument()
    expect(processCorrelationsApi.detail).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', {name: '查看详情'}))
    expect(await screen.findByText('来源：Process 实例快照')).toBeInTheDocument()
    expect(screen.getByText('流程实例标识：instance-1')).toBeInTheDocument()
    expect(screen.getByText('发布版本：release-1')).toBeInTheDocument()
    expect(screen.getByText('状态：ACTIVE')).toBeInTheDocument()
    expect(screen.getByText('业务标识：business-1')).toBeInTheDocument()
    expect(processCorrelationsApi.detail).toHaveBeenCalledExactlyOnceWith('20', CORRELATION, receipt, expect.any(AbortSignal))
    expect(processCorrelationsApi.list).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', {name: /取消流程|恢复|重试|启动流程|激活/})).not.toBeInTheDocument()
  })

  it('supersedes a pending detail and shows a safe error without stale detail output', async () => {
    let complete!: (value: ProcessInstanceSnapshot) => void
    const first = new Promise<ProcessInstanceSnapshot>(resolve => { complete = resolve })
    const secondReceipt = {...receipt, instanceId: 'instance-0'}
    vi.mocked(processCorrelationsApi.list).mockResolvedValueOnce({...page(), items: [receipt, secondReceipt]})
    vi.mocked(processCorrelationsApi.detail).mockReturnValueOnce(first)
      .mockRejectedValueOnce(new Error('private malformed detail'))
    render(<ExecutionTimelinePage />)
    fillWindow()
    submit()
    await screen.findByText('instance-0')
    fireEvent.click(screen.getAllByRole('button', {name: '查看详情'})[0])
    expect(await screen.findByText('正在读取流程实例详情')).toBeInTheDocument()
    const signal = vi.mocked(processCorrelationsApi.detail).mock.calls[0][3]
    fireEvent.click(screen.getAllByRole('button', {name: '查看详情'})[1])
    expect(signal?.aborted).toBe(true)
    expect(await screen.findByText('暂时无法读取流程实例详情。')).toBeInTheDocument()
    await act(async () => { complete({...snapshot(), businessKey: 'private-old-business'}) })
    expect(screen.getByText('来源：Process START 回执')).toBeInTheDocument()
    expect(screen.queryByText('来源：Process 实例快照')).not.toBeInTheDocument()
    expect(screen.queryByText('private-old-business', {exact: false})).not.toBeInTheDocument()
    expect(screen.queryByText('private malformed detail')).not.toBeInTheDocument()
    expect(processCorrelationsApi.detail).toHaveBeenNthCalledWith(2, '20', CORRELATION, secondReceipt, expect.any(AbortSignal))
  })

  it('cancels a pending list on edit and drops the late previous page', async () => {
    let complete!: (value: ProcessCorrelationPage) => void
    vi.mocked(processCorrelationsApi.list).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    render(<ExecutionTimelinePage />)
    fillWindow()
    submit()
    await screen.findByText('正在查询流程关联回执')
    const signal = vi.mocked(processCorrelationsApi.list).mock.calls[0][2]
    edit('关联标识', 'trace:next')
    expect(signal?.aborted).toBe(true)
    submit()
    expect(await screen.findByText('关联标识：trace:next')).toBeInTheDocument()
    await act(async () => { complete({...page(), items: [{...receipt, instanceId: 'old-page-instance'}]}) })
    expect(screen.queryByText('old-page-instance')).not.toBeInTheDocument()
    expect(processCorrelationsApi.list).toHaveBeenNthCalledWith(2, '20',
      {correlationId: 'trace:next', fromInclusive: FROM, toExclusive: UNTIL}, expect.any(AbortSignal))
  })

  it.each([
    ['tenant', auth('21'), true], ['epoch', auth('20', true, 81), true], ['permission', auth('20', false), false],
  ] as const)('discards page and pending detail after %s changes', async (_, next, allowed) => {
    let complete!: (value: ProcessInstanceSnapshot) => void
    vi.mocked(processCorrelationsApi.detail).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    const tree = render(<ExecutionTimelinePage />)
    fillWindow()
    submit()
    fireEvent.click(await screen.findByRole('button', {name: '查看详情'}))
    await screen.findByText('正在读取流程实例详情')
    const signal = vi.mocked(processCorrelationsApi.detail).mock.calls[0][3]
    current = next
    tree.rerender(<ExecutionTimelinePage />)
    expect(signal?.aborted).toBe(true)
    await act(async () => { complete(snapshot()) })
    expect(screen.queryByText('来源：Process START 回执')).not.toBeInTheDocument()
    expect(screen.queryByText('来源：Process 实例快照')).not.toBeInTheDocument()
    expect(processCorrelationsApi.list).toHaveBeenCalledTimes(1)
    if (allowed) expect(screen.getByLabelText('关联标识')).toHaveValue('')
    else expect(screen.getByText('当前身份不能访问此页面。')).toBeInTheDocument()
  })

  it('clears current page and detail on the existing tenant-context error', async () => {
    vi.mocked(processCorrelationsApi.detail).mockRejectedValueOnce(
      new ApiError('private tenant diagnostic', 409, 'TIANJI_TENANT_CONTEXT_CHANGED'))
    render(<ExecutionTimelinePage />)
    fillWindow()
    submit()
    fireEvent.click(await screen.findByRole('button', {name: '查看详情'}))
    await waitFor(() => expect(screen.queryByText('来源：Process START 回执')).not.toBeInTheDocument())
    expect(screen.queryByText('private tenant diagnostic')).not.toBeInTheDocument()
    expect(screen.queryByText('暂时无法读取流程实例详情。')).not.toBeInTheDocument()
  })

})
