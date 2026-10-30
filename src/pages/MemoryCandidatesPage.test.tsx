import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {memoryApi, type MemoryCandidatePage, type ReviewCommand} from '../api/memory'
import {useAuth} from '../auth/AuthContext'
import {resourceRegistry} from '../permissions/registry'
import {authorization} from '../test/fixtures'
import {candidate} from '../test/memoryFixtures'
import {memoryMergeApi, type MemoryMergePage} from '../api/memoryMerge'
import {memoryMergePage} from '../test/memoryMergeFixtures'
import MemoryCandidatesPage from './MemoryCandidatesPage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/memoryMerge', () => ({memoryMergeApi: {compare: vi.fn()}}))
vi.mock('../api/memory', async original => {
  const actual = await original<typeof import('../api/memory')>()
  return {...actual, memoryApi: {candidates: vi.fn(), confirm: vi.fn(), reject: vi.fn()}}
})
const auth = (tenant = '20', write = true) => ({status: 'ready' as const, authorization: authorization(tenant, ['TIANJI_MEMORY_READ', ...(write ? ['TIANJI_MEMORY_WRITE', 'TIANJI_MEMORY_FORGET'] : [])]),
  allows: (key: string) => !['tianji.button.memoryCandidates.confirm', 'tianji.button.memoryCandidates.reject'].includes(key) || write, login: () => {}, logout: async () => {}, retry: async () => {}})
const page = (tenant = '20'): MemoryCandidatePage => ({owner: {type: 'USER', id: `subject-${tenant}`}, scopeId: 'research', items: [candidate(`candidate-${tenant}`, tenant)], nextAfterMemoryId: null})
const search = async () => {
  fireEvent.change(screen.getByLabelText('业务范围'), {target: {value: 'research'}})
  fireEvent.click(screen.getByRole('button', {name: '读取候选'}))
  await screen.findByText(/候选内容 candidate-/)
}

describe('Memory candidate review', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(useAuth).mockReturnValue(auth()); vi.mocked(memoryApi.candidates).mockResolvedValue(page()) })

  it('requires an explicit scope, derives personal ownership and hides unauthorized mutation actions', async () => {
    vi.mocked(useAuth).mockReturnValue(auth('20', false)); render(<MemoryCandidatesPage />)
    expect(memoryApi.candidates).not.toHaveBeenCalled(); await search()
    expect(memoryApi.candidates).toHaveBeenCalledWith('20', {owner: {type: 'USER', id: 'subject-20'}, scopeId: 'research', kind: null, afterMemoryId: null, limit: 20}, expect.any(AbortSignal))
    expect(screen.queryByRole('button', {name: '确认'})).not.toBeInTheDocument(); expect(screen.queryByRole('button', {name: '丢弃'})).not.toBeInTheDocument()
    expect(screen.getByRole('button', {name: /^比\s*较$/})).toBeInTheDocument()
    const current = authorization('20', ['TIANJI_MEMORY_READ'])
    expect(resourceRegistry.canAccessResource('tianji.app.console', current.snapshot, current.binding)).toBe(true)
    expect(resourceRegistry.canAccessResource('tianji.page.memoryCandidates', current.snapshot, current.binding)).toBe(true)
    expect(resourceRegistry.canAccessResource('tianji.button.memoryCandidates.confirm', current.snapshot, current.binding)).toBe(false)
    expect(resourceRegistry.canAccessResource('tianji.button.memoryCandidates.compare', current.snapshot, current.binding)).toBe(true)
  })

  it('confirms only explicitly reviewed content and keeps its exact command on an uncertain retry', async () => {
    vi.mocked(memoryApi.confirm).mockRejectedValueOnce(new Error('connection lost')).mockImplementationOnce(async (_, command: ReviewCommand) => ({commandId: command.commandId, owner: command.owner,
      scopeId: command.scopeId, memoryId: command.memoryId, revision: 2, outcome: 'CORRECTED', stateAtMutation: 'ACTIVE', occurredAt: '2026-10-31T00:00:00Z'}))
    render(<MemoryCandidatesPage />); await search(); fireEvent.click(screen.getByRole('button', {name: '确认'}))
    expect(memoryApi.confirm).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', {name: '确认并保留'}))
    expect(await screen.findByText(/提交结果暂时未知/)).toBeInTheDocument()
    const command = vi.mocked(memoryApi.confirm).mock.calls[0][1]
    expect(command.expectedRevision).toBe(1); expect(command.content).toEqual(candidate('candidate-20').content); expect(command.confidence).toBe(1)
    expect(command.source).toEqual({reference: 'human-review:candidate-20', evidenceSha256: 'a'.repeat(64), sourceRunId: null, sourceEventId: null})
    expect(screen.getByRole('button', {name: '刷新候选'})).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', {name: /重试同一操作/})).not.toHaveClass('ant-btn-loading'))
    fireEvent.click(screen.getByRole('button', {name: /重试同一操作/}))
    await waitFor(() => expect(memoryApi.confirm).toHaveBeenCalledTimes(2)); expect(vi.mocked(memoryApi.confirm).mock.calls[1][1]).toEqual(command)
    await waitFor(() => expect(screen.getByRole('button', {name: '刷新候选'})).not.toBeDisabled())
    expect(memoryApi.candidates).toHaveBeenCalledTimes(2)
  })

  it('requires a fresh read after a revision conflict and does not retry the rejected command', async () => {
    vi.mocked(memoryApi.confirm).mockRejectedValueOnce(new ApiError('revision changed', 409, 'TIANJI_MEMORY_CONFLICT'))
    render(<MemoryCandidatesPage />); await search(); fireEvent.click(screen.getByRole('button', {name: '确认'}))
    fireEvent.click(screen.getByRole('button', {name: '确认并保留'}))
    expect(await screen.findByText(/候选版本或权限可能已变化/)).toBeInTheDocument()
    expect(screen.getByRole('button', {name: /重试同一操作/})).toBeDisabled()
    fireEvent.click(screen.getByRole('button', {name: '重新读取并审阅'}))
    await waitFor(() => expect(memoryApi.candidates).toHaveBeenCalledTimes(2)); expect(memoryApi.confirm).toHaveBeenCalledTimes(1)
  })

  it('discards through the separate revision-checked forget command and never calls confirmation', async () => {
    vi.mocked(memoryApi.reject).mockImplementation(async (_, command) => ({commandId: command.commandId, owner: command.owner, scopeId: command.scopeId, memoryId: command.memoryId,
      revision: 2, outcome: 'FORGOTTEN', stateAtMutation: 'FORGOTTEN', occurredAt: '2026-10-31T00:00:00Z'}))
    render(<MemoryCandidatesPage />); await search(); fireEvent.click(screen.getByRole('button', {name: '丢弃'})); fireEvent.click(screen.getByRole('button', {name: '确认丢弃'}))
    await waitFor(() => expect(memoryApi.reject).toHaveBeenCalledTimes(1)); expect(vi.mocked(memoryApi.reject).mock.calls[0][1]).toMatchObject({memoryId: 'candidate-20', expectedRevision: 1, reasonCode: 'USER_REJECTED_CANDIDATE'})
    expect(memoryApi.confirm).not.toHaveBeenCalled()
  })

  it('does not render a late result from a previous identity or tenant', async () => {
    let finish: ((value: MemoryCandidatePage) => void) | undefined
    vi.mocked(memoryApi.candidates).mockImplementation(tenant => tenant === '20' ? new Promise(resolve => { finish = resolve }) : Promise.resolve(page('21')))
    const current = render(<MemoryCandidatesPage />)
    fireEvent.change(screen.getByLabelText('业务范围'), {target: {value: 'research'}}); fireEvent.click(screen.getByRole('button', {name: '读取候选'}))
    await waitFor(() => expect(finish).toBeDefined()); vi.mocked(useAuth).mockReturnValue(auth('21')); current.rerender(<MemoryCandidatesPage />); await search()
    await act(async () => { finish?.(page()); await Promise.resolve() })
    expect(screen.queryByText('候选内容 candidate-20')).not.toBeInTheDocument(); expect(screen.getByText('候选内容 candidate-21')).toBeInTheDocument()
  })

  it('closes and aborts a comparison when the owning identity changes', async () => {
    let finish: ((value: MemoryMergePage) => void) | undefined
    vi.mocked(memoryMergeApi.compare).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const current = render(<MemoryCandidatesPage />); await search(); fireEvent.click(screen.getByRole('button', {name: /^比\s*较$/}))
    await waitFor(() => expect(finish).toBeDefined()); const signal = vi.mocked(memoryMergeApi.compare).mock.calls[0][3]
    vi.mocked(useAuth).mockReturnValue(auth('21')); current.rerender(<MemoryCandidatesPage />); expect(signal?.aborted).toBe(true)
    await act(async () => { finish?.(memoryMergePage(candidate('candidate-20'))); await Promise.resolve() })
    expect(screen.queryByText('已有事实 active-a')).not.toBeInTheDocument(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
