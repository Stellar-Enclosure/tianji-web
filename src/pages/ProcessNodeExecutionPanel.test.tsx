import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {MemoryRouter} from 'react-router-dom'
import {processAutomationApi, type NodeExecutionDTO, type NodeExecutionPageDTO} from '../api/processAutomation'
import {useAuth} from '../auth/AuthContext'
import {authorization} from '../test/fixtures'
import {ProcessNodeExecutionPanel} from './ProcessNodeExecutionPanel'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/processAutomation', async original => {
  const actual = await original<typeof import('../api/processAutomation')>()
  return {...actual, processAutomationApi: {...actual.processAutomationApi,
    listNodeExecutions: vi.fn(), retryNode: vi.fn()}}
})

const PAGE = 'tianji.page.processInstance'
const RETRY = 'tianji.button.processNode.retry'
const timestamp = '2026-11-14T12:00:00.123456Z'
const instanceId = 'pi-1'
const node: NodeExecutionDTO = {
  nodeId: 'serviceNode', occurrenceId: 'occ-1', attempt: 1, nodeExecutionRef: 'exec-1', kind: 'SERVICE',
  state: 'WAIT_RECOVERY', inputSha256: 'a'.repeat(64), outputSchemaSha256: 'b'.repeat(64),
  startedAt: timestamp, finishedAt: timestamp, deadlineAt: '2026-11-14T12:05:00Z',
  errorCode: 'TIANJI_EFFECT_UNKNOWN', sideEffectOutcome: 'UNKNOWN', agentRunId: null,
  output: {secret: 'private process output'}, eventReceiptIds: ['er-1'], version: 'c'.repeat(64), availableActions: ['RETRY'],
}
const page: NodeExecutionPageDTO = {
  instanceId, releaseVersion: 'auto-2', observedAt: timestamp, items: [node], nextCursor: null,
}
const auth = (permissions: readonly string[] = [], actions: readonly string[] = [PAGE, RETRY], tenant = '20') => ({
  status: 'ready' as const, authorization: authorization(tenant, ['TIANJI_PROCESS_READ', ...permissions]),
  allows: (key: string) => actions.includes(key), login: () => {}, logout: async () => {}, retry: async () => {},
})
let onRowsChange: (rows: readonly NodeExecutionDTO[]) => void
let onSelectionChange: (row?: NodeExecutionDTO) => void
let onRefresh: () => void
const view = (overrides: Partial<Parameters<typeof ProcessNodeExecutionPanel>[0]> = {}) => (
  <MemoryRouter><ProcessNodeExecutionPanel instanceId={instanceId} releaseVersion="auto-2" refreshToken={0}
    onRowsChange={onRowsChange} onSelectionChange={onSelectionChange} onRefresh={onRefresh} {...overrides} /></MemoryRouter>
)

beforeEach(() => {
  vi.resetAllMocks()
  onRowsChange = vi.fn()
  onSelectionChange = vi.fn()
  onRefresh = vi.fn()
  vi.mocked(useAuth).mockReturnValue(auth())
  vi.mocked(processAutomationApi.listNodeExecutions).mockResolvedValue(page)
  vi.mocked(processAutomationApi.retryNode).mockRejectedValue(new TypeError('No retry fixture configured'))
})

describe('Process node execution panel', () => {
  it('loads only the requested node page and reports the exact current observation to its owner', async () => {
    render(view({nodeId: node.nodeId, occurrenceId: node.occurrenceId, attempt: node.attempt}))
    expect((await screen.findAllByText('等待恢复核验')).length).toBeGreaterThan(0)
    expect(processAutomationApi.listNodeExecutions).toHaveBeenCalledExactlyOnceWith(
      '20', instanceId, {nodeId: node.nodeId, limit: 100}, expect.any(AbortSignal),
    )
    expect(onRowsChange).toHaveBeenCalledWith([node])
    expect(onSelectionChange).toHaveBeenCalledWith(node)
    expect(screen.getByText(node.inputSha256)).toBeInTheDocument()
    expect(screen.getByText(node.outputSchemaSha256)).toBeInTheDocument()
    expect(screen.getAllByText(node.deadlineAt + ' UTC').length).toBeGreaterThan(0)
    expect(screen.getByText('副作用结果未知，需核验后恢复')).toBeInTheDocument()
  })

  it('withholds output without data permission while preserving state and hashes', async () => {
    render(view({nodeId: node.nodeId}))
    fireEvent.click(await screen.findByRole('button', {name: node.nodeId}))
    expect((await screen.findAllByText('等待恢复核验')).length).toBeGreaterThan(0)
    expect(screen.getByText('无数据读取权限')).toBeInTheDocument()
    expect(screen.queryByText('private process output')).not.toBeInTheDocument()
    expect(screen.getByText(node.outputSchemaSha256)).toBeInTheDocument()
  })

  it('renders typed output only with DATA_READ and the agent link only with diagnostic and run detail permission', async () => {
    const agentNode = {...node, kind: 'AGENT' as const, agentRunId: 'run-1', output: {text: 'authorized value'}}
    vi.mocked(processAutomationApi.listNodeExecutions).mockResolvedValue({...page, items: [agentNode]})
    vi.mocked(useAuth).mockReturnValue(auth(['TIANJI_PROCESS_DATA_READ', 'TIANJI_PROCESS_DIAGNOSTIC_READ'], [PAGE, RETRY, 'tianji.page.runDetail']))
    render(view({nodeId: node.nodeId}))
    fireEvent.click(await screen.findByRole('button', {name: node.nodeId}))

    expect(await screen.findByText(/authorized value/)).toBeInTheDocument()
    expect(screen.getByRole('link', {name: '查看 Agent 执行'})).toHaveAttribute('href', '/runs/run-1')
  })

  it('offers retry only when all server and local gates allow it and then refreshes after SCHEDULED', async () => {
    vi.mocked(useAuth).mockReturnValue(auth([], [PAGE, RETRY]))
    vi.mocked(processAutomationApi.retryNode).mockResolvedValue({
      commandId: 'retry-1', instanceId, occurrenceId: node.occurrenceId,
      attempt: 2, nodeExecutionRef: 'exec-2', state: 'SCHEDULED',
    })
    render(view({nodeId: node.nodeId, occurrenceId: node.occurrenceId, attempt: node.attempt}))
    fireEvent.click(await screen.findByRole('button', {name: '重试节点'}))
    fireEvent.change(screen.getByLabelText('恢复原因'), {target: {value: '已核对业务副作用，允许新尝试'}})
    fireEvent.change(screen.getByLabelText('业务回执定位（可选）'), {target: {value: 'receipt-12'}})
    fireEvent.click(screen.getByRole('button', {name: '确认安排重试'}))

    await waitFor(() => expect(processAutomationApi.retryNode).toHaveBeenCalledOnce())
    const [, , command, signal] = vi.mocked(processAutomationApi.retryNode).mock.calls[0]
    expect(command).toMatchObject({nodeExecutionRef: node.nodeExecutionRef, expectedVersion: node.version,
      reason: '已核对业务副作用，允许新尝试', businessReceiptRef: 'receipt-12'})
    expect(command.commandId).toMatch(/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/)
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('keeps a lost retry request under the original command and body', async () => {
    vi.mocked(processAutomationApi.retryNode).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(view({nodeId: node.nodeId, occurrenceId: node.occurrenceId, attempt: node.attempt}))
    fireEvent.click(await screen.findByRole('button', {name: '重试节点'}))
    fireEvent.change(screen.getByLabelText('恢复原因'), {target: {value: '先前验证理由'}})
    fireEvent.click(screen.getByRole('button', {name: '确认安排重试'}))
    expect(await screen.findByText('重试结果尚未确认')).toBeInTheDocument()
    const original = vi.mocked(processAutomationApi.retryNode).mock.calls[0]
    fireEvent.click(screen.getByRole('button', {name: '使用同一请求重试'}))
    await waitFor(() => expect(processAutomationApi.retryNode).toHaveBeenCalledTimes(2))
    expect(vi.mocked(processAutomationApi.retryNode).mock.calls[1]?.[2]).toEqual(original?.[2])
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('requires a new confirmation when the displayed retry target version changes', async () => {
    const advanced = {...node, version: 'd'.repeat(64)}
    vi.mocked(processAutomationApi.listNodeExecutions).mockResolvedValueOnce(page)
      .mockResolvedValueOnce({...page, items: [advanced]})
    const parameters = {nodeId: node.nodeId, occurrenceId: node.occurrenceId, attempt: node.attempt}
    const rendered = render(view(parameters))
    fireEvent.click(await screen.findByRole('button', {name: '重试节点'}))
    fireEvent.change(screen.getByLabelText('恢复原因'), {target: {value: '已经查看当前节点'}})

    rendered.rerender(view({...parameters, refreshToken: 1}))
    expect(await screen.findByText(advanced.version)).toBeInTheDocument()
    const confirm = screen.getByRole('button', {name: '确认安排重试'})
    expect(confirm).toBeDisabled()
    fireEvent.click(confirm)
    expect(processAutomationApi.retryNode).not.toHaveBeenCalled()
  })

  it('shows one API page at a time, returns to a cached page, and reports graph rows in server order', async () => {
    const nextRow = {...node, nodeId: 'laterServiceNode', occurrenceId: 'occ-2', nodeExecutionRef: 'exec-2'}
    vi.mocked(processAutomationApi.listNodeExecutions).mockResolvedValueOnce({...page, nextCursor: 'next-1'})
      .mockResolvedValueOnce({...page, items: [nextRow]})
    render(view())

    expect(await screen.findByRole('button', {name: node.nodeId})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '下一页'}))
    expect(await screen.findByRole('button', {name: nextRow.nodeId})).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: node.nodeId})).not.toBeInTheDocument()
    expect(onRowsChange).toHaveBeenLastCalledWith([node, nextRow])

    fireEvent.click(screen.getByRole('button', {name: '上一页'}))
    expect(await screen.findByRole('button', {name: node.nodeId})).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: nextRow.nodeId})).not.toBeInTheDocument()
    expect(processAutomationApi.listNodeExecutions).toHaveBeenCalledTimes(2)
    expect(onRowsChange).toHaveBeenLastCalledWith([node])
  })

  it.each(['TIANJI_NODE_RETRY_BLOCKED', 'TIANJI_PROCESS_VERSION_CONFLICT'])(
    'requires a fresh explicit node read after a definitive %s refusal before correcting the retry', async code => {
      vi.mocked(processAutomationApi.retryNode).mockRejectedValueOnce(new ApiError('retry blocked', 409, code))
        .mockResolvedValueOnce({commandId: 'retry-2', instanceId, occurrenceId: node.occurrenceId,
          attempt: 2, nodeExecutionRef: 'exec-2', state: 'SCHEDULED'})
      render(view({nodeId: node.nodeId, occurrenceId: node.occurrenceId, attempt: node.attempt}))
      fireEvent.click(await screen.findByRole('button', {name: '重试节点'}))
      fireEvent.change(screen.getByLabelText('恢复原因'), {target: {value: '检查后更正回执定位'}})
      fireEvent.change(screen.getByLabelText('业务回执定位（可选）'), {target: {value: 'old-ref'}})
      fireEvent.click(screen.getByRole('button', {name: '确认安排重试'}))
      expect((await screen.findAllByText('节点恢复状态已变化')).length).toBe(1)
      expect(processAutomationApi.retryNode).toHaveBeenCalledOnce()
      expect(screen.queryByRole('button', {name: '重试节点'})).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', {name: '重新读取当前节点'}))
      await waitFor(() => expect(processAutomationApi.listNodeExecutions).toHaveBeenCalledTimes(2))
      fireEvent.click(await screen.findByRole('button', {name: '重试节点'}))
      fireEvent.change(screen.getByLabelText('业务回执定位（可选）'), {target: {value: 'corrected-ref'}})
      fireEvent.click(screen.getByRole('button', {name: '确认安排重试'}))
      await waitFor(() => expect(processAutomationApi.retryNode).toHaveBeenCalledTimes(2))
      expect(vi.mocked(processAutomationApi.retryNode).mock.calls[1]?.[2]).toMatchObject({
        reason: '检查后更正回执定位', businessReceiptRef: 'corrected-ref',
      })
    })

  it('redacts cached output after a 503 node observation failure', async () => {
    vi.mocked(useAuth).mockReturnValue(auth(['TIANJI_PROCESS_DATA_READ'], [PAGE, RETRY]))
    vi.mocked(processAutomationApi.listNodeExecutions).mockResolvedValueOnce(page)
      .mockRejectedValueOnce(new ApiError('unavailable', 503, 'UNAVAILABLE'))
    const rendered = render(view({nodeId: node.nodeId}))
    fireEvent.click(await screen.findByRole('button', {name: node.nodeId}))
    expect(await screen.findByText(/private process output/)).toBeInTheDocument()
    rendered.rerender(view({nodeId: node.nodeId, refreshToken: 1}))
    await waitFor(() => expect(processAutomationApi.listNodeExecutions).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('private process output')).not.toBeInTheDocument()
    expect(screen.getByText('暂时无法读取节点执行记录。')).toBeInTheDocument()
    expect(screen.getByText(node.outputSchemaSha256)).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '重试节点'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '重新读取节点'}))
    await waitFor(() => expect(processAutomationApi.listNodeExecutions).toHaveBeenCalledTimes(3))
    expect(await screen.findByText(/private process output/)).toBeInTheDocument()
  })

  it('does not retry an unknown node action or while the instance view is stale', async () => {
    vi.mocked(processAutomationApi.listNodeExecutions).mockResolvedValue({...page, items: [{...node, availableActions: []}]})
    const rendered = render(view({nodeId: node.nodeId, occurrenceId: node.occurrenceId, attempt: node.attempt}))
    expect((await screen.findAllByText('等待恢复核验')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', {name: '重试节点'})).not.toBeInTheDocument()

    vi.mocked(processAutomationApi.listNodeExecutions).mockResolvedValue(page)
    rendered.rerender(view({nodeId: node.nodeId, occurrenceId: node.occurrenceId, attempt: node.attempt, stale: true}))
    expect((await screen.findAllByText('等待恢复核验')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', {name: '重试节点'})).not.toBeInTheDocument()
  })

  it('shows only the active cursor page while preserving observed graph rows and restores cached rows on previous', async () => {
    const nextRow = {...node, nodeId: 'laterServiceNode', occurrenceId: 'occ-2', nodeExecutionRef: 'exec-2'}
    vi.mocked(processAutomationApi.listNodeExecutions).mockResolvedValueOnce({...page, nextCursor: 'next-1'})
      .mockResolvedValueOnce({...page, items: [nextRow]})
    render(view())
    expect(await screen.findByRole('button', {name: node.nodeId})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '下一页'}))
    expect(await screen.findByRole('button', {name: nextRow.nodeId})).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: node.nodeId})).not.toBeInTheDocument()
    expect(onRowsChange).toHaveBeenLastCalledWith([node, nextRow])

    fireEvent.click(screen.getByRole('button', {name: '上一页'}))
    expect(await screen.findByRole('button', {name: node.nodeId})).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: nextRow.nodeId})).not.toBeInTheDocument()
    expect(processAutomationApi.listNodeExecutions).toHaveBeenCalledTimes(2)
    expect(onRowsChange).toHaveBeenLastCalledWith([node])
  })

  it.each(['TIANJI_NODE_RETRY_BLOCKED', 'TIANJI_PROCESS_VERSION_CONFLICT'])(
    'requires a fresh explicit node read after a definitive %s refusal before correcting the retry', async code => {
      vi.mocked(processAutomationApi.retryNode).mockRejectedValueOnce(new ApiError(
        'retry blocked', 409, code,
      )).mockResolvedValueOnce({
        commandId: 'retry-2', instanceId, occurrenceId: node.occurrenceId,
        attempt: 2, nodeExecutionRef: 'exec-2', state: 'SCHEDULED',
      })
      render(view({nodeId: node.nodeId, occurrenceId: node.occurrenceId, attempt: node.attempt}))
      fireEvent.click(await screen.findByRole('button', {name: '重试节点'}))
      fireEvent.change(screen.getByLabelText('恢复原因'), {target: {value: '检查过后更正回执定位'}})
      fireEvent.change(screen.getByLabelText('业务回执定位（可选）'), {target: {value: 'old-ref'}})
      fireEvent.click(screen.getByRole('button', {name: '确认安排重试'}))
      expect(await screen.findByText('节点恢复状态已变化')).toBeInTheDocument()
      expect(processAutomationApi.retryNode).toHaveBeenCalledOnce()
      expect(screen.queryByRole('button', {name: '重试节点'})).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', {name: '重新读取当前节点'}))
      await waitFor(() => expect(processAutomationApi.listNodeExecutions).toHaveBeenCalledTimes(2))
      fireEvent.click(await screen.findByRole('button', {name: '重试节点'}))
      fireEvent.change(screen.getByLabelText('业务回执定位（可选）'), {target: {value: 'corrected-ref'}})
      fireEvent.click(screen.getByRole('button', {name: '确认安排重试'}))
      await waitFor(() => expect(processAutomationApi.retryNode).toHaveBeenCalledTimes(2))
      expect(vi.mocked(processAutomationApi.retryNode).mock.calls[1]?.[2]).toMatchObject({
        reason: '检查过后更正回执定位', businessReceiptRef: 'corrected-ref',
      })
    })

  it('retains the exact retry command after an idempotency conflict', async () => {
    vi.mocked(processAutomationApi.retryNode).mockRejectedValueOnce(new ApiError(
      'receipt conflict', 409, 'TIANJI_IDEMPOTENCY_CONFLICT',
    )).mockRejectedValueOnce(new TypeError('still unavailable'))
    render(view({nodeId: node.nodeId, occurrenceId: node.occurrenceId, attempt: node.attempt}))
    fireEvent.click(await screen.findByRole('button', {name: '重试节点'}))
    fireEvent.change(screen.getByLabelText('恢复原因'), {target: {value: '原始原因'}})
    fireEvent.click(screen.getByRole('button', {name: '确认安排重试'}))
    expect(await screen.findByText('重试结果尚未确认')).toBeInTheDocument()
    const originalCommand = vi.mocked(processAutomationApi.retryNode).mock.calls[0]?.[2]
    fireEvent.click(screen.getByRole('button', {name: '使用同一请求重试'}))
    await waitFor(() => expect(processAutomationApi.retryNode).toHaveBeenCalledTimes(2))
    expect(vi.mocked(processAutomationApi.retryNode).mock.calls[1]?.[2]).toEqual(originalCommand)
  })

  it('aborts the old page on identity or instance change and ignores its late result', async () => {
    const finishers: Array<(value: NodeExecutionPageDTO) => void> = []
    const signals: AbortSignal[] = []
    vi.mocked(processAutomationApi.listNodeExecutions).mockImplementation((_tenant, _id, _query, request) => {
      signals.push(request!)
      return new Promise(resolve => {finishers.push(resolve)})
    })
    const rendered = render(view())
    await waitFor(() => expect(signals).toHaveLength(1))
    vi.mocked(useAuth).mockReturnValue(auth(['TIANJI_PROCESS_DATA_READ'], [PAGE, RETRY], '21'))
    rendered.rerender(view({instanceId: 'pi-2'}))
    await waitFor(() => expect(signals[0]?.aborted).toBe(true))
    await waitFor(() => expect(signals).toHaveLength(2))
    await act(async () => { finishers[0]?.({...page, instanceId: 'pi-1'}); await Promise.resolve() })
    expect(screen.queryByText('private process output')).not.toBeInTheDocument()
    await act(async () => { finishers[1]?.({...page, instanceId: 'pi-2'}); await Promise.resolve() })
    expect(await screen.findByRole('button', {name: node.nodeId})).toBeInTheDocument()
    expect(onRowsChange).toHaveBeenLastCalledWith([node])
  })
})
