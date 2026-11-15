import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom'
import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {DraftSummaryDTO, ProcessDraftPageDTO} from '../api/processDrafts'
import {processDraftsApi} from '../api/processDrafts'
import {processAutomationApi, type AutomationInstanceDTO} from '../api/processAutomation'
import {processStartReceiptsApi} from '../api/processStartReceipts'
import {useAuth} from '../auth/AuthContext'
import {authorization} from '../test/fixtures'
import ProcessDefinitionWorkspacePage from './ProcessDefinitionWorkspacePage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/processDrafts', async original => {
  const actual = await original<typeof import('../api/processDrafts')>()
  return {...actual, processDraftsApi: {list: vi.fn(), create: vi.fn()}}
})
vi.mock('../api/processAutomation', async original => {
  const actual = await original<typeof import('../api/processAutomation')>()
  return {...actual, processAutomationApi: {...actual.processAutomationApi, start: vi.fn(), startRequestSha256: vi.fn()}}
})
vi.mock('../api/processStartReceipts', () => ({processStartReceiptsApi: {get: vi.fn()}}))

const PAGE = 'tianji.page.processDefinitions'
const CREATE = 'tianji.button.processDefinitions.create'
const COPY = 'tianji.button.processDefinitions.copy'
const START = 'tianji.button.processDefinitions.start'
const PROCESS_READ = 'tianji.page.processCorrelations'
const TIME = '2026-11-14T10:30:00.123456Z'
const summary = (draftId: string, overrides: Partial<DraftSummaryDTO> = {}): DraftSummaryDTO => ({
  draftId, definitionKey: 'orderFlow', title: 'Order flow', baseReleaseVersion: null,
  state: 'EDITING', revision: 1, contentSha256: 'a'.repeat(64), publishedReleaseVersion: null,
  createdAt: TIME, updatedAt: TIME, availableActions: ['SAVE', 'VALIDATE', 'PUBLISH', 'DISCARD'],
  ...overrides,
})
const page = (items: readonly DraftSummaryDTO[], nextCursor: string | null = null): ProcessDraftPageDTO =>
  ({observedAt: TIME, items, nextCursor})
const list = vi.mocked(processDraftsApi.list)
const create = vi.mocked(processDraftsApi.create)
const start = vi.mocked(processAutomationApi.start)
const startDigest = vi.mocked(processAutomationApi.startRequestSha256)
const getStartReceipt = vi.mocked(processStartReceiptsApi.get)

const auth = (tenant = '20', granted = [PAGE, CREATE, COPY, START, PROCESS_READ], subject = 'subject-' + tenant,
              permissions = ['TIANJI_PROCESS_RELEASE_PUBLISH', 'TIANJI_PROCESS_RELEASE_READ',
                'TIANJI_PROCESS_READ', 'TIANJI_PROCESS_START']): ReturnType<typeof useAuth> => {
  const frame = authorization(tenant, permissions)
  return {
    status: 'ready',
    authorization: {...frame, identity: {...frame.identity, subject}},
    allows: resource => granted.includes(resource),
    login: () => {}, logout: async () => {}, retry: async () => {},
  }
}
let current = auth()

function RouteState() {
  const location = useLocation()
  return <>
    <output aria-label="当前地址">{location.pathname + location.search}</output>
    <output aria-label="当前路由状态">{JSON.stringify(location.state)}</output>
  </>
}

function Harness({initialEntry = '/process-definitions', initialState}: {initialEntry?: string; initialState?: unknown}) {
  const entry = initialState === undefined ? initialEntry : {pathname: initialEntry, state: initialState}
  return <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/process-definitions/*" element={<ProcessDefinitionWorkspacePage />} />
      <Route path="/process-instances/:instanceId" element={<output aria-label="启动后实例地址" />} />
    </Routes>
    <RouteState />
  </MemoryRouter>
}

const visitNew = () => fireEvent.click(screen.getByRole('button', {name: '新建草稿'}))

describe('Process definition owner workspace', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    sessionStorage.clear()
    current = auth()
    vi.mocked(useAuth).mockImplementation(() => current)
    list.mockResolvedValue(page([]))
    start.mockResolvedValue({
      instanceId: 'pi-started', definitionKey: 'orderFlow', releaseVersion: 'auto-8', activationRevision: 4,
      profile: 'AUTOMATION_V2', businessKey: 'order-19', correlationId: 'corr-order-19', state: 'ACTIVE',
      version: '1'.repeat(64), configurationSha256: '2'.repeat(64), submittedAt: TIME, finishedAt: null,
      output: null, availableActions: ['CANCEL'], graph: {
        definitionKey: 'orderFlow', nodes: [{id: 'start', kind: 'START', name: 'Start'}], edges: [],
      },
    } as AutomationInstanceDTO)
    startDigest.mockResolvedValue('f'.repeat(64))
    getStartReceipt.mockRejectedValue(new ApiError('Missing receipt', 404, 'TIANJI_RESOURCE_NOT_FOUND'))
    create.mockImplementation(async (_tenant, definitionKey, body) => summary('pd-server-1', {
      definitionKey, title: body.title, baseReleaseVersion: body.baseReleaseVersion ?? null,
    }))
  })

  it('loads the owner draft list and shows a useful empty state', async () => {
    render(<Harness />)
    expect(await screen.findByText('还没有草稿')).toBeInTheDocument()
    expect(list).toHaveBeenCalledWith('20', {state: 'EDITING', limit: 20}, expect.any(AbortSignal))
    expect(screen.getByRole('button', {name: '新建草稿'})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: '筛选'})).toBeInTheDocument()
  })

  it('keeps router hooks stable when authentication changes from loading to ready', async () => {
    current = {...auth(), status: 'loading', authorization: undefined}
    const rendered = render(<Harness />)
    expect(screen.getByText('当前身份不能访问草稿工作区。')).toBeInTheDocument()

    current = auth()
    rendered.rerender(<Harness />)
    expect(await screen.findByText('还没有草稿')).toBeInTheDocument()
  })

  it('lists server drafts and paginates by the returned cursor under the same filters', async () => {
    list.mockResolvedValueOnce(page([summary('pd-1')], 'next-cursor'))
      .mockResolvedValueOnce(page([summary('pd-2')]))
    render(<Harness />)
    expect(await screen.findByText('Order flow')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '下一页'}))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(list).toHaveBeenLastCalledWith('20', {state: 'EDITING', limit: 20, cursor: 'next-cursor'}, expect.any(AbortSignal))
    expect(await screen.findByRole('link', {name: 'Order flow'})).toHaveAttribute('href', '/process-definitions/drafts/pd-2')
  })

  it('resets pagination when filters change and ignores the stale page response', async () => {
    let finishFirst!: (value: ProcessDraftPageDTO) => void
    const first = new Promise<ProcessDraftPageDTO>(resolve => { finishFirst = resolve })
    list.mockReturnValueOnce(first).mockResolvedValueOnce(page([summary('pd-published', {
      state: 'PUBLISHED', publishedReleaseVersion: 'auto-4', availableActions: ['VALIDATE'],
    })]))
    render(<Harness />)
    await waitFor(() => expect(list).toHaveBeenCalledOnce())
    fireEvent.mouseDown(screen.getByRole('combobox', {name: '状态'}))
    fireEvent.click(await screen.findByText('PUBLISHED', {selector: '.ant-select-item-option-content'}))
    fireEvent.click(screen.getByRole('button', {name: '筛选'}))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(list).toHaveBeenLastCalledWith('20', {state: 'PUBLISHED', limit: 20}, expect.any(AbortSignal))
    expect(await screen.findByText('auto-4')).toBeInTheDocument()
    await act(async () => { finishFirst(page([summary('pd-stale')], 'stale-cursor')) })
    expect(screen.queryByText('pd-stale')).not.toBeInTheDocument()
  })

  it('opens the new route and creates an empty draft using only captured form values', async () => {
    render(<Harness />)
    await screen.findByText('还没有草稿')
    visitNew()
    expect(await screen.findByRole('heading', {name: '新建草稿'})).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', {name: '创建空稿'})).toBeEnabled())
    expect(list).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('流程定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('草稿标题'), {target: {value: 'Order flow'}})
    create.mockImplementationOnce(async (_tenant, definitionKey, body) => {
      expect(sessionStorage.getItem('tianji.process-draft-create.v1')).not.toBeNull()
      return summary('pd-server-1', {definitionKey, title: body.title, baseReleaseVersion: body.baseReleaseVersion ?? null})
    })
    fireEvent.click(screen.getByRole('button', {name: '创建空稿'}))
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create).toHaveBeenCalledWith('20', 'orderFlow', {
      title: 'Order flow', baseReleaseVersion: null, commandId: expect.stringMatching(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/),
    }, expect.any(AbortSignal))
    expect(await screen.findByLabelText('当前地址')).toHaveTextContent('/process-definitions/drafts/pd-server-1')
  })

  it('submits the precise copy version without loading release contents and requires copy permission', async () => {
    const first = render(<Harness initialEntry="/process-definitions/new" />)
    await screen.findByRole('heading', {name: '新建草稿'})
    await waitFor(() => expect(screen.getByRole('button', {name: '复制为草稿'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('流程定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('草稿标题'), {target: {value: 'Copied flow'}})
    fireEvent.change(screen.getByLabelText('复制自发布版本（可选）'), {target: {value: 'auto-4'}})
    fireEvent.click(screen.getByRole('button', {name: '复制为草稿'}))
    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    expect(create).toHaveBeenCalledWith('20', 'orderFlow', {
      title: 'Copied flow', baseReleaseVersion: 'auto-4', commandId: expect.any(String),
    }, expect.any(AbortSignal))

    first.unmount()
    current = auth('20', [PAGE, CREATE])
    const second = render(<Harness initialEntry="/process-definitions/new" />)
    await screen.findByRole('heading', {name: '新建草稿'})
    expect(screen.queryByLabelText('复制自发布版本（可选）')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '复制为草稿'})).not.toBeInTheDocument()
    second.unmount()
  })

  it('persists the original CREATE reference before dispatch and keeps unknown outcome recoverable', async () => {
    create.mockImplementationOnce(async () => {
      expect(sessionStorage.getItem('tianji.process-draft-create.v1')).not.toBeNull()
      throw new TypeError('Failed to fetch')
    })
    list.mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([]))
    render(<Harness initialEntry="/process-definitions/new" />)
    await screen.findByRole('heading', {name: '新建草稿'})
    await waitFor(() => expect(screen.getByRole('button', {name: '创建空稿'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('流程定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('草稿标题'), {target: {value: 'Order flow'}})
    fireEvent.click(screen.getByRole('button', {name: '创建空稿'}))
    await screen.findByText('创建结果尚未确认')

    const stored = sessionStorage.getItem('tianji.process-draft-create.v1')
    expect(stored).not.toBeNull()
    const pointer = JSON.parse(stored!)
    expect(pointer).toMatchObject({
      operation: 'CREATE', tenantId: '20', definitionKey: 'orderFlow', title: 'Order flow', baseReleaseVersion: null,
      commandId: expect.any(String), actorFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(pointer.actorFingerprint).not.toContain('subject-20')
    expect(create).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', {name: '查证创建结果'}))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(list).toHaveBeenLastCalledWith('20', {creationCommandId: pointer.commandId}, expect.any(AbortSignal))
    expect(screen.getByText(/创建结果仍未知/)).toBeInTheDocument()
    expect(create).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', {name: '查证创建结果'})).toBeInTheDocument()
  })

  it('keeps the prior draft list readable while an unknown CREATE blocks another write', async () => {
    create.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    list.mockImplementation(async (_tenant, query) => query?.creationCommandId
      ? page([]) : page([summary('pd-existing')]))
    render(<Harness initialEntry="/process-definitions/new" />)
    await screen.findByRole('heading', {name: '新建草稿'})
    await waitFor(() => expect(screen.getByRole('button', {name: '创建空稿'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('流程定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('草稿标题'), {target: {value: 'Order flow'}})
    fireEvent.click(screen.getByRole('button', {name: '创建空稿'}))
    expect(await screen.findByText('创建结果尚未确认')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '返回工作区'}))

    expect(await screen.findByRole('link', {name: 'Order flow'})).toHaveAttribute(
      'href', '/process-definitions/drafts/pd-existing',
    )
    expect(screen.getByText(/创建结果仍未知/)).toBeInTheDocument()
    visitNew()
    expect(await screen.findByText('创建结果尚未确认')).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '创建空稿'})).not.toBeInTheDocument()
    expect(create).toHaveBeenCalledOnce()
  })

  it.each([
    [409, 'TIANJI_IDEMPOTENCY_CONFLICT'],
    [404, 'REQUEST_FAILED'],
  ] as const)('retains the original recovery key when HTTP %s has no definitive rejection', async (status, code) => {
    create.mockRejectedValueOnce(new ApiError('CREATE response failure', status, code))
    list.mockResolvedValueOnce(page([]))
    render(<Harness initialEntry="/process-definitions/new" />)
    await screen.findByRole('heading', {name: '新建草稿'})
    await waitFor(() => expect(screen.getByRole('button', {name: '创建空稿'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('流程定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('草稿标题'), {target: {value: 'Order flow'}})
    fireEvent.click(screen.getByRole('button', {name: '创建空稿'}))

    expect(await screen.findByText('创建结果尚未确认')).toBeInTheDocument()
    expect(sessionStorage.getItem('tianji.process-draft-create.v1')).not.toBeNull()
    expect(create).toHaveBeenCalledOnce()
  })

  it.each([
    [404, 'TIANJI_RESOURCE_NOT_FOUND'],
    [409, 'TIANJI_DRAFT_SOURCE_UNAVAILABLE'],
  ] as const)('clears definite protected-source failure %s and lets the owner correct the request', async (status, code) => {
    create.mockRejectedValueOnce(new ApiError('Source unavailable', status, code))
    const rendered = render(<Harness initialEntry="/process-definitions/new" />)
    await screen.findByRole('heading', {name: '新建草稿'})
    await waitFor(() => expect(screen.getByRole('button', {name: '复制为草稿'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('流程定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('草稿标题'), {target: {value: 'Copied flow'}})
    fireEvent.change(screen.getByLabelText('复制自发布版本（可选）'), {target: {value: 'missing-version'}})
    fireEvent.click(screen.getByRole('button', {name: '复制为草稿'}))

    expect(await screen.findByText('无法创建此草稿。请检查流程标识、标题和发布版本权限后重试。')).toBeInTheDocument()
    expect(screen.getByLabelText('复制自发布版本（可选）')).toHaveValue('missing-version')
    expect(sessionStorage.getItem('tianji.process-draft-create.v1')).toBeNull()
    expect(create).toHaveBeenCalledOnce()
    rendered.unmount()
  })

  it('rejects malformed definition filters before making a request', async () => {
    render(<Harness />)
    await screen.findByText('还没有草稿')
    const count = list.mock.calls.length
    fireEvent.change(screen.getByLabelText('流程定义'), {target: {value: '../private'}})
    fireEvent.click(screen.getByRole('button', {name: '筛选'}))
    expect(await screen.findByText('请输入有效的流程定义标识。')).toBeInTheDocument()
    expect(list).toHaveBeenCalledTimes(count)
  })

  it('loads owner drafts when session storage is unavailable but blocks new writes', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage denied') })
    render(<Harness />)
    expect(await screen.findByText('还没有草稿')).toBeInTheDocument()
    expect(list).toHaveBeenCalled()
    visitNew()
    expect(await screen.findByRole('heading', {name: '新建草稿'})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: '创建空稿'})).toBeDisabled()
    expect(create).not.toHaveBeenCalled()
  })

  it('remounts under the same actor and recovers the original command to its server draft ID', async () => {
    create.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    list.mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([]))
    const first = render(<Harness initialEntry="/process-definitions/new" />)
    await screen.findByRole('heading', {name: '新建草稿'})
    await waitFor(() => expect(screen.getByRole('button', {name: '创建空稿'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('流程定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('草稿标题'), {target: {value: 'Original title'}})
    fireEvent.click(screen.getByRole('button', {name: '创建空稿'}))
    expect(await screen.findByText('创建结果尚未确认')).toBeInTheDocument()
    const intent = JSON.parse(sessionStorage.getItem('tianji.process-draft-create.v1')!)
    first.unmount()

    list.mockReset().mockResolvedValueOnce(page([summary('pd-recovered', {
      title: 'Renamed after creation', baseReleaseVersion: null,
    })]))
    render(<Harness initialEntry="/process-definitions" />)
    await waitFor(() => expect(screen.getByLabelText('当前地址')).toHaveTextContent('/process-definitions/drafts/pd-recovered'))
    expect(list).toHaveBeenLastCalledWith('20', {creationCommandId: intent.commandId}, expect.any(AbortSignal))
    expect(create).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('tianji.process-draft-create.v1')).toBeNull()
  })

  it('removes another actor recovery data and ignores an old pending CREATE response', async () => {
    let finish!: (value: DraftSummaryDTO) => void
    create.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const {rerender} = render(<Harness initialEntry="/process-definitions/new" />)
    await screen.findByRole('heading', {name: '新建草稿'})
    await waitFor(() => expect(screen.getByRole('button', {name: '创建空稿'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('流程定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('草稿标题'), {target: {value: 'Order flow'}})
    fireEvent.click(screen.getByRole('button', {name: '创建空稿'}))
    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    expect(sessionStorage.getItem('tianji.process-draft-create.v1')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', {name: '返回工作区'}))
    current = auth('21', [PAGE, CREATE, COPY])
    rerender(<Harness />)
    expect(await screen.findByText('还没有草稿')).toBeInTheDocument()
    expect(sessionStorage.getItem('tianji.process-draft-create.v1')).toBeNull()
    await act(async () => { finish(summary('pd-old-actor')) })
    expect(screen.getByLabelText('当前地址')).toHaveTextContent('/process-definitions')
    expect(screen.queryByText('pd-old-actor')).not.toBeInTheDocument()
    current = auth('21', [])
    rerender(<Harness />)
    expect(await screen.findByText('当前身份不能访问草稿工作区。')).toBeInTheDocument()
  })

  it('prunes a previous owner pointer for a different signed-in user without page access', async () => {
    sessionStorage.setItem('tianji.process-draft-create.v1', JSON.stringify({
      version: 1, operation: 'CREATE', actorFingerprint: 'a'.repeat(64), tenantId: '20',
      definitionKey: 'orderFlow', title: 'Old title', baseReleaseVersion: null, commandId: 'create-old-1',
    }))
    current = auth('21', [])
    render(<Harness />)
    expect(await screen.findByText('当前身份不能访问草稿工作区。')).toBeInTheDocument()
    await waitFor(() => expect(sessionStorage.getItem('tianji.process-draft-create.v1')).toBeNull())
    expect(list).not.toHaveBeenCalled()
  })

  it('starts the selected definition with raw typed values and displays the server-selected release', async () => {
    start.mockImplementationOnce(async (_tenant, command) => {
      const pointer = JSON.parse(sessionStorage.getItem('tianji.process-start.v2')!)
      expect(pointer).toMatchObject({operation: 'START', commandId: command.commandId, requestSha256: 'f'.repeat(64)})
      expect(pointer).not.toHaveProperty('body')
      return {
        instanceId: 'pi-started', definitionKey: 'orderFlow', releaseVersion: 'auto-8', activationRevision: 4,
        profile: 'AUTOMATION_V2', businessKey: 'order-19', correlationId: 'corr-order-19', state: 'ACTIVE',
        version: '1'.repeat(64), configurationSha256: '2'.repeat(64), submittedAt: TIME, finishedAt: null,
        output: null, availableActions: ['CANCEL'], graph: {
          definitionKey: 'orderFlow', nodes: [{id: 'start', kind: 'START', name: 'Start'}], edges: [],
        },
      } as AutomationInstanceDTO
    })
    render(<Harness />)
    await screen.findByText('还没有草稿')
    await waitFor(() => expect(screen.getByRole('button', {name: '技术启动'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('启动定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('业务标识'), {target: {value: 'order-19'}})
    fireEvent.change(screen.getByLabelText('关联标识'), {target: {value: 'corr-order-19'}})
    fireEvent.change(screen.getByLabelText('启动变量 JSON'), {target: {value: '{"amount":"1.00","count":2}'}})
    fireEvent.change(screen.getByLabelText('Agent 节点覆盖 JSON（可选）'), {target: {value:
      '{"agentNode":{"templateRef":{"key":"template","version":1,"contentSha256":"' + 'a'.repeat(64)
        + '"},"parameters":{"enabled":true}}}'}})
    fireEvent.click(screen.getByRole('button', {name: '技术启动'}))

    await waitFor(() => expect(start).toHaveBeenCalledOnce())
    const [tenant, command, signal] = start.mock.calls[0]
    expect(tenant).toBe('20')
    expect(command).toMatchObject({
      definitionKey: 'orderFlow', businessKey: 'order-19', correlationId: 'corr-order-19',
      variables: {amount: '1.00', count: 2},
      agentTaskOverrides: {agentNode: {
        templateRef: {key: 'template', version: 1, contentSha256: 'a'.repeat(64)}, parameters: {enabled: true},
      }},
    })
    expect(Object.keys(command)).toEqual(['definitionKey', 'businessKey', 'commandId', 'correlationId', 'variables', 'agentTaskOverrides'])
    expect(command.commandId).toMatch(/^start-/)
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(startDigest).toHaveBeenCalledWith(command)
    expect(sessionStorage.getItem('tianji.process-start.v2')).toBeNull()
    expect(await screen.findByText(/auto-8.*修订 4/)).toBeInTheDocument()
    expect(screen.getByRole('link', {name: '打开已启动实例'})).toHaveAttribute('href', '/process-instances/pi-started')
  })

  it('preserves the original START body while mounted and never replaces an unknown write with another key', async () => {
    start.mockRejectedValueOnce(new TypeError('response lost'))
    render(<Harness />)
    await screen.findByText('还没有草稿')
    await waitFor(() => expect(screen.getByRole('button', {name: '技术启动'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('启动定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('业务标识'), {target: {value: 'order-19'}})
    fireEvent.change(screen.getByLabelText('关联标识'), {target: {value: 'corr-order-19'}})
    fireEvent.change(screen.getByLabelText('启动变量 JSON'), {target: {value: '{"count":2}'}})
    fireEvent.click(screen.getByRole('button', {name: '技术启动'}))
    expect(await screen.findByText('启动结果尚未确认')).toBeInTheDocument()
    const original = start.mock.calls[0]
    fireEvent.change(screen.getByLabelText('启动变量 JSON'), {target: {value: '{"count":3}'}})
    expect(screen.getByRole('button', {name: '技术启动'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button', {name: '重放原 START 请求'}))
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2))
    expect(start.mock.calls[1]?.[1]).toEqual(original?.[1])
    expect(startDigest.mock.calls[0]?.[0]).toEqual(startDigest.mock.calls[1]?.[0])
  })

  it('fences rapid START submissions while hashing the captured request', async () => {
    let completeDigest!: (value: string) => void
    startDigest.mockReturnValueOnce(new Promise(resolve => { completeDigest = resolve }))
    render(<Harness />)
    await screen.findByText('还没有草稿')
    await waitFor(() => expect(screen.getByRole('button', {name: '技术启动'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('启动定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('业务标识'), {target: {value: 'order-19'}})
    fireEvent.change(screen.getByLabelText('关联标识'), {target: {value: 'corr-order-19'}})
    fireEvent.click(screen.getByRole('button', {name: '技术启动'}))
    expect(screen.getByRole('button', {name: '技术启动'})).toBeDisabled()
    expect(screen.getByText(/正在计算请求摘要/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '技术启动'}))
    expect(startDigest).toHaveBeenCalledOnce()
    expect(start).not.toHaveBeenCalled()
    await act(async () => { completeDigest('f'.repeat(64)) })
    await waitFor(() => expect(start).toHaveBeenCalledOnce())
  })

  it('drops a pending START digest when the verified tenant changes before dispatch', async () => {
    let finishDigest!: (value: string) => void
    startDigest.mockReturnValueOnce(new Promise(resolve => { finishDigest = resolve }))
    const rendered = render(<Harness />)
    await screen.findByText('还没有草稿')
    await waitFor(() => expect(screen.getByRole('button', {name: '技术启动'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('启动定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('业务标识'), {target: {value: 'order-19'}})
    fireEvent.change(screen.getByLabelText('关联标识'), {target: {value: 'corr-order-19'}})
    fireEvent.click(screen.getByRole('button', {name: '技术启动'}))
    await waitFor(() => expect(startDigest).toHaveBeenCalledOnce())

    current = auth('21')
    rendered.rerender(<Harness />)
    await act(async () => { finishDigest('f'.repeat(64)) })
    expect(start).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('tianji.process-start.v2')).toBeNull()
  })

  it('drops a pending START digest when the authenticated subject changes', async () => {
    let finishDigest!: (value: string) => void
    startDigest.mockReturnValueOnce(new Promise(resolve => { finishDigest = resolve }))
    const rendered = render(<Harness />)
    await screen.findByText('还没有草稿')
    await waitFor(() => expect(screen.getByRole('button', {name: '技术启动'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('启动定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('业务标识'), {target: {value: 'order-19'}})
    fireEvent.change(screen.getByLabelText('关联标识'), {target: {value: 'corr-order-19'}})
    fireEvent.click(screen.getByRole('button', {name: '技术启动'}))
    await waitFor(() => expect(startDigest).toHaveBeenCalledOnce())

    current = auth('20', undefined, 'different-subject')
    rendered.rerender(<Harness />)
    await act(async () => { finishDigest('f'.repeat(64)) })
    expect(start).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('tianji.process-start.v2')).toBeNull()
  })

  it('keeps START unknown on a missing receipt, then navigates only for APPLIED', async () => {
    getStartReceipt.mockRejectedValueOnce(new ApiError('missing', 404, 'TIANJI_RESOURCE_NOT_FOUND'))
      .mockResolvedValueOnce({instanceId: 'pi-recovered', status: 'APPLIED', recordedAt: TIME})
    const identity = authorization('20', ['TIANJI_PROCESS_RELEASE_PUBLISH', 'TIANJI_PROCESS_READ', 'TIANJI_PROCESS_START']).identity
    const payload = new TextEncoder().encode(JSON.stringify([
      'TIANJI_PROCESS_DRAFT_OWNER_V1', identity.issuer, identity.subject,
    ]))
    const digest = await crypto.subtle.digest('SHA-256', payload)
    const actorFingerprint = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
    sessionStorage.setItem('tianji.process-start.v2', JSON.stringify({
      version: 1, operation: 'START', actorFingerprint, tenantId: '20',
      commandId: 'start-01234567-89ab-4cde-8fab-0123456789ab', requestSha256: 'b'.repeat(64),
    }))
    render(<Harness />)
    expect(await screen.findByText('启动结果尚未确认')).toBeInTheDocument()
    expect(start).not.toHaveBeenCalled()
    expect(getStartReceipt).toHaveBeenCalledWith('20', {
      commandId: 'start-01234567-89ab-4cde-8fab-0123456789ab', requestSha256: 'b'.repeat(64),
    }, expect.any(AbortSignal))
    expect(screen.getByRole('button', {name: '查证原 START 回执'})).toBeEnabled()
    fireEvent.click(screen.getByRole('button', {name: '查证原 START 回执'}))
    await waitFor(() => expect(getStartReceipt).toHaveBeenCalledTimes(2))
    expect(await screen.findByLabelText('当前地址')).toHaveTextContent('/process-instances/pi-recovered')
    expect(start).not.toHaveBeenCalled()
  })

  it.each([
    ['missing repeated member', '{"count":1,"count":2}'],
    ['fractional number', '{"count":1.0}'],
    ['noncanonical large integer', '{"count":1000000000000000}'],
  ])('rejects raw START JSON with %s before writing', async (_case, source) => {
    render(<Harness />)
    await waitFor(() => expect(screen.getByRole('button', {name: '技术启动'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('启动定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('业务标识'), {target: {value: 'order-19'}})
    fireEvent.change(screen.getByLabelText('关联标识'), {target: {value: 'corr-order-19'}})
    fireEvent.change(screen.getByLabelText('启动变量 JSON'), {target: {value: source}})
    fireEvent.click(screen.getByRole('button', {name: '技术启动'}))
    expect(await screen.findByText('启动变量或节点覆盖必须是符合限制的类型化 JSON。')).toBeInTheDocument()
    expect(start).not.toHaveBeenCalled()
    expect(startDigest).not.toHaveBeenCalled()
  })

  it.each([
    ['TIANJI_PROCESS_NOT_ACTIVATED', '此流程定义当前没有生效版本。'],
    ['TIANJI_PROCESS_ACTIVATION_CONFLICT', '启动期间生效版本发生变化。'],
  ] as const)('clears a definitive %s outcome and requires a deliberate new submission', async (code, message) => {
    start.mockRejectedValueOnce(new ApiError('START rejected', 409, code))
    render(<Harness />)
    await screen.findByText('还没有草稿')
    await waitFor(() => expect(screen.getByRole('button', {name: '技术启动'})).toBeEnabled())
    fireEvent.change(screen.getByLabelText('启动定义标识'), {target: {value: 'orderFlow'}})
    fireEvent.change(screen.getByLabelText('业务标识'), {target: {value: 'order-19'}})
    fireEvent.change(screen.getByLabelText('关联标识'), {target: {value: 'corr-order-19'}})
    fireEvent.click(screen.getByRole('button', {name: '技术启动'}))

    expect(await screen.findByText(new RegExp(message))).toBeInTheDocument()
    expect(sessionStorage.getItem('tianji.process-start.v2')).toBeNull()
    expect(start).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', {name: '技术启动'})).toBeEnabled()
  })

  it('requires both PROCESS_READ and PROCESS_START, including the exact action resource', async () => {
    current = auth('20', [PAGE, START], 'subject-20', [
      'TIANJI_PROCESS_RELEASE_PUBLISH', 'TIANJI_PROCESS_START',
    ])
    const first = render(<Harness />)
    expect(screen.queryByRole('button', {name: '技术启动'})).not.toBeInTheDocument()
    first.unmount()

    current = auth('20', [PAGE, START], 'subject-20', [
      'TIANJI_PROCESS_RELEASE_PUBLISH', 'TIANJI_PROCESS_READ',
    ])
    render(<Harness />)
    expect(screen.queryByRole('button', {name: '技术启动'})).not.toBeInTheDocument()
  })

  it('prefills a protected release copy handoff without starting or creating a draft', async () => {
    render(<Harness initialEntry="/process-definitions/new"
      initialState={{copyFrom: {definitionKey: 'orderFlow', releaseVersion: 'auto-9'}}} />)
    expect(await screen.findByRole('heading', {name: '新建草稿'})).toBeInTheDocument()
    expect(screen.getByLabelText('流程定义标识')).toHaveValue('orderFlow')
    expect(screen.getByLabelText('复制自发布版本（可选）')).toHaveValue('auto-9')
    await waitFor(() => expect(screen.getByLabelText('当前路由状态')).toHaveTextContent('null'))
    expect(start).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})
