import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {processReleasesApi, type ProcessRelease} from '../api/processReleases'
import {useAuth} from '../auth/AuthContext'
import {authorization} from '../test/fixtures'
import DefinitionReleasePage from './DefinitionReleasePage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/processReleases', async () => {
  const actual = await vi.importActual<typeof import('../api/processReleases')>('../api/processReleases')
  return {...actual, processReleasesApi: {get: vi.fn()}}
})

const PAGE = 'tianji.page.processReleases'
const CREATED = '2026-11-05T10:00:00.123456Z'
const RELEASE_READ = 'TIANJI_PROCESS_RELEASE_READ'
const auth = (tenant = '20', allowed = true, epoch?: number): ReturnType<typeof useAuth> => {
  const frame = authorization(tenant, [RELEASE_READ])
  return {status: 'ready', authorization: {...frame, binding: {...frame.binding, requestEpoch: epoch ?? frame.binding.requestEpoch}},
    allows: resource => resource === PAGE && allowed, login: () => {}, logout: async () => {}, retry: async () => {}}
}
const release = (releaseVersion: string, key = 'expenseModel'): ProcessRelease =>
  ({releaseVersion, manifestSha256: 'a'.repeat(64), createdAt: CREATED, models: [
    {type: 'BPMN', definitionKey: key, contentSha256: 'b'.repeat(64), inputs: {amount: 'INTEGER'}},
    {type: 'CMMN', definitionKey: 'caseModel', contentSha256: 'c'.repeat(64), inputs: {}},
  ]})
let current = auth()
const edit = (value: string) => fireEvent.change(screen.getByLabelText('发布版本'), {target: {value}})
const submit = () => fireEvent.click(screen.getByRole('button', {name: '查询发布'}))

describe('Process release metadata page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    current = auth()
    vi.mocked(useAuth).mockImplementation(() => current)
    vi.mocked(processReleasesApi.get).mockImplementation(async (_, version) => release(version))
  })

  it('renders an explicit release lookup', () => {
    render(<DefinitionReleasePage />)
    expect(processReleasesApi.get).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', {name: '查询发布'})).not.toBeNull()
    expect(screen.getByLabelText('发布版本')).toHaveValue('')
  })

  it('renders immutable release metadata and existing input types after one explicit lookup', async () => {
    render(<DefinitionReleasePage />)
    edit(' release-1')
    submit()
    expect(await screen.findByText('请输入有效的发布版本。')).toBeInTheDocument()
    expect(processReleasesApi.get).not.toHaveBeenCalled()
    edit('release-1')
    submit()
    expect(await screen.findByText('expenseModel')).toBeInTheDocument()
    expect(screen.getByText('BPMN')).toBeInTheDocument()
    expect(screen.getByText('CMMN')).toBeInTheDocument()
    expect(screen.getByText('amount')).toBeInTheDocument()
    expect(screen.getByText('无声明输入')).toBeInTheDocument()
    expect(screen.getByText('a'.repeat(64))).toBeInTheDocument()
    expect(screen.getByText('b'.repeat(64))).toBeInTheDocument()
    expect(screen.getByText(CREATED + ' UTC')).toHaveAttribute('datetime', CREATED)
    expect(processReleasesApi.get).toHaveBeenCalledExactlyOnceWith('20', 'release-1', expect.any(AbortSignal))
    expect(screen.queryByRole('button', {name: /发布流程|激活|回滚|迁移|启动/})).not.toBeInTheDocument()
  })

  it('clears prior metadata and uses fixed errors for invisible and unavailable responses', async () => {
    vi.mocked(processReleasesApi.get).mockResolvedValueOnce(release('release-1'))
      .mockRejectedValueOnce(new ApiError('private source', 404, 'TIANJI_RESOURCE_NOT_FOUND'))
      .mockRejectedValueOnce(new Error('private malformed body'))
    render(<DefinitionReleasePage />)
    edit('release-1')
    submit()
    await screen.findByText('expenseModel')
    submit()
    expect(await screen.findByText('当前无法读取该发布版本。')).toBeInTheDocument()
    expect(screen.queryByText('expenseModel')).not.toBeInTheDocument()
    submit()
    expect(await screen.findByText('暂时无法读取流程发布元数据。')).toBeInTheDocument()
    expect(screen.queryByText('private malformed body')).not.toBeInTheDocument()
  })

  it('aborts a pending read on edit and ignores the late response', async () => {
    let complete!: (value: ProcessRelease) => void
    const old = new Promise<ProcessRelease>(resolve => { complete = resolve })
    vi.mocked(processReleasesApi.get).mockReturnValueOnce(old)
    render(<DefinitionReleasePage />)
    edit('release-old')
    submit()
    expect(await screen.findByText('正在查询发布元数据')).toBeInTheDocument()
    const signal = vi.mocked(processReleasesApi.get).mock.calls[0][2]!
    expect(screen.getByRole('button', {name: '查询发布'})).toBeDisabled()
    edit('release-new')
    expect(signal.aborted).toBe(true)
    submit()
    expect(await screen.findByText('expenseModel')).toBeInTheDocument()
    await act(async () => { complete(release('release-old', 'oldModel')) })
    expect(screen.queryByText('oldModel')).not.toBeInTheDocument()
    expect(processReleasesApi.get).toHaveBeenNthCalledWith(2, '20', 'release-new', expect.any(AbortSignal))
  })

  it.each([
    ['tenant', auth('21'), true], ['epoch', auth('20', true, 80), true], ['permission', auth('20', false), false],
  ] as const)('discards old observation after %s changes', async (_, next, allowed) => {
    let complete!: (value: ProcessRelease) => void
    const old = new Promise<ProcessRelease>(resolve => { complete = resolve })
    vi.mocked(processReleasesApi.get).mockReturnValueOnce(old)
    const screenTree = render(<DefinitionReleasePage />)
    edit('release-1')
    submit()
    await waitFor(() => expect(processReleasesApi.get).toHaveBeenCalledTimes(1))
    const signal = vi.mocked(processReleasesApi.get).mock.calls[0][2]!
    current = next
    screenTree.rerender(<DefinitionReleasePage />)
    expect(signal.aborted).toBe(true)
    await act(async () => { complete(release('release-1', 'oldModel')) })
    expect(screen.queryByText('oldModel')).not.toBeInTheDocument()
    if (allowed) expect(screen.getByLabelText('发布版本')).toHaveValue('')
    else expect(screen.getByText('当前身份不能访问此页面。')).toBeInTheDocument()
  })
})
