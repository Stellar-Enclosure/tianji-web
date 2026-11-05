import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Form, Input, Space, Table, Tag, Typography, type TableColumnsType} from 'antd'
import {useLayoutEffect, useRef, useState} from 'react'
import {isProcessReleaseVersion, processReleasesApi, type ProcessReleaseModel,
  type ProcessRelease} from '../api/processReleases'
import {useAuth} from '../auth/AuthContext'

const PAGE = 'tianji.page.processReleases'
const INVALID_VERSION = '请输入有效的发布版本。'
const INVALID_COMPARISON = '请输入有效的对比版本。'
const DUPLICATE_COMPARISON = '对比版本必须与发布版本不同。'

const columns: TableColumnsType<ProcessReleaseModel> = [
  {title: '模型类型', key: 'type', render: (_, row) => <Tag>{row.type}</Tag>},
  {title: '定义标识', dataIndex: 'definitionKey'},
  {title: '内容 SHA-256', key: 'contentSha256', render: (_, row) => <Typography.Text code>{row.contentSha256}</Typography.Text>},
  {title: '声明输入', key: 'inputs', render: (_, row) => renderInputs(row.inputs)},
]

type LookupForm = {releaseVersion: string; comparisonVersion?: string}
type LookupState = {phase: 'idle' | 'loading'}
  | {phase: 'snapshot'; snapshot: ProcessRelease}
  | {phase: 'comparison'; baseline: ProcessRelease; comparison: ProcessRelease}
  | {phase: 'error'; message: string}

type ModelDifference = {
  model: ProcessReleaseModel
  baseline?: ProcessReleaseModel
  comparison?: ProcessReleaseModel
  change: '新增' | '移除' | '变更'
  reasons: string[]
}

const modelKey = (model: ProcessReleaseModel) => model.type + ':' + model.definitionKey

function renderInputs(inputs: ProcessReleaseModel['inputs']) {
  const fields = Object.keys(inputs).sort()
  return fields.length === 0 ? '无声明输入' : <ul>{fields.map(field =>
    <li key={field}><Typography.Text code>{field}</Typography.Text> {inputs[field]}</li>)}</ul>
}

function compareModels(baseline: ProcessRelease, comparison: ProcessRelease): ModelDifference[] {
  const remaining = new Map(comparison.models.map(model => [modelKey(model), model]))
  const differences: ModelDifference[] = []
  for (const model of baseline.models) {
    const key = modelKey(model)
    const target = remaining.get(key)
    if (!target) {
      differences.push({model, baseline: model, change: '移除', reasons: []})
      continue
    }
    remaining.delete(key)
    const reasons = []
    if (model.contentSha256 !== target.contentSha256) reasons.push('内容摘要变化')
    const fields = Object.keys(model.inputs)
    if (fields.length !== Object.keys(target.inputs).length
      || fields.some(field => !Object.hasOwn(target.inputs, field) || model.inputs[field] !== target.inputs[field])) {
      reasons.push('声明输入变化')
    }
    if (reasons.length) differences.push({model, baseline: model, comparison: target, change: '变更', reasons})
  }
  for (const model of remaining.values()) differences.push({model, comparison: model, change: '新增', reasons: []})
  return differences.sort((a, b) => {
    const left = modelKey(a.model), right = modelKey(b.model)
    return left < right ? -1 : left > right ? 1 : 0
  })
}

function renderComparisonModel(model?: ProcessReleaseModel) {
  return model ? <Space orientation="vertical">
    <Typography.Text code>{model.contentSha256}</Typography.Text>
    {renderInputs(model.inputs)}
  </Space> : '无此模型'
}

const comparisonColumns: TableColumnsType<ModelDifference> = [
  {title: '模型类型', key: 'type', render: (_, row) => <Tag>{row.model.type}</Tag>},
  {title: '定义标识', key: 'definitionKey', render: (_, row) => row.model.definitionKey},
  {title: '差异', key: 'change', render: (_, row) => <Space orientation="vertical">
    <Tag>{row.change}</Tag>
    {row.reasons.map(reason => <Typography.Text key={reason}>{reason}</Typography.Text>)}
  </Space>},
  {title: '基准模型摘要与声明输入', key: 'baseline', render: (_, row) => renderComparisonModel(row.baseline)},
  {title: '对比模型摘要与声明输入', key: 'comparison', render: (_, row) => renderComparisonModel(row.comparison)},
]

function ProcessReleaseComparison({baseline, comparison}: {baseline: ProcessRelease; comparison: ProcessRelease}) {
  const differences = compareModels(baseline, comparison)
  return <Card variant="borderless" className="surface-card" title="发布版本对比">
    <Space orientation="vertical" className="full-width">
      <Typography.Text>基准版本：{baseline.releaseVersion}</Typography.Text>
      <Typography.Text>基准 Manifest SHA-256：<Typography.Text code>{baseline.manifestSha256}</Typography.Text></Typography.Text>
      <Typography.Text>对比版本：{comparison.releaseVersion}</Typography.Text>
      <Typography.Text>对比 Manifest SHA-256：<Typography.Text code>{comparison.manifestSha256}</Typography.Text></Typography.Text>
      <Typography.Text>Manifest 摘要：{baseline.manifestSha256 === comparison.manifestSha256 ? '相同' : '不同'}</Typography.Text>
      {differences.length === 0 ? <Typography.Text>未发现模型元数据差异。</Typography.Text>
        : <Table<ModelDifference> rowKey={row => modelKey(row.model)} dataSource={differences}
          columns={comparisonColumns} pagination={false} scroll={{x: 1100}} />}
    </Space>
  </Card>
}

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
    form.setFields([{name: 'releaseVersion', errors: []}, {name: 'comparisonVersion', errors: []}])
    setState({phase: 'idle'})
  }

  const load = async ({releaseVersion, comparisonVersion = ''}: LookupForm) => {
    const comparing = comparisonVersion !== ''
    if (read.current || !currentAllows.current(PAGE) || !isProcessReleaseVersion(releaseVersion)
      || comparing && (!isProcessReleaseVersion(comparisonVersion) || comparisonVersion === releaseVersion)
      || form.getFieldValue('releaseVersion') !== releaseVersion
      || (form.getFieldValue('comparisonVersion') ?? '') !== comparisonVersion) return
    const controller = new AbortController()
    const request = ++sequence.current
    const isCurrent = () => !controller.signal.aborted && sequence.current === request && currentAllows.current(PAGE)
    read.current = controller
    setState({phase: 'loading'})
    try {
      const baseline = processReleasesApi.get(tenant, releaseVersion, controller.signal)
      if (comparing) {
        const [source, comparison] = await Promise.all([
          baseline, processReleasesApi.get(tenant, comparisonVersion, controller.signal),
        ])
        if (isCurrent()) setState({phase: 'comparison', baseline: source, comparison})
      } else {
        const snapshot = await baseline
        if (isCurrent()) setState({phase: 'snapshot', snapshot})
      }
    } catch (failure) {
      if (!isCurrent()) return
      if (comparing) controller.abort()
      if (failure instanceof ApiError) {
        if (failure.status === 401 || failure.status === 403
          || failure.status === 409 && failure.code === 'TIANJI_TENANT_CONTEXT_CHANGED') {
          setState({phase: 'idle'})
          return
        }
        if (failure.status === 400 && !comparing) {
          form.setFields([{name: 'releaseVersion', errors: [INVALID_VERSION]}])
          form.focusField('releaseVersion')
          setState({phase: 'idle'})
          return
        }
      }
      const unavailable = failure instanceof ApiError && failure.status === 404
      setState({phase: 'error', message: comparing
        ? unavailable ? '当前无法读取其中一个发布版本。' : '暂时无法比较流程发布元数据。'
        : unavailable ? '当前无法读取该发布版本。' : '暂时无法读取流程发布元数据。'})
    } finally {
      if (read.current === controller) read.current = null
    }
  }

  return <section aria-labelledby="process-release-title" className="page-stack">
    <div className="page-heading">
      <div>
        <Typography.Title id="process-release-title" level={2}>流程发布元数据</Typography.Title>
        <Typography.Text type="secondary">输入已知发布版本，查看当前租户的流程发布元数据。填写对比版本可查看两者差异。</Typography.Text>
      </div>
    </div>
    <Card variant="borderless" className="surface-card" title="查询流程发布">
      <Form form={form} layout="vertical" initialValues={{releaseVersion: '', comparisonVersion: ''}} onValuesChange={edit}
        onFinish={values => void load(values)} onFinishFailed={({errorFields}) => {
          const first = errorFields[0]
          if (first) form.focusField(first.name)
        }}>
        <Form.Item name="releaseVersion" label="发布版本" validateTrigger="onSubmit"
          rules={[{validator: (_, value: unknown) => isProcessReleaseVersion(value)
            ? Promise.resolve() : Promise.reject(new Error(INVALID_VERSION))}]}>
          <Input autoComplete="off" maxLength={128} />
        </Form.Item>
        <Form.Item name="comparisonVersion" label="对比版本（可选）" validateTrigger="onSubmit"
          rules={[{validator: (_, value: unknown) => {
            if (value === undefined || value === '') return Promise.resolve()
            if (!isProcessReleaseVersion(value)) return Promise.reject(new Error(INVALID_COMPARISON))
            return value === form.getFieldValue('releaseVersion')
              ? Promise.reject(new Error(DUPLICATE_COMPARISON)) : Promise.resolve()
          }}]}>
          <Input autoComplete="off" maxLength={128} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" disabled={state.phase === 'loading'}>查询发布</Button>
        </Form.Item>
      </Form>
    </Card>
    {state.phase === 'loading' && <div role="status">正在查询发布元数据</div>}
    {state.phase === 'error' && <Alert type="warning" showIcon title={state.message} />}
    {state.phase === 'comparison' && <ProcessReleaseComparison baseline={state.baseline} comparison={state.comparison} />}
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
