import {
  ApiError,
  useEmbeddedWorkbench,
  useWorkbenchLeaveGuard,
} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {allowsSnapshotRequirement} from '@stellar-enclosure/stellar-enclosure-web-shared/permissions'
import {Alert, Button, Descriptions, Input, Modal, Space, Tag, Typography} from 'antd'
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {Link, useParams, useSearchParams} from 'react-router-dom'
import {isProcessInstanceId} from '../api/processWorkerFailures'
import {processAutomationApi, type AutomationInstanceDTO, type CancelProcessCommand,
  type CancelProcessResult, type NodeExecutionDTO, type ProcessControlSnapshotDTO} from '../api/processAutomation'
import {gatewayAuth} from '../auth/gatewayAuth'
import {useAuth} from '../auth/AuthContext'
import {ProcessGraph} from '../components/process/ProcessGraph'
import {ProcessGraphList} from '../components/process/ProcessGraphList'
import {ProcessEventReceiptPanel} from './ProcessEventReceiptPanel'
import {ProcessNodeExecutionPanel} from './ProcessNodeExecutionPanel'

const PAGE = 'tianji.page.processInstance'
const CANCEL = 'tianji.button.processInstance.cancel'
const DATA_READ = {mode: 'ALL', codes: ['TIANJI_PROCESS_DATA_READ']} as const
const RECOVERY_PREFIX = 'tianji.process-instance-cancel.v1'
const CANCEL_BLOCKS: Readonly<Record<ProcessControlSnapshotDTO['cancellationBlockReason'], string>> = {
  NONE: '',
  PROCESS_TERMINAL: '流程实例已经结束，不能再取消。',
  MODEL_CONTAINS_CASE_SOURCE: '模型包含不支持本次取消的 Case 来源。',
}
const STATUS_LABELS: Readonly<Record<AutomationInstanceDTO['state'], string>> = {
  ACTIVE: '运行中',
  SUSPENDED: '已暂停',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELLED: '已取消',
}

type Observation =
  | {phase: 'loading'}
  | {phase: 'error'; message: string}
  | {phase: 'denied'; message: string}
  | {phase: 'instance'; snapshot: AutomationInstanceDTO; stale: boolean}

type CancelIntent = Readonly<{
  version: 1
  operation: 'PROCESS_CANCEL'
  actorFingerprint: string
  tenantId: string
  instanceId: string
  command: CancelProcessCommand
}>

type ControlState =
  | {phase: 'idle'}
  | {phase: 'loading'}
  | {phase: 'loaded'; control: ProcessControlSnapshotDTO}
  | {phase: 'error'; message: string}

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const own = Object.keys(value)
  return own.length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

async function fingerprint(issuer: string, subject: string): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(['TIANJI_PROCESS_CANCEL_OWNER_V1', issuer, subject]))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
}

function decodeIntent(value: unknown): CancelIntent | null {
  if (!exact(value, ['version', 'operation', 'actorFingerprint', 'tenantId', 'instanceId', 'command'])
      || value.version !== 1 || value.operation !== 'PROCESS_CANCEL'
      || typeof value.actorFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.actorFingerprint)
      || typeof value.tenantId !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value.tenantId)
      || !isProcessInstanceId(value.instanceId) || !exact(value.command, ['instanceId', 'commandId', 'expectedVersion', 'reason'])
      || value.command.instanceId !== value.instanceId || typeof value.command.commandId !== 'string'
      || !/^cancel-[A-Za-z0-9_.:-]{0,127}$/.test(value.command.commandId)
      || typeof value.command.expectedVersion !== 'string' || !/^[a-f0-9]{64}$/.test(value.command.expectedVersion)
      || typeof value.command.reason !== 'string' || !validCancelReason(value.command.reason)) return null
  return value as CancelIntent
}

function validCancelReason(reason: string): boolean {
  if (reason.length < 1 || reason.length > 512 || reason.startsWith(' ') || reason.endsWith(' ')) return false
  let hasVisibleContent = false
  for (const character of reason) {
    const code = character.codePointAt(0)!
    if (code === 0 || code < 0x20 || code === 0x7f) return false
    if (code >= 0xd800 && code <= 0xdfff) return false
    const whitespace = code === 0x20 || code >= 0x09 && code <= 0x0d || code >= 0x1c && code <= 0x1f
      || code === 0x1680 || code >= 0x2000 && code <= 0x2006 || code >= 0x2008 && code <= 0x200a
      || code === 0x2028 || code === 0x2029 || code === 0x205f || code === 0x3000
    if (!whitespace) hasVisibleContent = true
  }
  return hasVisibleContent
}

function recoveryKey(tenant: string, instanceId: string): string {
  return RECOVERY_PREFIX + ':' + encodeURIComponent(tenant) + ':' + encodeURIComponent(instanceId)
}

function publicFailure(failure: unknown): 'denied' | 'unavailable' {
  if (failure instanceof ApiError && ([401, 403, 404].includes(failure.status)
      || failure.status === 409 && failure.code === 'TIANJI_TENANT_CONTEXT_CHANGED')) return 'denied'
  return 'unavailable'
}

function UtcTime({value}: {value: string}) {
  return <time dateTime={value} title={value}>{value} UTC</time>
}

function activeReadWaits(control: ProcessControlSnapshotDTO): string {
  if (control.activeWaits.length === 0) return '当前没有可见的活动等待。'
  return control.activeWaits.map(wait => `${wait.activityKey}（${wait.kind}，${wait.occurrences}）`).join('、')
}

export default function ProcessInstancePage() {
  const {instanceId = ''} = useParams()
  const {status, authorization, allows} = useAuth()
  if (status !== 'ready' || !authorization || !allows(PAGE) || !isProcessInstanceId(instanceId)) {
    return <Alert type="warning" showIcon title="当前身份不能观察该流程实例。" />
  }
  const {identity, binding, snapshot} = authorization
  const canCancel = allows(CANCEL)
  const canReadData = allowsSnapshotRequirement(snapshot, binding, DATA_READ)
  const key = JSON.stringify([identity.issuer, identity.subject, identity.tenantId, binding.requestEpoch,
    instanceId, canCancel, canReadData])
  return <InstanceObservation key={key} tenant={identity.tenantId} issuer={identity.issuer} subject={identity.subject}
    instanceId={instanceId} epoch={binding.requestEpoch} canCancel={canCancel} canReadData={canReadData} />
}

function InstanceObservation({tenant, issuer, subject, instanceId, epoch, canCancel, canReadData}: {
  tenant: string
  issuer: string
  subject: string
  instanceId: string
  epoch: number
  canCancel: boolean
  canReadData: boolean
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [observation, setObservation] = useState<Observation>({phase: 'loading'})
  const [refreshToken, setRefreshToken] = useState(0)
  const [nodeRows, setNodeRows] = useState<readonly NodeExecutionDTO[]>([])
  const [selectedRow, setSelectedRow] = useState<NodeExecutionDTO>()
  const [controlState, setControlState] = useState<ControlState>({phase: 'idle'})
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelResult, setCancelResult] = useState<CancelProcessResult>()
  const [cancelError, setCancelError] = useState<string>()
  const [pendingIntent, setPendingIntent] = useState<CancelIntent>()
  const [actorFingerprint, setActorFingerprint] = useState<string>()
  const [storageReady, setStorageReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const observationRequest = useRef<AbortController | null>(null)
  const controlRequest = useRef<AbortController | null>(null)
  const cancelRequest = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const alive = useRef(false)

  const isCurrent = useCallback(() => alive.current && gatewayAuth.context.epoch === epoch, [epoch])

  useLayoutEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      sequence.current += 1
      observationRequest.current?.abort()
      controlRequest.current?.abort()
      cancelRequest.current?.abort()
      observationRequest.current = null
      controlRequest.current = null
      cancelRequest.current = null
    }
  }, [])

  useEffect(() => {
    let active = true
    const request = new AbortController()
    const requestSequence = ++sequence.current
    observationRequest.current?.abort()
    observationRequest.current = request
    void processAutomationApi.get(tenant, instanceId, request.signal).then(snapshot => {
      if (!active || !isCurrent() || request.signal.aborted || sequence.current !== requestSequence) return
      if (snapshot.instanceId !== instanceId) {
        setObservation({phase: 'denied', message: '当前无法观察该流程实例。'})
        return
      }
      setObservation({phase: 'instance', snapshot, stale: false})
    }).catch(failure => {
      if (!active || !isCurrent() || request.signal.aborted || sequence.current !== requestSequence) return
      const access = publicFailure(failure)
      if (access === 'denied') {
        setNodeRows([])
        setSelectedRow(undefined)
        setObservation({phase: 'denied', message: '当前无法观察该流程实例。'})
        return
      }
      setObservation(previous => previous.phase === 'instance'
        ? {...previous, stale: true}
        : {phase: 'error', message: '暂时无法读取流程实例。请稍后刷新。'})
    }).finally(() => {
      if (observationRequest.current === request) observationRequest.current = null
    })
    return () => {
      active = false
      request.abort()
      if (observationRequest.current === request) observationRequest.current = null
    }
  }, [epoch, instanceId, isCurrent, refreshToken, tenant])

  useEffect(() => {
    let active = true
    void fingerprint(issuer, subject).then(async actorFingerprint => {
      if (!active || !isCurrent()) return
      setActorFingerprint(actorFingerprint)
      try {
        const key = recoveryKey(tenant, instanceId)
        const stored = sessionStorage.getItem(key)
        if (!stored) {
          setStorageReady(true)
          return
        }
        const candidate = decodeIntent(JSON.parse(stored))
        if (!candidate || candidate.actorFingerprint !== actorFingerprint || candidate.tenantId !== tenant
            || candidate.instanceId !== instanceId) {
          sessionStorage.removeItem(key)
          setStorageReady(true)
          return
        }
        setPendingIntent(candidate)
        setStorageReady(true)
      } catch {
        setStorageError(true)
        setStorageReady(true)
      }
    }).catch(() => {
      if (active && isCurrent()) {
        setStorageError(true)
        setStorageReady(true)
      }
    })
    return () => { active = false }
  }, [instanceId, issuer, isCurrent, subject, tenant])

  const clearIntent = useCallback((commandId: string) => {
    try {
      const key = recoveryKey(tenant, instanceId)
      const raw = sessionStorage.getItem(key)
      if (!raw) return
      const stored = decodeIntent(JSON.parse(raw))
      if (stored?.tenantId === tenant && stored.instanceId === instanceId
          && stored.command.commandId === commandId) sessionStorage.removeItem(key)
    } catch {
      setStorageError(true)
    }
  }, [instanceId, tenant])

  const refresh = useCallback(() => {
    setNodeRows([])
    setSelectedRow(undefined)
    setObservation(current => current.phase === 'instance' ? {...current, stale: true} : current)
    setRefreshToken(current => current + 1)
  }, [])

  const fetchControl = useCallback(async (): Promise<ProcessControlSnapshotDTO | undefined> => {
    if (!isCurrent() || !canCancel) return undefined
    controlRequest.current?.abort()
    const request = new AbortController()
    controlRequest.current = request
    setControlState({phase: 'loading'})
    setCancelError(undefined)
    try {
      const value = await processAutomationApi.getControl(tenant, instanceId, request.signal)
      if (!isCurrent() || request.signal.aborted) return undefined
      if (observation.phase !== 'instance' || observation.stale
          || value.process.releaseVersion !== observation.snapshot.releaseVersion
          || value.process.status !== observation.snapshot.state) {
        setControlState({phase: 'error', message: '实例状态或发布版本已经变化。请刷新后重新确认取消。'})
        return undefined
      }
      setControlState({phase: 'loaded', control: value})
      return value
    } catch (failure) {
      if (!isCurrent() || request.signal.aborted) return undefined
      setControlState({phase: 'error', message: publicFailure(failure) === 'denied'
        ? '当前无法确认取消条件。' : '暂时无法读取当前取消条件。'})
      return undefined
    } finally {
      if (controlRequest.current === request) controlRequest.current = null
    }
  }, [canCancel, instanceId, isCurrent, observation, tenant])

  const openCancellation = async () => {
    if (!canCancel || observation.phase !== 'instance' || observation.stale || !observation.snapshot.availableActions.includes('CANCEL')
        || pendingIntent || !storageReady || storageError || !actorFingerprint) return
    setCancelOpen(true)
    setCancelReason('')
    setCancelResult(undefined)
    const current = await fetchControl()
    if (!current || !isCurrent()) return
  }

  const sendCancellation = async (intent: CancelIntent) => {
    if (!canCancel || !isCurrent() || observation.phase !== 'instance' || observation.stale
        || cancelRequest.current || intent.instanceId !== instanceId
        || intent.tenantId !== tenant || intent.command.instanceId !== instanceId
        || !pendingIntent && !observation.snapshot.availableActions.includes('CANCEL')) return
    const request = new AbortController()
    cancelRequest.current = request
    setCancelBusy(true)
    setCancelError(undefined)
    try {
      const result = await processAutomationApi.cancel(tenant, instanceId, intent.command, request.signal)
      if (!isCurrent() || request.signal.aborted) return
      clearIntent(intent.command.commandId)
      setPendingIntent(undefined)
      setCancelResult(result)
      setCancelOpen(false)
      setControlState({phase: 'idle'})
      refresh()
    } catch (failure) {
      if (!isCurrent() || request.signal.aborted) return
      if (failure instanceof ApiError && failure.status === 409 && failure.code === 'TIANJI_PROCESS_VERSION_CONFLICT') {
        clearIntent(intent.command.commandId)
        setPendingIntent(undefined)
        setCancelOpen(true)
        setControlState({phase: 'error', message: '取消版本已变化。请关闭对话框并重新读取实例状态后再确认。'})
        setCancelError('取消版本已变化。')
        return
      }
      const isAccessFailure = publicFailure(failure) === 'denied'
      if (isAccessFailure) {
        setPendingIntent(intent)
        setCancelError('取消回执暂时不可读取。首次请求仍保留，恢复访问后可使用原命令核对。')
        setObservation({phase: 'denied', message: '当前无法观察该流程实例。'})
        setCancelOpen(false)
      } else {
        setPendingIntent(intent)
        setCancelError('取消请求已发出，但结果尚未确认。请使用原请求再次核对。')
        setCancelOpen(false)
      }
    } finally {
      if (cancelRequest.current === request) cancelRequest.current = null
      if (isCurrent()) setCancelBusy(false)
    }
  }

  const confirmCancellation = async () => {
    if (!canCancel || cancelBusy || cancelRequest.current || !isCurrent()
        || observation.phase !== 'instance' || observation.stale) return
    if (pendingIntent) {
      await sendCancellation(pendingIntent)
      return
    }
    if (controlState.phase !== 'loaded' || controlState.control.allowedActions[0] !== 'CANCEL'
        || !isProcessInstanceId(instanceId) || !validCancelReason(cancelReason)
        || !globalThis.crypto?.randomUUID || !storageReady || storageError || !actorFingerprint) return
    const command: CancelProcessCommand = {
      instanceId,
      commandId: 'cancel-' + globalThis.crypto.randomUUID(),
      expectedVersion: controlState.control.version,
      reason: cancelReason,
    }
    const intent: CancelIntent = {
      version: 1, operation: 'PROCESS_CANCEL', actorFingerprint,
      tenantId: tenant, instanceId, command,
    }
    try {
      sessionStorage.setItem(recoveryKey(tenant, instanceId), JSON.stringify(intent))
    } catch {
      setStorageError(true)
      setCancelError('无法安全保留本次取消请求，流程尚未发送取消。')
      return
    }
    await sendCancellation(intent)
  }

  const searchNodeId = searchParams.get('nodeId') ?? undefined
  const selectedNodeId = observation.phase === 'instance'
    && observation.snapshot.graph.nodes.some(node => node.id === searchNodeId) ? searchNodeId : undefined
  const occurrenceId = selectedNodeId ? searchParams.get('occurrenceId') ?? undefined : undefined
  const attemptText = selectedNodeId ? searchParams.get('attempt') : null
  const attempt = attemptText && /^[1-9][0-9]?$/.test(attemptText) ? Number(attemptText) : undefined
  const receiptId = searchParams.get('receiptId') ?? undefined
  const selectedRowRef = useRef<NodeExecutionDTO | undefined>(undefined)
  useLayoutEffect(() => { selectedRowRef.current = selectedRow }, [selectedRow])
  const selectNode = (nodeId: string) => {
    if (observation.phase !== 'instance' || !observation.snapshot.graph.nodes.some(node => node.id === nodeId)) return
    setSelectedRow(undefined)
    setSearchParams({nodeId}, {replace: true})
  }
  const onRowsChange = useCallback((rows: readonly NodeExecutionDTO[]) => {
    setNodeRows(rows)
    setSelectedRow(current => current && rows.includes(current) ? current : undefined)
  }, [])
  const onSelectionChange = useCallback((row?: NodeExecutionDTO) => {
    const matched = row && selectedNodeId === row.nodeId
      && (occurrenceId === undefined || occurrenceId === row.occurrenceId)
      && (attempt === undefined || attempt === row.attempt)
      ? row : undefined
    setSelectedRow(matched)
  }, [attempt, occurrenceId, selectedNodeId])
  const selectedRowMatchesLocation = selectedRow !== undefined && selectedNodeId === selectedRow.nodeId
    && (occurrenceId === undefined || occurrenceId === selectedRow.occurrenceId)
    && (attempt === undefined || attempt === selectedRow.attempt)
  const receiptIsVisible = selectedRowMatchesLocation && receiptId !== undefined
    && selectedRow.eventReceiptIds.includes(receiptId)
  const reportReceipt = (nextReceipt: string) => {
    const row = selectedRowRef.current
    if (row && row.nodeId === selectedNodeId && row.eventReceiptIds.includes(nextReceipt)) {
      setSearchParams({nodeId: row.nodeId, occurrenceId: row.occurrenceId,
        attempt: String(row.attempt), receiptId: nextReceipt}, {replace: true})
    }
  }
  const selectNodeExecution = (row: NodeExecutionDTO) => {
    if (observation.phase !== 'instance' || !observation.snapshot.graph.nodes.some(node => node.id === row.nodeId)) return
    setSelectedRow(row)
    setSearchParams({nodeId: row.nodeId, occurrenceId: row.occurrenceId, attempt: String(row.attempt)}, {replace: true})
  }

  const canCancelInstance = canCancel && observation.phase === 'instance' && !observation.stale
    && observation.snapshot.availableActions.includes('CANCEL') && !pendingIntent
    && storageReady && !storageError && !!actorFingerprint
  const snapshot = observation.phase === 'instance' ? observation.snapshot : undefined
  const stale = observation.phase === 'instance' && observation.stale

  const {embedded, activeTabKey} = useEmbeddedWorkbench()
  useWorkbenchLeaveGuard(activeTabKey ?? `tianji:process-instance:${instanceId}`, {
    dirty: false,
    pendingMutation: cancelBusy || pendingIntent !== undefined,
  })

  if (observation.phase === 'loading' && !snapshot) {
    return <section aria-labelledby={embedded ? undefined : 'process-instance-title'} aria-label={embedded ? '流程实例' : undefined} className="page-stack">
      {!embedded && <Typography.Title id="process-instance-title" level={2}>流程实例</Typography.Title>}
      <div role="status">正在读取流程实例</div>
    </section>
  }
  if (observation.phase === 'denied') {
    return <Alert type="warning" showIcon title={observation.message} />
  }
  if (!snapshot) {
    return <section aria-labelledby={embedded ? undefined : 'process-instance-title'} aria-label={embedded ? '流程实例' : undefined} className="page-stack">
      <div className="page-heading">
        {!embedded && <div><Typography.Title id="process-instance-title" level={2}>流程实例</Typography.Title></div>}
        <Link to="/process-instances">返回实例查找</Link>
      </div>
      <Alert type="warning" showIcon title={observation.phase === 'error' ? observation.message : '当前无法观察该流程实例。'} />
      <Button onClick={refresh}>重新读取</Button>
    </section>
  }

  return <section aria-labelledby={embedded ? undefined : 'process-instance-title'} aria-label={embedded ? '流程实例' : undefined} className="page-stack">
    <header className="page-heading">
      {!embedded && (
        <div>
          <Typography.Title id="process-instance-title" level={2}>流程实例</Typography.Title>
          <Typography.Text type="secondary">查看固定发布版本与当前授权的节点执行状态。</Typography.Text>
        </div>
      )}
      <Space wrap>
        <Tag color={snapshot.state === 'ACTIVE' ? 'processing' : snapshot.state === 'COMPLETED' ? 'success' : 'default'}>
          {STATUS_LABELS[snapshot.state]}
        </Tag>
        <Button onClick={refresh} disabled={cancelBusy}>刷新实例</Button>
        {canCancelInstance && <Button danger onClick={() => void openCancellation()}>取消流程实例</Button>}
      </Space>
    </header>

    {stale && <Alert type="warning" showIcon title="实例观察已过期。危险操作已停用，请重新读取当前状态。" />}
    {observation.phase === 'instance' && cancelResult
      && <Alert type="success" showIcon title={cancelResult.accepted
        ? '取消请求已由服务端确认，正在核对实例状态。'
        : '服务端已确认流程结束，取消操作未产生新状态。'}
        description={cancelResult.linkedAgentClosureScheduled
          ? '关联 Agent 的关闭请求已安排，停止状态仍需单独观察。' : undefined} />}
    {pendingIntent && <Alert type="warning" showIcon title="取消结果尚未确认"
      description={<Space orientation="vertical" size="small">
        <span>{cancelError ?? '已保留首次请求。再次操作会使用原命令和版本。'}</span>
        <Button onClick={() => void sendCancellation(pendingIntent)}
          disabled={!canCancel || cancelBusy || observation.phase !== 'instance' || observation.stale}>重试原取消请求</Button>
      </Space>} />}
    {storageError && <Alert type="warning" showIcon title="浏览器会话存储不可用，取消操作已停用。" />}

    <Descriptions size="small" bordered column={{xs: 1, sm: 2, xl: 3}}>
      <Descriptions.Item label="流程实例标识">{snapshot.instanceId}</Descriptions.Item>
      <Descriptions.Item label="流程定义">{snapshot.definitionKey}</Descriptions.Item>
      <Descriptions.Item label="发布版本">{snapshot.releaseVersion}</Descriptions.Item>
      <Descriptions.Item label="生效修订">修订 {snapshot.activationRevision}</Descriptions.Item>
      <Descriptions.Item label="业务标识">{snapshot.businessKey}</Descriptions.Item>
      <Descriptions.Item label="关联标识">{snapshot.correlationId}</Descriptions.Item>
      <Descriptions.Item label="配置摘要"><Typography.Text code>{snapshot.configurationSha256}</Typography.Text></Descriptions.Item>
      <Descriptions.Item label="观察版本"><Typography.Text code>{snapshot.version}</Typography.Text></Descriptions.Item>
      <Descriptions.Item label="提交时间"><UtcTime value={snapshot.submittedAt} /></Descriptions.Item>
      <Descriptions.Item label="结束时间">{snapshot.finishedAt ? <UtcTime value={snapshot.finishedAt} /> : '未记录'}</Descriptions.Item>
    </Descriptions>

    {!canReadData && <Alert type="info" showIcon title="无数据读取权限" />}
    {canReadData && !stale && snapshot.output !== null && <section className="surface-card process-instance-layout__output" aria-label="流程输出">
      <Typography.Title level={4}>流程输出</Typography.Title>
      <pre>{JSON.stringify(snapshot.output, null, 2)}</pre>
    </section>}
    {canReadData && !stale && snapshot.output === null && <Typography.Text type="secondary">当前实例没有结构化输出。</Typography.Text>}
    {stale && <Typography.Text type="secondary">过期的结构化输出已隐藏。</Typography.Text>}

    <div className="process-instance-layout">
      <div className="process-instance-layout__graph">
        <ProcessGraph graph={snapshot.graph} executions={nodeRows} selectedNodeId={selectedNodeId ?? null} onSelectNode={selectNode} />
        <ProcessGraphList graph={snapshot.graph} executions={nodeRows} selectedNodeId={selectedNodeId ?? null} onSelectNode={selectNode} />
      </div>
      <div className="process-instance-layout__details">
        <ProcessNodeExecutionPanel instanceId={instanceId} releaseVersion={snapshot.releaseVersion}
          nodeId={selectedNodeId} occurrenceId={occurrenceId} attempt={attempt}
          refreshToken={refreshToken} stale={stale} onRowsChange={onRowsChange}
          onSelectionChange={onSelectionChange} onUserSelection={selectNodeExecution}
          onReceiptSelect={reportReceipt} onRefresh={refresh} />
        <ProcessEventReceiptPanel instanceId={instanceId} receiptId={receiptIsVisible ? receiptId : undefined} />
      </div>
    </div>

    <Modal title="确认取消流程实例" open={cancelOpen} onCancel={() => setCancelOpen(false)}
      onOk={() => void confirmCancellation()} okText={pendingIntent ? '重试原取消请求' : '确认取消'}
      cancelText="返回" okButtonProps={{
        disabled: cancelBusy || pendingIntent === undefined
          && (controlState.phase !== 'loaded' || controlState.control.allowedActions[0] !== 'CANCEL' || !validCancelReason(cancelReason)
            || observation.phase !== 'instance' || observation.stale),
      }} confirmLoading={cancelBusy} destroyOnHidden>
      <Space orientation="vertical" className="full-width">
        {controlState.phase === 'loading' && <div role="status">正在读取当前取消条件</div>}
        {controlState.phase === 'error' && <Alert type="warning" showIcon title={controlState.message} />}
        {controlState.phase === 'loaded' && <>
          <Typography.Text>实例状态：{STATUS_LABELS[controlState.control.process.status as AutomationInstanceDTO['state']]}</Typography.Text>
          <Typography.Text>活动等待：{activeReadWaits(controlState.control)}</Typography.Text>
          {controlState.control.cancellationBlockReason !== 'NONE'
            && <Alert type="warning" showIcon title={CANCEL_BLOCKS[controlState.control.cancellationBlockReason]} />}
          <Typography.Text>预计影响当前流程中的活动等待。</Typography.Text>
          <label htmlFor="process-cancel-reason">取消原因</label>
          <Input id="process-cancel-reason" maxLength={512} value={cancelReason}
            onChange={event => setCancelReason(event.target.value)} disabled={pendingIntent !== undefined} />
        </>}
        {cancelError && <Alert type="warning" showIcon title={cancelError} />}
        {cancelResult && <Alert type="success" showIcon title={cancelResult.accepted
          ? '取消操作已提交。' : '流程已结束，无需再次取消。'} />}
        {pendingIntent && <Alert type="warning" showIcon title="将使用首次取消请求中固定的命令、版本与原因。" />}
      </Space>
    </Modal>
  </section>
}
