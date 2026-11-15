import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {ActivationPageDTO, AutomationActivationDTO} from '../api/processActivations'
import {processActivationsApi} from '../api/processActivations'
import {useAuth} from '../auth/AuthContext'
import {authorization} from '../test/fixtures'
import ProcessActivationPanel from './ProcessActivationPanel'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/processActivations', async original => {
  const actual = await original<typeof import('../api/processActivations')>()
  return {...actual, processActivationsApi: {...actual.processActivationsApi, list: vi.fn(), activate: vi.fn()}}
})

const READ = 'tianji.page.processReleases'
const ACTIVATE = 'tianji.button.processActivation.activate'
const TIME = '2026-11-14T10:30:00.123456Z'
const definitionKey = 'orderFlow'
const releaseVersion = 'auto-7'
const commandId = 'activate-1'
const receipt = (expectedActivationRevision: number, version = releaseVersion): AutomationActivationDTO => ({
  definitionKey,
  releaseVersion: version,
  expectedActivationRevision,
  commandId,
  revision: expectedActivationRevision + 1,
  previousRevision: expectedActivationRevision === 0 ? null : expectedActivationRevision,
  activatedAt: TIME,
  sourceManifestSha256: 'a'.repeat(64),
  compiledManifestSha256: 'b'.repeat(64),
  dependencyManifestSha256: 'c'.repeat(64),
})
const current = {revision: 5, releaseVersion: 'auto-6', activatedAt: TIME}
const page = (overrides: Partial<ActivationPageDTO> = {}): ActivationPageDTO => ({
  definitionKey, observedAt: TIME, current, items: [], nextCursor: null, ...overrides,
})
const list = vi.mocked(processActivationsApi.list)
const activate = vi.mocked(processActivationsApi.activate)
const ownerHash = async () => {
  const actor = authorization('20', []).identity
  const bytes = new TextEncoder().encode(JSON.stringify(['TIANJI_PROCESS_ACTIVATION_OWNER_V1', actor.issuer, actor.subject]))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

const auth = (tenant = '20', permissions: readonly string[] = ['TIANJI_PROCESS_RELEASE_READ'],
              resources: readonly string[] = [READ]) => {
  const frame = authorization(tenant, [...permissions])
  return {
    status: 'ready' as const,
    authorization: frame,
    allows: (resource: string) => resources.includes(resource),
    login: () => {}, logout: async () => {}, retry: async () => {},
  }
}
let currentAuth = auth()

describe('Process activation panel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    sessionStorage.clear()
    currentAuth = auth()
    vi.mocked(useAuth).mockImplementation(() => currentAuth)
    list.mockResolvedValue(page())
    activate.mockImplementation(async (_tenant, _definition, command) => receipt(command.expectedActivationRevision))
  })

  it('reads the current pointer and leaves a distinct published target inactive', async () => {
    render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)

    expect(await screen.findByText('当前生效版本')).toBeInTheDocument()
    expect(await screen.findByText('auto-6')).toBeInTheDocument()
    expect(screen.getByText(/18:30:00/)).toHaveAttribute('title', TIME)
    expect(screen.getByText(/18:30:00/)).toHaveAttribute('datetime', TIME)
    expect(screen.getByText('待生效发布版本')).toBeInTheDocument()
    expect(screen.getAllByText(releaseVersion)).toHaveLength(2)
    expect(screen.queryByRole('button', {name: '设为生效'})).not.toBeInTheDocument()
    expect(list).toHaveBeenCalledWith('20', definitionKey, {limit: 20}, expect.any(AbortSignal))
    expect(activate).not.toHaveBeenCalled()
  })

  it('does not claim a missing activation when the current-state read fails', async () => {
    list.mockRejectedValueOnce(new ApiError('unavailable', 503, 'UNAVAILABLE'))
    render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)

    expect(await screen.findByText('暂时无法读取当前生效版本。')).toBeInTheDocument()
    expect(screen.queryByText('当前未生效')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '设为生效'})).not.toBeInTheDocument()
  })

  it('shows a real empty activation history for a readable definition', async () => {
    list.mockResolvedValueOnce(page({current: null}))
    render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)

    expect(await screen.findByText('当前未生效')).toBeInTheDocument()
    expect(screen.getAllByText(releaseVersion)).toHaveLength(2)
    expect(screen.queryByRole('button', {name: '设为生效'})).not.toBeInTheDocument()
  })

  it('paginates activation history and returns to the first page when the cursor expires', async () => {
    list.mockResolvedValueOnce(page({items: [receipt(3)], nextCursor: 'older_4'}))
      .mockResolvedValueOnce(page({items: [{...receipt(2, 'auto-3'), commandId: 'activate-3'}], nextCursor: 'older_3'}))
      .mockRejectedValueOnce(new ApiError('cursor expired', 400, 'TIANJI_INVALID_COMMAND'))
      .mockResolvedValueOnce(page({items: [receipt(3)], nextCursor: 'older_4'}))
    render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)
    expect(await screen.findByText('修订 4')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', {name: '更多生效历史'}))
    expect(await screen.findByText('修订 3')).toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith('20', definitionKey, {limit: 20, cursor: 'older_4'}, expect.any(AbortSignal))

    fireEvent.click(screen.getByRole('button', {name: '更多生效历史'}))
    expect(await screen.findByText('修订 4')).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '历史首页'})).not.toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith('20', definitionKey, {limit: 20}, expect.any(AbortSignal))
  })

  it('uses the initial revision zero only after a fresh read and explicit confirmation', async () => {
    currentAuth = auth('20', ['TIANJI_PROCESS_RELEASE_READ', 'TIANJI_PROCESS_RELEASE_ACTIVATE'],
      [READ, ACTIVATE])
    list.mockResolvedValueOnce(page({current: null})).mockResolvedValueOnce(page({
      current: {revision: 1, releaseVersion, activatedAt: TIME}, items: [receipt(0)],
    }))
    render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)
    await screen.findByText('当前未生效')

    fireEvent.click(screen.getByRole('button', {name: '设为生效'}))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    activate.mockImplementationOnce(async (_tenant, _definition, command) => {
      const stored = sessionStorage.getItem('tianji.process-activation.v1:20:orderFlow')
      expect(stored).not.toBeNull()
      expect(JSON.parse(stored!).commandId).toBe(command.commandId)
      return receipt(command.expectedActivationRevision)
    })
    fireEvent.click(screen.getByRole('button', {name: '确认生效'}))

    await waitFor(() => expect(activate).toHaveBeenCalledOnce())
    expect(activate).toHaveBeenCalledWith('20', definitionKey, {
      releaseVersion, expectedActivationRevision: 0, commandId: expect.stringMatching(/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/),
    }, expect.any(AbortSignal))
    expect(await screen.findByText('此命令已生效')).toBeInTheDocument()
    expect(screen.getByText('命令生效版本')).toBeInTheDocument()
    expect(screen.getByText('当前生效版本')).toBeInTheDocument()
  })

  it('uses the current observed revision and calls out a replaced base version', async () => {
    currentAuth = auth('20', ['TIANJI_PROCESS_RELEASE_READ', 'TIANJI_PROCESS_RELEASE_ACTIVATE'],
      [READ, ACTIVATE])
    render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion}
      baseReleaseVersion="auto-5" />)
    await screen.findByText('auto-6')
    expect(screen.getByText(/当前生效版本与此草稿的来源版本不同/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '设为生效'}))
    fireEvent.click(screen.getByRole('button', {name: '确认生效'}))
    await waitFor(() => expect(activate).toHaveBeenCalledOnce())
    expect(activate.mock.calls[0]?.[2]).toMatchObject({expectedActivationRevision: 5, releaseVersion})
  })

  it('rejects a confirmation when the current pointer changes before submission', async () => {
    currentAuth = auth('20', ['TIANJI_PROCESS_RELEASE_READ', 'TIANJI_PROCESS_RELEASE_ACTIVATE'],
      [READ, ACTIVATE])
    list.mockResolvedValueOnce(page()).mockResolvedValueOnce(page({
      current: {revision: 6, releaseVersion: 'auto-8', activatedAt: TIME},
    }))
    render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)
    expect(await screen.findByText('auto-6')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', {name: '设为生效'}))
    expect(screen.getByText('确认时的当前生效修订：5')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '重新读取'}))

    expect(await screen.findByText('auto-8')).toBeInTheDocument()
    expect(screen.getByRole('button', {name: '确认生效'})).toBeDisabled()
    expect(activate).not.toHaveBeenCalled()
  })

  it('keeps the prior activation receipt and current pointer distinct', async () => {
    currentAuth = auth('20', ['TIANJI_PROCESS_RELEASE_READ', 'TIANJI_PROCESS_RELEASE_ACTIVATE'],
      [READ, ACTIVATE])
    const prior = receipt(3)
    const intent = {
      version: 1, operation: 'ACTIVATE', actorFingerprint: await ownerHash(), tenantId: '20', definitionKey,
      releaseVersion, expectedActivationRevision: 3, commandId,
    }
    sessionStorage.setItem('tianji.process-activation.v1:20:orderFlow', JSON.stringify(intent))
    list.mockResolvedValueOnce(page({items: [prior]}))
    render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)

    expect(await screen.findByText('当前生效版本')).toBeInTheDocument()
    expect(await screen.findByText('auto-6')).toBeInTheDocument()
    expect(list.mock.calls.map(call => call[2])).toContainEqual({commandId})
    expect(await screen.findByText('此命令已生效')).toBeInTheDocument()
    expect(screen.getByText('修订 5')).toBeInTheDocument()
    expect(screen.getAllByText('修订 4')).toHaveLength(2)
    expect(activate).not.toHaveBeenCalled()
  })

  it('preserves the same activation command when the POST result is unknown', async () => {
    currentAuth = auth('20', ['TIANJI_PROCESS_RELEASE_READ', 'TIANJI_PROCESS_RELEASE_ACTIVATE'],
      [READ, ACTIVATE])
    activate.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    list.mockResolvedValueOnce(page()).mockResolvedValueOnce(page({items: []}))
    render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)
    await screen.findByText('auto-6')
    fireEvent.click(screen.getByRole('button', {name: '设为生效'}))
    fireEvent.click(screen.getByRole('button', {name: '确认生效'}))
    expect(await screen.findByText('生效结果尚未确认')).toBeInTheDocument()
    const serialized = sessionStorage.getItem('tianji.process-activation.v1:20:orderFlow')
    expect(serialized).not.toBeNull()
    const command = JSON.parse(serialized!)
    expect(list).toHaveBeenLastCalledWith('20', definitionKey, {commandId: expect.any(String)}, expect.any(AbortSignal))
    expect(activate).toHaveBeenCalledTimes(1)
    expect(activate.mock.calls[0]?.[2].commandId).toBe(command.commandId)
    expect(activate.mock.calls[0]?.[2].expectedActivationRevision).toBe(5)
    await waitFor(() => expect(screen.getByRole('button', {name: '设为生效'})).toBeDisabled())

    list.mockResolvedValueOnce(page({current: {revision: 7, releaseVersion: 'auto-9', activatedAt: TIME}}))
    fireEvent.click(screen.getByRole('button', {name: '重新读取'}))
    expect(await screen.findByText('auto-9')).toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith('20', definitionKey, {limit: 20}, expect.any(AbortSignal))
    expect(screen.getByText('生效结果尚未确认')).toBeInTheDocument()
    expect(sessionStorage.getItem('tianji.process-activation.v1:20:orderFlow')).toBe(serialized)
    expect(activate).toHaveBeenCalledOnce()
  })

  it('looks up an old command without treating its receipt as the current pointer', async () => {
    currentAuth = auth('20', ['TIANJI_PROCESS_RELEASE_READ', 'TIANJI_PROCESS_RELEASE_ACTIVATE'],
      [READ, ACTIVATE])
    const intent = {
      version: 1, operation: 'ACTIVATE', actorFingerprint: await ownerHash(), tenantId: '20', definitionKey,
      releaseVersion, expectedActivationRevision: 3, commandId,
    }
    sessionStorage.setItem('tianji.process-activation.v1:20:orderFlow', JSON.stringify(intent))
    list.mockResolvedValueOnce(page({items: [receipt(3)]}))
    render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion="auto-8" />)

    expect(await screen.findByText('auto-6')).toBeInTheDocument()
    expect(screen.getByText('命令生效版本')).toBeInTheDocument()
    expect(screen.getByText('此命令已生效')).toBeInTheDocument()
    expect(activate).not.toHaveBeenCalled()
  })

  it('requires read permission to issue any query or mutation', async () => {
    currentAuth = auth('20', ['TIANJI_PROCESS_RELEASE_ACTIVATE'], [READ, ACTIVATE])
    const rendered = render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)
    expect(await screen.findByText('当前无法查看流程生效状态。')).toBeInTheDocument()
    expect(list).not.toHaveBeenCalled()
    expect(activate).not.toHaveBeenCalled()

    rendered.unmount()
    currentAuth = auth('20', ['TIANJI_PROCESS_RELEASE_READ', 'TIANJI_PROCESS_RELEASE_ACTIVATE'],
      [READ, ACTIVATE])
    list.mockRejectedValueOnce(new ApiError('forbidden', 403, 'FORBIDDEN'))
    render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)
    expect(await screen.findByText('当前无法查看流程生效记录。')).toBeInTheDocument()
  })

  it('keeps current-state reads available when session storage cannot be read', async () => {
    currentAuth = auth('20', ['TIANJI_PROCESS_RELEASE_READ', 'TIANJI_PROCESS_RELEASE_ACTIVATE'],
      [READ, ACTIVATE])
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)

    expect(await screen.findByText('auto-6')).toBeInTheDocument()
    expect(list).toHaveBeenCalledWith('20', definitionKey, {limit: 20}, expect.any(AbortSignal))
    expect(screen.getByRole('button', {name: '设为生效'})).toBeDisabled()
    expect(activate).not.toHaveBeenCalled()
    getItem.mockRestore()
  })

  it('uses a known CAS rejection to reload the current pointer before allowing a new command', async () => {
    currentAuth = auth('20', ['TIANJI_PROCESS_RELEASE_READ', 'TIANJI_PROCESS_RELEASE_ACTIVATE'],
      [READ, ACTIVATE])
    activate.mockRejectedValueOnce(new ApiError('version changed', 409, 'TIANJI_PROCESS_VERSION_CONFLICT'))
    list.mockResolvedValueOnce(page()).mockResolvedValueOnce(page({
      current: {revision: 6, releaseVersion: 'auto-8', activatedAt: TIME},
    }))
    render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)
    await screen.findByText('auto-6')
    fireEvent.click(screen.getByRole('button', {name: '设为生效'}))
    fireEvent.click(screen.getByRole('button', {name: '确认生效'}))

    expect(await screen.findByText('auto-8')).toBeInTheDocument()
    expect(screen.getByText('当前生效版本已变化。已重新读取当前状态，请再次确认后使用新命令。')).toBeInTheDocument()
    expect(sessionStorage.getItem('tianji.process-activation.v1:20:orderFlow')).toBeNull()
    expect(activate).toHaveBeenCalledOnce()
  })

  it('keeps an idempotency conflict unresolved instead of creating a fresh command', async () => {
    currentAuth = auth('20', ['TIANJI_PROCESS_RELEASE_READ', 'TIANJI_PROCESS_RELEASE_ACTIVATE'],
      [READ, ACTIVATE])
    activate.mockRejectedValueOnce(new ApiError('idempotency conflict', 409, 'TIANJI_IDEMPOTENCY_CONFLICT'))
    list.mockResolvedValueOnce(page()).mockResolvedValueOnce(page({items: []}))
    render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)
    expect(await screen.findByText('auto-6')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '设为生效'}))
    fireEvent.click(screen.getByRole('button', {name: '确认生效'}))

    expect(await screen.findByText('生效结果尚未确认')).toBeInTheDocument()
    const original = JSON.parse(sessionStorage.getItem('tianji.process-activation.v1:20:orderFlow')!)
    expect(list.mock.calls.map(call => call[2])).toContainEqual({commandId: original.commandId})
    expect(screen.getByRole('button', {name: '设为生效'})).toBeDisabled()
    expect(activate).toHaveBeenCalledTimes(1)
  })

  it('ignores a late read from an earlier tenant with the same definition and release', async () => {
    let finishOld!: (value: ActivationPageDTO) => void
    list.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    const rendered = render(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)
    await waitFor(() => expect(finishOld).toBeDefined())
    currentAuth = auth('21')
    rendered.rerender(<ProcessActivationPanel definitionKey={definitionKey} releaseVersion={releaseVersion} />)
    await act(async () => { finishOld(page({current: null})) })
    expect(screen.queryByText('当前未生效')).not.toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith('21', definitionKey, {limit: 20}, expect.any(AbortSignal))
  })
})
