import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {allowsSnapshotRequirement} from '@stellar-enclosure/stellar-enclosure-web-shared/permissions'
import {Alert, Button, Descriptions, Empty, Input, Modal, Space, Table, Tag, Typography,
  type TableColumnsType} from 'antd'
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {Link} from 'react-router-dom'
import {isRunId} from '../api/agent'
import {processAutomationApi, type NodeExecutionDTO, type NodeExecutionPageDTO, type NodeRetryCommand} from '../api/processAutomation'
import {gatewayAuth} from '../auth/gatewayAuth'
import {useAuth} from '../auth/AuthContext'

const PAGE = 'tianji.page.processInstance'
const RETRY = 'tianji.button.processNode.retry'
const KNOWN_RETRY_BLOCKS = new Set(['TIANJI_NODE_RETRY_BLOCKED', 'TIANJI_PROCESS_VERSION_CONFLICT'])
const EMPTY_CURSOR_TRAIL: readonly (string | undefined)[] = []
const DATA_READ = {mode: 'ALL', codes: ['TIANJI_PROCESS_DATA_READ']} as const
const DIAGNOSTIC_READ = {mode: 'ALL', codes: ['TIANJI_PROCESS_DIAGNOSTIC_READ']} as const
const TERMINAL = new Set<NodeExecutionDTO['state']>(['COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED'])

const stateLabels: Record<NodeExecutionDTO['state'], string> = {
  SCHEDULED: '已安排', RUNNING: '运行中', WAITING: '等待中', RESULT_ACCEPTED: '已接收结果',
  WAIT_RECOVERY: '等待恢复核验', COMPLETED: '已完成', FAILED: '失败', TIMED_OUT: '已超时', CANCELLED: '已取消',
}
const kindLabels: Record<NodeExecutionDTO['kind'], string> = {
  HUMAN: '人工任务', SERVICE: '服务任务', RULE: '规则', AGENT: 'Agent', EVENT_WAIT: '事件等待',
  TIMER: '计时器', SUBPROCESS: '子流程', LOOP: '循环', MULTI_INSTANCE: '多实例', AND_JOIN: '并行汇合',
}

export type ProcessNodeExecutionPanelProps = Readonly<{
  instanceId: string
  releaseVersion: string
  nodeId?: string
  occurrenceId?: string
  attempt?: number
  refreshToken: number
  stale?: boolean
  onRowsChange: (rows: readonly NodeExecutionDTO[]) => void
  onSelectionChange?: (selected?: NodeExecutionDTO) => void
  onUserSelection?: (selected: NodeExecutionDTO) => void
  onReceiptSelect?: (receiptId: string) => void
  onRefresh: () => void
}>

type PendingRetry = Readonly<{command: NodeRetryCommand; row: NodeExecutionDTO}>
type RetryState = 'idle' | 'sending' | 'unknown'
type CachedPage = Readonly<{refreshToken: number; nodeId?: string; readTrigger: number; cursor?: string; page: NodeExecutionPageDTO}>

function isDataReadable(authorization: ReturnType<typeof useAuth>['authorization']): boolean {
  return !!authorization && allowsSnapshotRequirement(authorization.snapshot, authorization.binding, DATA_READ)
}

function isDiagnosticReadable(authorization: ReturnType<typeof useAuth>['authorization']): boolean {
  return !!authorization && allowsSnapshotRequirement(authorization.snapshot, authorization.binding, DIAGNOSTIC_READ)
}

function selectionKey(row: NodeExecutionDTO): string {
  return [row.nodeId, row.occurrenceId, row.attempt].join('/')
}

function matchSelection(rows: readonly NodeExecutionDTO[], nodeId?: string, occurrenceId?: string,
                        attempt?: number): NodeExecutionDTO | undefined {
  if (!nodeId) return undefined
  const candidates = rows.filter(row => row.nodeId === nodeId
    && (occurrenceId === undefined || row.occurrenceId === occurrenceId)
    && (attempt === undefined || row.attempt === attempt))
  return candidates[0]
}

function sideEffectLabel(outcome: NodeExecutionDTO['sideEffectOutcome']): string {
  switch (outcome) {
    case 'NONE': return '无副作用'
    case 'CONFIRMED': return '已确认'
    case 'UNKNOWN': return '未知'
  }
}

function outputText(row: NodeExecutionDTO): string {
  return row.output === null ? '该节点没有已记录的输出。' : JSON.stringify(row.output, null, 2)
}

function redactNode(row: NodeExecutionDTO): NodeExecutionDTO {
  return {...row, errorCode: null, agentRunId: null, output: null, eventReceiptIds: [], availableActions: []}
}

function UtcTime({value}: {value: string}) {
  return <time dateTime={value} title={value}>{value} UTC</time>
}

export function ProcessNodeExecutionPanel(props: ProcessNodeExecutionPanelProps) {
  const {status, authorization, allows} = useAuth()
  const canObserve = status === 'ready' && !!authorization && allows(PAGE)
  if (!canObserve || !authorization) return <Alert type="warning" showIcon message="当前身份不能观察此流程实例。" />
  const {identity, binding} = authorization
  const key = JSON.stringify([identity.issuer, identity.subject, identity.tenantId, binding.requestEpoch,
    canObserve, props.instanceId, props.releaseVersion])
  return <NodeExecutionObservation key={key} {...props} tenant={identity.tenantId} epoch={binding.requestEpoch} />
}

function NodeExecutionObservation({
  instanceId, releaseVersion, nodeId, occurrenceId, attempt, refreshToken, stale = false,
  onRowsChange, onSelectionChange, onUserSelection, onReceiptSelect, onRefresh, tenant, epoch,
}: ProcessNodeExecutionPanelProps & {tenant: string; epoch: number}) {
  const {allows, authorization} = useAuth()
  const canRetryPermission = allows(PAGE) && allows(RETRY)
  const dataReadable = isDataReadable(authorization)
  const diagnosticReadable = isDiagnosticReadable(authorization) && allows('tianji.page.runDetail')
  const currentAllows = useRef(allows)
  const request = useRef<AbortController | null>(null)
  const retryRequest = useRef<AbortController | null>(null)
  const alive = useRef(false)
  const retryFence = useRef(false)
  const sequence = useRef(0)
  const selectedKeyRef = useRef<string | undefined>(undefined)
  const rowsCallback = useRef(onRowsChange)
  const selectionCallback = useRef(onSelectionChange)
  const userSelectionCallback = useRef(onUserSelection)
  const receiptCallback = useRef(onReceiptSelect)
  const refreshCallback = useRef(onRefresh)
  const pagesRef = useRef<readonly CachedPage[]>([])
  const [pages, setPages] = useState<readonly CachedPage[]>([])
  const [paging, setPaging] = useState<Readonly<{
    refreshToken: number; nodeId?: string; cursor?: string; previous: readonly (string | undefined)[]
  }>>({
    refreshToken, nodeId, previous: [],
  })
  const [readTrigger, setReadTrigger] = useState(0)
  const currentPaging = paging.refreshToken === refreshToken && paging.nodeId === nodeId
  const cursor = currentPaging ? paging.cursor : undefined
  const cursorTrail = currentPaging ? paging.previous : EMPTY_CURSOR_TRAIL
  const currentPage = pages.find(page => page.refreshToken === refreshToken && page.nodeId === nodeId
    && page.readTrigger === readTrigger
    && currentPageKey(refreshToken, nodeId, page.cursor, readTrigger)
      === currentPageKey(refreshToken, nodeId, cursor, readTrigger))
  const visibleRows = useMemo(() => [...cursorTrail, cursor].flatMap(pageCursor =>
    pages.find(page => page.refreshToken === refreshToken && page.nodeId === nodeId && page.readTrigger === readTrigger
      && currentPageKey(refreshToken, nodeId, page.cursor, readTrigger)
        === currentPageKey(refreshToken, nodeId, pageCursor, readTrigger))?.page.items ?? []),
  [cursor, cursorTrail, nodeId, pages, readTrigger, refreshToken])
  const nextCursor = currentPage?.page.nextCursor ?? null
  const activePageKey = currentPageKey(refreshToken, nodeId, cursor, readTrigger)
  const [errorPageKey, setErrorPageKey] = useState<string>()
  const pageState = errorPageKey === activePageKey ? 'error' : currentPage ? 'loaded' : 'loading'
  const [selectedKey, setSelectedKey] = useState<string>()
  const [retryTarget, setRetryTarget] = useState<Pick<NodeExecutionDTO, 'nodeExecutionRef' | 'version'>>()
  const [reason, setReason] = useState('')
  const [businessReceiptRef, setBusinessReceiptRef] = useState('')
  const [reasonError, setReasonError] = useState<string>()
  const [pendingRetry, setPendingRetry] = useState<PendingRetry>()
  const [retryState, setRetryState] = useState<RetryState>('idle')
  const [retryError, setRetryError] = useState<string>()
  const [retryNeedsRefresh, setRetryNeedsRefresh] = useState(false)

  const isCurrent = useCallback((controller: AbortController, current: number) =>
    alive.current && !controller.signal.aborted && gatewayAuth.context.epoch === epoch
      && sequence.current === current && currentAllows.current(PAGE), [epoch])

  useLayoutEffect(() => {
    rowsCallback.current([])
    selectionCallback.current?.(undefined)
    alive.current = true
    return () => {
      alive.current = false
      sequence.current += 1
      request.current?.abort()
      retryRequest.current?.abort()
      request.current = null
      retryRequest.current = null
    }
  }, [])
  useLayoutEffect(() => {
    pagesRef.current = pages
    rowsCallback.current = onRowsChange
    selectionCallback.current = onSelectionChange
    userSelectionCallback.current = onUserSelection
    receiptCallback.current = onReceiptSelect
    refreshCallback.current = onRefresh
    currentAllows.current = allows
  }, [allows, onRowsChange, onReceiptSelect, onRefresh, onSelectionChange, onUserSelection, pages])

  useEffect(() => {
    const key = currentPageKey(refreshToken, nodeId, cursor, readTrigger)
    if (pagesRef.current.some(page => page.refreshToken === refreshToken
        && page.nodeId === nodeId && page.readTrigger === readTrigger
        && currentPageKey(refreshToken, nodeId, page.cursor, readTrigger) === key)) return
    if (errorPageKey === key) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const current = ++sequence.current
    const query = {...(nodeId ? {nodeId} : {}), ...(cursor ? {cursor} : {}), limit: 100}
    void processAutomationApi.listNodeExecutions(tenant, instanceId, query, controller.signal).then(page => {
      if (!isCurrent(controller, current)) return
      if (page.releaseVersion !== releaseVersion) {
        setErrorPageKey(key)
        rowsCallback.current([])
        selectionCallback.current?.(undefined)
        return
      }
      const updatedPages = [...pagesRef.current.filter(entry => entry.refreshToken === refreshToken
        && entry.nodeId === nodeId && entry.readTrigger === readTrigger
        && currentPageKey(refreshToken, nodeId, entry.cursor, readTrigger) !== key),
      {refreshToken, nodeId, readTrigger, cursor, page}]
      pagesRef.current = updatedPages
      setPages(updatedPages)
      setErrorPageKey(undefined)
      setRetryNeedsRefresh(false)
      setRetryError(undefined)
      const rows = [...cursorTrail, cursor].flatMap(pageCursor =>
        updatedPages.find(entry => entry.refreshToken === refreshToken && entry.nodeId === nodeId
          && entry.readTrigger === readTrigger
          && currentPageKey(refreshToken, nodeId, entry.cursor, readTrigger)
            === currentPageKey(refreshToken, nodeId, pageCursor, readTrigger))
          ?.page.items ?? [])
      rowsCallback.current(rows)
      selectionCallback.current?.(matchSelection(rows, nodeId, occurrenceId, attempt)
        ?? rows.find(row => selectionKey(row) === selectedKeyRef.current))
    }).catch(failure => {
      if (!isCurrent(controller, current)) return
      setErrorPageKey(key)
      if (failure instanceof ApiError && failure.status === 503) {
        const safePages = pagesRef.current.filter(page => page.nodeId === nodeId)
          .map(page => ({...page, refreshToken, readTrigger,
            page: {...page.page, items: page.page.items.map(redactNode)}}))
        pagesRef.current = safePages
        setPages(safePages)
        const rows = [...cursorTrail, cursor].flatMap(pageCursor =>
          safePages.find(page => currentPageKey(refreshToken, nodeId, page.cursor, readTrigger)
            === currentPageKey(refreshToken, nodeId, pageCursor, readTrigger))?.page.items ?? [])
        rowsCallback.current(rows)
        selectionCallback.current?.(matchSelection(rows, nodeId, occurrenceId, attempt))
      } else {
        pagesRef.current = []
        setPages([])
        rowsCallback.current([])
        selectionCallback.current?.(undefined)
      }
    }).finally(() => {
      if (request.current === controller) request.current = null
    })
    return () => {
      controller.abort()
      if (request.current === controller) request.current = null
    }
  }, [attempt, cursor, cursorTrail, epoch, errorPageKey, instanceId, isCurrent, nodeId, readTrigger,
    occurrenceId, refreshToken, releaseVersion, tenant])

  useEffect(() => {
    selectionCallback.current?.(matchSelection(visibleRows, nodeId, occurrenceId, attempt)
      ?? visibleRows.find(row => selectionKey(row) === selectedKey))
  }, [attempt, nodeId, occurrenceId, selectedKey, visibleRows])

  const selectedRow = useMemo(() =>
    matchSelection(visibleRows, nodeId, occurrenceId, attempt)
      ?? visibleRows.find(row => selectionKey(row) === selectedKey),
  [attempt, nodeId, occurrenceId, selectedKey, visibleRows])

  const selectRow = (row: NodeExecutionDTO) => {
    selectedKeyRef.current = selectionKey(row)
    setSelectedKey(selectionKey(row))
    selectionCallback.current?.(row)
    userSelectionCallback.current?.(row)
  }

  const canRetry = !!selectedRow && canRetryPermission && !stale && pageState === 'loaded' && retryState === 'idle'
    && !pendingRetry && !retryNeedsRefresh && selectedRow.state === 'WAIT_RECOVERY' && selectedRow.availableActions.includes('RETRY')
    && selectedRow.attempt < 10
  const retryTargetIsCurrent = retryTarget !== undefined && canRetry
    && retryTarget.nodeExecutionRef === selectedRow?.nodeExecutionRef && retryTarget.version === selectedRow.version

  const createRetryIntent = (row: NodeExecutionDTO | undefined): PendingRetry | undefined => {
    if (!row || !canRetryPermission || stale || row.state !== 'WAIT_RECOVERY'
        || !row.availableActions.includes('RETRY') || row.attempt >= 10 || !globalThis.crypto?.randomUUID) return undefined
    const trimmed = reason.trim()
    if (!trimmed || trimmed.length > 512 || /[\p{Cc}\p{Surrogate}]/u.test(trimmed)
        || businessReceiptRef.length > 255 || /[\p{Cc}\p{Surrogate}]/u.test(businessReceiptRef)) {
      setReasonError('请填写有效的恢复原因和业务回执定位。')
      return undefined
    }
    return {row, command: {
      commandId: 'retry-' + globalThis.crypto.randomUUID(), nodeExecutionRef: row.nodeExecutionRef,
      expectedVersion: row.version, reason: trimmed, businessReceiptRef: businessReceiptRef || null,
    }}
  }

  const submitRetry = async (existing?: PendingRetry) => {
    if (!alive.current || !tenant || !canRetryPermission || stale || retryFence.current || retryState === 'sending') return
    const intent = existing ?? (retryTargetIsCurrent ? createRetryIntent(selectedRow) : undefined)
    if (!intent) return
    retryFence.current = true
    setRetryError(undefined)
    setRetryState('sending')
    setPendingRetry(intent)
    setRetryTarget(undefined)
    const controller = new AbortController()
    retryRequest.current = controller
    try {
      const result = await processAutomationApi.retryNode(tenant, instanceId, intent.command, controller.signal)
      if (!alive.current || controller.signal.aborted || gatewayAuth.context.epoch !== epoch
          || !currentAllows.current(PAGE) || !currentAllows.current(RETRY)) return
      if (result.state !== 'SCHEDULED' || result.instanceId !== instanceId
          || result.occurrenceId !== intent.row.occurrenceId || result.attempt !== intent.row.attempt + 1
          || result.nodeExecutionRef === intent.row.nodeExecutionRef) {
        setRetryState('unknown')
        setRetryError('服务端没有确认新的节点尝试，请使用原请求核验。')
        return
      }
      setPendingRetry(undefined)
      setRetryState('idle')
      setRetryError(undefined)
      setReason('')
      setBusinessReceiptRef('')
      if (currentAllows.current(PAGE) && currentAllows.current(RETRY)) refreshCallback.current()
    } catch (failure) {
      if (!alive.current || controller.signal.aborted || gatewayAuth.context.epoch !== epoch
          || !currentAllows.current(PAGE) || !currentAllows.current(RETRY)) return
      if (failure instanceof ApiError && failure.status === 409 && KNOWN_RETRY_BLOCKS.has(failure.code)) {
        setPendingRetry(undefined)
        setRetryState('idle')
        setRetryNeedsRefresh(true)
        setRetryError('服务端拒绝了本次恢复请求。请先重新读取当前节点状态，再决定是否使用修正后的回执定位重新安排。')
      } else {
        setRetryState('unknown')
        setRetryError('重试结果尚未确认，请使用同一请求核验结果。')
      }
    } finally {
      if (retryRequest.current === controller) retryRequest.current = null
      retryFence.current = false
    }
  }

  const columns: TableColumnsType<NodeExecutionDTO> = useMemo(() => [
    {title: '节点', dataIndex: 'nodeId', render: (value: string, row) =>
      <Button type="link" onClick={() => selectRow(row)} aria-pressed={selectedRow === row}>{value}</Button>},
    {title: '发生序号', dataIndex: 'occurrenceId'},
    {title: '尝试', dataIndex: 'attempt'},
    {title: '类型', dataIndex: 'kind', render: (kind: NodeExecutionDTO['kind']) => kindLabels[kind]},
    {title: '状态', dataIndex: 'state', render: (state: NodeExecutionDTO['state']) =>
      <Tag color={state === 'WAIT_RECOVERY' ? 'warning' : TERMINAL.has(state) ? 'default' : 'processing'}>{stateLabels[state]}</Tag>},
    {title: '开始时间（UTC）', dataIndex: 'startedAt', render: (value: string) => <UtcTime value={value} />},
    {title: '截止时间（UTC）', dataIndex: 'deadlineAt', render: (value: string) => <UtcTime value={value} />},
  ], [selectedRow])

  const goPrevious = () => {
    if (cursorTrail.length === 0) return
    const previous = cursorTrail.at(-1)
    const nextTrail = cursorTrail.slice(0, -1)
    const rows = [...nextTrail, previous].flatMap(pageCursor =>
      pagesRef.current.find(page => page.refreshToken === refreshToken && page.nodeId === nodeId
        && page.readTrigger === readTrigger
        && currentPageKey(refreshToken, nodeId, page.cursor, readTrigger)
          === currentPageKey(refreshToken, nodeId, pageCursor, readTrigger))
        ?.page.items ?? [])
    setPaging({refreshToken, nodeId, cursor: previous, previous: nextTrail})
    rowsCallback.current(rows)
    selectionCallback.current?.(matchSelection(rows, nodeId, occurrenceId, attempt)
      ?? rows.find(row => selectionKey(row) === selectedKeyRef.current))
  }
  const goNext = () => {
    if (!nextCursor) return
    setPaging({refreshToken, nodeId, cursor: nextCursor, previous: [...cursorTrail, cursor]})
  }

  return <section aria-labelledby="process-node-execution-heading" className="page-stack">
    <header className="page-heading">
      <div>
        <Typography.Title level={4} id="process-node-execution-heading">节点执行</Typography.Title>
        <Typography.Text type="secondary">执行版本固定为 {releaseVersion}</Typography.Text>
      </div>
      {stale && <Tag color="warning">实例观察结果可能已过期</Tag>}
    </header>

    {pageState === 'loading' && <div role="status">正在读取节点执行记录</div>}
    {pageState === 'error' && <Alert type="error" showIcon title="暂时无法读取节点执行记录。"
      action={<Button onClick={() => { setErrorPageKey(undefined); setReadTrigger(value => value + 1) }}>重新读取节点</Button>} />}
    {pageState === 'loaded' && currentPage?.page.items.length === 0 && visibleRows.length === 0
      && <Empty description="暂无节点执行记录" />}
    {currentPage && <Table<NodeExecutionDTO> rowKey={selectionKey} dataSource={[...currentPage.page.items]}
      columns={columns} pagination={false} scroll={{x: 980}} rowClassName={row => selectionKey(row) === selectedKey
        || row === selectedRow ? 'process-node-row-selected' : ''} />}
    {retryError && pendingRetry && <Alert type="warning" showIcon title="重试结果尚未确认"
      description={<Space orientation="vertical"><span>{retryError}</span><span>
        原请求对应 {pendingRetry.row.nodeId} · {pendingRetry.row.occurrenceId} · 尝试 {pendingRetry.row.attempt}
      </span>
      {retryState === 'unknown' && <Button onClick={() => void submitRetry(pendingRetry)}
        disabled={stale || !canRetryPermission}>使用同一请求重试</Button>}</Space>} />}
    {retryNeedsRefresh && <Alert type="warning" showIcon title="节点恢复状态已变化"
      description={retryError}
      action={<Button onClick={() => { setErrorPageKey(undefined); setReadTrigger(value => value + 1) }}>
        重新读取当前节点
      </Button>} />}
    <Space>
      <Button onClick={goPrevious} disabled={cursorTrail.length === 0 || pageState === 'loading'}>上一页</Button>
      <Button onClick={goNext} disabled={!nextCursor || pageState === 'loading'}>下一页</Button>
    </Space>

    {selectedRow && <section aria-label="所选节点执行详情" className="surface-card">
      <Typography.Title level={5}>{selectedRow.nodeId} · {selectedRow.occurrenceId} · 尝试 {selectedRow.attempt}</Typography.Title>
      <Descriptions size="small" column={{xs: 1, sm: 2}}>
        <Descriptions.Item label="执行状态">{stateLabels[selectedRow.state]}</Descriptions.Item>
        <Descriptions.Item label="类型">{kindLabels[selectedRow.kind]}</Descriptions.Item>
        <Descriptions.Item label="执行版本"><Typography.Text code>{selectedRow.version}</Typography.Text></Descriptions.Item>
        <Descriptions.Item label="输入摘要"><Typography.Text code>{selectedRow.inputSha256}</Typography.Text></Descriptions.Item>
        <Descriptions.Item label="输出结构摘要"><Typography.Text code>{selectedRow.outputSchemaSha256}</Typography.Text></Descriptions.Item>
        <Descriptions.Item label="副作用状态">{sideEffectLabel(selectedRow.sideEffectOutcome)}</Descriptions.Item>
        {selectedRow.errorCode && <Descriptions.Item label="执行代码">{selectedRow.errorCode}</Descriptions.Item>}
        <Descriptions.Item label="截止时间"><UtcTime value={selectedRow.deadlineAt} /></Descriptions.Item>
      </Descriptions>

      {dataReadable && !stale && pageState === 'loaded'
        ? <div><Typography.Text strong>节点输出</Typography.Text><pre className="process-node-output">{outputText(selectedRow)}</pre></div>
        : <Alert type="info" showIcon title={!dataReadable ? '无数据读取权限'
          : stale ? '实例观察结果可能已过期' : '节点观察结果暂不可用'}
          description={!dataReadable ? '当前身份可以查看节点状态和摘要，但不能读取节点输出。'
            : '重新读取实例并确认状态后，才可读取本次节点输出。'} />}
      {selectedRow.kind === 'AGENT' && selectedRow.agentRunId && isRunId(selectedRow.agentRunId)
        && diagnosticReadable && !stale && pageState === 'loaded'
        && <p><Link to={'/runs/' + encodeURIComponent(selectedRow.agentRunId)}>查看 Agent 执行</Link></p>}
      {selectedRow.eventReceiptIds.length > 0 && <div>
        <Typography.Text strong>关联事件回执</Typography.Text>
        <Space wrap>{selectedRow.eventReceiptIds.map(receiptId => <Button key={receiptId} type="link"
          onClick={() => receiptCallback.current?.(receiptId)}>{receiptId}</Button>)}</Space>
      </div>}
      {selectedRow.state === 'WAIT_RECOVERY' && selectedRow.sideEffectOutcome === 'UNKNOWN'
        && <Alert type="warning" showIcon title="副作用结果未知，需核验后恢复" />}
      {selectedRow.attempt === 10 && selectedRow.state === 'WAIT_RECOVERY'
        && <Typography.Text type="secondary">已达到节点尝试次数上限。</Typography.Text>}
      {canRetry && <Button onClick={() => {
        setReasonError(undefined)
        setRetryTarget({nodeExecutionRef: selectedRow.nodeExecutionRef, version: selectedRow.version})
      }}>重试节点</Button>}
    </section>}

    <Modal title="安排节点重试" open={retryTarget !== undefined} okText="确认安排重试" cancelText="返回"
      confirmLoading={retryState === 'sending'} onCancel={() => setRetryTarget(undefined)}
      okButtonProps={{disabled: !retryTargetIsCurrent}}
      onOk={() => void submitRetry()}>
      <Space orientation="vertical" className="full-width">
        <Alert type="warning" showIcon title="仅在业务副作用已核验后安排新尝试。截止时间不会延长流程期限。" />
        {retryTarget && !retryTargetIsCurrent && <Alert type="warning" showIcon
          title="节点执行状态或版本已变化，请返回并重新确认重试。" />}
        <label htmlFor="node-retry-reason">恢复原因</label>
        <Input.TextArea id="node-retry-reason" aria-label="恢复原因" maxLength={512} value={reason}
          onChange={event => { setReason(event.target.value); setReasonError(undefined) }} />
        {reasonError && <Alert type="error" title={reasonError} />}
        <label htmlFor="node-business-receipt-ref">业务回执定位（可选）</label>
        <Input id="node-business-receipt-ref" aria-label="业务回执定位（可选）" maxLength={255}
          value={businessReceiptRef} onChange={event => setBusinessReceiptRef(event.target.value)} />
        <Typography.Text type="secondary">此定位仅供服务端查询核验，不代表副作用已成功。</Typography.Text>
      </Space>
    </Modal>
  </section>

}

function currentPageKey(refreshToken: number, nodeId: string | undefined, cursor?: string, readTrigger = 0): string {
  return JSON.stringify([refreshToken, nodeId ?? null, cursor ?? null, readTrigger])
}
