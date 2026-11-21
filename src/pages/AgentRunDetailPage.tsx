import {
  ApiError,
  useEmbeddedWorkbench,
  useWorkbenchLeaveGuard,
  type PublicOAuthIdentity,
} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Descriptions, Empty, Space, Spin, Tag, Typography} from 'antd'
import {useCallback, useEffect, useRef, useState} from 'react'
import {Link, useParams} from 'react-router-dom'
import {agentApi, isRunId, isTerminal, type AgentEvent, type AgentResult, type AgentRun, type CancelCommand} from '../api/agent'
import {AgentStreamError, observeAgentRun} from '../api/agentEvents'
import {agentRecoveryApi, type RecoveryDisposition} from '../api/agentRecovery'
import {isProcessCorrelationUtc} from '../api/processCorrelations'
import {useAuth} from '../auth/AuthContext'
import {openAgentEventCheckpoint} from '../auth/agentEventCheckpoint'
import {StatusTag} from './AgentRunsPage'

type VisibleToolEvent = Readonly<{toolKey: string; version: number; state: ToolEventState;
  accounting: 'PENDING' | 'SETTLED' | null}>
type VisibleEvent = Readonly<{eventId: string; sequence: number; type: string; author: string | null;
  occurredAt: string; summary: string; completed: boolean; tool?: VisibleToolEvent | null}>

const TOOL_STATES = {
  REQUESTED: '已记录请求', PREPARED: '已记录准备', DISPATCHING: '已记录派发中',
  AWAITING_APPROVAL: '等待审批', SUCCEEDED: '已报告成功', REJECTED: '已报告拒绝',
  FAILED_KNOWN: '已报告失败', UNKNOWN: '结果未知，需核对', UNAVAILABLE: '工具结果暂不可用',
} as const
type ToolEventState = keyof typeof TOOL_STATES
const TOOL_FIELDS = ['toolRef', 'hostInvocationId', 'state', 'dispatchEpoch', 'accountingState', 'errorCode']
const TOOL_KEY = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}(?![\s\S])/
const TOOL_UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?![\s\S])/
const TOOL_HASH = /^[0-9a-f]{64}(?![\s\S])/
const TOOL_ERROR = /^[A-Z][A-Z0-9_]{0,63}(?![\s\S])/


export default function AgentRunDetailPage() {
  const {runId = ''} = useParams()
  const {authorization} = useAuth()
  if (!authorization) return null
  const identity = authorization.identity
  return <AgentRunDetailContent key={JSON.stringify([identity.issuer, identity.tenantId, identity.subject, authorization.binding.requestEpoch, runId])}
    runId={runId} identity={identity} />
}

function AgentRunDetailContent({runId, identity}: {runId: string; identity: PublicOAuthIdentity}) {
  const {embedded, active, activeTabKey} = useEmbeddedWorkbench()
  const streamEnabled = !embedded || active
  const tenant = identity.tenantId
  const {allows} = useAuth()
  const [run, setRun] = useState<AgentRun>()
  const [result, setResult] = useState<AgentResult>()
  const [events, setEvents] = useState<VisibleEvent[]>([])
  const [partials, setPartials] = useState<Map<string, string>>(new Map())
  const [connection, setConnection] = useState<'connecting' | 'live' | 'reconnecting' | 'ended'>('connecting')
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [reload, setReload] = useState(0)
  const [cancelPending, setCancelPending] = useState<CancelCommand>()
  const [cancelling, setCancelling] = useState(false)
  const [cancelMessage, setCancelMessage] = useState<string>()
  const mutation = useRef<AbortController | null>(null)
  const refreshSequence = useRef(0)
  const seenSequences = useRef(new Set<number>())
  const lifetime = useRef<AbortController | null>(null)

  useWorkbenchLeaveGuard(activeTabKey ?? `tianji:run:${runId}`, {
    dirty: false,
    pendingMutation: cancelling,
  })

  const refresh = useCallback(async (signal: AbortSignal) => {
    const serial = ++refreshSequence.current
    const current = await agentApi.get(tenant, runId, signal)
    if (signal.aborted || serial !== refreshSequence.current) return
    setRun(current)
    if (isTerminal(current.status)) {
      const value = await agentApi.result(tenant, runId, signal)
      if (!signal.aborted && serial === refreshSequence.current) setResult(value)
    }
  }, [runId, tenant])

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    if (!isRunId(runId) || !streamEnabled) return () => controller.abort()
    let checkpoint: Awaited<ReturnType<typeof openAgentEventCheckpoint>> | undefined
    void (async () => {
      checkpoint = await openAgentEventCheckpoint(identity, runId)
      controller.signal.throwIfAborted()
      await refresh(controller.signal)
      await observeAgentRun({tenantId: tenant, runId, afterSequence: checkpoint.read(), signal: controller.signal,
        onState: setConnection,
        onEvent: event => {
          checkpoint?.advance(event.sequence)
          if (seenSequences.current.has(event.sequence)) return
          seenSequences.current.add(event.sequence)
          setEvents(previous => [...previous, visible(event)].slice(-200))
          if ((event.type === 'TEXT_DELTA' || event.type === 'AGENT_OUTPUT') && typeof event.payload.text === 'string') {
            const author = event.author ?? 'Agent'
            setPartials(previous => {
              if (!previous.has(author) && previous.size >= 8) return previous
              const next = new Map(previous)
              const text = event.payload.text as string
              const combined = event.type === 'AGENT_OUTPUT' ? text : (next.get(author) ?? '') + text
              next.set(author, combined.slice(-8_000))
              return next
            })
          }
          if (event.type === 'RUN_STATUS_CHANGED' || event.type === 'CANCEL_REQUESTED') {
            void refresh(controller.signal).catch(failure => {
              if (!controller.signal.aborted && !isAbort(failure)) setNotice('状态更新暂时不可用，可手动刷新。')
            })
          }
        },
      })
      if (!controller.signal.aborted) {
        setConnection('ended')
        await refresh(controller.signal)
      }
    })().catch(failure => {
      if (controller.signal.aborted || isAbort(failure)) return
      if (failure instanceof AgentStreamError && failure.code === 'AUTH_CHANGED') return
      if (failure instanceof AgentStreamError && failure.code === 'CURSOR_EXPIRED') {
        checkpoint?.clear()
        setNotice('部分历史事件已过期，当前状态和结果仍可查询。')
        setConnection('ended')
        void refresh(controller.signal).catch(error => {
          if (!controller.signal.aborted && !isAbort(error)) setError('无法读取当前运行状态。')
        })
      } else if ((failure instanceof ApiError && failure.status === 503)
        || (failure instanceof AgentStreamError && failure.code === 'UNAVAILABLE')) {
        setConnection('ended')
        setError('运行服务暂时不可用，请稍后刷新。')
      } else if ((failure instanceof ApiError && failure.status === 404)
        || (failure instanceof AgentStreamError && failure.code === 'NOT_FOUND')) {
        setError('运行不存在，或当前身份无权查看。')
      } else {
        setError('无法读取运行或事件流，请检查连接后重试。')
      }
    })
    return () => {
      controller.abort()
      mutation.current?.abort()
      refreshSequence.current += 1
      if (lifetime.current === controller) lifetime.current = null
    }
  }, [runId, tenant, identity, refresh, reload, streamEnabled])

  const sendCancellation = async (command: CancelCommand) => {
    if (mutation.current) return
    const controller = new AbortController()
    mutation.current = controller
    setCancelling(true)
    setCancelMessage(undefined)
    try {
      const response = await agentApi.cancel(tenant, command, controller.signal)
      if (controller.signal.aborted) return
      setCancelPending(undefined)
      setRun(current => current && response.revision >= current.revision
        ? {...current, status: response.status, revision: response.revision,
          cancelRequested: response.accepted || current.cancelRequested}
        : current)
      setCancelMessage(response.accepted
        ? response.status === 'CANCELLED' ? '运行已取消。' : '取消请求已记录，正在等待执行停止。'
        : '取消未被接受，运行可能已经结束。')
      if (lifetime.current) {
        const signal = lifetime.current.signal
        void refresh(signal).catch(failure => {
          if (!signal.aborted && !isAbort(failure)) setNotice('状态更新暂时不可用，可手动刷新。')
        })
      }
    } catch (failure) {
      if (controller.signal.aborted || isAbort(failure)) return
      if (failure instanceof ApiError && failure.code === 'TIANJI_REVISION_CONFLICT') {
        setCancelPending(undefined)
        setCancelMessage('运行状态已变化，请刷新后再决定是否取消。')
        if (lifetime.current) void refresh(lifetime.current.signal).catch(() => {})
      } else {
        setCancelPending(command)
        setCancelMessage('取消结果暂时未知，可重试同一请求或刷新状态。')
      }
    } finally {
      if (mutation.current === controller) mutation.current = null
      if (!controller.signal.aborted) setCancelling(false)
    }
  }

  const cancel = () => {
    if (!run || run.runId !== runId || cancelling || mutation.current) return
    if (cancelPending) { void sendCancellation(cancelPending); return }
    if (!globalThis.crypto?.randomUUID) { setCancelMessage('当前环境无法生成安全的请求标识。'); return }
    const command: CancelCommand = {runId, commandId: crypto.randomUUID(), expectedRevision: run.revision, reason: '用户请求取消'}
    setCancelPending(command)
    void sendCancellation(command)
  }

  const reloadDetails = () => {
    seenSequences.current.clear()
    setRun(undefined)
    setResult(undefined)
    setEvents([])
    setPartials(new Map())
    setError(undefined)
    setNotice(undefined)
    setConnection('connecting')
    setReload(value => value + 1)
  }
  const displayError = isRunId(runId) ? error : '运行标识无效。'

  return <section aria-labelledby={embedded ? undefined : 'detail-title'} aria-label={embedded ? '运行详情' : undefined} className="page-stack">
    <div className="page-heading">
      {!embedded && (
        <div><Typography.Text type="secondary"><Link to="/runs">运行记录</Link> / 详情</Typography.Text>
          <Typography.Title id="detail-title" level={2}>运行详情</Typography.Title></div>
      )}
      <Space><Button onClick={reloadDetails} disabled={cancelling}>刷新</Button>
        {run && run.runId === runId && !isTerminal(run.status) && allows('tianji.button.runDetail.cancel') &&
          <Button danger onClick={cancel} loading={cancelling} disabled={run.cancelRequested && !cancelPending}>
            {cancelPending && cancelMessage ? '重试取消请求' : '取消运行'}
          </Button>}</Space>
    </div>
    {displayError && <Alert type="error" showIcon message={displayError} />}
    {notice && <Alert type="warning" showIcon message={notice} />}
    {cancelMessage && <Alert type="info" showIcon message={cancelMessage} />}
    {!run && !displayError && <Spin description="正在读取运行" />}
    {run && run.runId === runId && <>
      <Card variant="borderless" className="surface-card">
        <Descriptions column={{xs: 1, sm: 2, lg: 3}} items={[
          {key: 'status', label: '状态', children: <StatusTag status={run.status} />},
          {key: 'definition', label: 'Agent 定义', children: run.definitionKey},
          {key: 'version', label: '定义版本', children: run.definitionVersion},
          {key: 'id', label: '运行 ID', children: <Typography.Text copyable>{run.runId}</Typography.Text>},
          {key: 'created', label: '创建时间', children: new Date(run.createdAt).toLocaleString()},
          {key: 'attempt', label: '执行次数', children: run.attempt},
        ]} />
        {run.waitReason && <Alert type="warning" showIcon message={`等待或核对原因：${run.waitReason}`} />}
        {run.cancelRequested && !isTerminal(run.status) && <Alert type="info" showIcon message="取消请求已记录，正在等待执行停止。" />}
      </Card>
      {allows('tianji.page.runDetail') && <RecoveryEvidenceCard key={reload} runId={runId} tenant={tenant} />}
      <div className="detail-grid">
        <Card title="执行输出" variant="borderless" className="surface-card">
          {result?.sideEffectOutcome === 'UNKNOWN' && <Alert type="warning" showIcon message="外部操作结果待核对，请勿直接重复执行。" className="form-alert" />}
          {result?.errorCode && <Alert type="error" showIcon message={`运行错误：${result.errorCode}`} className="form-alert" />}
          {result ? <>
            <pre className="output-text">{formatOutput(result.output)}</pre>
            {isTerminal(run.status) && isTerminal(result.status) && result.runId === run.runId &&
              <Descriptions title="用量与费用" column={{xs: 1, sm: 2}} items={[
                {key: 'usage-kind', label: '用量口径', children: result.usage?.kind === 'ACTUAL' ? '已报告实测'
                  : result.usage?.kind === 'ESTIMATED' ? '已报告估算' : '用量未知'},
                {key: 'input-tokens', label: '输入 Token', children: result.usage?.inputTokens ?? '未知'},
                {key: 'output-tokens', label: '输出 Token', children: result.usage?.outputTokens ?? '未知'},
                {key: 'total-tokens', label: '总 Token', children: result.usage?.totalTokens ?? '未知'},
                {key: 'cost', label: '费用', children: result.usage?.costReported ? '暂无可核验金额' : '费用未知'},
              ]} />}
          </> : partials.size ? [...partials].map(([author, text]) => <div key={author} className="partial-output">
              <Typography.Text strong>{author}</Typography.Text><pre className="output-text">{text}</pre></div>)
              : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无输出" />}
        </Card>
        <Card title={<Space>事件记录 <Tag>{connectionLabel(connection)}</Tag></Space>} variant="borderless" className="surface-card">
          {events.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无事件" />
            : <ol className="event-list">{events.map(event => <li key={event.sequence}>
              <div><Typography.Text strong>#{event.sequence} {event.tool === undefined ? event.type : '工具事件'}</Typography.Text>
                {event.author && <Typography.Text type="secondary"> · {event.author}</Typography.Text>}</div>
              {event.tool === undefined ? <>
                <Typography.Text type="secondary">{new Date(event.occurredAt).toLocaleTimeString()}</Typography.Text>
                {event.summary && <pre className="event-summary">{event.summary}</pre>}
              </> : <>
                {isProcessCorrelationUtc(event.occurredAt)
                  ? <Typography.Text type="secondary"><time dateTime={event.occurredAt}>{event.occurredAt} UTC</time></Typography.Text>
                  : <Typography.Text type="secondary">工具事件时间未验证</Typography.Text>}
                {event.tool === null ? <div>工具事件详情未验证</div> : <div>
                  <Typography.Text code>{event.tool.toolKey}</Typography.Text>
                  <Typography.Text> 版本 {event.tool.version} </Typography.Text>
                  <Tag>{TOOL_STATES[event.tool.state]}</Tag>
                  {event.tool.accounting !== null && <Typography.Text type="secondary">
                    {event.tool.accounting === 'SETTLED' ? '记账已结算' : '记账待确认'}
                  </Typography.Text>}
                </div>}
              </>}
            </li>)}</ol>}
          {events.length >= 200 && <Typography.Text type="secondary">仅展示最近 200 条事件。</Typography.Text>}
        </Card>
      </div>
    </>}
  </section>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isToolState = (state: unknown): state is ToolEventState =>
  typeof state === 'string' && Object.hasOwn(TOOL_STATES, state)

function toolEvidence(event: AgentEvent): VisibleToolEvent | null {
  if (event.type !== 'TOOL_STARTED' && event.type !== 'TOOL_FINISHED') return null
  const payload = event.payload
  if (!Object.keys(payload).every(key => TOOL_FIELDS.includes(key))
      || !['toolRef', 'hostInvocationId', 'state'].every(key => Object.hasOwn(payload, key))) return null
  const {toolRef, hostInvocationId, state, dispatchEpoch, accountingState, errorCode} = payload
  if (!isRecord(toolRef) || Object.keys(toolRef).length !== 3
      || !['key', 'version', 'contentSha256'].every(key => Object.hasOwn(toolRef, key))
      || typeof toolRef.key !== 'string' || !TOOL_KEY.test(toolRef.key)
      || typeof toolRef.version !== 'number' || !Number.isSafeInteger(toolRef.version) || toolRef.version < 1
      || typeof toolRef.contentSha256 !== 'string' || !TOOL_HASH.test(toolRef.contentSha256)
      || typeof hostInvocationId !== 'string' || !TOOL_UUID.test(hostInvocationId) || !isToolState(state)) return null

  const hasEpoch = Object.hasOwn(payload, 'dispatchEpoch')
  const hasAccounting = Object.hasOwn(payload, 'accountingState')
  const hasError = Object.hasOwn(payload, 'errorCode')
  const accounting = accountingState === 'PENDING' || accountingState === 'SETTLED' ? accountingState : null
  if ((hasEpoch && (typeof dispatchEpoch !== 'number' || !Number.isSafeInteger(dispatchEpoch) || dispatchEpoch < 0))
      || (hasAccounting && accounting === null)
      || (hasError && (typeof errorCode !== 'string' || !TOOL_ERROR.test(errorCode)))) return null

  if (event.type === 'TOOL_STARTED') {
    if (state !== 'REQUESTED' || dispatchEpoch !== 0 || hasAccounting || hasError) return null
  } else if (state === 'UNAVAILABLE') {
    if (hasEpoch || hasAccounting || !hasError) return null
  } else if (state === 'AWAITING_APPROVAL') {
    if (dispatchEpoch !== 0 || accounting !== 'PENDING' || hasError) return null
  } else {
    const terminal = state === 'SUCCEEDED' || state === 'REJECTED' || state === 'FAILED_KNOWN'
    if (state === 'REQUESTED' || accounting === null || (!hasEpoch && !terminal)) return null
  }
  return {toolKey: toolRef.key, version: toolRef.version, state, accounting}
}

const recoveryLifecycleLabels: Record<RecoveryDisposition['lifecycle'], string> = {
  QUEUED: '排队中', ACTIVE: '执行中', STALLED: '需要核对', TERMINAL: '已记录终态', UNVERIFIED: '未核验',
}
const recoveryReasonLabels: Record<RecoveryDisposition['reason'], string> = {
  QUEUE_DISCOVERY: '等待调度发现', CURRENT_LEASE: '当前租约有效', CANCEL_REQUESTED: '已记录取消请求',
  DEADLINE_DUE: '运行截止时间已到', LEASE_MISSING: '未找到当前租约', LEASE_EXPIRED: '运行租约已过期',
  AUTHORIZATION_DENIED: '运行授权被拒绝', AUTHORIZATION_UNAVAILABLE: '运行授权不可用',
  FENCE_UNVERIFIED: '执行边界未核验', SUSPENSION_UNVERIFIED: '暂停原因未核验',
  LEGACY_WAIT_UNVERIFIED: '既有等待状态未核验', TERMINAL_RECORDED: '已记录终态',
  SOURCE_UNAVAILABLE: '恢复证据源不可用',
}
const recoveryEffectLabels: Record<RecoveryDisposition['agentEffect'], string> = {
  RECORDED_NONE: '运行账本记录为无', RECORDED_CONFIRMED: '运行账本记录为已确认',
  UNKNOWN: '结果未知，需核对', UNVERIFIED: '未核验',
}
const recoveryCoverageLabels: Record<RecoveryDisposition['toolEvidence']['coverage'], string> = {
  COMPLETE: '本地工具证据已读完', TRUNCATED: '本地工具证据已截断', UNAVAILABLE: '本地工具证据不可用',
}
const evidenceFlag = (value: boolean | null) => value === null ? '未能确认' : value ? '已观察到' : '未观察到'

function RecoveryEvidenceCard({runId, tenant}: {runId: string; tenant: string}) {
  const pending = useRef<AbortController | null>(null)
  const [loading, setLoading] = useState(false)
  const [evidence, setEvidence] = useState<RecoveryDisposition>()
  const [error, setError] = useState<string>()

  useEffect(() => () => pending.current?.abort(), [])

  const load = async () => {
    if (pending.current) return
    const request = new AbortController()
    pending.current = request
    setLoading(true)
    setEvidence(undefined)
    setError(undefined)
    try {
      const result = await agentRecoveryApi.get(tenant, runId, request.signal)
      if (!request.signal.aborted) setEvidence(result)
    } catch (failure) {
      if (request.signal.aborted || isAbort(failure)) return
      setError(failure instanceof ApiError && failure.status === 404
        ? '当前无法读取该运行的恢复证据。' : '暂时无法读取恢复证据。')
    } finally {
      if (pending.current === request) pending.current = null
      if (!request.signal.aborted) setLoading(false)
    }
  }

  return <Card title="恢复证据" variant="borderless" className="surface-card">
    <Button onClick={() => void load()} loading={loading} disabled={loading}>读取恢复证据</Button>
    {error && <Alert type="warning" showIcon message={error} />}
    {evidence && <>
      <Typography.Paragraph type="secondary">来源：Agent 运行账本与本地工具证据</Typography.Paragraph>
      {evidence.evidenceConflict && <Alert type="warning" showIcon
        message="运行账本与工具证据不一致，需要人工核对。" />}
      <Descriptions column={{xs: 1, sm: 2, lg: 3}} items={[
        {key: 'time', label: '观察时间', children: <time dateTime={evidence.observedAt}>{evidence.observedAt} UTC</time>},
        {key: 'lifecycle', label: '运行状态', children: recoveryLifecycleLabels[evidence.lifecycle]},
        {key: 'reason', label: '记录原因', children: recoveryReasonLabels[evidence.reason]},
        {key: 'effect', label: '副作用记录', children: recoveryEffectLabels[evidence.agentEffect]},
        {key: 'coverage', label: '工具证据覆盖', children: recoveryCoverageLabels[evidence.toolEvidence.coverage]},
        {key: 'dispatching', label: '工具派发中', children: evidenceFlag(evidence.toolEvidence.hasDispatching)},
        {key: 'unknown', label: '工具结果未知', children: evidenceFlag(evidence.toolEvidence.hasUnknownResult)},
        {key: 'unresolved', label: '写入结果待核对', children: evidenceFlag(evidence.toolEvidence.hasUnresolvedWrite)},
        {key: 'receipt', label: '本地工具回执', children: evidenceFlag(evidence.toolEvidence.hasLocalReceipt)},
      ]} />
    </>}
  </Card>
}

const visible = (event: AgentEvent): VisibleEvent => {
  if (event.type.startsWith('TOOL_')) {
    return {eventId: event.eventId, sequence: event.sequence, type: event.type, author: null,
      occurredAt: event.occurredAt, completed: false, summary: '', tool: toolEvidence(event)}
  }
  const raw = typeof event.payload.text === 'string' ? event.payload.text : JSON.stringify(event.payload)
  return {eventId: event.eventId, sequence: event.sequence, type: event.type, author: event.author, occurredAt: event.occurredAt, completed: event.type === 'RUN_STATUS_CHANGED' && event.payload.status === 'COMPLETED',
    summary: raw.length > 2048 ? `${raw.slice(0, 2048)}…` : raw === '{}' ? '' : raw}
}
const formatOutput = (output: Readonly<Record<string, unknown>>): string =>
  typeof output.text === 'string' ? output.text : JSON.stringify(output, null, 2)
const connectionLabel = (value: 'connecting' | 'live' | 'reconnecting' | 'ended') =>
  ({connecting: '连接中', live: '实时', reconnecting: '重连中', ended: '已结束'})[value]
const isAbort = (failure: unknown): boolean => failure instanceof DOMException && failure.name === 'AbortError'
