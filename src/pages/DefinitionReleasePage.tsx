import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Form, Input, Space, Table, Tag, Typography, type TableColumnsType} from 'antd'
import {useLayoutEffect, useRef, useState} from 'react'
import {isProcessReleaseVersion, processReleasesApi, type ProcessReleaseModel,
  type ProcessRelease} from '../api/processReleases'
import {useAuth} from '../auth/AuthContext'

const PAGE = 'tianji.page.processReleases'
const INVALID_VERSION = '请输入有效的发布版本。'

const columns: TableColumnsType<ProcessReleaseModel> = [
  {title: '模型类型', key: 'type', render: (_, row) => <Tag>{row.type}</Tag>},
  {title: '定义标识', dataIndex: 'definitionKey'},
  {title: '内容 SHA-256', key: 'contentSha256', render: (_, row) => <Typography.Text code>{row.contentSha256}</Typography.Text>},
  {title: '声明输入', key: 'inputs', render: (_, row) => {
    const fields = Object.keys(row.inputs).sort()
    return fields.length === 0 ? '无声明输入' : <ul>{fields.map(field =>
      <li key={field}><Typography.Text code>{field}</Typography.Text> {row.inputs[field]}</li>)}</ul>
  }},
]

type LookupForm = {releaseVersion: string}
type LookupState = {phase: 'idle' | 'loading'}
  | {phase: 'snapshot'; snapshot: ProcessRelease}
  | {phase: 'error'; message: string}

export default function DefinitionReleasePage() {
  const {status, authorization, allows} = useAuth()
  if (status !== 'ready' || !authorization || !allows(PAGE)) {
    return <Alert type="warning" showIcon title="当前身份不能访问此页面。" />
  }
  const {identity, binding} = authorization
  return <ProcessReleaseLookup key={JSON.stringify([identity.issuer, identity.tenantId, identity.subject, binding.requestEpoch])}
    tenant={identity.tenantId} />
}

function ProcessReleaseLookup({tenant}: {tenant: string}) {
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
    form.setFields([{name: 'releaseVersion', errors: []}])
    setState({phase: 'idle'})
  }

  const load = async ({releaseVersion}: LookupForm) => {
    if (read.current || !currentAllows.current(PAGE) || !isProcessReleaseVersion(releaseVersion)
      || form.getFieldValue('releaseVersion') !== releaseVersion) return
    const controller = new AbortController()
    const request = ++sequence.current
    const isCurrent = () => !controller.signal.aborted && sequence.current === request && currentAllows.current(PAGE)
    read.current = controller
    setState({phase: 'loading'})
    try {
      const snapshot = await processReleasesApi.get(tenant, releaseVersion, controller.signal)
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
          form.setFields([{name: 'releaseVersion', errors: [INVALID_VERSION]}])
          form.focusField('releaseVersion')
          setState({phase: 'idle'})
          return
        }
      }
      setState({phase: 'error', message: failure instanceof ApiError && failure.status === 404
        ? '当前无法读取该发布版本。' : '暂时无法读取流程发布元数据。'})
    } finally {
      if (read.current === controller) read.current = null
    }
  }

  return <section aria-labelledby="process-release-title" className="page-stack">
    <div className="page-heading">
      <div>
        <Typography.Title id="process-release-title" level={2}>流程发布元数据</Typography.Title>
        <Typography.Text type="secondary">输入已知发布版本，查看当前租户的流程发布元数据。</Typography.Text>
      </div>
    </div>
    <Card variant="borderless" className="surface-card" title="查询流程发布">
      <Form form={form} layout="vertical" initialValues={{releaseVersion: ''}} onValuesChange={edit}
        onFinish={values => void load(values)} onFinishFailed={() => form.focusField('releaseVersion')}>
        <Form.Item name="releaseVersion" label="发布版本" validateTrigger="onSubmit"
          rules={[{validator: (_, value: unknown) => isProcessReleaseVersion(value)
            ? Promise.resolve() : Promise.reject(new Error(INVALID_VERSION))}]}>
          <Input autoComplete="off" maxLength={128} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" disabled={state.phase === 'loading'}>查询发布</Button>
        </Form.Item>
      </Form>
    </Card>
    {state.phase === 'loading' && <div role="status">正在查询发布元数据</div>}
    {state.phase === 'error' && <Alert type="warning" showIcon title={state.message} />}
    {state.phase === 'snapshot' && <Card variant="borderless" className="surface-card" title="已发布元数据">
      <Space orientation="vertical" className="full-width">
        <Typography.Text>发布版本：{state.snapshot.releaseVersion}</Typography.Text>
        <Typography.Text>Manifest SHA-256：<Typography.Text code>{state.snapshot.manifestSha256}</Typography.Text></Typography.Text>
        <Typography.Text>创建时间：<time dateTime={state.snapshot.createdAt}>{state.snapshot.createdAt} UTC</time></Typography.Text>
        <Table<ProcessReleaseModel> rowKey={row => row.type + ':' + row.definitionKey}
          dataSource={state.snapshot.models} columns={columns} pagination={false} scroll={{x: 900}} />
      </Space>
    </Card>}
  </section>
}
