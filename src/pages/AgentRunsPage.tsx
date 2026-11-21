import {WorkspaceList, useEmbeddedWorkbench} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Button, Space, Table, Tag, Typography} from 'antd'
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
  const {embedded} = useEmbeddedWorkbench()
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

  const refresh = () => {
    setLoading(true)
    setLoadError(undefined)
    setPageIndex(0)
    setCursors([undefined])
    setRevision(value => value + 1)
  }

  const items = page?.items ? [...page.items] : []

  return <section aria-labelledby={embedded ? undefined : 'runs-title'} aria-label={embedded ? '运行记录' : undefined} className="page-stack">
    {!embedded && (
      <div className="page-heading">
        <div><Typography.Title id="runs-title" level={2}>运行记录</Typography.Title>
          <Typography.Text type="secondary">查看当前身份创建的智能执行任务。</Typography.Text></div>
      </div>
    )}
    <WorkspaceList
      ariaLabel="运行记录"
      toolbar={<Space><Button onClick={refresh}>刷新</Button></Space>}
      pageState={{
        loading,
        error: loadError ? new Error(loadError) : null,
        empty: !loading && !loadError && items.length === 0,
        emptyDescription: '暂无运行记录',
        onRetry: refresh,
      }}
      table={
        <Table<AgentRun> rowKey="runId" dataSource={items} pagination={false}
          scroll={{x: 760}} columns={[
            {title: '状态', dataIndex: 'status', width: 150, render: (status: AgentRun['status']) => <StatusTag status={status} />},
            {title: 'Agent 定义', dataIndex: 'definitionKey', ellipsis: true},
            {title: '版本', dataIndex: 'definitionVersion', width: 90},
            {title: '创建时间', dataIndex: 'createdAt', width: 190, render: (value: string) => new Date(value).toLocaleString()},
            {title: '操作', key: 'action', width: 90, render: (_, run) => <Button type="link" onClick={() => navigate(`/runs/${encodeURIComponent(run.runId)}`)}>查看</Button>},
          ]} />
      }
      pagination={{
        mode: 'cursor',
        hasMore: Boolean(page?.nextCursor),
        hasPrevious: pageIndex > 0,
        loadingMore: loading,
        onNext: next,
        onPrevious: () => { setLoading(true); setLoadError(undefined); setPageIndex(value => value - 1) },
      }}
    />
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
