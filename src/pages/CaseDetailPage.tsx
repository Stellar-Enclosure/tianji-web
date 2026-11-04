import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Form, Input, Modal, Space, Table, Tag, Timeline, Typography} from 'antd'
import {useCallback, useEffect, useReducer, useRef, useState} from 'react'
import {Link, useNavigate, useParams} from 'react-router-dom'
import {casesApi, type ActOnPlanItemCommand, type CaseInstance, type CaseOperationResult, type CasePlanItem,
  type CasePlanItemAction} from '../api/cases'
import {useAuth} from '../auth/AuthContext'
import {actionReducer} from './orchestrationAction'

const LOOKUP = 'tianji.page.cases'
const DETAIL = 'tianji.page.caseDetail'
const ACT = 'tianji.button.caseDetail.actPlanItem'
const labels: Record<CasePlanItemAction, string> = {
  DISABLE: '停用计划项', ENABLE: '启用计划项', START: '启动计划项', TERMINATE: '终止计划项',
}
type Operation = Readonly<{command: ActOnPlanItemCommand; source: CaseInstance}>
const utc = new Intl.DateTimeFormat('zh-CN', {timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'})

const javaWhitespace = (codePoint: number): boolean => codePoint >= 0x9 && codePoint <= 0xd || codePoint >= 0x1c && codePoint <= 0x20
  || codePoint === 0x1680 || codePoint >= 0x2000 && codePoint <= 0x2006 || codePoint >= 0x2008 && codePoint <= 0x200a
  || codePoint === 0x2028 || codePoint === 0x2029 || codePoint === 0x205f || codePoint === 0x3000
const validCaseId = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length < 1 || value.length > 255 || value.charCodeAt(0) <= 0x20
    || value.charCodeAt(value.length - 1) <= 0x20 || [...value].every(character => javaWhitespace(character.codePointAt(0) ?? 0))) return false
  for (let index = 0; index < value.length; index++) {
    const character = value.charCodeAt(index)
    if (character === 0 || character < 32 || character === 127 || character >= 0xdc00 && character <= 0xdfff) return false
    if (character >= 0xd800 && character <= 0xdbff) {
      const next = value.charCodeAt(++index)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
    }
  }
  return true
}
const freezeCase = (value: CaseInstance): CaseInstance => Object.freeze({...value,
  planItems: Object.freeze(value.planItems.map(item => Object.freeze({...item,
    availableActions: Object.freeze([...item.availableActions])}))),
})

export default function CaseDetailPage() {
  const {authorization, allows} = useAuth()
  const {caseInstanceId} = useParams()
  const readResource = caseInstanceId === undefined ? LOOKUP : DETAIL
  if (!authorization || !allows(readResource)) return <Alert type="warning" showIcon title="当前身份不能访问此案件。" />
  const {identity, binding} = authorization
  return <CaseDetailContent key={JSON.stringify([identity.issuer, identity.tenantId, identity.subject,
    binding.requestEpoch, readResource, caseInstanceId ?? null])} tenant={identity.tenantId}
    caseInstanceId={caseInstanceId} readResource={readResource} />
}

function CaseDetailContent({tenant, caseInstanceId, readResource}: {tenant: string; caseInstanceId?: string; readResource: string}) {
  const {allows} = useAuth()
  const navigate = useNavigate()
  const [form] = Form.useForm<{caseInstanceId: string}>()
  const currentAllows = useRef(allows)
  const [current, setCurrent] = useState<CaseInstance>()
  const [receipts, setReceipts] = useState<readonly CaseOperationResult[]>([])
  const [reading, setReading] = useState(caseInstanceId !== undefined)
  const [error, setError] = useState<string>()
  const [state, dispatch] = useReducer(actionReducer<Operation>, {phase: 'idle'})
  const read = useRef<AbortController | null>(null)
  const write = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  useEffect(() => { currentAllows.current = allows }, [allows])

  const load = useCallback(async (accepted = false) => {
    if (caseInstanceId === undefined || !currentAllows.current(readResource)) return
    read.current?.abort()
    const controller = new AbortController(), serial = ++sequence.current
    read.current = controller
    setCurrent(undefined); setReading(true); setError(undefined)
    try {
      const result = await casesApi.get(tenant, {caseInstanceId}, controller.signal)
      if (!controller.signal.aborted && serial === sequence.current && currentAllows.current(readResource)) setCurrent(result)
    } catch (failure) {
      if (!controller.signal.aborted && serial === sequence.current) {
        setCurrent(undefined)
        setError(accepted ? '操作已接受，当前状态暂不可用，请重新读取当前案件。'
          : failure instanceof ApiError && failure.status === 404
            ? '该案件当前不可见、状态已变化或入口尚未启用，请重新查询核对。'
            : '无法读取当前案件状态，请核对连接、当前权限或服务配置后重试。')
      }
    } finally {
      if (read.current === controller) read.current = null
      if (!controller.signal.aborted && serial === sequence.current) setReading(false)
    }
  }, [tenant, caseInstanceId, readResource])

  useEffect(() => {
    let active = true
    if (caseInstanceId !== undefined) queueMicrotask(() => { if (active) void load() })
    return () => { active = false; sequence.current += 1; read.current?.abort(); write.current?.abort() }
  }, [caseInstanceId, load])

  const lookup = ({caseInstanceId: requested}: {caseInstanceId: string}) => {
    if (state.phase !== 'idle' || read.current || write.current || !currentAllows.current(readResource) || !validCaseId(requested)) return
    setError(undefined)
    if (requested === caseInstanceId) void load()
    else navigate(`/cases/${encodeURIComponent(requested)}`)
  }

  const propose = (item: CasePlanItem, action: CasePlanItemAction) => {
    if (!current || current.status !== 'ACTIVE' || state.phase !== 'idle' || read.current || write.current
      || !currentAllows.current(readResource) || !currentAllows.current(ACT) || !item.availableActions.includes(action)) return
    if (!globalThis.crypto?.randomUUID) { setError('当前环境无法生成安全的请求标识。'); return }
    const source = freezeCase(current), selected = source.planItems.find(value => value.planItemInstanceId === item.planItemInstanceId)
    if (!selected || !selected.availableActions.includes(action)) return
    const command: ActOnPlanItemCommand = Object.freeze({commandId: crypto.randomUUID(), caseInstanceId: source.caseInstanceId,
      planItemInstanceId: selected.planItemInstanceId, expectedVersion: selected.version, action})
    setError(undefined)
    dispatch({type: 'propose', command: Object.freeze({command, source})})
  }

  const send = async (operation: Operation) => {
    if (write.current || read.current || state.phase !== 'proposed' && state.phase !== 'unknown'
      || !currentAllows.current(readResource) || !currentAllows.current(ACT)) return
    const controller = new AbortController()
    write.current = controller
    dispatch({type: 'send'}); setError(undefined)
    try {
      const result = await casesApi.actPlanItem(tenant, operation.command, operation.source, controller.signal)
      if (!controller.signal.aborted && write.current === controller && currentAllows.current(readResource)) {
        setReceipts(value => [...value, result]); setCurrent(undefined); dispatch({type: 'settled'})
        write.current = null
        void load(true)
      }
    } catch (failure) {
      if (!controller.signal.aborted && write.current === controller) {
        const definitive = failure instanceof ApiError && failure.status >= 400 && failure.status < 500
          && failure.status !== 408 && failure.status !== 429
        if (definitive) {
          setCurrent(undefined); dispatch({type: 'settled'})
          setError('案件、计划项或当前权限已变化，请重新读取并审阅后再操作。')
        } else {
          dispatch({type: 'uncertain'})
          setError('操作结果暂时未知。请重试原请求，暂不能更改案件标识、刷新或执行其他动作。离开页面不代表撤回操作。')
        }
      }
    } finally {
      if (write.current === controller) write.current = null
    }
  }

  const frozen = state.phase !== 'idle'
  const proposed = state.phase === 'proposed' ? state.command : undefined
  const pending = state.phase === 'unknown' ? state.command : undefined
  const selected = proposed?.source.planItems.find(item => item.planItemInstanceId === proposed.command.planItemInstanceId)
  const timeline = current ? [
    {content: <Space wrap><Typography.Text>案件已提交</Typography.Text><time dateTime={current.submittedAt}>{utc.format(new Date(current.submittedAt))} UTC</time></Space>},
    current.finishedAt === null
      ? {content: <Typography.Text>案件当前进行中</Typography.Text>}
      : {content: <Space wrap><Typography.Text>{`案件已结束（${current.status}）`}</Typography.Text>
        <time dateTime={current.finishedAt}>{utc.format(new Date(current.finishedAt))} UTC</time></Space>},
  ] : []

  return <section aria-labelledby="case-detail-title" className="page-stack">
    <div className="page-heading">
      <div><Typography.Title id="case-detail-title" level={2}>{caseInstanceId === undefined ? '案件查询' : '案件详情'}</Typography.Title>
        <Typography.Text type="secondary">按已获授权的案件标识读取当前事实；实际动作资格由服务器再次核对。</Typography.Text></div>
      <Space>
        {!frozen && caseInstanceId !== undefined && allows(LOOKUP) && <Link to="/cases">返回案件查询</Link>}
        <Button disabled={caseInstanceId === undefined || reading || frozen} onClick={() => {
          if (!read.current && !write.current && state.phase === 'idle' && currentAllows.current(readResource)) void load()
        }}>刷新当前状态</Button>
      </Space>
    </div>
    <Card variant="borderless" className="surface-card" title="案件标识查询">
      <Form form={form} layout="vertical" initialValues={{caseInstanceId: caseInstanceId ?? ''}} disabled={reading || frozen}
        onFinish={lookup} className="full-width">
        <Form.Item name="caseInstanceId" label="案件标识" rules={[{validator: (_, value: unknown) => validCaseId(value)
          ? Promise.resolve() : Promise.reject(new Error('请输入有效案件标识'))}]}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item><Button type="primary" htmlType="submit" disabled={reading || frozen}>查询案件</Button></Form.Item>
      </Form>
    </Card>
    {current && <Card variant="borderless" className="surface-card" title="案件当前事实">
      <Space orientation="vertical" className="full-width">
        <Space wrap><Tag color={current.status === 'ACTIVE' ? 'processing' : current.status === 'COMPLETED' ? 'success' : 'default'}>{current.status}</Tag>
          <Typography.Text>案件标识：{current.caseInstanceId}</Typography.Text></Space>
        <Typography.Text>定义：{current.definitionKey}；发布版本：{current.releaseVersion}</Typography.Text>
        <Typography.Text>业务标识：{current.businessKey}；关联标识：{current.correlationId}</Typography.Text>
        <Alert type="info" showIcon title="当前接口不提供完整案件历史；这里只显示当前状态和真实提交、结束时间。" />
        <Timeline items={timeline} />
        <Table<CasePlanItem> rowKey="planItemInstanceId" dataSource={[...current.planItems]} pagination={false} scroll={{x: 900}}
          locale={{emptyText: '暂无当前计划项'}} columns={[
            {title: '计划项', dataIndex: 'planItemDefinitionKey'},
            {title: '类型', dataIndex: 'kind', render: (kind: CasePlanItem['kind']) => <Tag>{kind === 'MILESTONE' ? '里程碑' : '人工任务'}</Tag>},
            {title: '当前状态', dataIndex: 'state'},
            {title: '允许操作', key: 'actions', render: (_, item) => current.status === 'ACTIVE' && allows(ACT)
              ? <Space wrap>{item.availableActions.map(action => <Button key={action} disabled={reading || frozen}
                onClick={() => propose(item, action)}>{labels[action]}</Button>)}</Space> : null},
          ]} />
      </Space>
    </Card>}
    {reading && <Typography.Text role="status" type="secondary">正在读取当前案件…</Typography.Text>}
    {state.phase === 'submitting' && <Typography.Text role="status" type="secondary">正在提交案件操作…</Typography.Text>}
    {error && <Alert type="warning" showIcon title={error} action={pending ? <Button disabled={!allows(ACT)}
      onClick={() => void send(pending)}>重试原请求</Button> : undefined} />}
    {receipts.length > 0 && <Card variant="borderless" className="surface-card" title="本页操作回执">
      <Space orientation="vertical" className="full-width">
        <Alert type="info" showIcon title="本页操作回执可能为重放；不是完整历史或最新状态。" />
        {receipts.map(receipt => <Card key={receipt.commandId} size="small" title="本次操作已接受">
          <Space orientation="vertical">
            <Typography.Text>计划项：{receipt.planItemDefinitionKey}；操作：{labels[receipt.action]}</Typography.Text>
            <Typography.Text>状态：{receipt.previousState} → {receipt.resultingState}</Typography.Text>
            <Typography.Text>发生时间：<time dateTime={receipt.occurredAt}>{utc.format(new Date(receipt.occurredAt))} UTC</time></Typography.Text>
          </Space>
        </Card>)}
      </Space>
    </Card>}
    <Modal open={!!proposed} title="确认案件操作" okText="确认执行" cancelText="返回检查"
      okButtonProps={{disabled: !proposed || !allows(ACT)}} onCancel={() => { if (!write.current) dispatch({type: 'cancelProposal'}) }}
      onOk={() => { if (proposed) void send(proposed) }}>
      {proposed && selected && <Space orientation="vertical" className="full-width">
        <Typography.Paragraph>确认{labels[proposed.command.action]}：{selected.planItemDefinitionKey}（{selected.planItemInstanceId}）。
          实际后续状态以刷新结果为准。</Typography.Paragraph>
        {proposed.command.action === 'TERMINATE' && <Alert type="warning" showIcon
          title="只终止所选计划项，不表示终止整个案件或完成流程。" />}
      </Space>}
    </Modal>
  </section>
}
