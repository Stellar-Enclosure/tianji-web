import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography} from 'antd'
import {useCallback, useEffect, useRef, useState} from 'react'
import {MEMORY_KINDS, isMemoryIdentifier, memoryApi, type MemoryCandidate, type MemoryCandidatePage, type MemoryCandidateQuery,
  type MemoryKind, type RejectCommand, type ReviewCommand} from '../api/memory'
import {useAuth} from '../auth/AuthContext'
import MemoryMergeDialog from './MemoryMergeDialog'

type Filters = {ownerType: 'USER' | 'TEAM'; teamId?: string; scopeId: string; kind?: MemoryKind}
type Pending = {action: 'confirm'; entry: MemoryCandidate; command: ReviewCommand} | {action: 'reject'; entry: MemoryCandidate; command: RejectCommand}
const labels: Record<MemoryKind, string> = {FACT: '事实', PREFERENCE: '偏好', EXPERIENCE: '经验'}

export default function MemoryCandidatesPage() {
  const {authorization} = useAuth()
  if (!authorization) return null
  const {identity, binding} = authorization
  return <MemoryCandidatesContent key={JSON.stringify([identity.issuer, identity.tenantId, identity.subject, binding.requestEpoch])} tenant={identity.tenantId} subject={identity.subject} />
}

function MemoryCandidatesContent({tenant, subject}: {tenant: string; subject: string}) {
  const {allows} = useAuth()
  const [form] = Form.useForm<Filters>()
  const ownerType = Form.useWatch('ownerType', form)
  const [query, setQuery] = useState<MemoryCandidateQuery>()
  const [page, setPage] = useState<MemoryCandidatePage>()
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [dialog, setDialog] = useState<{action: Pending['action']; entry: MemoryCandidate}>()
  const [comparison, setComparison] = useState<MemoryCandidate>()
  const [pending, setPending] = useState<Pending>()
  const [submitting, setSubmitting] = useState(false)
  const [writeError, setWriteError] = useState<string>()
  const [rejected, setRejected] = useState(false)
  const activeWrite = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!query) return
    const controller = new AbortController()
    void memoryApi.candidates(tenant, {...query, afterMemoryId: cursors[pageIndex]}, controller.signal).then(value => {
      if (!controller.signal.aborted) setPage(value)
    }).catch(failure => {
      if (!controller.signal.aborted && !isAbort(failure)) setError('无法读取候选记忆，请核对范围、当前权限或服务配置后重试。')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [query, tenant, cursors, pageIndex, reload])
  useEffect(() => () => activeWrite.current?.abort(), [])

  const refresh = useCallback(() => {
    setPage(undefined); setError(undefined); setLoading(true); setPageIndex(0); setCursors([null]); setReload(value => value + 1)
  }, [])
  const send = useCallback(async (operation: Pending) => {
    if (activeWrite.current) return
    if (!allows(`tianji.button.memoryCandidates.${operation.action}`)) { setWriteError('当前身份已不能执行此操作，请重新验证权限。'); return }
    const controller = new AbortController(); activeWrite.current = controller
    setSubmitting(true); setWriteError(undefined); setRejected(false)
    try {
      if (operation.action === 'confirm') await memoryApi.confirm(tenant, operation.command, controller.signal)
      else await memoryApi.reject(tenant, operation.command, controller.signal)
      if (!controller.signal.aborted) { setPending(undefined); setDialog(undefined); refresh() }
    } catch (failure) {
      if (!controller.signal.aborted && !isAbort(failure)) {
        const definitive = failure instanceof ApiError && failure.status > 0 && failure.status < 500
        setRejected(definitive)
        setWriteError(definitive ? '操作未完成，候选版本或权限可能已变化。请重新读取并审阅。' : '提交结果暂时未知。重试将保留原操作标识和版本，请勿重新提交同一变更。')
      }
    } finally {
      if (activeWrite.current === controller) activeWrite.current = null
      if (!controller.signal.aborted) setSubmitting(false)
    }
  }, [allows, refresh, tenant])

  const submit = () => {
    if (pending) { void send(pending); return }
    if (!dialog || !globalThis.crypto?.randomUUID) { setWriteError('当前环境无法生成安全的操作标识。'); return }
    const {entry, action} = dialog
    const base = {commandId: crypto.randomUUID(), owner: entry.owner, scopeId: entry.scopeId, memoryId: entry.memoryId, expectedRevision: entry.revision}
    const operation: Pending = action === 'confirm' ? {action, entry, command: {...base, content: entry.content, confidence: 1, reasonCode: 'USER_CONFIRMED',
      source: {reference: `human-review:${entry.memoryId}`, evidenceSha256: entry.contentSha256, sourceRunId: null, sourceEventId: null}}}
      : {action, entry, command: {...base, reasonCode: 'USER_REJECTED_CANDIDATE'}}
    setPending(operation); void send(operation)
  }
  const search = (values: Filters) => {
    if (pending || submitting) return
    setQuery({owner: values.ownerType === 'USER' ? {type: 'USER', id: subject} : {type: 'TEAM', id: values.teamId?.trim() ?? ''},
      scopeId: values.scopeId.trim(), kind: values.kind ?? null, afterMemoryId: null, limit: 20})
    refresh()
  }
  const open = (action: Pending['action'], entry: MemoryCandidate) => {
    if (pending || submitting) return
    setWriteError(undefined); setRejected(false); setDialog({action, entry})
  }
  const turnPage = (index: number) => { setPage(undefined); setError(undefined); setLoading(true); setPageIndex(index) }
  const resetRejected = () => { if (submitting) return; setPending(undefined); setDialog(undefined); setWriteError(undefined); setRejected(false); refresh() }

  return <section aria-labelledby="memory-title" className="page-stack">
    <div className="page-heading"><div><Typography.Title id="memory-title" level={2}>候选记忆审阅</Typography.Title>
      <Typography.Text type="secondary">未确认的候选不会影响模型回答。核对内容后确认，或丢弃不应保留的条目。</Typography.Text></div>
      <Button disabled={!query || loading || !!pending || submitting} onClick={refresh}>刷新候选</Button></div>
    <Card variant="borderless" className="surface-card">
      <Form form={form} layout="vertical" initialValues={{ownerType: 'USER'}} onFinish={search} disabled={!!pending || submitting}>
        <Space align="start" wrap>
          <Form.Item name="ownerType" label="记忆归属" rules={[{required: true}]}><Select className="memory-owner-select" options={[{value: 'USER', label: '我的记忆'}, {value: 'TEAM', label: '团队记忆'}]} /></Form.Item>
          {ownerType === 'TEAM' && <Form.Item name="teamId" label="团队标识" rules={[{required: true, whitespace: true, max: 256}, {validator: (_, value: unknown) => typeof value === 'string' && isMemoryIdentifier(value.trim(), 256) ? Promise.resolve() : Promise.reject(new Error('请输入有效的团队标识'))}]}><Input autoComplete="off" /></Form.Item>}
          <Form.Item name="scopeId" label="业务范围" rules={[{required: true, whitespace: true, max: 128}, {validator: (_, value: unknown) => typeof value === 'string' && isMemoryIdentifier(value.trim()) ? Promise.resolve() : Promise.reject(new Error('请输入有效的业务范围'))}]}><Input autoComplete="off" placeholder="输入已获授权的业务范围" /></Form.Item>
          <Form.Item name="kind" label="候选类型"><Select allowClear placeholder="全部类型" className="memory-owner-select" options={MEMORY_KINDS.map(value => ({value, label: labels[value]}))} /></Form.Item>
          <Form.Item label=" "><Button type="primary" htmlType="submit" loading={loading}>读取候选</Button></Form.Item>
        </Space>
      </Form>
      <Typography.Text type="secondary">团队标识和范围由业务配置确定，服务会重新核对当前访问权限。</Typography.Text>
    </Card>
    {error && <Alert type="error" showIcon title={error} />}
    {pending && writeError && !dialog && <Alert type="warning" showIcon title={writeError} action={rejected ? <Button onClick={resetRejected}>重新读取并审阅</Button>
      : <Button onClick={() => { setDialog({action: pending.action, entry: pending.entry}); void send(pending) }}>重试原操作</Button>} />}
    <Card variant="borderless" className="surface-card">
      <Table<MemoryCandidate> rowKey="memoryId" loading={loading} dataSource={page?.items ? [...page.items] : []} pagination={false} scroll={{x: 940}}
        locale={{emptyText: error ? '候选读取失败' : query ? '当前范围暂无未确认候选' : '选择记忆归属和业务范围后读取候选'}} columns={[
          {title: '类型', dataIndex: 'kind', width: 95, render: (value: MemoryKind) => <Tag>{labels[value]}</Tag>},
          {title: '候选内容', key: 'content', render: (_, entry) => <CandidateContent entry={entry} />},
          {title: '来源置信度', dataIndex: 'confidence', width: 110, render: (value: number) => `${Math.round(value * 100)}% · 待确认`},
          {title: '分类', dataIndex: 'sensitivity', width: 125},
          {title: '到期时间', dataIndex: 'expiresAt', width: 185, render: (value: string | null) => value === null ? '未设置到期时间' : new Date(value).toLocaleString()},
          {title: '操作', key: 'actions', width: 210, render: (_, entry) => <Space>
            {allows('tianji.button.memoryCandidates.compare') && <Button type="link" disabled={!!pending || submitting} onClick={() => setComparison(entry)}>比较</Button>}
            {allows('tianji.button.memoryCandidates.confirm') && <Button type="link" disabled={!!pending || submitting} onClick={() => open('confirm', entry)}>确认</Button>}
            {allows('tianji.button.memoryCandidates.reject') && <Button type="link" danger disabled={!!pending || submitting} onClick={() => open('reject', entry)}>丢弃</Button>}
          </Space>},
        ]} />
      {query && <div className="pagination-row"><Typography.Text type="secondary">第 {pageIndex + 1} 页</Typography.Text><Space>
        <Button disabled={pageIndex === 0 || loading || !!pending} onClick={() => turnPage(pageIndex - 1)}>上一页</Button>
        <Button disabled={!page?.nextAfterMemoryId || loading || !!pending} onClick={() => { setCursors(values => [...values.slice(0, pageIndex + 1), page?.nextAfterMemoryId ?? null]); turnPage(pageIndex + 1) }}>下一页</Button>
      </Space></div>}
    </Card>
    <Modal title={dialog?.action === 'confirm' ? '确认候选记忆' : '丢弃候选记忆'} open={!!dialog} onCancel={() => { if (!submitting) setDialog(undefined) }}
      onOk={submit} okButtonProps={{disabled: rejected}} okText={pending && writeError ? '重试同一操作' : dialog?.action === 'confirm' ? '确认并保留' : '确认丢弃'} cancelText="返回列表核对" confirmLoading={submitting} mask={{closable: !pending && !submitting}}>
      {writeError && <Alert type="warning" showIcon title={writeError} action={rejected ? <Button onClick={resetRejected}>重新读取并审阅</Button> : undefined} className="form-alert" />}
      {dialog && <><Typography.Paragraph>{dialog.action === 'confirm' ? '确认后，此条内容将成为已确认记忆。请只确认你已核实的内容。' : '丢弃会遗忘此候选并清除其正文，此操作需要当前遗忘权限。'}</Typography.Paragraph>
        <CandidateContent entry={dialog.entry} /><Typography.Paragraph type="secondary">原始来源声明：{dialog.entry.source.reference}</Typography.Paragraph>
        <Typography.Text type="secondary">版本 {dialog.entry.revision} · {labels[dialog.entry.kind]}</Typography.Text></>}
    </Modal>
    {comparison && <MemoryMergeDialog key={JSON.stringify([comparison.owner.type, comparison.owner.id, comparison.scopeId, comparison.memoryId, comparison.revision, comparison.contentSha256])}
      tenant={tenant} candidate={comparison} onClose={() => setComparison(undefined)} />}
  </section>
}

function CandidateContent({entry}: {entry: MemoryCandidate}) {
  return <div>{entry.content.text && <Typography.Paragraph className="event-summary">{entry.content.text}</Typography.Paragraph>}
    {Object.entries(entry.content.facts).map(([key, value]) => <Typography.Paragraph key={key} className="event-summary"><Typography.Text strong>{key}：</Typography.Text>{value}</Typography.Paragraph>)}</div>
}
const isAbort = (failure: unknown): boolean => failure instanceof DOMException && failure.name === 'AbortError'
