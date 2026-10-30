import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Form, Input, Modal, Space, Tag, Typography} from 'antd'
import {useEffect, useRef, useState} from 'react'
import {Link} from 'react-router-dom'
import {isMemoryIdentifier} from '../api/memory'
import {memoryPreferencesApi, type PreferenceOutcome, type PreferencePreparation} from '../api/memoryPreferences'
import {useAuth} from '../auth/AuthContext'

type Props = Readonly<{runId: string; completed: boolean; sourceEventId?: string}>
const RESOURCE = 'tianji.button.runDetail.extractPreferences'

export default function MemoryPreferenceAction(props: Props) {
  const {authorization, allows} = useAuth()
  if (!authorization || !allows(RESOURCE)) return null
  const {identity, binding} = authorization
  return <PreferenceAction key={JSON.stringify([identity.issuer, identity.tenantId, identity.subject, binding.requestEpoch, props.runId])}
    {...props} tenant={identity.tenantId} subject={identity.subject} />
}

function PreferenceAction({runId, completed, sourceEventId, tenant, subject}: Props & {tenant: string; subject: string}) {
  const {allows} = useAuth()
  const [form] = Form.useForm<{scopeId: string}>()
  const [open, setOpen] = useState(false)
  const [prepared, setPrepared] = useState<PreferencePreparation>()
  const [pending, setPending] = useState<PreferencePreparation>()
  const [preparing, setPreparing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [rejected, setRejected] = useState(false)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const reading = useRef<AbortController | null>(null)
  const writing = useRef<AbortController | null>(null)
  useEffect(() => () => { reading.current?.abort(); writing.current?.abort() }, [])

  const prepare = async ({scopeId}: {scopeId: string}) => {
    if (reading.current || writing.current || pending || !sourceEventId || !completed || !allows(RESOURCE)) return
    const controller = new AbortController(); reading.current = controller
    setPreparing(true); setError(undefined); setPrepared(undefined); setRejected(false)
    try {
      const result = await memoryPreferencesApi.prepare(tenant, {owner: {type: 'USER', id: subject}, scopeId: scopeId.trim(), runId, sourceEventId}, controller.signal)
      if (!controller.signal.aborted) setPrepared(result)
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof ApiError && failure.status === 404
        ? '该运行或业务范围没有可用的偏好提取来源。' : '暂时无法核对偏好来源，请检查当前权限或连接后重试。')
    } finally {
      if (reading.current === controller) reading.current = null
      if (!controller.signal.aborted) setPreparing(false)
    }
  }
  const send = async (selection: PreferencePreparation) => {
    if (writing.current || !allows(RESOURCE) || selection.outcome !== 'ELIGIBLE') return
    const controller = new AbortController(); writing.current = controller
    setPending(selection); setSubmitting(true); setError(undefined); setRejected(false)
    try {
      const result = await memoryPreferencesApi.extract(tenant, selection.command, selection.preferenceKeys, controller.signal)
      if (!controller.signal.aborted) {
        setPending(undefined); setPrepared(undefined); setOpen(false)
        setNotice(result.outcome === 'ELIGIBLE' ? '偏好请求已处理，请在候选记忆中审阅仍待确认的条目。' : explanation(result.outcome))
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        const definitive = failure instanceof ApiError && failure.status > 0 && failure.status < 500
        setRejected(definitive); setError(definitive ? '来源、策略或权限可能已变化。请重新核对来源并查看当前候选。'
          : '处理结果暂时未知。请重试原请求，同一来源将沿用原处理记录。')
      }
    } finally {
      if (writing.current === controller) writing.current = null
      if (!controller.signal.aborted) setSubmitting(false)
    }
  }
  const reset = () => { if (!submitting) { setPending(undefined); setPrepared(undefined); setError(undefined); setRejected(false) } }
  if (!completed && !open && !pending && !notice) return null
  const selection = pending ?? prepared
  return <Card title="偏好候选" variant="borderless" className="surface-card">
    <Space orientation="vertical" className="full-width">
      <Typography.Text type="secondary">从本次输入中识别已获业务策略批准的显式偏好，生成的候选需要单独审阅。</Typography.Text>
      <Space wrap><Button disabled={(!completed || !sourceEventId) && !pending} onClick={() => setOpen(true)}>{pending ? '继续核对原请求' : '提取偏好候选'}</Button>
        {allows('tianji.page.memoryCandidates') && <Link to="/memory">查看候选记忆</Link>}</Space>
      {completed && !sourceEventId && <Typography.Text type="secondary">正在等待可核对的完成事件；缺少来源事件时暂不能提取。</Typography.Text>}
      {notice && <Alert type="info" showIcon title={notice} />}
      {pending && error && !open && <Alert type="warning" showIcon title={error} action={<Button onClick={() => setOpen(true)}>继续核对</Button>} />}
    </Space>
    <Modal title="提取偏好候选" open={open} onCancel={() => { if (!submitting) setOpen(false) }} cancelText="返回运行详情"
      onOk={() => { if (selection) void send(selection) }} okText={pending && error ? '重试原请求' : '生成未确认候选'} confirmLoading={submitting}
      okButtonProps={{disabled: !selection || selection.outcome !== 'ELIGIBLE' || rejected || preparing}} mask={{closable: !pending && !submitting}}>
      <Typography.Paragraph>选择保存偏好的业务范围，先核对可识别的条目。同一来源只处理一次，候选仍需人工确认。</Typography.Paragraph>
      <Form form={form} layout="vertical" disabled={!!pending || preparing || submitting} onFinish={values => void prepare(values)} onValuesChange={() => { if (!pending) { setPrepared(undefined); setError(undefined) } }}>
        <Form.Item name="scopeId" label="业务范围" rules={[{required: true, whitespace: true, max: 128}, {validator: (_, value: unknown) => typeof value === 'string' && isMemoryIdentifier(value.trim()) ? Promise.resolve() : Promise.reject(new Error('请输入有效的业务范围'))}]}>
          <Input autoComplete="off" placeholder="输入已获授权的业务范围" />
        </Form.Item>
        <Form.Item><Button htmlType="submit" loading={preparing} disabled={!completed || !sourceEventId}>核对偏好来源</Button></Form.Item>
      </Form>
      {selection && <Alert className="form-alert" type={selection.outcome === 'ELIGIBLE' ? 'info' : 'warning'} showIcon title={explanation(selection.outcome, selection.candidateCount)}
        description={<Space wrap><Tag>{selection.sensitivity === 'RESTRICTED' ? '受限' : '机密'}</Tag>{selection.preferenceKeys.map(key => <Tag key={key} className="preference-key">{key}</Tag>)}</Space>} />}
      {error && <Alert type="warning" showIcon title={error} action={rejected ? <Button onClick={reset}>重新核对来源</Button> : undefined} />}
    </Modal>
  </Card>
}

function explanation(outcome: PreferenceOutcome, count = 0): string {
  if (outcome === 'ELIGIBLE') return `识别到 ${count} 条显式偏好。生成后请到候选记忆页确认。`
  if (outcome === 'NO_DECLARATION') return '本次输入没有可识别的显式偏好。'
  if (outcome === 'CONFLICTING_PREFERENCE') return '本次输入包含互相矛盾的偏好，请先核对来源。'
  if (outcome === 'UNSUPPORTED_PREFERENCE') return '有偏好键或值未获当前业务策略批准。'
  if (outcome === 'RUN_NOT_COMPLETED') return '来源运行尚未成功完成。'
  return '该来源不符合当前偏好提取条件。'
}
