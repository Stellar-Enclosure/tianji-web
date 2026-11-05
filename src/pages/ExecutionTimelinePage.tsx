import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Form, Input, Space, Table, Typography, type TableColumnsType} from 'antd'
import {useLayoutEffect, useRef, useState, type FormEvent} from 'react'
import {Link} from 'react-router-dom'
import {agentApi, type AgentRun, type AgentRunPage} from '../api/agent'
import {processAgentOutcomesApi, type ProcessAgentOutcome, type ProcessAgentOutcomePage} from '../api/processAgentOutcomes'
import {processMigrationPreflightApi, type ProcessMigrationPreflight, type ProcessMigrationPreflightStatus, type ProcessMigrationTarget} from '../api/processMigrationPreflight'
import {isProcessReleaseVersion, processReleasesApi} from '../api/processReleases'
import {isProcessStartReceiptQuery, processStartReceiptsApi, type ProcessStartReceipt, type ProcessStartReceiptQuery} from '../api/processStartReceipts'
import {isProcessCorrelationId, isProcessCorrelationQuery, isProcessCorrelationUtc, processCorrelationsApi,
  type ProcessCorrelationPage, type ProcessCorrelationQuery, type ProcessCorrelationReceipt,
  type ProcessInstanceSnapshot} from '../api/processCorrelations'
import {useAuth} from '../auth/AuthContext'
import {StatusTag} from './AgentRunsPage'

const PAGE = 'tianji.page.processCorrelations'
const AGENT_PAGE = 'tianji.page.runs'
const AGENT_DETAIL = 'tianji.page.runDetail'
const RELEASE_PAGE = 'tianji.page.processReleases'
const TIME_EXAMPLE = '2026-11-05T00:00:00Z'
const INVALID_UTC = '请输入有效的 UTC 时间。'
const INVALID_WINDOW = '请输入有效且不超过 31 天的 UTC 查询时间窗。'

type LookupForm = Pick<ProcessCorrelationQuery, 'correlationId' | 'fromInclusive' | 'toExclusive'>
type ListState = {phase: 'idle' | 'loading'}
  | {phase: 'page'; query: ProcessCorrelationQuery; page: ProcessCorrelationPage}
  | {phase: 'error'; message: string}
type DetailState = {phase: 'idle' | 'loading'}
  | {phase: 'snapshot'; snapshot: ProcessInstanceSnapshot; selection: number}
  | {phase: 'error'; message: string}
type PendingRead = {kind: 'list' | 'detail'; controller: AbortController}
type AgentListState = {phase: 'idle' | 'loading'}
  | {phase: 'page'; page: AgentRunPage}
  | {phase: 'error'; message: string}
type ProcessAgentOutcomeState = {phase: 'idle' | 'loading'}
  | {phase: 'page'; page: ProcessAgentOutcomePage}
  | {phase: 'error'; message: string}
type ProcessAgentOutcomeRow = ProcessAgentOutcome & {rowIndex: number}



function UtcTime({value}: {value: string}) {
  return <time dateTime={value}>{value} UTC</time>
}

const validation = (valid: (value: unknown) => boolean, message: string) =>
  ({validator: (_: unknown, value: unknown) => valid(value)
    ? Promise.resolve() : Promise.reject(new Error(message))})

function authFailed(failure: unknown) {
  return failure instanceof ApiError && (failure.status === 401 || failure.status === 403
    || failure.status === 409 && failure.code === 'TIANJI_TENANT_CONTEXT_CHANGED')
}

export default function ExecutionTimelinePage() {
  const {status, authorization, allows} = useAuth()
  if (status !== 'ready' || !authorization || !allows(PAGE)) {
    return <Alert type="warning" showIcon title="当前身份不能访问此页面。" />
  }
  const {identity, binding} = authorization
  return <ProcessCorrelationLookup
    key={JSON.stringify([identity.issuer, identity.tenantId, identity.subject, binding.requestEpoch])}
    tenant={identity.tenantId} />
}

function ProcessCorrelationLookup({tenant}: {tenant: string}) {
  const {allows} = useAuth()
  const currentAllows = useRef(allows)
  const [form] = Form.useForm<LookupForm>()
  const [list, setList] = useState<ListState>({phase: 'idle'})
  const [detail, setDetail] = useState<DetailState>({phase: 'idle'})
  const [agentWindow, setAgentWindow] = useState<LookupForm>()
  const read = useRef<PendingRead | null>(null)
  const sequence = useRef(0)

  useLayoutEffect(() => { currentAllows.current = allows }, [allows])
  useLayoutEffect(() => () => {
    sequence.current += 1
    read.current?.controller.abort()
    read.current = null
  }, [])

  const edit = () => {
    sequence.current += 1
    read.current?.controller.abort()
    read.current = null
    form.setFields([{name: 'correlationId', errors: []}, {name: 'fromInclusive', errors: []},
      {name: 'toExclusive', errors: []}])
    setList({phase: 'idle'})
    setDetail({phase: 'idle'})
    setAgentWindow(undefined)
  }

  const beginRead = (kind: PendingRead['kind']) => {
    read.current?.controller.abort()
    const controller = new AbortController()
    const request = ++sequence.current
    read.current = {kind, controller}
    return {
      signal: controller.signal,
      generation: request,
      isCurrent: () => !controller.signal.aborted && sequence.current === request && currentAllows.current(PAGE),
      finish: () => { if (read.current?.controller === controller) read.current = null },
    }
  }

  const load = async (query: ProcessCorrelationQuery) => {
    if (read.current?.kind === 'list' || !currentAllows.current(PAGE) || !isProcessCorrelationQuery(query)
      || form.getFieldValue('correlationId') !== query.correlationId
      || form.getFieldValue('fromInclusive') !== query.fromInclusive
      || form.getFieldValue('toExclusive') !== query.toExclusive) return
    const request = beginRead('list')
    setList({phase: 'loading'})
    setDetail({phase: 'idle'})
    try {
      const page = await processCorrelationsApi.list(tenant, query, request.signal)
      if (request.isCurrent()) {
        setList({phase: 'page', query, page})
        const {correlationId, fromInclusive, toExclusive} = query
        setAgentWindow({correlationId, fromInclusive, toExclusive})
      }
    } catch (failure) {
      if (!request.isCurrent()) return
      if (authFailed(failure)) {
        setList({phase: 'idle'})
        setAgentWindow(undefined)
        return
      }
      setList({phase: 'error', message: query.cursor
        ? '暂时无法读取下一页，请重新查询关联。' : '暂时无法读取流程关联回执。'})
    } finally {
      request.finish()
    }
  }

  const submit = (fields: LookupForm) => {
    if (!isProcessCorrelationQuery(fields)) {
      form.setFields([{name: 'toExclusive', errors: [INVALID_WINDOW]}])
      form.focusField('toExclusive')
      return
    }
    void load(fields)
  }

  const next = () => {
    if (list.phase !== 'page' || list.page.nextCursor === null) return
    void load({...list.query, cursor: list.page.nextCursor})
  }

  const openDetail = async (receipt: ProcessCorrelationReceipt) => {
    if (list.phase !== 'page' || !list.page.items.includes(receipt)
      || read.current?.kind === 'list' || !currentAllows.current(PAGE)) return
    const request = beginRead('detail')
    setDetail({phase: 'loading'})
    try {
      const snapshot = await processCorrelationsApi.detail(tenant, list.query.correlationId, receipt, request.signal)
      if (request.isCurrent()) setDetail({phase: 'snapshot', snapshot, selection: request.generation})
    } catch (failure) {
      if (!request.isCurrent()) return
      if (authFailed(failure)) {
        setList({phase: 'idle'})
        setDetail({phase: 'idle'})
        setAgentWindow(undefined)
        return
      }
      setDetail({phase: 'error', message: failure instanceof ApiError && failure.status === 404
        ? '当前无法读取该流程实例详情。' : '暂时无法读取流程实例详情。'})
    } finally {
      request.finish()
    }
  }

  const columns: TableColumnsType<ProcessCorrelationReceipt> = [
    {title: '流程实例标识', dataIndex: 'instanceId'},
    {title: '发布版本', dataIndex: 'releaseVersion'},
    {title: '提交时间', key: 'submittedAt', render: (_, row) => <UtcTime value={row.submittedAt} />},
    {title: '详情', key: 'detail', render: (_, row) =>
      <Button onClick={() => void openDetail(row)}>查看详情</Button>},
  ]

  return <section aria-labelledby="process-correlations-title" className="page-stack">
    <div className="page-heading">
      <div>
        <Typography.Title id="process-correlations-title" level={2}>流程关联查询</Typography.Title>
        <Typography.Text type="secondary">查询当前身份启动的流程回执，按需读取单个流程实例详情。</Typography.Text>
      </div>
    </div>
    <Card variant="borderless" className="surface-card" title="查询流程关联">
      <Form form={form} layout="vertical" initialValues={{correlationId: '', fromInclusive: '', toExclusive: ''}}
        onValuesChange={edit} onFinish={submit} onFinishFailed={({errorFields}) => {
          const first = errorFields[0]
          if (first) form.focusField(first.name)
        }}>
        <Form.Item name="correlationId" label="关联标识" validateTrigger="onSubmit"
          rules={[validation(isProcessCorrelationId, '请输入有效的关联标识。')]}>
          <Input autoComplete="off" maxLength={128} />
        </Form.Item>
        <Form.Item name="fromInclusive" label="开始时间（UTC，含）" validateTrigger="onSubmit"
          rules={[validation(isProcessCorrelationUtc, INVALID_UTC)]}>
          <Input autoComplete="off" maxLength={27} placeholder={TIME_EXAMPLE} />
        </Form.Item>
        <Form.Item name="toExclusive" label="结束时间（UTC，不含）" validateTrigger="onSubmit"
          rules={[validation(isProcessCorrelationUtc, INVALID_UTC)]}>
          <Input autoComplete="off" maxLength={27} placeholder={TIME_EXAMPLE} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" disabled={list.phase === 'loading'}>查询关联</Button>
        </Form.Item>
      </Form>
    </Card>
    <ProcessStartReceiptLookup tenant={tenant} isCurrent={() => currentAllows.current(PAGE)} />
    {list.phase === 'loading' && <div role="status">正在查询流程关联回执</div>}
    {list.phase === 'error' && <Alert type="warning" showIcon title={list.message} />}
    {list.phase === 'page' && <Card variant="borderless" className="surface-card" title="流程启动回执">
      <Space orientation="vertical" className="full-width">
        <Typography.Text type="secondary">来源：Process START 回执</Typography.Text>
        <Typography.Text>关联标识：{list.page.correlationId}</Typography.Text>
        <Typography.Text>观察时间：<UtcTime value={list.page.observedAt} /></Typography.Text>
        <Table<ProcessCorrelationReceipt> rowKey="instanceId" dataSource={list.page.items}
          columns={columns} pagination={false} scroll={{x: 900}} locale={{emptyText: '当前时间窗无流程启动回执'}} />
        {list.page.nextCursor !== null && <Button onClick={next}>下一页</Button>}
      </Space>
    </Card>}
    {detail.phase === 'loading' && <div role="status">正在读取流程实例详情</div>}
    {detail.phase === 'error' && <Alert type="warning" showIcon title={detail.message} />}
    {detail.phase === 'snapshot' && <Card variant="borderless" className="surface-card" title="流程实例详情">
      <Space orientation="vertical" className="full-width">
        <Typography.Text type="secondary">来源：Process 实例快照</Typography.Text>
        <Typography.Text>流程实例标识：{detail.snapshot.instanceId}</Typography.Text>
        <Typography.Text>定义标识：{detail.snapshot.definitionKey}</Typography.Text>
        <Typography.Text>发布版本：{detail.snapshot.releaseVersion}</Typography.Text>
        <Typography.Text>业务标识：{detail.snapshot.businessKey}</Typography.Text>
        <Typography.Text>状态：{detail.snapshot.status}</Typography.Text>
        <Typography.Text>提交时间：<UtcTime value={detail.snapshot.submittedAt} /></Typography.Text>
        <Typography.Text>结束时间：{detail.snapshot.finishedAt === null
          ? '未记录' : <UtcTime value={detail.snapshot.finishedAt} />}</Typography.Text>
      </Space>
    </Card>}
    {detail.phase === 'snapshot' && <ProcessAgentOutcomeLookup key={detail.selection}
      tenant={tenant} instanceId={detail.snapshot.instanceId}
      isSelectionCurrent={() => sequence.current === detail.selection && currentAllows.current(PAGE)} />}
    {detail.phase === 'snapshot' && allows(RELEASE_PAGE) && <ProcessMigrationPreflightLookup key={detail.selection}
      tenant={tenant} instance={detail.snapshot}
      isSelectionCurrent={() => sequence.current === detail.selection && currentAllows.current(PAGE)
        && currentAllows.current(RELEASE_PAGE)} />}
    {agentWindow && allows(AGENT_PAGE) && <OwnerAgentCorrelationLookup tenant={tenant} query={agentWindow} />}
  </section>
}


type StartReceiptState = {phase: 'idle' | 'loading' | 'unobserved'}
  | {phase: 'receipt'; receipt: ProcessStartReceipt}
  | {phase: 'error'; message: string}

function ProcessStartReceiptLookup({tenant, isCurrent}: {tenant: string; isCurrent: () => boolean}) {
  const [query, setQuery] = useState<ProcessStartReceiptQuery>({commandId: '', requestSha256: ''})
  const [state, setState] = useState<StartReceiptState>({phase: 'idle'})
  const pending = useRef<AbortController | null>(null)

  useLayoutEffect(() => () => {
    pending.current?.abort()
    pending.current = null
  }, [])

  const edit = (name: keyof ProcessStartReceiptQuery, value: string) => {
    pending.current?.abort()
    pending.current = null
    setQuery(previous => ({...previous, [name]: value}))
    setState({phase: 'idle'})
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending.current || !isCurrent()) return
    if (!isProcessStartReceiptQuery(query)) {
      setState({phase: 'error', message: '请输入有效的 START 命令标识和 64 位小写 SHA-256。'})
      return
    }
    const request = new AbortController()
    pending.current = request
    setState({phase: 'loading'})
    const acceptsResult = () => pending.current === request && !request.signal.aborted && isCurrent()
    try {
      const receipt = await processStartReceiptsApi.get(tenant, query, request.signal)
      if (acceptsResult()) setState({phase: 'receipt', receipt})
    } catch (failure) {
      if (!acceptsResult()) return
      if (authFailed(failure)) setState({phase: 'idle'})
      else if (failure instanceof ApiError && failure.status === 404) setState({phase: 'unobserved'})
      else setState({phase: 'error', message: '当前无法查询 START 回执。'})
    } finally {
      if (pending.current === request) pending.current = null
    }
  }

  return <Card title="核对 START 回执" variant="borderless" className="surface-card">
    <form onSubmit={submit}>
      <Space orientation="vertical" className="full-width">
        <Typography.Text type="secondary">输入原 START 命令标识和已独立留存的请求摘要。</Typography.Text>
        <label htmlFor="start-receipt-command">START 命令标识</label>
        <Input id="start-receipt-command" autoComplete="off" maxLength={128} value={query.commandId}
          onChange={event => edit('commandId', event.target.value)} />
        <label htmlFor="start-receipt-digest">原请求 SHA-256</label>
        <Input id="start-receipt-digest" autoComplete="off" maxLength={64} value={query.requestSha256}
          onChange={event => edit('requestSha256', event.target.value)} />
        <Button htmlType="submit" loading={state.phase === 'loading'} disabled={state.phase === 'loading'}>查询 START 回执</Button>
        {state.phase === 'loading' && <span role="status">正在查询 START 回执</span>}
        {state.phase === 'error' && <Alert type="warning" showIcon title={state.message} />}
        {state.phase === 'unobserved' && <Alert type="info" showIcon title="未观察到匹配的已应用 START 回执。"
          description="原请求的执行结果仍未知。" />}
        {state.phase === 'receipt' && <>
          <Typography.Text type="secondary">来源：Process 已应用 START 回执</Typography.Text>
          <Typography.Text>回执实例标识：{state.receipt.instanceId}</Typography.Text>
          <Typography.Text>回执记录时间：<UtcTime value={state.receipt.recordedAt} /></Typography.Text>
        </>}
      </Space>
    </form>
  </Card>
}

const preflightLabels: Record<ProcessMigrationPreflightStatus, string> = {
  NATIVE_STRUCTURE_VALIDATED_ONLY: '仅原生结构校验通过',
  INSTANCE_NOT_LIVE: '实例当前不可预检',
  TARGET_UNAVAILABLE: '目标发布不可用',
  TARGET_PIN_MISMATCH: '目标发布摘要不匹配',
  RELEASE_PAIR_UNSUPPORTED: '该版本组合不受支持',
  SHAPE_UNSUPPORTED: '流程结构不受支持',
  ACTIVE_EVIDENCE_UNSAFE: '当前实例证据不足',
  NATIVE_REJECTED: '原生结构校验未通过',
}

function ProcessMigrationPreflightLookup({tenant, instance, isSelectionCurrent}: {
  tenant: string
  instance: ProcessInstanceSnapshot
  isSelectionCurrent: () => boolean
}) {
  const [version, setVersion] = useState('')
  const [pin, setPin] = useState<ProcessMigrationTarget>()
  const [report, setReport] = useState<ProcessMigrationPreflight>()
  const [loading, setLoading] = useState<'release' | 'preflight'>()
  const [error, setError] = useState<string>()
  const pending = useRef<AbortController | null>(null)

  useLayoutEffect(() => () => {
    pending.current?.abort()
    pending.current = null
  }, [])

  const reset = (value: string) => {
    pending.current?.abort()
    pending.current = null
    setVersion(value)
    setPin(undefined)
    setReport(undefined)
    setLoading(undefined)
    setError(undefined)
  }
  const current = (request: AbortController) =>
    pending.current === request && !request.signal.aborted && isSelectionCurrent()
  const finish = (request: AbortController) => {
    if (pending.current !== request) return
    pending.current = null
    if (!request.signal.aborted && isSelectionCurrent()) setLoading(undefined)
  }

  const readRelease = async () => {
    if (pending.current || !isSelectionCurrent()) return
    if (!isProcessReleaseVersion(version)) {
      setError('目标发布版本无效。')
      return
    }
    const request = new AbortController()
    pending.current = request
    setLoading('release')
    setPin(undefined)
    setReport(undefined)
    setError(undefined)
    try {
      const release = await processReleasesApi.get(tenant, version, request.signal)
      if (current(request)) setPin({instanceId: instance.instanceId, sourceReleaseVersion: instance.releaseVersion,
        targetReleaseVersion: release.releaseVersion, expectedTargetManifestSha256: release.manifestSha256})
    } catch (failure) {
      if (current(request) && !authFailed(failure)) setError('当前无法读取目标发布。')
    } finally {
      finish(request)
    }
  }

  const runPreflight = async () => {
    if (pending.current || !pin || pin.targetReleaseVersion !== version || !isSelectionCurrent()) return
    const request = new AbortController()
    pending.current = request
    setLoading('preflight')
    setReport(undefined)
    setError(undefined)
    try {
      const result = await processMigrationPreflightApi.get(tenant, pin, request.signal)
      if (current(request)) setReport(result)
    } catch (failure) {
      if (current(request) && !authFailed(failure)) setError('当前无法读取迁移预检结果。')
    } finally {
      finish(request)
    }
  }

  return <Card title="单实例迁移预检" variant="borderless" className="surface-card">
    <Space orientation="vertical" className="full-width">
      <Typography.Text type="secondary">结构预检只检查当前实例与目标发布。</Typography.Text>
      <label htmlFor="migration-target-release">预检目标发布版本</label>
      <Input id="migration-target-release" value={version} onChange={event => reset(event.target.value)} />
      <Space>
        <Button onClick={() => void readRelease()} loading={loading === 'release'}
          disabled={loading !== undefined}>读取目标发布摘要</Button>
        {pin && <Button onClick={() => void runPreflight()} loading={loading === 'preflight'}
          disabled={loading !== undefined}>运行迁移预检</Button>}
      </Space>
      {pin && <Typography.Text>目标清单 SHA-256：{pin.expectedTargetManifestSha256}</Typography.Text>}
      {error && <Alert type="warning" showIcon title={error} />}
      {report && <>
        <Typography.Text strong>{preflightLabels[report.status]}</Typography.Text>
        <Typography.Text>来源发布：{report.sourceReleaseVersion} → 目标发布：{report.targetReleaseVersion}</Typography.Text>
        {report.activityId && <Typography.Text>校验活动：{report.activityId}</Typography.Text>}
        <Typography.Text>观察时间：<UtcTime value={report.observedAt} /></Typography.Text>
      </>}
    </Space>
  </Card>
}

function OwnerAgentCorrelationLookup({tenant, query}: {tenant: string; query: LookupForm}) {
  const {allows} = useAuth()
  const [state, setState] = useState<AgentListState>({phase: 'idle'})
  const pending = useRef<AbortController | null>(null)

  useLayoutEffect(() => () => {
    pending.current?.abort()
    pending.current = null
  }, [])

  const load = async (cursor?: string) => {
    if (pending.current || !allows(AGENT_PAGE)) return
    const controller = new AbortController()
    pending.current = controller
    const isCurrent = () => pending.current === controller && !controller.signal.aborted && allows(AGENT_PAGE)
    setState({phase: 'loading'})
    try {
      const page = await agentApi.listByCorrelation(tenant, cursor === undefined ? query : {...query, cursor}, controller.signal)
      if (isCurrent()) setState({phase: 'page', page})
    } catch (failure) {
      if (!isCurrent()) return
      setState({phase: 'error', message: authFailed(failure) ? '当前无法读取 Agent 运行。'
        : cursor === undefined ? '暂时无法读取 Agent 运行。' : '暂时无法读取下一页 Agent 运行，请重新查询。'})
    } finally {
      if (pending.current === controller) pending.current = null
    }
  }

  const columns: TableColumnsType<AgentRun> = [
    {title: 'Agent 运行标识', dataIndex: 'runId', render: (_, run) => allows(AGENT_DETAIL)
      ? <Link to={'/runs/' + encodeURIComponent(run.runId)}>{run.runId}</Link> : run.runId},
    {title: '运行状态', key: 'status', render: (_, run) => <StatusTag status={run.status} />},
    {title: '创建时间', key: 'createdAt', render: (_, run) => <UtcTime value={run.createdAt} />},
  ]
  const nextCursor = state.phase === 'page' ? state.page.nextCursor : null

  return <Card variant="borderless" className="surface-card" title="同关联标识的当前身份 Agent 运行">
    <Space orientation="vertical" className="full-width">
      <Typography.Text type="secondary">来源：Agent 运行记录</Typography.Text>
      <Typography.Text type="secondary">按同一标识和时间窗独立查询当前身份的运行记录。</Typography.Text>
      <Button disabled={state.phase === 'loading'} onClick={() => void load()}>查询同关联标识的 Agent 运行</Button>
      {state.phase === 'loading' && <div role="status">正在查询当前身份的 Agent 运行</div>}
      {state.phase === 'error' && <Alert type="warning" showIcon title={state.message} />}
      {state.phase === 'page' && <Table<AgentRun> rowKey="runId" dataSource={state.page.items}
        columns={columns} pagination={false} scroll={{x: 620}} locale={{emptyText: '当前时间窗无同关联标识的 Agent 运行'}} />}
      {nextCursor !== null && <Button onClick={() => void load(nextCursor)}>下一页 Agent 运行</Button>}
    </Space>
  </Card>
}


function ProcessAgentOutcomeLookup({tenant, instanceId, isSelectionCurrent}: {
  tenant: string; instanceId: string; isSelectionCurrent: () => boolean
}) {
  const [state, setState] = useState<ProcessAgentOutcomeState>({phase: 'idle'})
  const pending = useRef<AbortController | null>(null)

  useLayoutEffect(() => () => {
    pending.current?.abort()
    pending.current = null
  }, [])

  const load = async (cursor?: string) => {
    if (pending.current || !isSelectionCurrent()) return
    const controller = new AbortController()
    pending.current = controller
    const isCurrent = () => pending.current === controller && !controller.signal.aborted && isSelectionCurrent()
    setState({phase: 'loading'})
    try {
      const page = await processAgentOutcomesApi.list(tenant, instanceId, cursor, controller.signal)
      if (isCurrent()) setState({phase: 'page', page})
    } catch (failure) {
      if (!isCurrent()) return
      let message = '暂时无法读取此流程的 Agent 结果。'
      if (authFailed(failure)) message = '当前身份无法读取流程侧 Agent 结果。'
      else if (failure instanceof ApiError && failure.status === 404) message = '当前无法读取此流程的 Agent 结果。'
      else if (cursor !== undefined && failure instanceof ApiError && failure.status === 400) {
        message = '流程侧 Agent 结果分页已失效，请重新查询。'
      }
      setState({phase: 'error', message})
    } finally {
      if (pending.current === controller) pending.current = null
    }
  }

  const columns: TableColumnsType<ProcessAgentOutcomeRow> = [
    {title: '活动标识', dataIndex: 'activityId'},
    {title: '调度状态', dataIndex: 'dispatchState'},
    {title: '收件处理状态', dataIndex: 'inboxState'},
    {title: '已记录的 Agent 终态', dataIndex: 'terminalStatus', render: (_, row) => row.terminalStatus ?? '未记录'},
    {title: '调度记录时间', key: 'dispatchRecordedAt', render: (_, row) => <UtcTime value={row.dispatchRecordedAt} />},
    {title: '收件时间', key: 'receivedAt', render: (_, row) => row.receivedAt === null ? '未记录' : <UtcTime value={row.receivedAt} />},
    {title: '决定时间', key: 'decidedAt', render: (_, row) => row.decidedAt === null ? '未记录' : <UtcTime value={row.decidedAt} />},
  ]
  const nextCursor = state.phase === 'page' ? state.page.nextCursor : null

  return <Card variant="borderless" className="surface-card" title="流程侧 Agent 结果">
    <Space orientation="vertical" className="full-width">
      <Typography.Text type="secondary">来源：Process 本地调度与结果收件记录</Typography.Text>
      <Typography.Text type="secondary">收件处理状态与已记录的 Agent 终态分别显示。</Typography.Text>
      <Button disabled={state.phase === 'loading'} onClick={() => void load()}>查询流程侧 Agent 结果</Button>
      {state.phase === 'loading' && <div role="status">正在查询流程侧 Agent 结果</div>}
      {state.phase === 'error' && <Alert type="warning" showIcon title={state.message} />}
      {state.phase === 'page' && <>
        <Typography.Text>结果观察时间：<UtcTime value={state.page.observedAt} /></Typography.Text>
        <Table<ProcessAgentOutcomeRow> rowKey="rowIndex" dataSource={state.page.items.map((row, rowIndex) => ({...row, rowIndex}))}
          columns={columns} pagination={false} scroll={{x: 1180}} locale={{emptyText: '此流程暂无本地 Agent 结果记录'}} />
      </>}
      {nextCursor !== null && <Button onClick={() => void load(nextCursor)}>下一页流程侧 Agent 结果</Button>}
    </Space>
  </Card>
}
