import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Form, Input, InputNumber, Modal, Space, Table, Tag, Typography} from 'antd'
import {useCallback, useEffect, useRef, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {agentApi, type AgentRun, type AgentRunPage, type StartCommand} from '../api/agent'
import {useAuth} from '../auth/AuthContext'

type FormValues = {definitionKey: string; definitionVersion: number; text: string}

export default function AgentRunsPage() {
  const {authorization} = useAuth()
  const tenant = authorization?.identity.tenantId ?? ''
  return <AgentRunsContent key={tenant} tenant={tenant} />
}

function AgentRunsContent({tenant}: {tenant: string}) {
  const {allows} = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState<AgentRunPage>()
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const [pageIndex, setPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>()
  const [revision, setRevision] = useState(0)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pending, setPending] = useState<StartCommand>()
  const [submitError, setSubmitError] = useState<string>()
  const activeWrite = useRef<AbortController | null>(null)
  const [form] = Form.useForm<FormValues>()

  useEffect(() => {
    const controller = new AbortController()
    void agentApi.list(tenant, cursors[pageIndex], controller.signal).then(value => {
      if (!controller.signal.aborted) setPage(value)
    }).catch(failure => {
      if (!controller.signal.aborted && !isAbort(failure)) {
        setPage(undefined)
        setLoadError('无法读取运行记录，请稍后重试。')
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [tenant, cursors, pageIndex, revision])

  useEffect(() => () => activeWrite.current?.abort(), [])

  const send = useCallback(async (command: StartCommand) => {
    if (activeWrite.current) return
    const controller = new AbortController()
    activeWrite.current = controller
    setSubmitting(true)
    setSubmitError(undefined)
    try {
      const run = await agentApi.start(tenant, command, controller.signal)
      if (!controller.signal.aborted) navigate(`/runs/${encodeURIComponent(run.runId)}`)
    } catch (failure) {
      if (!controller.signal.aborted && !isAbort(failure)) {
        setPending(command)
        setSubmitError(failure instanceof ApiError && failure.status > 0 && failure.status < 500
          ? '请求未完成，请核对权限和输入。重试会使用同一个请求标识。'
          : '提交结果暂时未知。可重试同一请求，或返回列表核对后再操作。')
      }
    } finally {
      if (activeWrite.current === controller) activeWrite.current = null
      if (!controller.signal.aborted) setSubmitting(false)
    }
  }, [navigate, tenant])

  const start = (values: FormValues) => {
    if (activeWrite.current) return
    if (pending) { void send(pending); return }
    if (!globalThis.crypto?.randomUUID) { setSubmitError('当前环境无法生成安全的请求标识。'); return }
    const command: StartCommand = {
      definitionKey: values.definitionKey.trim(), definitionVersion: values.definitionVersion,
      idempotencyKey: crypto.randomUUID(), input: {text: values.text, artifactRefs: [], taskData: {}},
      sessionId: null, businessKey: null, correlationId: null, policyOverride: null,
    }
    setPending(command)
    void send(command)
  }

  const close = () => {
    if (submitting) return
    setOpen(false)
    setPending(undefined)
    setSubmitError(undefined)
    form.resetFields()
    setLoading(true)
    setLoadError(undefined)
    setPageIndex(0)
    setCursors([undefined])
    setRevision(value => value + 1)
  }

  const next = () => {
    if (!page?.nextCursor) return
    setLoading(true)
    setLoadError(undefined)
    setCursors(current => [...current.slice(0, pageIndex + 1), page.nextCursor ?? undefined])
    setPageIndex(value => value + 1)
  }

  return <section aria-labelledby="runs-title" className="page-stack">
    <div className="page-heading">
      <div><Typography.Title id="runs-title" level={2}>运行记录</Typography.Title>
        <Typography.Text type="secondary">查看当前身份创建的智能执行任务。</Typography.Text></div>
      <Space>
        <Button onClick={() => { setLoading(true); setLoadError(undefined); setPageIndex(0); setCursors([undefined]); setRevision(value => value + 1) }}>刷新</Button>
        {allows('tianji.button.runs.start') && <Button type="primary" onClick={() => setOpen(true)}>启动运行</Button>}
      </Space>
    </div>
    {loadError && <Alert type="error" showIcon message={loadError} />}
    <Card variant="borderless" className="surface-card">
      <Table<AgentRun> rowKey="runId" loading={loading} dataSource={page?.items ? [...page.items] : []} pagination={false}
        locale={{emptyText: '暂无运行记录'}} scroll={{x: 760}} columns={[
          {title: '状态', dataIndex: 'status', width: 150, render: (status: AgentRun['status']) => <StatusTag status={status} />},
          {title: 'Agent 定义', dataIndex: 'definitionKey', ellipsis: true},
          {title: '版本', dataIndex: 'definitionVersion', width: 90},
          {title: '创建时间', dataIndex: 'createdAt', width: 190, render: (value: string) => new Date(value).toLocaleString()},
          {title: '操作', key: 'action', width: 90, render: (_, run) => <Button type="link" onClick={() => navigate(`/runs/${encodeURIComponent(run.runId)}`)}>查看</Button>},
        ]} />
      <div className="pagination-row"><Typography.Text type="secondary">第 {pageIndex + 1} 页</Typography.Text>
        <Space><Button disabled={pageIndex === 0 || loading} onClick={() => { setLoading(true); setLoadError(undefined); setPageIndex(value => value - 1) }}>上一页</Button>
          <Button disabled={!page?.nextCursor || loading} onClick={next}>下一页</Button></Space></div>
    </Card>
    <Modal title="启动 Agent 运行" open={open} onCancel={close}
      onOk={() => pending && submitError ? void send(pending) : form.submit()}
      okText={pending && submitError ? '重试同一请求' : '启动'} confirmLoading={submitting} cancelText="返回列表" destroyOnHidden>
      {submitError && <Alert type="warning" showIcon message={submitError} className="form-alert" />}
      <Form form={form} layout="vertical" initialValues={{definitionVersion: 1}} onFinish={start} disabled={submitting || !!submitError}>
        <Form.Item name="definitionKey" label="Agent 定义标识" rules={[{required: true, whitespace: true, max: 128}]}>
          <Input autoComplete="off" placeholder="例如：research-assistant" />
        </Form.Item>
        <Form.Item name="definitionVersion" label="定义版本" rules={[{required: true, type: 'number', min: 1}]}>
          <InputNumber min={1} precision={0} max={Number.MAX_SAFE_INTEGER} className="full-width" />
        </Form.Item>
        <Form.Item name="text" label="任务内容" rules={[{required: true, whitespace: true, max: 100_000}]}>
          <Input.TextArea rows={5} placeholder="描述希望 Agent 完成的任务" />
        </Form.Item>
      </Form>
    </Modal>
  </section>
}

export function StatusTag({status}: {status: AgentRun['status']}) {
  const colors: Partial<Record<AgentRun['status'], string>> = {COMPLETED: 'success', FAILED: 'error', TIMED_OUT: 'error',
    CANCELLED: 'default', RUNNING: 'processing', WAITING: 'warning', SUSPENDED: 'warning'}
  const labels: Record<AgentRun['status'], string> = {CREATED: '已创建', QUEUED: '排队中', RUNNING: '执行中', WAITING: '等待中',
    SUSPENDED: '需核对', COMPLETED: '已完成', FAILED: '失败', CANCELLED: '已取消', TIMED_OUT: '已超时'}
  return <Tag color={colors[status]}>{labels[status]}</Tag>
}

const isAbort = (failure: unknown): boolean => failure instanceof DOMException && failure.name === 'AbortError'
