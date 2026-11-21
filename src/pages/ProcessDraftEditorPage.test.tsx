import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {ApiError, EmbeddedWorkbench, type WorkbenchHost, type WorkbenchPort} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {createMemoryRouter, RouterProvider} from 'react-router-dom'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {DraftContentVO, DraftPublicationVO, DraftValidationResultDTO, ProcessDraftDTO} from '../api/processDrafts'
import {processDraftsApi} from '../api/processDrafts'
import {authorization} from '../test/fixtures'
import {gatewayAuth} from '../auth/gatewayAuth'
import {useAuth} from '../auth/AuthContext'
import ProcessDraftEditorPage from './ProcessDraftEditorPage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/processDrafts', async original => {
  const actual = await original<typeof import('../api/processDrafts')>()
  return {...actual, processDraftsApi: {
    ...actual.processDraftsApi,
    get: vi.fn(), save: vi.fn(), validate: vi.fn(), publish: vi.fn(), discard: vi.fn(),
  }}
})
vi.mock('./ProcessActivationPanel', () => ({
  ProcessActivationPanel: ({releaseVersion}: {releaseVersion: string}) =>
    <section aria-label="已发布版本生效状态">发布版本 {releaseVersion} 的生效状态</section>,
}))

const PAGE = 'tianji.page.processDraftEditor'
const SAVE = 'tianji.button.processDraftEditor.save'
const VALIDATE = 'tianji.button.processDraftEditor.validate'
const PUBLISH = 'tianji.button.processDraftEditor.publish'
const DISCARD = 'tianji.button.processDraftEditor.discard'
const TIME = '2026-11-12T08:00:00.123456Z'
const draftId = 'pd-1'
const hash = 'a'.repeat(64)
const content: DraftContentVO = {
  models: [{type: 'BPMN', definitionKey: 'orders', xml: '<definitions>unfinished'},
    {type: 'DMN', definitionKey: 'pricing', xml: '<definitions>unfinished decision'}],
  inputSchemaSource: '{"type":"object",', outputSchemaSource: '',
  nodeBindingsSource: null, eventRoutesSource: '  [',
}
const detail = (change: Partial<ProcessDraftDTO> = {}): ProcessDraftDTO => ({
  draftId, definitionKey: 'orders', title: 'Order flow', baseReleaseVersion: null, state: 'EDITING', revision: 4,
  contentSha256: hash, publishedReleaseVersion: null, createdAt: TIME, updatedAt: TIME,
  availableActions: ['SAVE', 'VALIDATE', 'PUBLISH', 'DISCARD'], baseSourceManifestSha256: null,
  content, lastCommandId: 'save:4', publication: null, commandReceipt: null, ...change,
})
const graph = {
  definitionKey: 'orders',
  nodes: [{id: 'start', kind: 'START' as const, name: 'Receive order'},
    {id: 'end', kind: 'END' as const, name: 'Finish'}],
  edges: [{id: 'flow', source: 'start', target: 'end', label: null}],
}
const validation: DraftValidationResultDTO = {
  draftId, revision: 4, contentSha256: hash, valid: true, compilerVersion: 'compiler-2',
  sourceManifestSha256: 'b'.repeat(64), graph, issues: [],
}
const publication: DraftPublicationVO = {
  draftId, publishedRevision: 4, draftRevision: 5, releaseVersion: 'auto-5',
  sourceManifestSha256: 'b'.repeat(64), compiledManifestSha256: 'c'.repeat(64),
  dependencyManifestSha256: 'd'.repeat(64), compilerVersion: 'compiler-2', publishedAt: TIME, commandId: 'publish-1',
}
const saveResult = {draftId, state: 'EDITING' as const, revision: 5,
  contentSha256: 'b'.repeat(64), updatedAt: TIME, commandId: 'save-1'}
const get = vi.mocked(processDraftsApi.get)
const save = vi.mocked(processDraftsApi.save)
const validate = vi.mocked(processDraftsApi.validate)
const publish = vi.mocked(processDraftsApi.publish)
const discard = vi.mocked(processDraftsApi.discard)
const useAuthMock = vi.mocked(useAuth)

let currentPermissions = new Set([PAGE, SAVE, VALIDATE, PUBLISH, DISCARD])
let pageAllowed = true

function setAuthorization(tenantId = '20', resources = currentPermissions) {
  const frame = authorization(tenantId, ['TIANJI_PROCESS_RELEASE_PUBLISH'])
  useAuthMock.mockReturnValue({
    status: 'ready', authorization: frame,
    allows: (resource: string) => resources.has(resource) && pageAllowed,
    login: () => {}, logout: async () => {}, retry: async () => {},
  })
}

function renderEditor(path = `/process-definitions/drafts/${draftId}`) {
  const router = createMemoryRouter([
    {path: '/process-definitions/drafts/:draftId', element: <ProcessDraftEditorPage />},
    {path: '/process-definitions', element: <h1>流程工作区</h1>},
    {path: '/away', element: <h1>离开页</h1>},
  ], {initialEntries: [path]})
  return {router, ...render(<RouterProvider router={router} />)}
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (failure: unknown) => void
  const promise = new Promise<T>((fulfill, fail) => { resolve = fulfill; reject = fail })
  return {promise, resolve, reject}
}

async function actorFingerprint() {
  const frame = authorization('20', ['TIANJI_PROCESS_RELEASE_PUBLISH'])
  const bytes = new TextEncoder().encode(JSON.stringify([
    'TIANJI_PROCESS_DRAFT_OWNER_V1', frame.identity.issuer, frame.identity.subject,
  ]))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

describe('Process draft editor', () => {
  beforeEach(() => {
    gatewayAuth.context.invalidate()
    currentPermissions = new Set([PAGE, SAVE, VALIDATE, PUBLISH, DISCARD])
    pageAllowed = true
    setAuthorization()
    sessionStorage.clear()
    vi.resetAllMocks()
    setAuthorization()
    get.mockResolvedValue(detail())
    save.mockResolvedValue(saveResult)
    validate.mockResolvedValue(validation)
    publish.mockResolvedValue(publication)
    discard.mockResolvedValue({...saveResult, state: 'DISCARDED', commandId: 'discard-1'})
  })

  afterEach(() => {
    gatewayAuth.context.invalidate()
    vi.restoreAllMocks()
  })

  it('restores unfinished XML and JSON while preserving null, empty, and multiple-model values', async () => {
    renderEditor()

    expect(await screen.findByLabelText('BPMN 模型 1 XML')).toHaveValue(content.models?.[0]?.xml)
    expect(screen.getByLabelText('DMN 模型 2 XML')).toHaveValue(content.models?.[1]?.xml)
    expect(screen.getByLabelText('输入结构 JSON')).toHaveValue(content.inputSchemaSource)
    expect(screen.getByLabelText('输出结构 JSON')).toHaveValue('')
    expect(screen.getByRole('checkbox', {name: '不设置节点绑定 JSON'})).toBeChecked()
    expect(screen.getByRole('checkbox', {name: '不设置事件路由 JSON'})).not.toBeChecked()
    expect(screen.getByLabelText('节点绑定 JSON')).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', {name: '不设置节点绑定 JSON'}))
    expect(screen.getByLabelText('节点绑定 JSON')).toBeEnabled()
    expect(screen.getByRole('checkbox', {name: '不设置节点绑定 JSON'})).not.toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', {name: '不设置节点绑定 JSON'}))
    expect(screen.getByLabelText('节点绑定 JSON')).toBeDisabled()
    expect(screen.getByRole('checkbox', {name: '不设置节点绑定 JSON'})).toBeChecked()
    expect(get).toHaveBeenCalledWith('20', draftId, undefined, expect.any(AbortSignal))
  })

  it('saves the captured revision and keeps edits made while that save is pending', async () => {
    const request = deferred<typeof saveResult>()
    save.mockReturnValueOnce(request.promise)
    renderEditor()

    const title = await screen.findByLabelText('草稿标题')
    const source = screen.getByLabelText('BPMN 模型 1 XML')
    fireEvent.change(title, {target: {value: 'Order flow revised'}})
    fireEvent.change(source, {target: {value: '<process id="captured">'}})
    fireEvent.click(screen.getByRole('button', {name: /暂存修订 4/}))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    const [tenant, id, original, signal] = save.mock.calls[0]!
    expect(tenant).toBe('20')
    expect(id).toBe(draftId)
    expect(original.expectedRevision).toBe(4)
    expect(original.title).toBe('Order flow revised')
    expect(original.content.models?.[0]?.xml).toBe('<process id="captured">')
    expect(signal).toBeInstanceOf(AbortSignal)
    const pointer = JSON.parse(sessionStorage.getItem(`tianji.process-draft-editor.v1:20:${draftId}`)!)
    expect(pointer).toMatchObject({operation: 'SAVE', expectedRevision: 4, draftId, tenantId: '20'})
    expect(JSON.stringify(pointer)).not.toContain('<process id=')

    fireEvent.change(title, {target: {value: 'Newer local title'}})
    fireEvent.change(source, {target: {value: '<process id="newer local edit">'}})
    await act(async () => { request.resolve(saveResult) })

    expect(await screen.findByText(/已暂存修订 5/)).toBeInTheDocument()
    expect(screen.getByLabelText('草稿标题')).toHaveValue('Newer local title')
    expect(screen.getByLabelText('BPMN 模型 1 XML')).toHaveValue('<process id="newer local edit">')
    expect(screen.getByText('尚有未暂存修改')).toBeInTheDocument()
    expect(screen.getByRole('button', {name: '发布已保存修订'})).toBeDisabled()
    expect(sessionStorage.getItem(`tianji.process-draft-editor.v1:20:${draftId}`)).toBeNull()
  })

  it('binds validation to the saved revision and publishes that exact snapshot once', async () => {
    renderEditor()
    await screen.findByLabelText('草稿标题')
    fireEvent.click(screen.getByRole('button', {name: '校验已保存修订'}))
    expect(await screen.findAllByText('模型校验通过')).toHaveLength(1)
    expect(validate).toHaveBeenCalledWith('20', {draftId, expectedRevision: 4, expectedContentSha256: hash}, expect.any(AbortSignal))
    expect(screen.getAllByRole('button', {name: 'Receive order，开始事件，状态未知'})).toHaveLength(2)

    fireEvent.change(screen.getByLabelText('发布版本号'), {target: {value: 'auto-5'}})
    fireEvent.click(screen.getByRole('button', {name: '发布已保存修订'}))
    expect(await screen.findByRole('dialog', {name: '确认发布固定修订'})).toBeInTheDocument()
    expect(screen.getAllByText(/修订 4/)).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', {name: '确认发布'}))

    expect(await screen.findByRole('region', {name: '已发布版本生效状态'})).toBeInTheDocument()
    expect(publish).toHaveBeenCalledOnce()
    expect(publish).toHaveBeenCalledWith('20', {
      draftId, expectedRevision: 4, expectedContentSha256: hash, releaseVersion: 'auto-5', commandId: expect.any(String),
    }, expect.any(AbortSignal))
    expect(screen.getByText('发布版本 auto-5 的生效状态')).toBeInTheDocument()
    expect(screen.getByLabelText('草稿标题')).toBeDisabled()
  })

  it('discards only after confirmation and returns to the workspace', async () => {
    const {router} = renderEditor()
    await screen.findByLabelText('草稿标题')
    fireEvent.click(screen.getByRole('button', {name: '放弃草稿'}))
    expect(await screen.findByRole('dialog', {name: '确认放弃此草稿'})).toBeInTheDocument()
    expect(discard).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', {name: '确认放弃'}))

    expect(await screen.findByRole('heading', {name: '流程工作区'})).toBeInTheDocument()
    expect(discard).toHaveBeenCalledWith('20', draftId,
      {commandId: expect.any(String), expectedRevision: 4}, expect.any(AbortSignal))
    expect(await router.state.location.pathname).toBe('/process-definitions')
  })

  it('does not save or write a recovery pointer when synchronous validation rejects the buffer', async () => {
    renderEditor()
    fireEvent.change(await screen.findByLabelText('草稿标题'), {target: {value: '   '}})
    fireEvent.click(screen.getByRole('button', {name: /暂存修订 4/}))

    expect(await screen.findByText('草稿内容或请求超出可暂存范围。请检查标题和原始文本。')).toBeInTheDocument()
    expect(sessionStorage.getItem(`tianji.process-draft-editor.v1:20:${draftId}`)).toBeNull()
    expect(save).not.toHaveBeenCalled()
  })

  it('drops a validation response after the editable buffer changes', async () => {
    const result = deferred<DraftValidationResultDTO>()
    validate.mockReturnValueOnce(result.promise)
    renderEditor()
    await screen.findByLabelText('草稿标题')
    fireEvent.click(screen.getByRole('button', {name: '校验已保存修订'}))
    await waitFor(() => expect(validate).toHaveBeenCalledOnce())
    fireEvent.change(screen.getByLabelText('草稿标题'), {target: {value: 'Edited while validating'}})
    fireEvent.change(screen.getByLabelText('草稿标题'), {target: {value: detail().title}})
    await act(async () => { result.resolve(validation) })

    expect(screen.queryByText('模型校验通过')).not.toBeInTheDocument()
    expect(screen.getByRole('button', {name: '发布已保存修订'})).toBeDisabled()
  })

  it('keeps a dirty buffer through a known revision conflict until explicit reload confirmation', async () => {
    const serverCurrent = detail({revision: 5, contentSha256: 'e'.repeat(64), title: 'Server title',
      content: {...content, inputSchemaSource: '{"server":true}'}, lastCommandId: 'save:5'})
    get.mockResolvedValueOnce(detail()).mockResolvedValueOnce(serverCurrent)
    save.mockRejectedValueOnce(new ApiError('revision conflict', 409, 'TIANJI_DRAFT_VERSION_CONFLICT'))
    renderEditor()
    const title = await screen.findByLabelText('草稿标题')
    fireEvent.change(title, {target: {value: 'Local title'}})
    fireEvent.click(screen.getByRole('button', {name: /暂存修订 4/}))

    expect(await screen.findByText(/服务器当前为修订 5/)).toBeInTheDocument()
    expect(screen.getByLabelText('草稿标题')).toHaveValue('Local title')
    expect(screen.getByRole('button', {name: '查看并重载服务器修订 5'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '查看并重载服务器修订 5'}))
    expect(await screen.findByRole('dialog', {name: '重载服务器修订'})).toBeInTheDocument()
    expect(screen.getByLabelText('草稿标题')).toHaveValue('Local title')
    fireEvent.click(screen.getByRole('button', {name: '用修订 5 替换本地编辑'}))
    expect(screen.getByLabelText('草稿标题')).toHaveValue('Server title')
    expect(screen.getByLabelText('输入结构 JSON')).toHaveValue('{"server":true}')
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('keeps text entered during a current refresh until the user explicitly reloads the returned revision', async () => {
    const refresh = deferred<ProcessDraftDTO>()
    get.mockResolvedValueOnce(detail()).mockReturnValueOnce(refresh.promise)
    renderEditor()
    const title = await screen.findByLabelText('草稿标题')
    fireEvent.click(screen.getByRole('button', {name: '重新读取服务器稿'}))
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    fireEvent.change(title, {target: {value: 'Edit made while reading'}})
    await act(async () => { refresh.resolve(detail({revision: 5, title: 'Persisted concurrent change'})) })

    expect(title).toHaveValue('Edit made while reading')
    expect(screen.getByRole('button', {name: '暂存修订 4'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button', {name: '查看并重载服务器修订 5'}))
    fireEvent.click(screen.getByRole('button', {name: '用修订 5 替换本地编辑'}))
    expect(title).toHaveValue('Persisted concurrent change')
  })

  it('handles a failed current refresh without hiding the saved draft', async () => {
    get.mockResolvedValueOnce(detail()).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderEditor()
    const title = await screen.findByLabelText('草稿标题')
    fireEvent.click(screen.getByRole('button', {name: '重新读取服务器稿'}))

    expect(await screen.findByText('暂时无法重新读取服务器稿。')).toBeInTheDocument()
    expect(title).toHaveValue(detail().title)
    expect(screen.getByRole('button', {name: '重新读取服务器稿'})).toBeEnabled()
  })

  it('keeps unknown save results queryable and only replays while the original body remains in memory', async () => {
    get.mockResolvedValueOnce(detail()).mockResolvedValueOnce(detail({commandReceipt: null}))
    save.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const rendered = renderEditor()
    await screen.findByLabelText('草稿标题')
    fireEvent.change(screen.getByLabelText('BPMN 模型 1 XML'), {target: {value: '<process id="unknown">'}})
    fireEvent.click(screen.getByRole('button', {name: /暂存修订 4/}))
    expect(await screen.findByText('原命令仍待确认。查询结果没有提供匹配回执，请保留原命令并稍后查证。')).toBeInTheDocument()
    const original = save.mock.calls[0]![2]
    expect(save).toHaveBeenCalledOnce()
    expect(get).toHaveBeenLastCalledWith('20', draftId, original.commandId, expect.any(AbortSignal))
    expect(JSON.stringify(sessionStorage)).not.toContain('<process id="unknown">')
    fireEvent.click(screen.getByRole('button', {name: '用同一命令重试'}))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save.mock.calls[1]?.[2]).toEqual(original)
    expect(get).toHaveBeenLastCalledWith('20', draftId, original.commandId, expect.any(AbortSignal))

    const pointer = JSON.parse(sessionStorage.getItem(`tianji.process-draft-editor.v1:20:${draftId}`)!)
    expect(pointer.commandId).toBe(original.commandId)
    rendered.unmount()
    renderEditor()
    expect(await screen.findByText('原暂存命令仍待确认。已恢复服务器已保存稿，未重放本地正文。')).toBeInTheDocument()
    expect(save).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenLastCalledWith('20', draftId, pointer.commandId, expect.any(AbortSignal))
    expect(screen.getByLabelText('BPMN 模型 1 XML')).toHaveValue(content.models?.[0]?.xml)
  })

  it('shows a matching old SAVE receipt beside the newer current server projection without replaying', async () => {
    const fingerprint = await actorFingerprint()
    const commandId = 'draft-save-original'
    const pointer = {version: 1, operation: 'SAVE', actorFingerprint: fingerprint, tenantId: '20', draftId,
      commandId, expectedRevision: 4, expectedContentSha256: hash, releaseVersion: null}
    sessionStorage.setItem(`tianji.process-draft-editor.v1:20:${draftId}`, JSON.stringify(pointer))
    const current = detail({revision: 6, contentSha256: 'f'.repeat(64), title: 'Current server title',
      lastCommandId: 'save:6', commandReceipt: {
        commandId, operation: 'SAVE', requestSha256: 'e'.repeat(64), resultRevision: 5,
        resultContentSha256: 'b'.repeat(64), releaseVersion: null, completedAt: TIME,
      },
    })
    get.mockResolvedValueOnce(current)
    renderEditor()

    expect(await screen.findByText(/原暂存命令已确认，原结果修订 5。当前稿为修订 6/)).toBeInTheDocument()
    expect(screen.getByLabelText('草稿标题')).toHaveValue('Current server title')
    expect(screen.getByText('当前为已保存修订')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(sessionStorage.getItem(`tianji.process-draft-editor.v1:20:${draftId}`)).toBeNull()
    expect(save).not.toHaveBeenCalled()
    expect(get).toHaveBeenCalledWith('20', draftId, commandId, expect.any(AbortSignal))
  })

  it('replays a recovered PUBLISH with its original revision, hash, target, and command id', async () => {
    const fingerprint = await actorFingerprint()
    const pointer = {version: 1, operation: 'PUBLISH', actorFingerprint: fingerprint, tenantId: '20', draftId,
      commandId: 'publish-original', expectedRevision: 4, expectedContentSha256: hash, releaseVersion: 'auto-5'}
    sessionStorage.setItem(`tianji.process-draft-editor.v1:20:${draftId}`, JSON.stringify(pointer))
    const newerCurrent = detail({revision: 5, contentSha256: 'e'.repeat(64), title: 'Another saved version',
      lastCommandId: 'save:5'})
    get.mockResolvedValueOnce(newerCurrent).mockResolvedValueOnce(newerCurrent)
    publish.mockRejectedValueOnce(new ApiError('revision changed', 409, 'TIANJI_DRAFT_VERSION_CONFLICT'))
    renderEditor()
    expect(await screen.findByText(/仍待确认/)).toBeInTheDocument()
    expect(screen.getByLabelText('草稿标题')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', {name: '用同一命令重试'}))

    await waitFor(() => expect(publish).toHaveBeenCalledOnce())
    expect(publish).toHaveBeenCalledWith('20', {
      draftId, expectedRevision: 4, expectedContentSha256: hash, releaseVersion: 'auto-5', commandId: 'publish-original',
    }, expect.any(AbortSignal))
    expect(sessionStorage.getItem(`tianji.process-draft-editor.v1:20:${draftId}`)).toBeNull()
  })

  it('blocks leaving a dirty editor and warns before unloading the browser page', async () => {
    const {router} = renderEditor()
    fireEvent.change(await screen.findByLabelText('草稿标题'), {target: {value: 'Unsaved title'}})
    const event = new Event('beforeunload', {cancelable: true})
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)

    await act(async () => { await router.navigate('/away') })
    expect(await screen.findByRole('dialog', {name: '离开草稿编辑'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '留在此页'}))
    expect(await screen.findByLabelText('草稿标题')).toHaveValue('Unsaved title')
    await act(async () => { await router.navigate('/away') })
    fireEvent.click(await screen.findByRole('button', {name: '离开此页'}))
    expect(await screen.findByRole('heading', {name: '离开页'})).toBeInTheDocument()
  })

  it('hides edit actions and performs no read when the editor page permission is absent', async () => {
    pageAllowed = false
    setAuthorization()
    renderEditor()

    expect(await screen.findByText('当前身份不能访问此草稿。')).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', {name: '暂存修订 4'})).not.toBeInTheDocument()
  })

  it('reports dirty draft edits to EmbeddedWorkbench leave guard across close and logout checks', async () => {
    const capturedPorts: WorkbenchPort[] = []
    const host: WorkbenchHost = {
      attach: port => { capturedPorts.push(port); return {ok: true} },
      reportCatalog: () => ({ok: true}),
      requestNavigation: () => ({ok: true}),
    }
    const tabKey = '["tianji","tianji.page.processDraftEditor","pd-1"]'
    const router = createMemoryRouter([
      {
        path: '/process-definitions/drafts/:draftId',
        element: (
          <EmbeddedWorkbench host={host} status="ready" pages={[]} onPresent={async () => ({ok: true as const})}>
            <ProcessDraftEditorPage />
          </EmbeddedWorkbench>
        ),
      },
    ], {initialEntries: [`/process-definitions/drafts/${draftId}`]})

    render(<RouterProvider router={router} />)
    await waitFor(() => expect(capturedPorts).toHaveLength(1))
    await act(async () => {
      await capturedPorts[0]!.present({
        mode: 'show',
        navigationId: 1,
        tabKey,
        target: {path: `/process-definitions/drafts/${draftId}`, search: ''},
        signal: new AbortController().signal,
      })
    })

    expect(await screen.findByLabelText('草稿标题')).toHaveValue('Order flow')
    expect(capturedPorts[0]!.checkLeave({reason: 'close', tabKey})).toEqual(
      expect.objectContaining({ok: true, dirty: false}),
    )

    fireEvent.change(screen.getByLabelText('草稿标题'), {target: {value: 'Edited embedded title'}})
    expect(capturedPorts[0]!.checkLeave({reason: 'close', tabKey})).toEqual(
      expect.objectContaining({ok: true, dirty: true}),
    )
    expect(capturedPorts[0]!.checkLeave({reason: 'logout'})).toEqual(
      expect.objectContaining({ok: true, dirty: true}),
    )
  })
})
