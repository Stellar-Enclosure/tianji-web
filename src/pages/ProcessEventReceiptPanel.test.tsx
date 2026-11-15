import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {processEventsApi, type ProcessEventReceiptDTO} from '../api/processEvents'
import {useAuth} from '../auth/AuthContext'
import {authorization} from '../test/fixtures'
import {ProcessEventReceiptPanel} from './ProcessEventReceiptPanel'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/processEvents', () => ({processEventsApi: {getReceipt: vi.fn()}}))

const INSTANCE_PAGE = 'tianji.page.processInstance'
const observed = '2026-11-14T12:01:00.000001Z'
const receipt: ProcessEventReceiptDTO = {
  receiptId: 'er-1', eventId: 'producer:event-1', state: 'APPLIED', releaseVersion: 'auto-2',
  activationRevision: 3, admittedAt: observed, instanceId: 'pi-1', nodeExecutionRef: 'exec:3',
  receivedAt: observed, decidedAt: '2026-11-14T12:01:00.000002Z', decisionCode: 'APPLIED',
}
const received: ProcessEventReceiptDTO = {
  receiptId: 'er-1', eventId: 'producer:event-1', state: 'RECEIVED', releaseVersion: 'auto-2',
  activationRevision: 3, admittedAt: observed, instanceId: null, nodeExecutionRef: null,
  receivedAt: observed, decidedAt: null, decisionCode: null,
}
const auth = (tenant = '20', allowed = true) => ({
  status: 'ready' as const, authorization: authorization(tenant, ['TIANJI_PROCESS_READ']),
  allows: (key: string) => key === INSTANCE_PAGE && allowed, login: () => {},
  logout: async () => {}, retry: async () => {},
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(useAuth).mockReturnValue(auth())
})

describe('Process event receipt panel', () => {
  it('does not read when there is no receipt selected', () => {
    render(<ProcessEventReceiptPanel instanceId="pi-1" />)
    expect(screen.getByText('暂无关联事件回执')).toBeInTheDocument()
    expect(processEventsApi.getReceipt).not.toHaveBeenCalled()
  })

  it('reads only the selected receipt for the current tenant and displays decision facts without payload', async () => {
    vi.mocked(processEventsApi.getReceipt).mockResolvedValue(receipt)
    render(<ProcessEventReceiptPanel instanceId="pi-1" receiptId="er-1" />)

    expect(await screen.findByText('事件已应用')).toBeInTheDocument()
    expect(processEventsApi.getReceipt).toHaveBeenCalledExactlyOnceWith('20', 'er-1', expect.any(AbortSignal))
    expect(screen.getByText('auto-2')).toBeInTheDocument()
    expect(screen.getByText('修订 3')).toBeInTheDocument()
    expect(screen.getByText(observed + ' UTC')).toBeInTheDocument()
    expect(screen.getByText(receipt.decidedAt + ' UTC')).toBeInTheDocument()
    expect(screen.queryByText(/payload|producer subject|wait token/i)).not.toBeInTheDocument()
  })

  it('renders the explicit unlinked receipt phase without inventing a decision', async () => {
    vi.mocked(processEventsApi.getReceipt).mockResolvedValue(received)
    render(<ProcessEventReceiptPanel instanceId="pi-1" receiptId="er-1" />)

    expect(await screen.findByText('事件已接纳，等待处理')).toBeInTheDocument()
    expect(screen.getByText('未关联流程实例')).toBeInTheDocument()
    expect(screen.queryByText('事件已应用')).not.toBeInTheDocument()
    expect(screen.queryByText('APPLIED')).not.toBeInTheDocument()
  })

  it('keeps terminal observations quiet until an explicit refresh and clears a changed receipt', async () => {
    vi.mocked(processEventsApi.getReceipt).mockResolvedValue(receipt)
    const rendered = render(<ProcessEventReceiptPanel instanceId="pi-1" receiptId="er-1" />)
    expect(await screen.findByText('事件已应用')).toBeInTheDocument()
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(processEventsApi.getReceipt).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', {name: '重新读取'}))
    await waitFor(() => expect(processEventsApi.getReceipt).toHaveBeenCalledTimes(2))

    rendered.rerender(<ProcessEventReceiptPanel instanceId="pi-1" receiptId="er-2" />)
    await waitFor(() => expect(processEventsApi.getReceipt).toHaveBeenCalledTimes(3))
    expect(processEventsApi.getReceipt).toHaveBeenLastCalledWith('20', 'er-2', expect.any(AbortSignal))
  })

  it('keeps only the current-scope receipt projection when an explicit refresh is unavailable', async () => {
    vi.mocked(processEventsApi.getReceipt).mockResolvedValueOnce(receipt)
      .mockRejectedValueOnce(new ApiError('unavailable', 503, 'TIANJI_DEPENDENCY_UNAVAILABLE'))
    render(<ProcessEventReceiptPanel instanceId="pi-1" receiptId="er-1" />)
    expect(await screen.findByText('事件已应用')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '重新读取'}))
    expect(await screen.findByText('暂时无法读取最新回执，当前显示的是此前读取的服务端状态。')).toBeInTheDocument()
    expect(screen.getByText('事件已应用')).toBeInTheDocument()
    expect(screen.queryByText(/payload|producer subject|wait token/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', {name: '重新读取'})).toBeEnabled()
  })

  it('hides the receipt and aborts a late response after identity changes', async () => {
    const finishers: Array<(value: ProcessEventReceiptDTO) => void> = []
    const signals: AbortSignal[] = []
    vi.mocked(processEventsApi.getReceipt).mockImplementation((_tenant, _id, signal) => {
      signals.push(signal!)
      return new Promise(resolve => {finishers.push(resolve)})
    })
    const rendered = render(<ProcessEventReceiptPanel instanceId="pi-1" receiptId="er-1" />)
    await waitFor(() => expect(signals).toHaveLength(1))

    vi.mocked(useAuth).mockReturnValue(auth('21'))
    rendered.rerender(<ProcessEventReceiptPanel instanceId="pi-1" receiptId="er-1" />)
    await waitFor(() => expect(signals[0]?.aborted).toBe(true))
    await waitFor(() => expect(signals).toHaveLength(2))
    expect(processEventsApi.getReceipt).toHaveBeenLastCalledWith('21', 'er-1', expect.any(AbortSignal))
    await act(async () => { finishers[0]?.(receipt); await Promise.resolve() })
    expect(screen.queryByText('事件已应用')).not.toBeInTheDocument()
    await act(async () => { finishers[1]?.({...receipt, instanceId: 'pi-1'}); await Promise.resolve() })
    expect(await screen.findByText('事件已应用')).toBeInTheDocument()
  })

  it('clears protected receipt details on an authorization failure', async () => {
    vi.mocked(processEventsApi.getReceipt).mockRejectedValue(new ApiError('forbidden', 403, 'FORBIDDEN'))
    render(<ProcessEventReceiptPanel instanceId="pi-1" receiptId="er-1" />)
    expect(await screen.findByText('当前无法观察该事件回执。')).toBeInTheDocument()
    expect(screen.queryByText('er-1')).not.toBeInTheDocument()
  })
})
