import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {memoryPreferencesApi, type PreferencePreparation} from '../api/memoryPreferences'
import {useAuth} from '../auth/AuthContext'
import {authorization} from '../test/fixtures'
import {preferencePreparation, preferenceResult} from '../test/preferenceFixtures'
import MemoryPreferenceAction from './MemoryPreferenceAction'
import {resourceRegistry} from '../permissions/registry'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/memoryPreferences', () => ({memoryPreferencesApi: {prepare: vi.fn(), extract: vi.fn()}}))
const auth = (tenant = '20', allowed = true) => ({status: 'ready' as const, authorization: authorization(tenant, ['TIANJI_AGENT_READ', 'TIANJI_MEMORY_READ', 'TIANJI_MEMORY_WRITE']),
  allows: (key: string) => key !== 'tianji.button.runDetail.extractPreferences' || allowed, login: () => {}, logout: async () => {}, retry: async () => {}})
const view = (completed = true, event: string | null = 'terminal-1') => <MemoryRouter><MemoryPreferenceAction runId="run-1" completed={completed} sourceEventId={event ?? undefined} /></MemoryRouter>
const prepare = async () => {
  fireEvent.click(screen.getByRole('button', {name: '提取偏好候选'})); fireEvent.change(screen.getByLabelText('业务范围'), {target: {value: 'research'}})
  fireEvent.click(screen.getByRole('button', {name: '核对偏好来源'})); await screen.findByText(/识别到 1 条显式偏好/)
}

describe('Explicit preference candidates', () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.mocked(useAuth).mockReturnValue(auth()); vi.mocked(memoryPreferencesApi.prepare).mockResolvedValue(preferencePreparation())
    vi.mocked(memoryPreferencesApi.extract).mockResolvedValue(preferenceResult())
  })

  it('requires permission, successful completion and an actual terminal event before preparation', () => {
    vi.mocked(useAuth).mockReturnValue(auth('20', false)); const current = render(view()); expect(screen.queryByRole('button', {name: '提取偏好候选'})).not.toBeInTheDocument()
    vi.mocked(useAuth).mockReturnValue(auth()); current.rerender(view(false)); expect(screen.queryByRole('button', {name: '提取偏好候选'})).not.toBeInTheDocument()
    current.rerender(view(true, null)); expect(screen.getByRole('button', {name: '提取偏好候选'})).toBeDisabled(); expect(memoryPreferencesApi.prepare).not.toHaveBeenCalled()
    const withoutReview = authorization('20', ['TIANJI_AGENT_READ', 'TIANJI_MEMORY_WRITE'])
    expect(resourceRegistry.canAccessResource('tianji.button.runDetail.extractPreferences', withoutReview.snapshot, withoutReview.binding)).toBe(false)
  })

  it('derives personal ownership and requires explicit confirmation after read-only preparation', async () => {
    render(view()); await prepare(); expect(memoryPreferencesApi.extract).not.toHaveBeenCalled()
    expect(memoryPreferencesApi.prepare).toHaveBeenCalledWith('20', {owner: {type: 'USER', id: 'subject-20'}, scopeId: 'research', runId: 'run-1', sourceEventId: 'terminal-1'}, expect.any(AbortSignal))
    expect(screen.queryByLabelText('policyRef')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', {name: '生成未确认候选'}))
    await waitFor(() => expect(memoryPreferencesApi.extract).toHaveBeenCalledTimes(1))
    expect(memoryPreferencesApi.extract).toHaveBeenCalledWith('20', preferencePreparation().command, ['language'], expect.any(AbortSignal))
    expect(await screen.findByText(/偏好请求已处理/)).toBeInTheDocument()
  })

  it('preserves the exact source command and scope freeze across an uncertain write and detail refresh', async () => {
    vi.mocked(memoryPreferencesApi.extract).mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce(preferenceResult())
    const current = render(view()); await prepare(); fireEvent.click(screen.getByRole('button', {name: '生成未确认候选'}))
    expect(await screen.findByText(/处理结果暂时未知/)).toBeInTheDocument(); expect(screen.getByLabelText('业务范围')).toBeDisabled()
    current.rerender(view(false, null))
    await waitFor(() => expect(screen.getByRole('button', {name: /重试原请求/})).not.toHaveClass('ant-btn-loading'))
    fireEvent.click(screen.getByRole('button', {name: /重试原请求/})); await waitFor(() => expect(memoryPreferencesApi.extract).toHaveBeenCalledTimes(2))
    expect(vi.mocked(memoryPreferencesApi.extract).mock.calls[1].slice(0, 3)).toEqual(vi.mocked(memoryPreferencesApi.extract).mock.calls[0].slice(0, 3))
    expect(memoryPreferencesApi.prepare).toHaveBeenCalledTimes(1)
  })

  it('aborts preparation and ignores an old identity result after switching tenant', async () => {
    let finish: ((value: PreferencePreparation) => void) | undefined
    vi.mocked(memoryPreferencesApi.prepare).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const current = render(view()); fireEvent.click(screen.getByRole('button', {name: '提取偏好候选'})); fireEvent.change(screen.getByLabelText('业务范围'), {target: {value: 'research'}})
    fireEvent.click(screen.getByRole('button', {name: '核对偏好来源'})); await waitFor(() => expect(finish).toBeDefined())
    const signal = vi.mocked(memoryPreferencesApi.prepare).mock.calls[0][2]; vi.mocked(useAuth).mockReturnValue(auth('21')); current.rerender(view())
    expect(signal?.aborted).toBe(true); await act(async () => { finish?.(preferencePreparation()); await Promise.resolve() })
    expect(screen.queryByText(/识别到 1 条显式偏好/)).not.toBeInTheDocument(); expect(memoryPreferencesApi.extract).not.toHaveBeenCalled()
  })

  it('requires a new source check after a rejected write and keeps it separate from another mutation', async () => {
    vi.mocked(memoryPreferencesApi.extract).mockRejectedValueOnce(new ApiError('source changed', 409, 'TIANJI_IDEMPOTENCY_CONFLICT'))
    render(view()); await prepare(); fireEvent.click(screen.getByRole('button', {name: '生成未确认候选'}))
    expect(await screen.findByText(/来源、策略或权限可能已变化/)).toBeInTheDocument(); expect(screen.getByRole('button', {name: /重试原请求/})).toBeDisabled()
    fireEvent.click(screen.getByRole('button', {name: '重新核对来源'})); expect(memoryPreferencesApi.extract).toHaveBeenCalledTimes(1)
    expect(memoryPreferencesApi.prepare).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', {name: /生成未确认候选/})).toBeDisabled()
  })
})
