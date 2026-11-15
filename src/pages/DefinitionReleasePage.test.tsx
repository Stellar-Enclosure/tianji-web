import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {processReleasesApi, type ProcessRelease} from '../api/processReleases'
import {processActivationsApi, type AutomationReleaseDTO} from '../api/processActivations'
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom'
import {useAuth} from '../auth/AuthContext'
import {authorization} from '../test/fixtures'
import DefinitionReleasePage from './DefinitionReleasePage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/processReleases', async () => {
  const actual = await vi.importActual<typeof import('../api/processReleases')>('../api/processReleases')
  return {...actual, processReleasesApi: {get: vi.fn()}}
})
vi.mock('../api/processActivations', async () => {
  const actual = await vi.importActual<typeof import('../api/processActivations')>('../api/processActivations')
  return {...actual, processActivationsApi: {...actual.processActivationsApi, getRelease: vi.fn(), list: vi.fn()}}
})
vi.mock('./ProcessActivationPanel', () => ({
  ProcessActivationPanel: (props: {definitionKey: string; releaseVersion: string}) =>
    <section aria-label="生效状态">{props.definitionKey}@{props.releaseVersion}</section>,
}))

const PAGE = 'tianji.page.processReleases'
const COPY = 'tianji.button.processDefinitions.copy'
const CREATED = '2026-11-05T10:00:00.123456Z'
const RELEASE_READ = 'TIANJI_PROCESS_RELEASE_READ'
const auth = (tenant = '20', allowed = true, epoch?: number, copy = false): ReturnType<typeof useAuth> => {
  const frame = authorization(tenant, [RELEASE_READ])
  return {status: 'ready', authorization: {...frame, binding: {...frame.binding, requestEpoch: epoch ?? frame.binding.requestEpoch}},
    allows: resource => resource === PAGE && allowed || resource === COPY && copy,
    login: () => {}, logout: async () => {}, retry: async () => {}}
}
const release = (releaseVersion: string, key = 'expenseModel'): ProcessRelease =>
  ({releaseVersion, manifestSha256: 'a'.repeat(64), createdAt: CREATED, models: [
    {type: 'BPMN', definitionKey: key, contentSha256: 'b'.repeat(64), inputs: {amount: 'INTEGER'}},
    {type: 'CMMN', definitionKey: 'caseModel', contentSha256: 'c'.repeat(64), inputs: {}},
  ]})
const v2Release = (releaseVersion: string): AutomationReleaseDTO => ({
  releaseVersion,
  sourceManifestSha256: '1'.repeat(64),
  compiledManifestSha256: '2'.repeat(64),
  dependencyManifestSha256: '3'.repeat(64),
  compilerVersion: 'automation-bpmn-2',
  sourceDraftId: 'pd-30',
  sourceDraftRevision: 7,
  graph: {
    definitionKey: 'expenseFlow',
    nodes: [{id: 'start', kind: 'START', name: '<script>alert(1)</script>'}, {id: 'end', kind: 'END', name: '结束'}],
    edges: [{id: 'to-end', source: 'start', target: 'end', label: null}],
  },
  artifact: {
    profile: 'AUTOMATION_V2',
    models: [{type: 'BPMN', definitionKey: 'expenseFlow', xml: '<definitions><script>text only</script></definitions>'}],
    inputSchema: {type: 'object', properties: {amount: {type: 'integer'}}, required: ['amount'], additionalProperties: false},
    outputSchema: {type: 'object', properties: {}, required: [], additionalProperties: false},
    nodeBindings: [],
    eventRoutes: [],
  },
})
let current = auth()
const edit = (value: string) => fireEvent.change(screen.getByLabelText('发布版本'), {target: {value}})
const compare = (value: string) => fireEvent.change(screen.getByLabelText('对比版本（可选）'), {target: {value}})
const submit = () => fireEvent.click(screen.getByRole('button', {name: '查询发布'}))
const selectV2 = () => {
  fireEvent.mouseDown(screen.getByRole('combobox', {name: '发布格式'}))
  fireEvent.click(screen.getByText('流程 V2'))
}
const selectV1 = () => {
  fireEvent.mouseDown(screen.getByRole('combobox', {name: '发布格式'}))
  fireEvent.click(screen.getByText('传统发布（V1）'))
}
const enterRelease = (version: string) => edit(version)

function RouteProbe() {
  const location = useLocation()
  const copyFrom = (location.state as {copyFrom?: {definitionKey: string; releaseVersion: string}} | null)?.copyFrom
  return <output aria-label="复制来源">{copyFrom ? copyFrom.definitionKey + '@' + copyFrom.releaseVersion : '无'}</output>
}

function V2Harness() {
  return <MemoryRouter initialEntries={['/operations/process-releases']}>
    <Routes>
      <Route path="/operations/process-releases" element={<DefinitionReleasePage />} />
    </Routes>
    <RouteProbe />
  </MemoryRouter>
}

describe('Process release metadata page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    current = auth()
    vi.mocked(useAuth).mockImplementation(() => current)
    vi.mocked(processReleasesApi.get).mockImplementation(async (_, version) => release(version))
    vi.mocked(processActivationsApi.getRelease).mockImplementation(async (_, version) => v2Release(version))
    vi.mocked(processActivationsApi.list).mockResolvedValue({
      definitionKey: 'expenseFlow', observedAt: CREATED, current: null, items: [], nextCursor: null,
    })
  })

  it('renders an explicit release lookup', () => {
    render(<DefinitionReleasePage />)
    expect(processReleasesApi.get).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', {name: '查询发布'})).not.toBeNull()
    expect(screen.getByLabelText('发布版本')).toHaveValue('')
  })

  it('offers an optional comparison version without loading either release', () => {
    render(<DefinitionReleasePage />)
    expect(screen.getByLabelText('对比版本（可选）')).toHaveValue('')
    expect(processReleasesApi.get).not.toHaveBeenCalled()
  })

  it('requests two exact published releases with one comparison signal', async () => {
    render(<DefinitionReleasePage />)
    edit('release-base')
    compare('release-target')
    submit()
    await waitFor(() => expect(processReleasesApi.get).toHaveBeenCalledTimes(2))
    const signal = vi.mocked(processReleasesApi.get).mock.calls[0][2]
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(processReleasesApi.get).toHaveBeenNthCalledWith(1, '20', 'release-base', signal)
    expect(processReleasesApi.get).toHaveBeenNthCalledWith(2, '20', 'release-target', signal)
  })

  it('compares model identities, digests and declared inputs only after both exact reads succeed', async () => {
    const baseline: ProcessRelease = {
      ...release('release-base'), manifestSha256: 'd'.repeat(64), models: [
        {type: 'DMN', definitionKey: 'shared', contentSha256: '3'.repeat(64), inputs: {amount: 'INTEGER'}},
        {type: 'CMMN', definitionKey: 'oldCase', contentSha256: '2'.repeat(64), inputs: {}},
        {type: 'BPMN', definitionKey: 'shared', contentSha256: '1'.repeat(64), inputs: {amount: 'INTEGER'}},
        {type: 'BPMN', definitionKey: 'steady', contentSha256: '4'.repeat(64), inputs: {b: 'STRING', a: 'BOOLEAN'}},
      ],
    }
    const target: ProcessRelease = {
      ...release('release-target'), manifestSha256: 'e'.repeat(64), models: [
        {type: 'CMMN', definitionKey: 'newCase', contentSha256: '5'.repeat(64), inputs: {}},
        {type: 'BPMN', definitionKey: 'steady', contentSha256: '4'.repeat(64), inputs: {a: 'BOOLEAN', b: 'STRING'}},
        {type: 'DMN', definitionKey: 'shared', contentSha256: '3'.repeat(64), inputs: {amount: 'STRING'}},
        {type: 'BPMN', definitionKey: 'shared', contentSha256: '6'.repeat(64), inputs: {amount: 'INTEGER'}},
      ],
    }
    let complete!: (value: ProcessRelease) => void
    const pending = new Promise<ProcessRelease>(resolve => { complete = resolve })
    vi.mocked(processReleasesApi.get).mockResolvedValueOnce(baseline).mockReturnValueOnce(pending)
    render(<DefinitionReleasePage />)
    edit('release-base')
    compare('release-target')
    submit()
    await waitFor(() => expect(processReleasesApi.get).toHaveBeenCalledTimes(2))
    expect(screen.queryByText(baseline.manifestSha256)).not.toBeInTheDocument()
    expect(screen.queryByText('发布版本对比')).not.toBeInTheDocument()
    await act(async () => { complete(target) })

    expect(await screen.findByText('发布版本对比')).toBeInTheDocument()
    expect(screen.getByText('基准版本：release-base')).toBeInTheDocument()
    expect(screen.getByText('对比版本：release-target')).toBeInTheDocument()
    expect(screen.getByText(baseline.manifestSha256)).toBeInTheDocument()
    expect(screen.getByText(target.manifestSha256)).toBeInTheDocument()
    expect(screen.getByText('Manifest 摘要：不同')).toBeInTheDocument()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.map(row => within(row).getAllByRole('cell').slice(0, 2).map(cell => cell.textContent)))
      .toEqual([['BPMN', 'shared'], ['CMMN', 'newCase'], ['CMMN', 'oldCase'], ['DMN', 'shared']])
    expect(within(rows[0]).getByText('内容摘要变化')).toBeInTheDocument()
    expect(within(rows[0]).queryByText('声明输入变化')).not.toBeInTheDocument()
    expect(within(rows[1]).getByText('新增')).toBeInTheDocument()
    expect(within(rows[2]).getByText('移除')).toBeInTheDocument()
    expect(within(rows[3]).getByText('声明输入变化')).toBeInTheDocument()
    expect(within(rows[3]).queryByText('内容摘要变化')).not.toBeInTheDocument()
    expect(screen.queryByText('steady')).not.toBeInTheDocument()
  })

  it('keeps both manifest hashes visible when the model metadata is identical', async () => {
    vi.mocked(processReleasesApi.get).mockResolvedValueOnce(release('release-base'))
      .mockResolvedValueOnce({...release('release-target'), manifestSha256: 'f'.repeat(64), models: [...release('release-target').models].reverse()})
    render(<DefinitionReleasePage />)
    edit('release-base')
    compare('release-target')
    submit()
    expect(await screen.findByText('未发现模型元数据差异。')).toBeInTheDocument()
    expect(screen.getByText('a'.repeat(64))).toBeInTheDocument()
    expect(screen.getByText('f'.repeat(64))).toBeInTheDocument()
    expect(screen.getByText('Manifest 摘要：不同')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('rejects duplicate and malformed optional comparison versions without issuing either read', async () => {
    render(<DefinitionReleasePage />)
    edit('release-base')
    compare('release-base')
    submit()
    expect(await screen.findByText('对比版本必须与发布版本不同。')).toBeInTheDocument()
    expect(processReleasesApi.get).not.toHaveBeenCalled()
    compare(' release-target')
    submit()
    expect(await screen.findByText('请输入有效的对比版本。')).toBeInTheDocument()
    expect(processReleasesApi.get).not.toHaveBeenCalled()
    compare('')
    submit()
    expect(await screen.findByText('已发布元数据')).toBeInTheDocument()
    expect(processReleasesApi.get).toHaveBeenCalledExactlyOnceWith('20', 'release-base', expect.any(AbortSignal))
  })

  it('aborts the other comparison read after failure and shows no partial or private result', async () => {
    let complete!: (value: ProcessRelease) => void
    vi.mocked(processReleasesApi.get).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
      .mockRejectedValueOnce(new ApiError('private target diagnostic', 404, 'TIANJI_RESOURCE_NOT_FOUND'))
    render(<DefinitionReleasePage />)
    edit('release-base')
    compare('release-target')
    submit()
    expect(await screen.findByText('当前无法读取其中一个发布版本。')).toBeInTheDocument()
    expect(vi.mocked(processReleasesApi.get).mock.calls[0][2]?.aborted).toBe(true)
    await act(async () => { complete(release('release-base', 'privateBaselineModel')) })
    expect(screen.queryByText('privateBaselineModel')).not.toBeInTheDocument()
    expect(screen.queryByText('private target diagnostic')).not.toBeInTheDocument()
    expect(screen.queryByText('发布版本对比')).not.toBeInTheDocument()
  })

  it('cancels both reads on comparison edit and ignores the late previous pair', async () => {
    let completeBase!: (value: ProcessRelease) => void
    let completeTarget!: (value: ProcessRelease) => void
    vi.mocked(processReleasesApi.get).mockReturnValueOnce(new Promise(resolve => { completeBase = resolve }))
      .mockReturnValueOnce(new Promise(resolve => { completeTarget = resolve }))
    render(<DefinitionReleasePage />)
    edit('release-base')
    compare('release-old')
    submit()
    await waitFor(() => expect(processReleasesApi.get).toHaveBeenCalledTimes(2))
    const first = vi.mocked(processReleasesApi.get).mock.calls[0][2]
    const second = vi.mocked(processReleasesApi.get).mock.calls[1][2]
    compare('release-new')
    expect(first?.aborted).toBe(true)
    expect(second?.aborted).toBe(true)
    submit()
    expect(await screen.findByText('对比版本：release-new')).toBeInTheDocument()
    await act(async () => {
      completeBase(release('release-base', 'oldBaseModel'))
      completeTarget(release('release-old', 'oldTargetModel'))
    })
    expect(screen.queryByText('对比版本：release-old')).not.toBeInTheDocument()
    expect(screen.queryByText('oldTargetModel')).not.toBeInTheDocument()
    expect(processReleasesApi.get).toHaveBeenCalledTimes(4)
  })

  it('drops both comparison reads and fields on a changed request epoch', async () => {
    let completeBase!: (value: ProcessRelease) => void
    let completeTarget!: (value: ProcessRelease) => void
    vi.mocked(processReleasesApi.get).mockReturnValueOnce(new Promise(resolve => { completeBase = resolve }))
      .mockReturnValueOnce(new Promise(resolve => { completeTarget = resolve }))
    const tree = render(<DefinitionReleasePage />)
    edit('release-base')
    compare('release-target')
    submit()
    await waitFor(() => expect(processReleasesApi.get).toHaveBeenCalledTimes(2))
    const signal = vi.mocked(processReleasesApi.get).mock.calls[0][2]
    current = auth('20', true, 81)
    tree.rerender(<DefinitionReleasePage />)
    expect(signal?.aborted).toBe(true)
    await act(async () => {
      completeBase(release('release-base', 'oldBaseModel'))
      completeTarget(release('release-target', 'oldTargetModel'))
    })
    expect(screen.getByLabelText('发布版本')).toHaveValue('')
    expect(screen.getByLabelText('对比版本（可选）')).toHaveValue('')
    expect(screen.queryByText('发布版本对比')).not.toBeInTheDocument()
  })

  it('clears a comparison on tenant-context failure without rendering a side result', async () => {
    vi.mocked(processReleasesApi.get).mockResolvedValueOnce(release('release-base'))
      .mockRejectedValueOnce(new ApiError('private tenant diagnostic', 409, 'TIANJI_TENANT_CONTEXT_CHANGED'))
    render(<DefinitionReleasePage />)
    edit('release-base')
    compare('release-target')
    submit()
    await waitFor(() => expect(processReleasesApi.get).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(vi.mocked(processReleasesApi.get).mock.calls[0][2]?.aborted).toBe(true))
    expect(screen.queryByText('发布版本对比')).not.toBeInTheDocument()
    expect(screen.queryByText('expenseModel')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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

  it('reads a known V2 release explicitly and renders the verified source as plain text', async () => {
    vi.mocked(processActivationsApi.getRelease).mockResolvedValueOnce(v2Release('auto-7'))
    render(<V2Harness />)
    selectV2()
    enterRelease('auto-7')
    fireEvent.click(screen.getByRole('button', {name: '查询 V2 发布'}))

    expect(await screen.findByText('expenseFlow@auto-7')).toBeInTheDocument()
    expect(processActivationsApi.getRelease).toHaveBeenCalledExactlyOnceWith('20', 'auto-7', expect.any(AbortSignal))
    expect(processReleasesApi.get).not.toHaveBeenCalled()
    expect(screen.getByText('来源草稿修订：7')).toBeInTheDocument()
    expect(screen.getByText('1'.repeat(64))).toBeInTheDocument()
    expect(screen.getByText('2'.repeat(64))).toBeInTheDocument()
    expect(screen.getByText('3'.repeat(64))).toBeInTheDocument()
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: '复制为草稿'})).not.toBeInTheDocument()
  })

  it('offers an exact-source copy only with the independent copy permission', async () => {
    current = auth('20', true, undefined, true)
    vi.mocked(useAuth).mockImplementation(() => current)
    vi.mocked(processActivationsApi.getRelease).mockResolvedValueOnce(v2Release('auto-7'))
    render(<V2Harness />)
    selectV2()
    enterRelease('auto-7')
    fireEvent.click(screen.getByRole('button', {name: '查询 V2 发布'}))

    const copy = await screen.findByRole('link', {name: '复制为草稿'})
    expect(copy).toHaveAttribute('href', '/process-definitions/new')
    fireEvent.click(copy)
    expect(screen.getByLabelText('复制来源')).toHaveTextContent('expenseFlow@auto-7')
    expect(processActivationsApi.getRelease).toHaveBeenCalledExactlyOnceWith('20', 'auto-7', expect.any(AbortSignal))
  })

  it('keeps V2 lookup failures isolated and does not fall back to the V1 reader', async () => {
    vi.mocked(processActivationsApi.getRelease).mockRejectedValueOnce(
      new ApiError('private not-found detail', 404, 'TIANJI_RESOURCE_NOT_FOUND'),
    )
    render(<V2Harness />)
    selectV2()
    enterRelease('auto-404')
    fireEvent.click(screen.getByRole('button', {name: '查询 V2 发布'}))

    expect(await screen.findByText('当前无法读取该流程发布版本。')).toBeInTheDocument()
    expect(processReleasesApi.get).not.toHaveBeenCalled()
    expect(screen.queryByText('private not-found detail')).not.toBeInTheDocument()
    expect(screen.queryByText('expenseModel')).not.toBeInTheDocument()
  })

  it('aborts the V2 source read when its requested version changes', async () => {
    let complete!: (value: AutomationReleaseDTO) => void
    vi.mocked(processActivationsApi.getRelease).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    render(<V2Harness />)
    selectV2()
    enterRelease('auto-old')
    fireEvent.click(screen.getByRole('button', {name: '查询 V2 发布'}))
    expect(await screen.findByText('正在查询发布元数据')).toBeInTheDocument()
    const signal = vi.mocked(processActivationsApi.getRelease).mock.calls[0][2]!
    enterRelease('auto-new')
    expect(signal.aborted).toBe(true)
    await act(async () => { complete(v2Release('auto-old')) })
    expect(screen.queryByText('expenseFlow@auto-old')).not.toBeInTheDocument()
    expect(processReleasesApi.get).not.toHaveBeenCalled()
  })

  it('clears a V1 comparison when switching formats so a later V1 lookup stays singular', () => {
    render(<DefinitionReleasePage />)
    compare('release-older')
    selectV2()
    selectV1()
    expect(screen.getByLabelText('对比版本（可选）')).toHaveValue('')
    expect(processReleasesApi.get).not.toHaveBeenCalled()
    expect(processActivationsApi.getRelease).not.toHaveBeenCalled()
  })
})
