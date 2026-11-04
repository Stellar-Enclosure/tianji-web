import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Modal, Select, Space, Tag, Typography} from 'antd'
import {useCallback, useEffect, useReducer, useRef, useState} from 'react'
import {Link, useParams} from 'react-router-dom'
import {humanTasksApi, type ClaimHumanTaskCommand, type CompleteHumanTaskCommand, type HumanTask, type HumanTaskActionReceipt,
  type HumanTaskFormValue, type TransferHumanTaskCommand, type UnclaimHumanTaskCommand} from '../api/humanTasks'
import {useAuth} from '../auth/AuthContext'
import {actionReducer} from './orchestrationAction'
import TaskSchemaForm from './TaskSchemaForm'

const READ = 'tianji.page.taskDetail'
const resources = {claim: 'tianji.button.taskDetail.claim', unclaim: 'tianji.button.taskDetail.unclaim',
  transfer: 'tianji.button.taskDetail.transfer', complete: 'tianji.button.taskDetail.complete'} as const
const labels = {claim: '认领任务', unclaim: '归还任务', transfer: '转交任务', complete: '提交处理结果'} as const
type Operation = Readonly<{action: 'claim'; command: ClaimHumanTaskCommand; source: HumanTask}>
  | Readonly<{action: 'unclaim'; command: UnclaimHumanTaskCommand; source: HumanTask}>
  | Readonly<{action: 'transfer'; command: TransferHumanTaskCommand; source: HumanTask}>
  | Readonly<{action: 'complete'; command: CompleteHumanTaskCommand; source: HumanTask}>
const eligible = (task: HumanTask, action: Operation['action']): boolean => !task.suspended
  && (action === 'claim' ? !task.assigned : action === 'transfer' || task.assignedToMe)
const utc = new Intl.DateTimeFormat('zh-CN', {timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'})

export default function TaskDetailPage() {
  const {authorization, allows} = useAuth()
  const {taskId = ''} = useParams()
  if (!authorization || !allows(READ)) return <Alert type="warning" showIcon title="当前身份不能访问此任务。" />
  const {identity, binding} = authorization
  return <TaskDetailContent key={JSON.stringify([identity.issuer, identity.tenantId, identity.subject, binding.requestEpoch, READ, taskId])}
    tenant={identity.tenantId} taskId={taskId} />
}

function TaskDetailContent({tenant, taskId}: {tenant: string; taskId: string}) {
  const {allows} = useAuth()
  const currentAllows = useRef(allows)
  const [task, setTask] = useState<HumanTask>()
  const [receipt, setReceipt] = useState<HumanTaskActionReceipt>()
  const [lane, setLane] = useState<string>()
  const [reading, setReading] = useState(true)
  const [error, setError] = useState<string>()
  const [state, dispatch] = useReducer(actionReducer<Operation>, {phase: 'idle'})
  const read = useRef<AbortController | null>(null)
  const write = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  useEffect(() => { currentAllows.current = allows }, [allows])
  const load = useCallback(async () => {
    if (!currentAllows.current(READ)) return
    read.current?.abort()
    const controller = new AbortController(), serial = ++sequence.current
    read.current = controller
    setTask(undefined); setLane(undefined); setReading(true); setError(undefined)
    try {
      const result = await humanTasksApi.get(tenant, {taskId}, controller.signal)
      if (!controller.signal.aborted && serial === sequence.current && currentAllows.current(READ)) setTask(result)
    } catch (failure) {
      if (!controller.signal.aborted && serial === sequence.current) {
        setTask(undefined)
        setError(failure instanceof ApiError && failure.status === 404
          ? '该任务当前不可见、状态已变化或入口尚未启用，请重新读取核对。'
          : '无法读取当前任务状态，请核对连接、当前权限或服务配置后重试。')
      }
    } finally {
      if (read.current === controller) read.current = null
      if (!controller.signal.aborted && serial === sequence.current) setReading(false)
    }
  }, [tenant, taskId])
  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) void load() })
    return () => { active = false; sequence.current += 1; read.current?.abort(); write.current?.abort() }
  }, [load])

  const propose = (action: Operation['action'], form?: Readonly<Record<string, HumanTaskFormValue>>) => {
    if (!task || state.phase !== 'idle' || read.current || write.current || !currentAllows.current(READ)
      || !currentAllows.current(resources[action]) || !eligible(task, action)) return
    if (action === 'transfer' && (lane === undefined || !task.availableLanes.includes(lane)) || action === 'complete' && form === undefined) return
    if (!globalThis.crypto?.randomUUID) { setError('当前环境无法生成安全的请求标识。'); return }
    const source: HumanTask = Object.freeze({...task, availableLanes: Object.freeze([...task.availableLanes]),
      formSchema: Object.freeze(Object.fromEntries(Object.entries(task.formSchema)))})
    const base = {commandId: crypto.randomUUID(), taskId: source.taskId, expectedVersion: source.version}
    let operation: Operation
    if (action === 'transfer') operation = {action, source, command: Object.freeze({...base, targetLane: lane!})}
    else if (action === 'complete') operation = {action, source, command: Object.freeze({...base, form: Object.freeze(Object.fromEntries(Object.entries(form!)))})}
    else operation = {action, source, command: Object.freeze(base)}
    setError(undefined)
    dispatch({type: 'propose', command: Object.freeze(operation)})
  }

  const send = async (operation: Operation) => {
    if (write.current || read.current || state.phase !== 'proposed' && state.phase !== 'unknown'
      || !currentAllows.current(READ) || !currentAllows.current(resources[operation.action])) return
    const controller = new AbortController()
    write.current = controller
    dispatch({type: 'send'}); setError(undefined)
    try {
      let result: HumanTaskActionReceipt
      if (operation.action === 'claim') result = await humanTasksApi.claim(tenant, operation.command, operation.source, controller.signal)
      else if (operation.action === 'unclaim') result = await humanTasksApi.unclaim(tenant, operation.command, operation.source, controller.signal)
      else if (operation.action === 'transfer') result = await humanTasksApi.transfer(tenant, operation.command, operation.source, controller.signal)
      else result = await humanTasksApi.complete(tenant, operation.command, operation.source, controller.signal)
      if (!controller.signal.aborted && write.current === controller && currentAllows.current(READ)) {
        setReceipt(result); setTask(undefined); setLane(undefined); dispatch({type: 'settled'})
        write.current = null
        void load()
      }
    } catch (failure) {
      if (!controller.signal.aborted && write.current === controller) {
        const definitive = failure instanceof ApiError && failure.status >= 400 && failure.status < 500 && failure.status !== 408 && failure.status !== 429
        if (definitive) {
          setTask(undefined); setLane(undefined); dispatch({type: 'settled'})
          setError('任务或当前权限已变化，请重新读取并审阅后再操作。')
        } else {
          dispatch({type: 'uncertain'})
          setError('提交结果暂时未知。请重试原请求，暂不能更改表单、队列或刷新。离开页面不代表撤回操作。')
        }
      }
    } finally {
      if (write.current === controller) write.current = null
    }
  }

  const frozen = state.phase !== 'idle'
  const proposed = state.phase === 'proposed' ? state.command : undefined
  const pending = state.phase === 'unknown' ? state.command : undefined
  const proposalDecision = proposed?.action === 'complete' && proposed.source.kind === 'APPROVAL' && proposed.source.approvalField !== null
    ? proposed.command.form[proposed.source.approvalField] ? '批准' : '拒绝' : undefined
  return <section aria-labelledby="task-detail-title" className="page-stack">
    <div className="page-heading">
      <div><Typography.Title id="task-detail-title" level={2}>任务详情</Typography.Title>
        <Typography.Text type="secondary">实际处理资格由服务器核对；申请人与审批者分离。</Typography.Text></div>
      <Space>
        {!frozen && allows('tianji.page.taskInbox') && <Link to="/tasks">返回任务箱</Link>}
        <Button disabled={reading || frozen} onClick={() => {
          if (!read.current && !write.current && state.phase === 'idle' && currentAllows.current(READ)) void load()
        }}>刷新</Button>
      </Space>
    </div>
    {task && <Card variant="borderless" className="surface-card" title={task.name}>
      <Space orientation="vertical" className="full-width">
        <Space wrap><Tag>{task.kind === 'APPROVAL' ? '审批任务' : '操作任务'}</Tag>
          <Tag>{task.assignedToMe ? '分配给我' : task.assigned ? '已分配给其他参与者' : '未认领'}</Tag>
          <Tag color={task.suspended ? 'warning' : 'default'}>{task.suspended ? '已暂停' : '未暂停'}</Tag></Space>
        <Space wrap><Typography.Text type="secondary">{task.scopeType === 'CASE' ? '案件范围：' : '流程范围：'}</Typography.Text>
          {!frozen && task.scopeType === 'CASE' && allows('tianji.page.caseDetail') ? <Link to={`/cases/${encodeURIComponent(task.scopeId)}`}>{task.scopeId}</Link>
            : <Typography.Text>{task.scopeId}</Typography.Text>}</Space>
        <Typography.Text>发布版本：{task.releaseVersion}；流程定义：{task.definitionKey}；任务定义：{task.taskDefinitionKey}；当前队列：{task.lane}</Typography.Text>
        <Typography.Text>创建时间：<time dateTime={task.createdAt}>{utc.format(new Date(task.createdAt))} UTC</time></Typography.Text>
        <Typography.Text>到期时间：{task.dueAt === null ? '未设置' : <time dateTime={task.dueAt}>{utc.format(new Date(task.dueAt))} UTC</time>}</Typography.Text>
        {task.suspended && <Alert type="warning" showIcon title="任务已暂停，当前不能执行操作。" />}
        {!task.assignedToMe && <Typography.Text type="secondary">{task.assigned ? '任务已分配给其他参与者；当前不能归还或完成。' : '先认领任务，实际资格以服务器核对结果为准。'}</Typography.Text>}
        <Space wrap>
          {allows(resources.claim) && eligible(task, 'claim') && <Button disabled={frozen || reading} onClick={() => propose('claim')}>认领任务</Button>}
          {allows(resources.unclaim) && eligible(task, 'unclaim') && <Button disabled={frozen || reading} onClick={() => propose('unclaim')}>归还任务</Button>}
        </Space>
        {allows(resources.transfer) && <Space wrap>
          <label htmlFor="task-target-lane">目标队列</label>
          <Select id="task-target-lane" aria-label="目标队列" className="memory-owner-select" value={lane} disabled={frozen || reading || task.suspended}
            options={task.availableLanes.map(value => ({value, label: value}))} onChange={(value: string) => {
              if (state.phase === 'idle' && !read.current && !write.current && currentAllows.current(resources.transfer)
                && task.availableLanes.includes(value)) setLane(value)
            }} />
          <Button disabled={frozen || reading || task.suspended || lane === undefined} onClick={() => propose('transfer')}>转交任务</Button>
        </Space>}
        {allows(resources.complete) && eligible(task, 'complete') && <TaskSchemaForm
          key={JSON.stringify([task.taskId, task.version, task.formSchema, task.kind, task.approvalField])}
          schema={task.formSchema} kind={task.kind} approvalField={task.approvalField} disabled={frozen || reading}
          onSubmit={form => propose('complete', form)} />}
      </Space>
    </Card>}
    {reading && <Typography.Text role="status" type="secondary">正在读取当前任务…</Typography.Text>}
    {state.phase === 'submitting' && <Typography.Text role="status" type="secondary">正在提交任务操作…</Typography.Text>}
    {error && <Alert type="warning" showIcon title={error} action={pending ? <Button disabled={!allows(resources[pending.action])}
      onClick={() => void send(pending)}>重试原请求</Button> : undefined} />}
    {receipt && <Card variant="borderless" className="surface-card" title="本页操作回执">
      <Space orientation="vertical" className="full-width">
        <Alert type="info" showIcon title="操作已接受。此回执是本页确认的历史结果，当前任务状态以重新读取为准。" />
        <Typography.Text>操作：{receipt.action}；请求标识：{receipt.commandId}</Typography.Text>
        {receipt.approved !== null && <Typography.Text>审批决定：{receipt.approved ? '批准' : '拒绝'}</Typography.Text>}
        <Typography.Text>发生时间：<time dateTime={receipt.occurredAt}>{utc.format(new Date(receipt.occurredAt))} UTC</time></Typography.Text>
      </Space>
    </Card>}
    <Modal open={!!proposed} title={proposed ? `确认${proposalDecision ?? labels[proposed.action]}` : '确认任务操作'}
      okText="确认提交" cancelText="返回修改" okButtonProps={{disabled: !proposed || !allows(resources[proposed.action])}}
      onCancel={() => { if (!write.current) dispatch({type: 'cancelProposal'}) }} onOk={() => { if (proposed) void send(proposed) }}>
      {proposed && <Typography.Paragraph>{proposalDecision ? `明确${proposalDecision}此审批` : labels[proposed.action]}：{proposed.source.name}。
        {proposed.action === 'transfer' && `目标队列为 ${proposed.command.targetLane}。`}
        实际权限、申请与审批分离以及任务版本由服务器再次核对。</Typography.Paragraph>}
    </Modal>
  </section>
}
