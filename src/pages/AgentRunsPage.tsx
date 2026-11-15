import {Alert, Button, Card, Space, Table, Tag, Typography} from 'antd'
import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {agentApi, type AgentRun, type AgentRunPage} from '../api/agent'
import {useAuth} from '../auth/AuthContext'

export default function AgentRunsPage() {
  const {authorization} = useAuth()
  const tenant = authorization?.identity.tenantId ?? ''
  return <AgentRunsContent key={tenant} tenant={tenant} />
}

function AgentRunsContent({tenant}: {tenant: string}) {
  const navigate = useNavigate()
  const [page, setPage] = useState<AgentRunPage>()
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const [pageIndex, setPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>()
  const [revision, setRevision] = useState(0)

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
