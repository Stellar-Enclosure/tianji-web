import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom'
import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {DraftSummaryDTO, ProcessDraftPageDTO} from '../api/processDrafts'
import {processDraftsApi} from '../api/processDrafts'
import {useAuth} from '../auth/AuthContext'
import {authorization} from '../test/fixtures'
import ProcessDefinitionWorkspacePage from './ProcessDefinitionWorkspacePage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/processDrafts', async original => {
  const actual = await original<typeof import('../api/processDrafts')>()
  return {...actual, processDraftsApi: {list: vi.fn(), create: vi.fn()}}
})

const PAGE = 'tianji.page.processDefinitions'
const CREATE = 'tianji.button.processDefinitions.create'
const COPY = 'tianji.button.processDefinitions.copy'
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

const auth = (tenant = '20', granted = [PAGE, CREATE, COPY], subject = 'subject-' + tenant): ReturnType<typeof useAuth> => {
  const frame = authorization(tenant, ['TIANJI_PROCESS_RELEASE_PUBLISH', 'TIANJI_PROCESS_RELEASE_READ'])
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
  return <output aria-label="当前地址">{location.pathname + location.search}</output>
}

function Harness({initialEntry = '/process-definitions'}: {initialEntry?: string}) {
  return <MemoryRouter initialEntries={[initialEntry]}>
    <Routes>
      <Route path="/process-definitions/*" element={<ProcessDefinitionWorkspacePage />} />
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
    list.mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([summary('pd-existing')]))
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
})
