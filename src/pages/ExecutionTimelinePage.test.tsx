import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {agentApi, type AgentRunPage} from '../api/agent'
import {processAgentOutcomesApi, type ProcessAgentOutcome, type ProcessAgentOutcomePage} from '../api/processAgentOutcomes'
import {processCorrelationsApi, type ProcessCorrelationPage, type ProcessInstanceSnapshot} from '../api/processCorrelations'
import {processMigrationPreflightApi, type ProcessMigrationPreflight} from '../api/processMigrationPreflight'
import {processReleasesApi} from '../api/processReleases'
import {processStartReceiptsApi, type ProcessStartReceipt} from '../api/processStartReceipts'
import {useAuth} from '../auth/AuthContext'
import {authorization, run} from '../test/fixtures'
import ExecutionTimelinePage from './ExecutionTimelinePage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/agent', () => ({agentApi: {listByCorrelation: vi.fn()}}))
vi.mock('../api/processAgentOutcomes', () => ({processAgentOutcomesApi: {list: vi.fn()}}))
vi.mock('../api/processMigrationPreflight', () => ({processMigrationPreflightApi: {get: vi.fn()}}))
vi.mock('../api/processStartReceipts', async original => {
  const actual = await original<typeof import('../api/processStartReceipts')>()
  return {...actual, processStartReceiptsApi: {get: vi.fn()}}
})
vi.mock('../api/processReleases', async original => {
  const actual = await original<typeof import('../api/processReleases')>()
  return {...actual, processReleasesApi: {get: vi.fn()}}
})
vi.mock('../api/processCorrelations', async () => {
  const actual = await vi.importActual<typeof import('../api/processCorrelations')>('../api/processCorrelations')
  return {...actual, processCorrelationsApi: {list: vi.fn(), detail: vi.fn()}}
})

const PAGE = 'tianji.page.processCorrelations'
const AGENT_PAGE = 'tianji.page.runs'
const AGENT_DETAIL = 'tianji.page.runDetail'
const AGENT_QUERY_BUTTON = '查询同关联标识的 Agent 运行'
const FROM = '2026-11-05T10:00:00.001Z'
const UNTIL = '2026-11-05T11:00:00Z'
const CORRELATION = 'trace:expense-1'
const AGENT_NEXT = '下一页 Agent 运行'
const AGENT_SOURCE = '来源：Agent 运行记录'
const AGENT_LOADING = '正在查询当前身份的 Agent 运行'
const RUN_CREATED = '2026-11-05T10:00:01.123456Z'
const agentRun = (id = 'run-owned') => ({...run(id, 'WAITING'), createdAt: RUN_CREATED})
const agentPage = (): AgentRunPage => ({items: [agentRun()], nextCursor: null})
const query = {correlationId: CORRELATION, fromInclusive: FROM, toExclusive: UNTIL}
const screenWithRouter = () => <MemoryRouter><ExecutionTimelinePage /></MemoryRouter>
const findAgentButton = () => screen.findByRole('button', {name: AGENT_QUERY_BUTTON})
const receipt = {instanceId: 'instance-1', releaseVersion: 'release-1', submittedAt: '2026-11-05T10:30:00.123456Z'}
const page = (correlationId = CORRELATION): ProcessCorrelationPage =>
  ({correlationId, observedAt: '2026-11-05T11:00:01.123456Z', items: [receipt], nextCursor: null})
const auth = (tenant = '20', allowed = true, epoch?: number, agent = false, detail = agent): ReturnType<typeof useAuth> => {
  const frame = authorization(tenant, agent ? ['TIANJI_PROCESS_READ', 'TIANJI_AGENT_READ'] : ['TIANJI_PROCESS_READ'])
  return {status: 'ready', authorization: {...frame, binding: {...frame.binding, requestEpoch: epoch ?? frame.binding.requestEpoch}},
    allows: resource => resource === PAGE ? allowed : resource === AGENT_PAGE ? agent : resource === AGENT_DETAIL && detail,
    login: () => {}, logout: async () => {}, retry: async () => {}}
}
const snapshot = (): ProcessInstanceSnapshot => ({
  ...receipt, definitionKey: 'expense', businessKey: 'business-1', correlationId: CORRELATION,
  status: 'ACTIVE', finishedAt: null,
})
const OUTCOME_QUERY = '查询流程侧 Agent 结果'
const OUTCOME_NEXT = '下一页流程侧 Agent 结果'
const OUTCOME_SOURCE = '来源：Process 本地调度与结果收件记录'
const OUTCOME_LOADING = '正在查询流程侧 Agent 结果'
const OUTCOME_EMPTY = '此流程暂无本地 Agent 结果记录'
const OUTCOME_CURSOR = 'v1.' + 'a'.repeat(64)
const OBSERVED = '2026-11-05T11:00:02.123456Z'
const outcome = (activityId = 'dispatchAgent'): ProcessAgentOutcome => ({
  activityId, dispatchState: 'ACKNOWLEDGED', inboxState: 'APPLIED', terminalStatus: 'COMPLETED',
  dispatchRecordedAt: '2026-11-05T10:31:00.123456Z', receivedAt: '2026-11-05T10:31:01.123456Z',
  decidedAt: '2026-11-05T10:31:02.123456Z',
})
const outcomePage = (instanceId = receipt.instanceId, items: readonly ProcessAgentOutcome[] = [outcome()]): ProcessAgentOutcomePage =>
  ({instanceId, observedAt: OBSERVED, items, nextCursor: null})
const findOutcomeButton = () => screen.findByRole('button', {name: OUTCOME_QUERY})
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
    vi.mocked(agentApi.listByCorrelation).mockResolvedValue(agentPage())
    vi.mocked(processAgentOutcomesApi.list).mockImplementation(async (_, instanceId) => outcomePage(instanceId))
  })

  it('offers an explicit START receipt lookup without reading on entry', () => {
    render(<ExecutionTimelinePage />)
    expect(screen.queryByLabelText('START 命令标识')).not.toBeNull()
    expect(screen.getByLabelText('原请求 SHA-256')).toHaveValue('')
    expect(processStartReceiptsApi.get).not.toHaveBeenCalled()
    expect(processCorrelationsApi.list).not.toHaveBeenCalled()
  })

  it('queries one current owner START receipt from an independently supplied digest', async () => {
    vi.mocked(processStartReceiptsApi.get).mockResolvedValueOnce({
      instanceId: 'owned-start-instance', status: 'APPLIED', recordedAt: '2026-11-05T10:20:30.123456Z',
    })
    render(<ExecutionTimelinePage />)
    edit('START 命令标识', 'intent:abc-01')
    edit('原请求 SHA-256', 'A'.repeat(64))
    fireEvent.click(screen.getByRole('button', {name: '查询 START 回执'}))
    expect(screen.getByText('请输入有效的 START 命令标识和 64 位小写 SHA-256。')).toBeInTheDocument()
    expect(processStartReceiptsApi.get).not.toHaveBeenCalled()
    edit('原请求 SHA-256', 'a'.repeat(64))
    expect(processStartReceiptsApi.get).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', {name: '查询 START 回执'}))
    expect(await screen.findByText('来源：Process 已应用 START 回执')).toBeInTheDocument()
    expect(screen.getByText('回执实例标识：owned-start-instance')).toBeInTheDocument()
    expect(screen.getByText('2026-11-05T10:20:30.123456Z UTC')).toBeInTheDocument()
    expect(processStartReceiptsApi.get).toHaveBeenCalledExactlyOnceWith('20',
      {commandId: 'intent:abc-01', requestSha256: 'a'.repeat(64)}, expect.any(AbortSignal))
    expect(processCorrelationsApi.list).not.toHaveBeenCalled()
    expect(processCorrelationsApi.detail).not.toHaveBeenCalled()
  })

  it('keeps a missing START receipt as an unknown execution result', async () => {
    vi.mocked(processStartReceiptsApi.get).mockRejectedValueOnce(new ApiError('private diagnostic', 404, 'TIANJI_RESOURCE_NOT_FOUND'))
    render(<ExecutionTimelinePage />)
    edit('START 命令标识', 'intent:abc-01')
    edit('原请求 SHA-256', 'a'.repeat(64))
    fireEvent.click(screen.getByRole('button', {name: '查询 START 回执'}))
    expect(await screen.findByText('未观察到匹配的已应用 START 回执。')).toBeInTheDocument()
    expect(screen.getByText('原请求的执行结果仍未知。')).toBeInTheDocument()
    expect(screen.queryByText('private diagnostic')).not.toBeInTheDocument()
    expect(screen.queryByText('来源：Process 已应用 START 回执')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: /重试启动|重新执行|启动流程/})).not.toBeInTheDocument()
  })

  it.each(['edit', 'epoch', 'permission'] as const)('discards a pending START receipt after %s', async change => {
    let resolve!: (value: ProcessStartReceipt) => void
    vi.mocked(processStartReceiptsApi.get).mockReturnValueOnce(new Promise(value => { resolve = value }))
    const {rerender} = render(<ExecutionTimelinePage />)
    edit('START 命令标识', 'intent:abc-01')
    edit('原请求 SHA-256', 'a'.repeat(64))
    fireEvent.click(screen.getByRole('button', {name: '查询 START 回执'}))
    const signal = vi.mocked(processStartReceiptsApi.get).mock.calls[0][2]
    expect(screen.getByText('正在查询 START 回执')).toBeInTheDocument()
    if (change === 'edit') edit('原请求 SHA-256', 'b'.repeat(64))
    else {
      current = change === 'epoch' ? auth('20', true, 42) : auth('20', false)
      rerender(<ExecutionTimelinePage />)
    }
    expect(signal?.aborted).toBe(true)
    await act(async () => { resolve({instanceId: 'stale-start-instance', status: 'APPLIED', recordedAt: '2026-11-05T10:20:30Z'}) })
    expect(screen.queryByText('回执实例标识：stale-start-instance')).not.toBeInTheDocument()
    expect(processStartReceiptsApi.get).toHaveBeenCalledTimes(1)
  })

  it('offers an explicit migration preflight only after current Process detail and release permission', async () => {
    const currentAccess = auth()
    current = {...currentAccess, allows: resource => resource === 'tianji.page.processReleases' || currentAccess.allows(resource)}
    vi.mocked(processCorrelationsApi.detail).mockResolvedValue(snapshot())
    render(screenWithRouter())
    expect(screen.queryByRole('button', {name: '读取目标发布摘要'})).toBeNull()
    fillWindow()
    submit()
    fireEvent.click(await screen.findByRole('button', {name: '查看详情'}))
    expect(await screen.findByText('来源：Process 实例快照')).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '读取目标发布摘要'})).not.toBeNull()
    expect(processReleasesApi.get).not.toHaveBeenCalled()
    expect(processMigrationPreflightApi.get).not.toHaveBeenCalled()
  })

  it('pins the displayed target digest before the explicit structure-only preflight', async () => {
    const currentAccess = auth()
    current = {...currentAccess, allows: resource => resource === 'tianji.page.processReleases' || currentAccess.allows(resource)}
    vi.mocked(processCorrelationsApi.detail).mockResolvedValue(snapshot())
    const pin = 'a'.repeat(64)
    vi.mocked(processReleasesApi.get).mockResolvedValue({releaseVersion: 'release-2',
      manifestSha256: pin, createdAt: OBSERVED, models: []})
    const report: ProcessMigrationPreflight = {instanceId: receipt.instanceId, sourceReleaseVersion: 'release-1',
      targetReleaseVersion: 'release-2', activityId: 'waitForExpiry', status: 'NATIVE_STRUCTURE_VALIDATED_ONLY', observedAt: OBSERVED}
    vi.mocked(processMigrationPreflightApi.get).mockResolvedValue(report)
    render(screenWithRouter())
    fillWindow()
    submit()
    fireEvent.click(await screen.findByRole('button', {name: '查看详情'}))
    await screen.findByText('来源：Process 实例快照')
    edit('预检目标发布版本', 'release-2')
    expect(screen.queryByRole('button', {name: '运行迁移预检'})).toBeNull()
    fireEvent.click(screen.getByRole('button', {name: '读取目标发布摘要'}))
    expect(await screen.findByText('目标清单 SHA-256：' + pin)).toBeInTheDocument()
    expect(processReleasesApi.get).toHaveBeenCalledExactlyOnceWith('20', 'release-2', expect.any(AbortSignal))
    expect(processMigrationPreflightApi.get).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', {name: '运行迁移预检'}))
    expect(await screen.findByText('仅原生结构校验通过')).toBeInTheDocument()
    expect(processMigrationPreflightApi.get).toHaveBeenCalledExactlyOnceWith('20',
      {instanceId: receipt.instanceId, sourceReleaseVersion: 'release-1', targetReleaseVersion: 'release-2',
        expectedTargetManifestSha256: pin}, expect.any(AbortSignal))
    expect(screen.queryByRole('button', {name: '执行迁移'})).toBeNull()
    edit('预检目标发布版本', 'release-3')
    expect(screen.queryByText('仅原生结构校验通过')).toBeNull()
    expect(screen.queryByText('目标清单 SHA-256：' + pin)).toBeNull()
  })

  it('aborts and discards a late target release after the user changes the version', async () => {
    const currentAccess = auth()
    current = {...currentAccess, allows: resource => resource === 'tianji.page.processReleases' || currentAccess.allows(resource)}
    vi.mocked(processCorrelationsApi.detail).mockResolvedValue(snapshot())
    let resolve: ((value: Awaited<ReturnType<typeof processReleasesApi.get>>) => void) | undefined
    let signal: AbortSignal | undefined
    vi.mocked(processReleasesApi.get).mockImplementation((_tenant, _version, request) => {
      signal = request
      return new Promise(finish => {resolve = finish})
    })
    render(screenWithRouter())
    fillWindow()
    submit()
    fireEvent.click(await screen.findByRole('button', {name: '查看详情'}))
    await screen.findByText('来源：Process 实例快照')
    edit('预检目标发布版本', 'release-2')
    fireEvent.click(screen.getByRole('button', {name: '读取目标发布摘要'}))
    await waitFor(() => expect(signal).toBeDefined())
    edit('预检目标发布版本', 'release-3')
    expect(signal?.aborted).toBe(true)
    await act(async () => {resolve?.({releaseVersion: 'release-2', manifestSha256: 'a'.repeat(64), createdAt: OBSERVED, models: []})})
    expect(screen.queryByRole('button', {name: '运行迁移预检'})).toBeNull()
    expect(processMigrationPreflightApi.get).not.toHaveBeenCalled()
  })

  it('keeps preflight unavailable without the current release read permission', async () => {
    vi.mocked(processCorrelationsApi.detail).mockResolvedValue(snapshot())
    render(screenWithRouter())
    fillWindow()
    submit()
    fireEvent.click(await screen.findByRole('button', {name: '查看详情'}))
    expect(await screen.findByText('来源：Process 实例快照')).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '读取目标发布摘要'})).toBeNull()
    expect(processReleasesApi.get).not.toHaveBeenCalled()
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
  it('offers an explicit Agent lookup only after an authorized Process result', async () => {
    current = auth('20', true, undefined, true)
    render(screenWithRouter())
    expect(screen.queryByRole('button', {name: AGENT_QUERY_BUTTON})).not.toBeInTheDocument()
    fillWindow()
    expect(agentApi.listByCorrelation).not.toHaveBeenCalled()
    submit()
    await screen.findByText('来源：Process START 回执')
    const button = screen.getByRole('button', {name: AGENT_QUERY_BUTTON})
    expect(agentApi.listByCorrelation).not.toHaveBeenCalled()
    fireEvent.click(button)
    expect(await screen.findByRole('link', {name: 'run-owned'})).toHaveAttribute('href', '/runs/run-owned')
    expect(screen.getByText(AGENT_SOURCE)).toBeInTheDocument()
    expect(screen.getByText('等待中')).toBeInTheDocument()
    expect(screen.getByText(RUN_CREATED + ' UTC')).toHaveAttribute('dateTime', RUN_CREATED)
    expect(screen.getByText('来源：Process START 回执')).toBeInTheDocument()
    expect(agentApi.listByCorrelation).toHaveBeenCalledExactlyOnceWith('20', query, expect.any(AbortSignal))
    expect(processCorrelationsApi.detail).not.toHaveBeenCalled()
  })

  it('keeps the Agent action and calls absent for Process-only access', async () => {
    render(<ExecutionTimelinePage />)
    fillWindow()
    submit()
    await screen.findByText('来源：Process START 回执')
    expect(screen.queryByRole('button', {name: AGENT_QUERY_BUTTON})).not.toBeInTheDocument()
    expect(screen.queryByText(AGENT_SOURCE)).not.toBeInTheDocument()
    expect(agentApi.listByCorrelation).not.toHaveBeenCalled()
  })

  it('only links returned runs when the existing detail resource allows it', async () => {
    current = auth('20', true, undefined, true, false)
    render(screenWithRouter())
    fillWindow()
    submit()
    fireEvent.click(await findAgentButton())
    expect(await screen.findByText('run-owned')).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: 'run-owned'})).not.toBeInTheDocument()
  })

  it('navigates the two source pages independently and never sends a Process cursor to Agent', async () => {
    current = auth('20', true, undefined, true)
    const processFirst: ProcessCorrelationPage = {...page(), nextCursor: 'v1.YQ'}
    const processSecond = {...page(), items: [{...receipt, instanceId: 'process-next'}]}
    const processThird = {...page(), items: [{...receipt, instanceId: 'process-last'}]}
    vi.mocked(processCorrelationsApi.list).mockResolvedValueOnce(processFirst)
      .mockResolvedValueOnce({...processSecond, nextCursor: 'v1.Yg'}).mockResolvedValueOnce(processThird)
    vi.mocked(agentApi.listByCorrelation).mockResolvedValueOnce({
      items: Array.from({length: 20}, (_, index) => agentRun('run-' + (20 - index))),
      nextCursor: 'v1.YWdlbnQ',
    }).mockResolvedValueOnce({items: [], nextCursor: null})
    render(screenWithRouter())
    fillWindow()
    submit()
    fireEvent.click(await screen.findByRole('button', {name: '下一页'}))
    await screen.findByText('process-next')
    fireEvent.click(await findAgentButton())
    expect(await screen.findByRole('link', {name: 'run-20'})).toBeInTheDocument()
    expect(agentApi.listByCorrelation).toHaveBeenNthCalledWith(1, '20', query, expect.any(AbortSignal))
    fireEvent.click(screen.getByRole('button', {name: '下一页'}))
    await screen.findByText('process-last')
    expect(screen.getByRole('link', {name: 'run-20'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: AGENT_NEXT}))
    expect(await screen.findByText('当前时间窗无同关联标识的 Agent 运行')).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: 'run-20'})).not.toBeInTheDocument()
    expect(screen.getByText('process-last')).toBeInTheDocument()
    expect(processCorrelationsApi.list).toHaveBeenCalledTimes(3)
    expect(agentApi.listByCorrelation).toHaveBeenNthCalledWith(2, '20',
      {...query, cursor: 'v1.YWdlbnQ'}, expect.any(AbortSignal))
  })

  it.each([
    ['dependency failure', new Error('private Agent endpoint failure'), '暂时无法读取 Agent 运行。'],
    ['still-current mocked denial', new ApiError('private Agent denial', 403, 'TIANJI_PERMISSION_DENIED'), '当前无法读取 Agent 运行。'],
  ] as const)('keeps Process results and details after an Agent %s', async (_, failure, message) => {
    current = auth('20', true, undefined, true)
    vi.mocked(processCorrelationsApi.detail).mockResolvedValue(snapshot())
    vi.mocked(agentApi.listByCorrelation).mockRejectedValueOnce(failure)
    render(screenWithRouter())
    fillWindow()
    submit()
    fireEvent.click(await screen.findByRole('button', {name: '查看详情'}))
    await screen.findByText('来源：Process 实例快照')
    fireEvent.click(await findAgentButton())
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByText('来源：Process START 回执')).toBeInTheDocument()
    expect(screen.getByText('来源：Process 实例快照')).toBeInTheDocument()
    expect(screen.queryByText(/private Agent/)).not.toBeInTheDocument()
  })

  it('aborts the pending Agent lookup on a shared query edit and discards a late page', async () => {
    current = auth('20', true, undefined, true)
    let complete!: (value: AgentRunPage) => void
    vi.mocked(agentApi.listByCorrelation).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    render(screenWithRouter())
    fillWindow()
    submit()
    fireEvent.click(await findAgentButton())
    expect(await screen.findByText(AGENT_LOADING)).toBeInTheDocument()
    const signal = vi.mocked(agentApi.listByCorrelation).mock.calls[0][2]
    const button = await findAgentButton()
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(agentApi.listByCorrelation).toHaveBeenCalledTimes(1)
    edit('结束时间（UTC，不含）', '2026-11-05T11:01:00Z')
    expect(signal?.aborted).toBe(true)
    expect(screen.queryByRole('button', {name: AGENT_QUERY_BUTTON})).not.toBeInTheDocument()
    await act(async () => { complete(agentPage()) })
    expect(screen.queryByText('run-owned')).not.toBeInTheDocument()
    submit()
    await findAgentButton()
    expect(agentApi.listByCorrelation).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['same-epoch Agent permission loss', auth(), true],
    ['changed request epoch', auth('20', true, 81, true), false],
    ['changed tenant', auth('21', true, undefined, true), false],
    ['shared sign-out', {...auth(), status: 'signed-out', authorization: undefined}, false],
  ] as const)('aborts Agent on %s and protects both scope views', async (_, next, preserveProcess) => {
    current = auth('20', true, undefined, true)
    let complete!: (value: AgentRunPage) => void
    vi.mocked(agentApi.listByCorrelation).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    const tree = render(screenWithRouter())
    fillWindow()
    submit()
    fireEvent.click(await findAgentButton())
    await screen.findByText(AGENT_LOADING)
    const signal = vi.mocked(agentApi.listByCorrelation).mock.calls[0][2]
    current = next
    tree.rerender(screenWithRouter())
    expect(signal?.aborted).toBe(true)
    await act(async () => { complete(agentPage()) })
    expect(screen.queryByText('run-owned')).not.toBeInTheDocument()
    expect(screen.queryByText(AGENT_SOURCE)).not.toBeInTheDocument()
    if (preserveProcess) expect(screen.getByText('来源：Process START 回执')).toBeInTheDocument()
    else expect(screen.queryByText('来源：Process START 回执')).not.toBeInTheDocument()
    expect(agentApi.listByCorrelation).toHaveBeenCalledTimes(1)
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

  it('offers an explicit Process Agent outcome lookup only after current detail succeeds', async () => {
    vi.mocked(processCorrelationsApi.detail).mockResolvedValueOnce(snapshot())
    vi.mocked(processAgentOutcomesApi.list).mockResolvedValueOnce(outcomePage(receipt.instanceId, [
      outcome(), {...outcome(), dispatchState: 'CLOSED', inboxState: 'DEAD', terminalStatus: null},
    ]))
    render(<ExecutionTimelinePage />)
    expect(screen.queryByRole('button', {name: OUTCOME_QUERY})).not.toBeInTheDocument()
    fillWindow()
    submit()
    const detail = await screen.findByRole('button', {name: '查看详情'})
    expect(screen.queryByRole('button', {name: OUTCOME_QUERY})).not.toBeInTheDocument()
    fireEvent.click(detail)
    await screen.findByText('来源：Process 实例快照')
    const button = await findOutcomeButton()
    expect(processAgentOutcomesApi.list).not.toHaveBeenCalled()
    fireEvent.click(button)

    const header = await screen.findByRole('columnheader', {name: '已记录的 Agent 终态'})
    const table = header.closest('table')
    if (!table) throw new Error('Expected an outcome table')
    const [, applied, dead] = within(table).getAllByRole('row')
    expect(within(applied).getByText('ACKNOWLEDGED')).toBeInTheDocument()
    expect(within(applied).getByText('APPLIED')).toBeInTheDocument()
    expect(within(applied).getByText('COMPLETED')).toBeInTheDocument()
    expect(within(dead).getByText('CLOSED')).toBeInTheDocument()
    expect(within(dead).getByText('DEAD')).toBeInTheDocument()
    expect(within(dead).getByText('未记录')).toBeInTheDocument()
    expect(within(table).getAllByText('dispatchAgent')).toHaveLength(2)
    expect(within(table).queryByRole('link')).not.toBeInTheDocument()
    expect(within(table).queryByText('FAILED')).not.toBeInTheDocument()
    expect(screen.getByText(OUTCOME_SOURCE)).toBeInTheDocument()
    expect(screen.getByText(OBSERVED + ' UTC')).toHaveAttribute('dateTime', OBSERVED)
    expect(within(applied).getByText(outcome().dispatchRecordedAt + ' UTC')).toHaveAttribute('dateTime', outcome().dispatchRecordedAt)
    expect(screen.getByText('来源：Process START 回执')).toBeInTheDocument()
    expect(screen.getByText('来源：Process 实例快照')).toBeInTheDocument()
    expect(processAgentOutcomesApi.list).toHaveBeenCalledExactlyOnceWith('20', receipt.instanceId, undefined, expect.any(AbortSignal))
    expect(agentApi.listByCorrelation).not.toHaveBeenCalled()
  })

  it('keeps the Process Agent outcome control absent after failed or pending Process detail', async () => {
    let fail!: (reason: unknown) => void
    vi.mocked(processCorrelationsApi.detail).mockReturnValueOnce(new Promise((_, reject) => { fail = reject }))
    render(<ExecutionTimelinePage />)
    fillWindow()
    submit()
    fireEvent.click(await screen.findByRole('button', {name: '查看详情'}))
    expect(await screen.findByText('正在读取流程实例详情')).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: OUTCOME_QUERY})).not.toBeInTheDocument()
    await act(async () => { fail(new ApiError('private detail', 404, 'TIANJI_RESOURCE_NOT_FOUND')) })
    expect(screen.getByText('当前无法读取该流程实例详情。')).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: OUTCOME_QUERY})).not.toBeInTheDocument()
    expect(processAgentOutcomesApi.list).not.toHaveBeenCalled()
  })

  it('uses only the returned Process outcome cursor and keeps the independent views', async () => {
    current = auth('20', true, undefined, true)
    vi.mocked(processCorrelationsApi.detail).mockResolvedValueOnce(snapshot())
    const first: ProcessAgentOutcomePage = {...outcomePage(receipt.instanceId,
      Array.from({length: 20}, (_, index) => outcome('outcome-' + index))), nextCursor: OUTCOME_CURSOR}
    vi.mocked(processAgentOutcomesApi.list).mockResolvedValueOnce(first).mockResolvedValueOnce(outcomePage(receipt.instanceId, []))
    render(screenWithRouter())
    fillWindow()
    submit()
    fireEvent.click(await findAgentButton())
    expect(await screen.findByRole('link', {name: 'run-owned'})).toHaveAttribute('href', '/runs/run-owned')
    fireEvent.click(screen.getByRole('button', {name: '查看详情'}))
    fireEvent.click(await findOutcomeButton())
    expect(await screen.findByText('outcome-0')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: OUTCOME_NEXT}))
    expect(await screen.findByText(OUTCOME_EMPTY)).toBeInTheDocument()
    expect(screen.queryByText('outcome-0')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: OUTCOME_NEXT})).not.toBeInTheDocument()
    expect(screen.getByText('来源：Process START 回执')).toBeInTheDocument()
    expect(screen.getByText('来源：Process 实例快照')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'run-owned'})).toBeInTheDocument()
    expect(processAgentOutcomesApi.list).toHaveBeenNthCalledWith(1, '20', receipt.instanceId, undefined, expect.any(AbortSignal))
    expect(processAgentOutcomesApi.list).toHaveBeenNthCalledWith(2, '20', receipt.instanceId, OUTCOME_CURSOR, expect.any(AbortSignal))
    expect(processCorrelationsApi.list).toHaveBeenCalledTimes(1)
    expect(agentApi.listByCorrelation).toHaveBeenCalledTimes(1)
  })

  it('keeps other source results on a stale outcome cursor and explicitly restarts without it', async () => {
    vi.mocked(processCorrelationsApi.detail).mockResolvedValueOnce(snapshot())
    vi.mocked(processAgentOutcomesApi.list).mockResolvedValueOnce({
      ...outcomePage(receipt.instanceId, Array.from({length: 20}, (_, index) => outcome('outcome-' + index))),
      nextCursor: OUTCOME_CURSOR,
    }).mockRejectedValueOnce(new ApiError('private invalid cursor', 400, 'TIANJI_INVALID_COMMAND'))
    render(<ExecutionTimelinePage />)
    fillWindow()
    submit()
    fireEvent.click(await screen.findByRole('button', {name: '查看详情'}))
    fireEvent.click(await findOutcomeButton())
    fireEvent.click(await screen.findByRole('button', {name: OUTCOME_NEXT}))
    expect(await screen.findByText('流程侧 Agent 结果分页已失效，请重新查询。')).toBeInTheDocument()
    expect(screen.queryByText('private invalid cursor')).not.toBeInTheDocument()
    expect(screen.getByText('来源：Process START 回执')).toBeInTheDocument()
    expect(screen.getByText('来源：Process 实例快照')).toBeInTheDocument()
    fireEvent.click(await findOutcomeButton())
    expect(await screen.findByText('dispatchAgent')).toBeInTheDocument()
    expect(processAgentOutcomesApi.list).toHaveBeenNthCalledWith(3, '20', receipt.instanceId, undefined, expect.any(AbortSignal))
  })

  it.each([
    [404, 'TIANJI_RESOURCE_NOT_FOUND', '当前无法读取此流程的 Agent 结果。'],
    [503, 'TIANJI_DEPENDENCY_UNAVAILABLE', '暂时无法读取此流程的 Agent 结果。'],
    [403, 'TIANJI_PERMISSION_DENIED', '当前身份无法读取流程侧 Agent 结果。'],
  ] as const)('keeps still-authorized Process and own Agent views on outcome API %s', async (status, code, message) => {
    current = auth('20', true, undefined, true)
    vi.mocked(processCorrelationsApi.detail).mockResolvedValueOnce(snapshot())
    vi.mocked(processAgentOutcomesApi.list).mockRejectedValueOnce(new ApiError('private outcome diagnostic', status, code))
    render(screenWithRouter())
    fillWindow()
    submit()
    fireEvent.click(await findAgentButton())
    await screen.findByRole('link', {name: 'run-owned'})
    fireEvent.click(screen.getByRole('button', {name: '查看详情'}))
    fireEvent.click(await findOutcomeButton())
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByText('private outcome diagnostic')).not.toBeInTheDocument()
    expect(screen.queryByText(OUTCOME_EMPTY)).not.toBeInTheDocument()
    expect(screen.getByText('来源：Process START 回执')).toBeInTheDocument()
    expect(screen.getByText('来源：Process 实例快照')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'run-owned'})).toBeInTheDocument()
  })

  it.each([false, true])('cancels pending outcomes on detail reselection, same instance=%s', async same => {
    const nextReceipt = {...receipt, instanceId: 'instance-2'}
    const nextSnapshot = {...snapshot(), ...nextReceipt}
    const selected = same ? snapshot() : nextSnapshot
    vi.mocked(processCorrelationsApi.list).mockResolvedValueOnce({...page(), items: [receipt, nextReceipt]})
    vi.mocked(processCorrelationsApi.detail).mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(selected)
    let complete!: (value: ProcessAgentOutcomePage) => void
    vi.mocked(processAgentOutcomesApi.list).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    render(<ExecutionTimelinePage />)
    fillWindow()
    submit()
    fireEvent.click((await screen.findAllByRole('button', {name: '查看详情'}))[0])
    fireEvent.click(await findOutcomeButton())
    expect(await screen.findByText(OUTCOME_LOADING)).toBeInTheDocument()
    const button = await findOutcomeButton()
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(processAgentOutcomesApi.list).toHaveBeenCalledTimes(1)
    const signal = vi.mocked(processAgentOutcomesApi.list).mock.calls[0][3]
    fireEvent.click(screen.getAllByRole('button', {name: '查看详情'})[same ? 0 : 1])
    await screen.findByText('流程实例标识：' + selected.instanceId)
    expect(signal?.aborted).toBe(true)
    await act(async () => { complete(outcomePage(receipt.instanceId, [outcome('oldOutcome')])) })
    expect(screen.queryByText('oldOutcome')).not.toBeInTheDocument()
    fireEvent.click(await findOutcomeButton())
    await screen.findByText('dispatchAgent')
    expect(processAgentOutcomesApi.list).toHaveBeenNthCalledWith(2, '20', selected.instanceId, undefined, expect.any(AbortSignal))
  })

  it.each(['edit', 'epoch', 'sign-out'] as const)('cancels outcome requests and drops late values after %s', async change => {
    vi.mocked(processCorrelationsApi.detail).mockResolvedValueOnce(snapshot())
    let complete!: (value: ProcessAgentOutcomePage) => void
    vi.mocked(processAgentOutcomesApi.list).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    const tree = render(<ExecutionTimelinePage />)
    fillWindow()
    submit()
    fireEvent.click(await screen.findByRole('button', {name: '查看详情'}))
    fireEvent.click(await findOutcomeButton())
    await screen.findByText(OUTCOME_LOADING)
    const signal = vi.mocked(processAgentOutcomesApi.list).mock.calls[0][3]
    if (change === 'edit') edit('关联标识', 'trace:next')
    else {
      current = change === 'epoch' ? auth('20', true, 91) : {...auth(), status: 'signed-out', authorization: undefined}
      tree.rerender(<ExecutionTimelinePage />)
    }
    expect(signal?.aborted).toBe(true)
    await act(async () => { complete(outcomePage()) })
    expect(screen.queryByText('dispatchAgent')).not.toBeInTheDocument()
    expect(screen.queryByText(OUTCOME_SOURCE)).not.toBeInTheDocument()
    expect(processAgentOutcomesApi.list).toHaveBeenCalledTimes(1)
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
