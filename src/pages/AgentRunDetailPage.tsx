import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Descriptions, Empty, Space, Spin, Tag, Typography} from 'antd'
import {useCallback, useEffect, useRef, useState} from 'react'
import {Link, useParams} from 'react-router-dom'
import {agentApi, isRunId, isTerminal, type AgentEvent, type AgentResult, type AgentRun, type CancelCommand} from '../api/agent'
import {AgentStreamError, observeAgentRun} from '../api/agentEvents'
import {useAuth} from '../auth/AuthContext'
import {StatusTag} from './AgentRunsPage'
import MemoryPreferenceAction from './MemoryPreferenceAction'

type VisibleEvent = Readonly<{eventId: string; sequence: number; type: string; author: string | null; occurredAt: string; summary: string; completed: boolean}>

export default function AgentRunDetailPage() {
  const {runId = ''} = useParams()
  const {authorization} = useAuth()
  const tenant = authorization?.identity.tenantId ?? ''
  return <AgentRunDetailContent key={JSON.stringify([authorization?.identity.issuer, tenant, authorization?.identity.subject, authorization?.binding.requestEpoch, runId])} runId={runId} tenant={tenant} />
}

function AgentRunDetailContent({runId, tenant}: {runId: string; tenant: string}) {
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
  const lifetime = useRef<AbortController | null>(null)

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
    if (!isRunId(runId)) return () => controller.abort()
    void (async () => {
      await refresh(controller.signal)
      await observeAgentRun({tenantId: tenant, runId, afterSequence: 0, signal: controller.signal,
        onState: setConnection,
        onEvent: event => {
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
        setNotice('部分历史事件已过期，当前状态和结果仍可查询。')
        setConnection('ended')
        void refresh(controller.signal).catch(error => {
          if (!controller.signal.aborted && !isAbort(error)) setError('无法读取当前运行状态。')
        })
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
  }, [runId, tenant, refresh, reload])

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

  return <section aria-labelledby="detail-title" className="page-stack">
    <div className="page-heading">
      <div><Typography.Text type="secondary"><Link to="/runs">运行记录</Link> / 详情</Typography.Text>
        <Typography.Title id="detail-title" level={2}>运行详情</Typography.Title></div>
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
    <MemoryPreferenceAction runId={runId} completed={run?.status === 'COMPLETED'} sourceEventId={events.find(event => event.completed && event.sequence === run?.lastEventSequence)?.eventId} />
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
      <div className="detail-grid">
        <Card title="执行输出" variant="borderless" className="surface-card">
          {result?.sideEffectOutcome === 'UNKNOWN' && <Alert type="warning" showIcon message="外部操作结果待核对，请勿直接重复执行。" className="form-alert" />}
          {result?.errorCode && <Alert type="error" showIcon message={`运行错误：${result.errorCode}`} className="form-alert" />}
          {result ? <pre className="output-text">{formatOutput(result.output)}</pre>
            : partials.size ? [...partials].map(([author, text]) => <div key={author} className="partial-output">
              <Typography.Text strong>{author}</Typography.Text><pre className="output-text">{text}</pre></div>)
              : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无输出" />}
        </Card>
        <Card title={<Space>事件记录 <Tag>{connectionLabel(connection)}</Tag></Space>} variant="borderless" className="surface-card">
          {events.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无事件" />
            : <ol className="event-list">{events.map(event => <li key={event.sequence}>
              <div><Typography.Text strong>#{event.sequence} {event.type}</Typography.Text>
                {event.author && <Typography.Text type="secondary"> · {event.author}</Typography.Text>}</div>
              <Typography.Text type="secondary">{new Date(event.occurredAt).toLocaleTimeString()}</Typography.Text>
              {event.summary && <pre className="event-summary">{event.summary}</pre>}
            </li>)}</ol>}
          {events.length >= 200 && <Typography.Text type="secondary">仅展示最近 200 条事件。</Typography.Text>}
        </Card>
      </div>
    </>}
  </section>
}

const visible = (event: AgentEvent): VisibleEvent => {
  const raw = typeof event.payload.text === 'string' ? event.payload.text : JSON.stringify(event.payload)
  return {eventId: event.eventId, sequence: event.sequence, type: event.type, author: event.author, occurredAt: event.occurredAt, completed: event.type === 'RUN_STATUS_CHANGED' && event.payload.status === 'COMPLETED',
    summary: raw.length > 2048 ? `${raw.slice(0, 2048)}…` : raw === '{}' ? '' : raw}
}
const formatOutput = (output: Readonly<Record<string, unknown>>): string =>
  typeof output.text === 'string' ? output.text : JSON.stringify(output, null, 2)
const connectionLabel = (value: 'connecting' | 'live' | 'reconnecting' | 'ended') =>
  ({connecting: '连接中', live: '实时', reconnecting: '重连中', ended: '已结束'})[value]
const isAbort = (failure: unknown): boolean => failure instanceof DOMException && failure.name === 'AbortError'
