import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Form, Input, Space, Table, Tag, Typography, type TableColumnsType} from 'antd'
import {useLayoutEffect, useRef, useState} from 'react'
import {Link} from 'react-router-dom'
import {isProcessInstanceId, processWorkerFailuresApi, type ProcessWorkerFailure,
  type ProcessWorkerFailures} from '../api/processWorkerFailures'
import {useAuth} from '../auth/AuthContext'

const PAGE = 'tianji.page.workerFailures'
const PROCESS_INSTANCE_PAGE = 'tianji.page.processInstance'
const INVALID_ID = '请输入有效的流程实例标识。'

const statuses: Record<ProcessWorkerFailure['status'], string> = {
  RETRY_AVAILABLE: '服务端快照标记可重试',
  MANUAL_REVIEW: '需人工核对',
  HISTORICAL_FAILURE: '历史失败记录',
}

const reasons: Record<ProcessWorkerFailure['reason'], string> = {
  NONE: '无额外原因',
  NO_NATIVE_DEADLETTER: '当前未见原生 deadletter',
  UNKNOWN_OUTCOME: '结果未知，需核对',
  BUSINESS_REJECTED: '业务拒绝',
  RESTORE_LIMIT_REACHED: '已达恢复次数上限',
  UNSUPPORTED_NATIVE_JOB: '原生任务类型暂不支持',
  PROCESS_INACTIVE: '流程当前未运行',
  EVIDENCE_CONFLICT: '证据存在冲突',
  ACTIVE_LEASE: '仍有活动租约',
  BINDING_UNVERIFIED: '来源绑定尚未验证',
  HISTORY_INCOMPLETE: '历史证据不完整',
  UNSUPPORTED_EFFECT: '副作用类型不支持',
}

const reportedFailures: Record<ProcessWorkerFailure['reportedFailure'], string> = {
  NONE: '未报告失败结果',
  RETRYABLE: '已报告可重试',
  BUSINESS_REJECTED: '已报告业务拒绝',
  UNKNOWN: '结果未知，需核对',
  UNVERIFIED: '报告结果尚未验证',
}

const columns: TableColumnsType<ProcessWorkerFailure> = [
  {title: 'Worker 任务标识', dataIndex: 'jobId'},
  {title: '活动标识', key: 'activityId', render: (_, row) => row.activityId ?? '—'},
  {title: '原生 deadletter', key: 'nativeDeadletter', render: (_, row) => row.nativeDeadletter ? '是' : '否'},
  {title: '服务端状态', key: 'status', render: (_, row) => <Tag>{statuses[row.status]}</Tag>},
  {title: '原因', key: 'reason', render: (_, row) => reasons[row.reason]},
  {title: '已报告结果', key: 'reportedFailure', render: (_, row) => reportedFailures[row.reportedFailure]},
]

type LookupForm = {instanceId: string}
type LookupState = {phase: 'idle' | 'loading'}
  | {phase: 'snapshot'; snapshot: ProcessWorkerFailures}
  | {phase: 'error'; message: string}

export default function WorkerFailuresPage() {
  const {status, authorization, allows} = useAuth()
  if (status !== 'ready' || !authorization || !allows(PAGE)) {
    return <Alert type="warning" showIcon title="当前身份不能访问此页面。" />
  }
  const {identity, binding} = authorization
  return <WorkerFailureLookup key={JSON.stringify([identity.issuer, identity.tenantId, identity.subject, binding.requestEpoch])}
    tenant={identity.tenantId} />
}

function WorkerFailureLookup({tenant}: {tenant: string}) {
  const {allows} = useAuth()
  const currentAllows = useRef(allows)
  const [form] = Form.useForm<LookupForm>()
  const [state, setState] = useState<LookupState>({phase: 'idle'})
  const read = useRef<AbortController | null>(null)
  const sequence = useRef(0)

  useLayoutEffect(() => { currentAllows.current = allows }, [allows])
  useLayoutEffect(() => () => {
    sequence.current += 1
    read.current?.abort()
    read.current = null
  }, [])

  const edit = () => {
    sequence.current += 1
    read.current?.abort()
    read.current = null
    form.setFields([{name: 'instanceId', errors: []}])
    setState({phase: 'idle'})
  }

  const load = async ({instanceId}: LookupForm) => {
    if (read.current || !currentAllows.current(PAGE) || !isProcessInstanceId(instanceId)
      || form.getFieldValue('instanceId') !== instanceId) return
    const controller = new AbortController()
    const request = ++sequence.current
    const isCurrent = () => !controller.signal.aborted && sequence.current === request && currentAllows.current(PAGE)
    read.current = controller
    setState({phase: 'loading'})
    try {
      const snapshot = await processWorkerFailuresApi.get(tenant, instanceId, controller.signal)
      if (isCurrent()) setState({phase: 'snapshot', snapshot})
    } catch (failure) {
      if (!isCurrent()) return
      if (failure instanceof ApiError) {
        if (failure.status === 401 || failure.status === 403
          || failure.status === 409 && failure.code === 'TIANJI_TENANT_CONTEXT_CHANGED') {
          setState({phase: 'idle'})
          return
        }
        if (failure.status === 400) {
          form.setFields([{name: 'instanceId', errors: [INVALID_ID]}])
          form.focusField('instanceId')
          setState({phase: 'idle'})
          return
        }
      }
      setState({phase: 'error', message: failure instanceof ApiError && failure.status === 404
        ? '当前无法观察该流程实例。' : '暂时无法读取 Worker 失败快照。'})
    } finally {
      if (read.current === controller) read.current = null
    }
  }

  return <section aria-labelledby="worker-failures-title" className="page-stack">
    <div className="page-heading">
      <div>
        <Typography.Title id="worker-failures-title" level={2}>Worker 失败观察</Typography.Title>
        <Typography.Text type="secondary">输入已知且由当前身份启动的流程实例标识，查看服务端失败快照。</Typography.Text>
      </div>
    </div>
    <Card variant="borderless" className="surface-card" title="查询流程实例">
      <Form form={form} layout="vertical" initialValues={{instanceId: ''}} onValuesChange={edit}
        onFinish={values => void load(values)} onFinishFailed={() => form.focusField('instanceId')}>
        <Form.Item name="instanceId" label="流程实例标识" validateTrigger="onSubmit"
          rules={[{validator: (_, value: unknown) => isProcessInstanceId(value)
            ? Promise.resolve() : Promise.reject(new Error(INVALID_ID))}]}>
          <Input autoComplete="off" maxLength={255} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" disabled={state.phase === 'loading'}>查询失败快照</Button>
        </Form.Item>
      </Form>
    </Card>
    {state.phase === 'loading' && <div role="status">正在查询 Worker 失败快照</div>}
    {state.phase === 'error' && <Alert type="warning" showIcon title={state.message} />}
    {state.phase === 'snapshot' && <Card variant="borderless" className="surface-card" title="Worker 失败快照">
      <Space orientation="vertical" className="full-width">
        <Typography.Text>流程实例标识：{state.snapshot.instanceId}</Typography.Text>
        {allows(PROCESS_INSTANCE_PAGE) && <Link to={'/process-instances/' + encodeURIComponent(state.snapshot.instanceId)}>
          查看流程实例
        </Link>}
        <Typography.Text>观察时间：<time dateTime={state.snapshot.observedAt}>{state.snapshot.observedAt} UTC</time></Typography.Text>
        {state.snapshot.failures.length === 0
          ? <Alert type="info" showIcon title="此快照未返回 Worker 失败记录。" />
          : <Table<ProcessWorkerFailure> rowKey="jobId" dataSource={state.snapshot.failures} columns={columns}
              pagination={false} scroll={{x: 900}} />}
      </Space>
    </Card>}
  </section>
}
