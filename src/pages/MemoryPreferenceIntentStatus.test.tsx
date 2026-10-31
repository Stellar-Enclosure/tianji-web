import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {memoryPreferenceIntentsApi, type PreferenceIntentStatus} from '../api/memoryPreferenceIntents'
import {useAuth} from '../auth/AuthContext'
import {resourceRegistry} from '../permissions/registry'
import {authorization} from '../test/fixtures'
import {preferenceIntentCancellation, preferenceIntentQuery, preferenceIntentStatus} from '../test/preferenceIntentFixtures'
import MemoryPreferenceIntentStatusCard from './MemoryPreferenceIntentStatus'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/memoryPreferenceIntents', async () => {
  const actual = await vi.importActual<typeof import('../api/memoryPreferenceIntents')>('../api/memoryPreferenceIntents')
  return {...actual, memoryPreferenceIntentsApi: {status: vi.fn(), cancel: vi.fn()}}
})
const VIEW = 'tianji.button.runDetail.preferenceIntentStatus', CANCEL = 'tianji.button.runDetail.cancelPreferenceIntent'
const auth = (tenant = '20', view = true, cancel = true) => ({status: 'ready' as const, authorization: authorization(tenant, ['TIANJI_AGENT_READ', 'TIANJI_MEMORY_READ', 'TIANJI_MEMORY_FORGET']),
  allows: (key: string) => key === VIEW ? view : key === CANCEL ? cancel : true, login: () => {}, logout: async () => {}, retry: async () => {}})
const view = (available = true) => <MemoryRouter><MemoryPreferenceIntentStatusCard runId="run-1" available={available} /></MemoryRouter>
const lookup = async () => {
  fireEvent.change(screen.getByLabelText('提取范围'), {target: {value: 'research'}}); fireEvent.click(screen.getByRole('button', {name: '查询提取状态'})); await screen.findByText('等待处理')
}
const confirm = async () => {
  fireEvent.click(screen.getByRole('button', {name: '停止后续提取'})); await screen.findByRole('button', {name: '确认停止提取'}); fireEvent.click(screen.getByRole('button', {name: '确认停止提取'}))
}

describe('Owned background preference progress', () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.mocked(useAuth).mockReturnValue(auth()); vi.mocked(memoryPreferenceIntentsApi.status).mockResolvedValue(preferenceIntentStatus())
    vi.mocked(memoryPreferenceIntentsApi.cancel).mockImplementation(async (_, command) => preferenceIntentCancellation(command.commandId))
  })

  it('uses explicit source lookup for a running run and separates status and cancellation permissions', async () => {
    vi.mocked(useAuth).mockReturnValue(auth('20', false)); const current = render(view()); expect(screen.queryByText('后台偏好提取')).not.toBeInTheDocument()
    vi.mocked(useAuth).mockReturnValue(auth('20', true, false)); current.rerender(view()); expect(memoryPreferenceIntentsApi.status).not.toHaveBeenCalled(); await lookup()
    expect(memoryPreferenceIntentsApi.status).toHaveBeenCalledWith('20', preferenceIntentQuery(), expect.any(AbortSignal)); expect(screen.queryByRole('button', {name: '停止后续提取'})).not.toBeInTheDocument()
    const withoutRead = authorization('20', ['TIANJI_AGENT_READ', 'TIANJI_MEMORY_FORGET'])
    expect(resourceRegistry.canAccessResource(VIEW, withoutRead.snapshot, withoutRead.binding)).toBe(false)
    expect(resourceRegistry.canAccessResource(CANCEL, withoutRead.snapshot, withoutRead.binding)).toBe(false)
  })

  it('requires explicit stop confirmation and preserves existing candidates and the Agent run', async () => {
    render(view()); await lookup(); fireEvent.click(screen.getByRole('button', {name: '停止后续提取'}))
    expect(memoryPreferenceIntentsApi.cancel).not.toHaveBeenCalled(); expect(await screen.findByText(/已提交的候选不会删除/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '确认停止提取'})); expect(await screen.findByText(/Agent 运行不会因此取消/)).toBeInTheDocument()
    expect(memoryPreferenceIntentsApi.cancel).toHaveBeenCalledWith('20', expect.objectContaining({...preferenceIntentQuery(), expectedRevision: 3, commandId: expect.any(String)}), expect.any(AbortSignal))
    expect(screen.getByText('已停止')).toBeInTheDocument(); expect(screen.queryByRole('button', {name: '停止后续提取'})).not.toBeInTheDocument()
  })

  it('freezes scope and refresh after an unknown stop and reuses its exact command across detail refresh', async () => {
    vi.mocked(memoryPreferenceIntentsApi.cancel).mockRejectedValueOnce(new Error('reply lost')).mockImplementationOnce(async (_, command) => preferenceIntentCancellation(command.commandId))
    const current = render(view()); await lookup(); await confirm(); expect(await screen.findByText(/停止结果暂时未知/)).toBeInTheDocument()
    expect(screen.getByLabelText('提取范围')).toBeDisabled(); expect(screen.getByRole('button', {name: '查询提取状态'})).toBeDisabled()
    current.rerender(view(false)); await waitFor(() => expect(screen.getByRole('button', {name: /重试原停止请求/})).not.toHaveClass('ant-btn-loading'))
    fireEvent.click(screen.getByRole('button', {name: /重试原停止请求/})); await screen.findByText(/Agent 运行不会因此取消/)
    expect(vi.mocked(memoryPreferenceIntentsApi.cancel).mock.calls[1].slice(0, 2)).toEqual(vi.mocked(memoryPreferenceIntentsApi.cancel).mock.calls[0].slice(0, 2))
    expect(memoryPreferenceIntentsApi.status).toHaveBeenCalledTimes(1)
  })

  it('requires a fresh query after a revision or permission rejection', async () => {
    vi.mocked(memoryPreferenceIntentsApi.cancel).mockRejectedValueOnce(new ApiError('state changed', 409, 'TIANJI_IDEMPOTENCY_CONFLICT'))
    render(view()); await lookup(); await confirm(); expect(await screen.findByText(/请重新查询后再决定/)).toBeInTheDocument()
    expect(screen.getByLabelText('提取范围')).not.toBeDisabled(); expect(screen.queryByRole('button', {name: /重试原停止请求/})).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '停止后续提取'})).not.toBeInTheDocument(); expect(memoryPreferenceIntentsApi.status).toHaveBeenCalledTimes(1)
  })

  it('aborts and ignores old identity reads while keeping not requested distinct from processed proposals', async () => {
    let finish: ((value: PreferenceIntentStatus) => void) | undefined
    vi.mocked(memoryPreferenceIntentsApi.status).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const current = render(view()); fireEvent.change(screen.getByLabelText('提取范围'), {target: {value: 'research'}}); fireEvent.click(screen.getByRole('button', {name: '查询提取状态'}))
    await waitFor(() => expect(finish).toBeDefined()); const signal = vi.mocked(memoryPreferenceIntentsApi.status).mock.calls[0][2]
    vi.mocked(useAuth).mockReturnValue(auth('21')); current.rerender(view()); expect(signal?.aborted).toBe(true)
    await act(async () => { finish?.(preferenceIntentStatus()); await Promise.resolve() }); expect(screen.queryByText('等待处理')).not.toBeInTheDocument()
    vi.mocked(useAuth).mockReturnValue(auth()); current.rerender(view()); vi.mocked(memoryPreferenceIntentsApi.status).mockResolvedValueOnce({...preferenceIntentQuery(), intent: null})
    fireEvent.change(screen.getByLabelText('提取范围'), {target: {value: 'research'}}); fireEvent.click(screen.getByRole('button', {name: '查询提取状态'}))
    expect(await screen.findByText('该范围内尚未请求后台提取。')).toBeInTheDocument(); expect(screen.queryByRole('button', {name: '停止后续提取'})).not.toBeInTheDocument()
  })

  it('aborts an in-flight stop and never projects its old identity receipt into the new frame', async () => {
    let finish: ((value: ReturnType<typeof preferenceIntentCancellation>) => void) | undefined
    vi.mocked(memoryPreferenceIntentsApi.cancel).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const current = render(view()); await lookup(); await confirm(); await waitFor(() => expect(finish).toBeDefined())
    const [, command, signal] = vi.mocked(memoryPreferenceIntentsApi.cancel).mock.calls[0]
    vi.mocked(useAuth).mockReturnValue(auth('21')); current.rerender(view()); expect(signal?.aborted).toBe(true)
    await act(async () => { finish?.(preferenceIntentCancellation(command.commandId)); await Promise.resolve() })
    expect(screen.queryByText(/Agent 运行不会因此取消/)).not.toBeInTheDocument(); expect(screen.queryByText('已停止')).not.toBeInTheDocument()
    expect(screen.getByLabelText('提取范围')).toHaveValue('')
  })
})
