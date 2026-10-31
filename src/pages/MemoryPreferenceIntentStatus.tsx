import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Form, Input, Modal, Space, Tag, Typography} from 'antd'
import {useEffect, useRef, useState} from 'react'
import {Link} from 'react-router-dom'
import {isMemoryIdentifier} from '../api/memory'
import {isPreferenceIntentTerminal, memoryPreferenceIntentsApi, type CancelPreferenceIntent, type PreferenceIntentState, type PreferenceIntentStatus} from '../api/memoryPreferenceIntents'
import {useAuth} from '../auth/AuthContext'

type Props = Readonly<{runId: string; available: boolean}>
const VIEW = 'tianji.button.runDetail.preferenceIntentStatus'
const CANCEL = 'tianji.button.runDetail.cancelPreferenceIntent'

export default function MemoryPreferenceIntentStatusCard(props: Props) {
  const {authorization, allows} = useAuth()
  if (!authorization || !allows(VIEW)) return null
  const {identity, binding} = authorization
  return <IntentStatus key={JSON.stringify([identity.issuer, identity.tenantId, identity.subject, binding.requestEpoch, props.runId])}
    {...props} tenant={identity.tenantId} subject={identity.subject} />
}

function IntentStatus({runId, available, tenant, subject}: Props & {tenant: string; subject: string}) {
  const {allows} = useAuth()
  const [form] = Form.useForm<{scopeId: string}>()
  const [loaded, setLoaded] = useState<PreferenceIntentStatus>()
  const [proposed, setProposed] = useState<CancelPreferenceIntent>()
  const [pending, setPending] = useState<CancelPreferenceIntent>()
  const [reading, setReading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const read = useRef<AbortController | null>(null)
  const write = useRef<AbortController | null>(null)
  useEffect(() => () => { read.current?.abort(); write.current?.abort() }, [])

  const lookup = async ({scopeId}: {scopeId: string}) => {
    if (read.current || write.current || pending || proposed || !allows(VIEW)) return
    const controller = new AbortController(); read.current = controller; setReading(true); setError(undefined); setNotice(undefined); setLoaded(undefined)
    try {
      const result = await memoryPreferenceIntentsApi.status(tenant, {owner: {type: 'USER', id: subject}, scopeId: scopeId.trim(), runId}, controller.signal)
      if (!controller.signal.aborted) setLoaded(result)
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof ApiError && failure.status === 404 ? '状态入口尚未启用，或该来源当前不可见。' : '暂时无法读取提取状态，请检查当前权限或连接后重试。')
    } finally {
      if (read.current === controller) read.current = null
      if (!controller.signal.aborted) setReading(false)
    }
  }
  const send = async (command: CancelPreferenceIntent) => {
    if (write.current || read.current || !allows(CANCEL)) return
    const controller = new AbortController(); write.current = controller; setPending(command); setProposed(undefined); setSubmitting(true); setError(undefined); setNotice(undefined)
    try {
      const result = await memoryPreferenceIntentsApi.cancel(tenant, command, controller.signal)
      if (!controller.signal.aborted) {
        setPending(undefined); setLoaded(result.status)
        setNotice(result.status.intent?.state === 'CANCELLED' ? '已停止后续提取。已提交的候选仍保留，Agent 运行不会因此取消。' : '该提取请求已经结束，现有结果未改变。')
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        const definitive = failure instanceof ApiError && failure.status > 0 && failure.status < 500
        if (definitive) { setPending(undefined); setLoaded(undefined) }
        setError(definitive ? '提取状态或当前权限已变化，请重新查询后再决定是否停止。' : '停止结果暂时未知。请重试原停止请求，暂不能更改范围或刷新。')
      }
    } finally {
      if (write.current === controller) write.current = null
      if (!controller.signal.aborted) setSubmitting(false)
    }
  }
  const propose = () => {
    if (!loaded?.intent || isPreferenceIntentTerminal(loaded.intent.state) || pending || read.current || write.current || !allows(CANCEL)) return
    if (!globalThis.crypto?.randomUUID) { setError('当前环境无法生成安全的请求标识。'); return }
    setProposed({owner: loaded.owner, scopeId: loaded.scopeId, runId: loaded.runId, commandId: crypto.randomUUID(), expectedRevision: loaded.intent.revision})
  }

  if (!available && !loaded && !pending && !proposed && !reading && !error && !notice) return null
  const intent = loaded?.intent
  const phase = intent ? phases[intent.state] : undefined
  return <Card title="后台偏好提取" variant="borderless" className="surface-card">
    <Space orientation="vertical" className="full-width">
      <Typography.Text type="secondary">查看后台提取进度，或停止尚未完成的提取。已提交的候选仍需单独审阅。</Typography.Text>
      <Form form={form} layout="vertical" className="full-width" disabled={reading || submitting || !!pending || !!proposed} onFinish={values => void lookup(values)}
        onValuesChange={() => { setLoaded(undefined); setError(undefined); setNotice(undefined) }}>
        <Form.Item name="scopeId" label="提取范围" rules={[{required: true, whitespace: true, max: 128}, {validator: (_, value: unknown) => typeof value === 'string' && isMemoryIdentifier(value.trim()) ? Promise.resolve() : Promise.reject(new Error('请输入有效的业务范围'))}]}>
          <Input autoComplete="off" placeholder="输入已获授权的业务范围" />
        </Form.Item>
        <Form.Item><Button htmlType="submit" loading={reading}>查询提取状态</Button></Form.Item>
      </Form>
      {loaded && !intent && <Alert type="info" showIcon title="该范围内尚未请求后台提取。" />}
      {intent && phase && <Space orientation="vertical" className="full-width">
        <Space wrap><Tag color={phase.color}>{phase.label}</Tag><Typography.Text>{intent.totalCount === null ? '尚未完成来源核对' : `已确认处理 ${intent.nextIndex} / ${intent.totalCount} 项提案`}</Typography.Text></Space>
        <Typography.Text type="secondary">最后更新：{new Date(intent.updatedAt).toLocaleString()}。已处理提案可能与已有记忆重复。</Typography.Text>
        {intent.reasonCode && <Typography.Text type="secondary">{reason(intent.reasonCode)}</Typography.Text>}
        {!isPreferenceIntentTerminal(intent.state) && allows(CANCEL) && !pending && <Button danger disabled={reading || submitting || !!proposed} onClick={propose}>停止后续提取</Button>}
      </Space>}
      {notice && <Alert type="info" showIcon title={notice} />}
      {submitting && <Typography.Text role="status" type="secondary">正在停止后续提取…</Typography.Text>}
      {error && <Alert type="warning" showIcon title={error} action={pending ? <Button loading={submitting} disabled={!allows(CANCEL)} onClick={() => void send(pending)}>重试原停止请求</Button> : undefined} />}
      {allows('tianji.page.memoryCandidates') && <Link to="/memory">查看候选记忆</Link>}
    </Space>
    <Modal title="停止后续提取" open={!!proposed} onCancel={() => setProposed(undefined)} onOk={() => { if (proposed) void send(proposed) }} okText="确认停止提取" cancelText="保留提取请求" okButtonProps={{danger: true, disabled: !allows(CANCEL)}}>
      <Typography.Paragraph>停止这个范围内尚未完成的偏好提取。已提交的候选不会删除，Agent 运行继续；已结束的提取不会改写。</Typography.Paragraph>
    </Modal>
  </Card>
}

const phases: Record<PreferenceIntentState, Readonly<{label: string; color: string}>> = {
  RESERVED: {label: '待授权', color: 'gold'}, READY: {label: '等待处理', color: 'gold'}, CLAIMED: {label: '处理中', color: 'processing'}, APPLIED: {label: '已处理', color: 'success'},
  SKIPPED: {label: '已跳过', color: 'default'}, REJECTED: {label: '提取受限', color: 'warning'}, EXPIRED: {label: '已过期', color: 'warning'}, CANCELLED: {label: '已停止', color: 'default'}, DEAD: {label: '待人工核对', color: 'error'},
}
const reason = (code: string): string => {
  if (['OWNER_DENIED', 'CURRENT_PERMISSION_DENIED', 'WRITE_PERMISSION_DENIED'].includes(code)) return '当前权限不允许继续提取。'
  if (['ISSUE_UNAVAILABLE', 'CURRENT_AUTHORITY_UNAVAILABLE', 'WRITE_UNAVAILABLE'].includes(code)) return '授权或连接暂不可用。'
  if (code === 'GRANT_EXPIRED') return '提取授权已过期，需要新的用户请求核对。'
  if (['SOURCE_NOT_COMPLETED', 'SOURCE_CHANGED'].includes(code)) return '来源运行已变化，不能继续提取。'
  if (code === 'INTENT_EXPIRED') return '提取请求已超过有效时间。'
  if (['ATTEMPTS_EXHAUSTED', 'WRITE_CONFLICT'].includes(code)) return '自动处理未能完成，请核对当前来源与候选。'
  if (code === 'EXTRACTION_NO_DECLARATION') return '本次输入没有可识别的显式偏好。'
  if (code === 'EXTRACTION_UNSUPPORTED_PREFERENCE') return '部分偏好不符合当前业务策略。'
  if (code === 'EXTRACTION_CONFLICTING_PREFERENCE') return '输入包含互相矛盾的偏好。'
  if (code === 'USER_CANCELLED') return '后续提取已停止；已提交候选仍保留。'
  if (code === 'BUDGET_YIELD') return '等待下一次处理。'
  return '请核对当前来源与业务策略。'
}
