import {Alert, Button, Card, Form, Input, InputNumber, Select, Space, Table, Tag, Typography} from 'antd'
import {useEffect, useRef, useState} from 'react'
import {Link} from 'react-router-dom'
import {humanTasksApi, type HumanTask, type HumanTaskPage, type HumanTaskScopeType, type HumanTaskSelection, type ListHumanTasksQuery} from '../api/humanTasks'
import {useAuth} from '../auth/AuthContext'

const READ = 'tianji.page.taskInbox', DETAIL = 'tianji.page.taskDetail', CASE = 'tianji.page.caseDetail'
type Filters = {scopeType: HumanTaskScopeType; selection: HumanTaskSelection; releaseVersion?: string; scopeId?: string; taskDefinitionKey?: string; limit: number}
const defaults: Filters = {scopeType: 'PROCESS', selection: 'ASSIGNED', limit: 20}
const initialQuery: ListHumanTasksQuery = {...defaults, releaseVersion: null, scopeId: null, taskDefinitionKey: null, afterTaskId: null}
const asciiTrim = (value: string): string => {
  let start = 0, end = value.length
  while (start < end && value.charCodeAt(start) <= 0x20) start += 1
  while (end > start && value.charCodeAt(end - 1) <= 0x20) end -= 1
  return value.slice(start, end)
}
const optional = (value?: string): string | null => value === undefined || asciiTrim(value) === '' ? null : asciiTrim(value)
const validScopeId = (value: unknown): boolean => {
  if (value === undefined || value === '') return true
  if (typeof value !== 'string') return false
  const text = asciiTrim(value)
  if (text === '') return true
  if (text.length > 255 || [...text].every(character => {
    const code = character.charCodeAt(0)
    return code >= 0x9 && code <= 0xd || code >= 0x1c && code <= 0x20 || code === 0x1680
      || code >= 0x2000 && code <= 0x2006 || code >= 0x2008 && code <= 0x200a
      || code === 0x2028 || code === 0x2029 || code === 0x205f || code === 0x3000
  })) return false
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code < 32 || code === 127 || code >= 0xdc00 && code <= 0xdfff) return false
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++index)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
    }
  }
  return true
}
const utc = new Intl.DateTimeFormat('zh-CN', {timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'})

export default function TaskInboxPage() {
  const {authorization, allows} = useAuth()
  if (!authorization || !allows(READ)) return <Alert type="warning" showIcon title="当前身份不能访问任务箱。" />
  const {identity, binding} = authorization
  return <TaskInboxContent key={JSON.stringify([identity.issuer, identity.tenantId, identity.subject, binding.requestEpoch, READ])} tenant={identity.tenantId} />
}

function TaskInboxContent({tenant}: {tenant: string}) {
  const {allows} = useAuth()
  const [form] = Form.useForm<Filters>()
  const [query, setQuery] = useState<ListHumanTasksQuery>(initialQuery)
  const [revision, setRevision] = useState(0)
  const apply = (values: Filters) => {
    if (!allows(READ)) return
    setQuery({scopeType: values.scopeType, selection: values.selection, releaseVersion: optional(values.releaseVersion), scopeId: optional(values.scopeId),
      taskDefinitionKey: optional(values.taskDefinitionKey), afterTaskId: null, limit: values.limit})
    setRevision(value => value + 1)
  }
  return <section aria-labelledby="task-inbox-title" className="page-stack">
    <div className="page-heading">
      <div><Typography.Title id="task-inbox-title" level={2}>任务箱</Typography.Title>
        <Typography.Text type="secondary">查看当前身份可见的人工任务。全部可见仍受当前身份范围限制。</Typography.Text></div>
      <Button onClick={() => { if (allows(READ)) setRevision(value => value + 1) }}>刷新</Button>
    </div>
    <Card variant="borderless" className="surface-card">
      <Form form={form} layout="vertical" initialValues={defaults} onFinish={apply} onValuesChange={(changed: Partial<Filters>) => {
        if (!allows(READ)) return
        if (changed.scopeType || changed.selection) setQuery(value => ({...value, scopeType: changed.scopeType ?? value.scopeType,
          selection: changed.selection ?? value.selection, afterTaskId: null}))
      }}>
        <Space wrap align="start">
          <Form.Item name="scopeType" label="任务范围"><Select className="memory-owner-select" options={[{value: 'PROCESS', label: '流程任务'}, {value: 'CASE', label: '案件任务'}]} /></Form.Item>
          <Form.Item name="selection" label="任务选择"><Select className="memory-owner-select" options={[{value: 'ASSIGNED', label: '我的任务'}, {value: 'CANDIDATE', label: '候选任务'}, {value: 'ALL', label: '全部可见'}]} /></Form.Item>
          <Form.Item name="releaseVersion" label="发布版本" rules={[{validator: (_, value: unknown) => value === undefined || value === ''
            || typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(asciiTrim(value)) ? Promise.resolve() : Promise.reject(new Error('请输入有效的发布版本'))}]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="scopeId" label="范围标识" rules={[{validator: (_, value: unknown) => validScopeId(value)
            ? Promise.resolve() : Promise.reject(new Error('请输入有效的范围标识'))}]}><Input autoComplete="off" /></Form.Item>
          <Form.Item name="taskDefinitionKey" label="任务定义标识" rules={[{validator: (_, value: unknown) => value === undefined || value === ''
            || typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(asciiTrim(value)) ? Promise.resolve() : Promise.reject(new Error('请输入有效的任务定义标识'))}]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="limit" label="每页数量" rules={[{required: true, type: 'integer', min: 1, max: 50, message: '每页数量须为 1 至 50 的整数'}]}>
            <InputNumber min={1} max={50} precision={0} />
          </Form.Item>
        </Space>
        <Form.Item><Button htmlType="submit">查询任务</Button></Form.Item>
      </Form>
    </Card>
    <TaskInboxResults key={JSON.stringify([query, revision])} tenant={tenant} query={query} />
  </section>
}

function TaskInboxResults({tenant, query}: {tenant: string; query: ListHumanTasksQuery}) {
  const {allows} = useAuth()
  const currentAllows = useRef(allows)
  const [page, setPage] = useState<HumanTaskPage>()
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const sequence = useRef(0)
  useEffect(() => { currentAllows.current = allows }, [allows])
  useEffect(() => {
    const controller = new AbortController(), serial = ++sequence.current
    void humanTasksApi.query(tenant, {...query, afterTaskId: cursors[pageIndex] ?? null}, controller.signal).then(value => {
      if (!controller.signal.aborted && serial === sequence.current && currentAllows.current(READ)) setPage(value)
    }).catch(() => {
      if (!controller.signal.aborted && serial === sequence.current) { setPage(undefined); setError('无法读取任务，请核对当前权限、筛选或服务配置后重试。') }
    }).finally(() => { if (!controller.signal.aborted && serial === sequence.current) setLoading(false) })
    return () => { controller.abort(); sequence.current += 1 }
  }, [tenant, query, cursors, pageIndex])
  const next = () => {
    if (loading || page?.nextAfterTaskId == null || !currentAllows.current(READ)) return
    const cursor = page.nextAfterTaskId
    setLoading(true); setPage(undefined); setError(undefined)
    setCursors(value => [...value.slice(0, pageIndex + 1), cursor]); setPageIndex(value => value + 1)
  }
  const previous = () => {
    if (loading || pageIndex === 0 || !currentAllows.current(READ)) return
    setLoading(true); setPage(undefined); setError(undefined); setPageIndex(value => value - 1)
  }
  return <Card variant="borderless" className="surface-card">
    {error && <Alert type="error" showIcon title={error} />}
    {page?.items.length === 0 && page.nextAfterTaskId !== null && <Alert type="info" showIcon title="后续可能还有可见任务，请继续查询。" />}
    <Table<HumanTask> rowKey="taskId" loading={loading} dataSource={page ? [...page.items] : []} pagination={false} scroll={{x: 1200}}
      locale={{emptyText: error ? '当前任务数据不可用' : '暂无当前可见任务'}} columns={[
        {title: '任务', dataIndex: 'name'},
        {title: '类型', dataIndex: 'kind', render: (kind: HumanTask['kind']) => <Tag>{kind === 'APPROVAL' ? '审批' : '操作'}</Tag>},
        {title: '范围', key: 'scope', render: (_, task) => <Space orientation="vertical">
          <Typography.Text type="secondary">{task.scopeType === 'CASE' ? '案件' : '流程'}</Typography.Text>
          {task.scopeType === 'CASE' && allows(CASE) ? <Link to={`/cases/${encodeURIComponent(task.scopeId)}`}>{task.scopeId}</Link> : <Typography.Text>{task.scopeId}</Typography.Text>}
        </Space>},
        {title: '发布版本', dataIndex: 'releaseVersion'}, {title: '队列', dataIndex: 'lane'},
        {title: '分配', key: 'assignment', render: (_, task) => task.assignedToMe ? '分配给我' : task.assigned ? '已分配给其他参与者' : '未认领'},
        {title: '暂停状态', dataIndex: 'suspended', render: (value: boolean) => <Tag color={value ? 'warning' : 'default'}>{value ? '已暂停' : '未暂停'}</Tag>},
        {title: '创建时间', dataIndex: 'createdAt', render: (value: string) => <time dateTime={value}>{utc.format(new Date(value))} UTC</time>},
        {title: '到期时间', dataIndex: 'dueAt', render: (value: string | null) => value === null ? '未设置' : <time dateTime={value}>{utc.format(new Date(value))} UTC</time>},
        {title: '操作', key: 'actions', render: (_, task) => allows(DETAIL) ? <Link to={`/tasks/${encodeURIComponent(task.taskId)}`}>查看任务</Link> : null},
      ]} />
    <div className="pagination-row"><Typography.Text type="secondary">第 {pageIndex + 1} 页</Typography.Text>
      <Space><Button disabled={pageIndex === 0 || loading} onClick={previous}>上一页</Button>
        <Button disabled={page?.nextAfterTaskId == null || loading} onClick={next}>下一页</Button></Space>
    </div>
  </Card>
}
