import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Form, Input, Space, Table, Typography, type TableColumnsType} from 'antd'
import {useLayoutEffect, useRef, useState} from 'react'
import {isProcessCorrelationId, isProcessCorrelationQuery, isProcessCorrelationUtc, processCorrelationsApi,
  type ProcessCorrelationPage, type ProcessCorrelationQuery, type ProcessCorrelationReceipt,
  type ProcessInstanceSnapshot} from '../api/processCorrelations'
import {useAuth} from '../auth/AuthContext'

const PAGE = 'tianji.page.processCorrelations'
const TIME_EXAMPLE = '2026-11-05T00:00:00Z'
const INVALID_UTC = '请输入有效的 UTC 时间。'
const INVALID_WINDOW = '请输入有效且不超过 31 天的 UTC 查询时间窗。'

type LookupForm = Pick<ProcessCorrelationQuery, 'correlationId' | 'fromInclusive' | 'toExclusive'>
type ListState = {phase: 'idle' | 'loading'}
  | {phase: 'page'; query: ProcessCorrelationQuery; page: ProcessCorrelationPage}
  | {phase: 'error'; message: string}
type DetailState = {phase: 'idle' | 'loading'}
  | {phase: 'snapshot'; snapshot: ProcessInstanceSnapshot}
  | {phase: 'error'; message: string}
type PendingRead = {kind: 'list' | 'detail'; controller: AbortController}

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
  }

  const beginRead = (kind: PendingRead['kind']) => {
    read.current?.controller.abort()
    const controller = new AbortController()
    const request = ++sequence.current
    read.current = {kind, controller}
    return {
      signal: controller.signal,
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
      if (request.isCurrent()) setList({phase: 'page', query, page})
    } catch (failure) {
      if (!request.isCurrent()) return
      if (authFailed(failure)) {
        setList({phase: 'idle'})
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
      if (request.isCurrent()) setDetail({phase: 'snapshot', snapshot})
    } catch (failure) {
      if (!request.isCurrent()) return
      if (authFailed(failure)) {
        setList({phase: 'idle'})
        setDetail({phase: 'idle'})
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
  </section>
}
