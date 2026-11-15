import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Form, Input, Select, Space, Table, Tag, Typography,
  type TableColumnsType} from 'antd'
import {useLayoutEffect, useRef, useState} from 'react'
import {Link} from 'react-router-dom'
import {processActivationsApi, type AutomationReleaseDTO} from '../api/processActivations'
import {isProcessReleaseVersion, processReleasesApi, type ProcessReleaseModel,
  type ProcessRelease} from '../api/processReleases'
import {ProcessGraph} from '../components/process/ProcessGraph'
import {ProcessGraphList} from '../components/process/ProcessGraphList'
import {useAuth} from '../auth/AuthContext'
import {ProcessActivationPanel} from './ProcessActivationPanel'

const PAGE = 'tianji.page.processReleases'
const COPY = 'tianji.button.processDefinitions.copy'
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
  | {phase: 'v2-snapshot'; snapshot: AutomationReleaseDTO}
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
  const [mode, setMode] = useState<'v1' | 'v2'>('v1')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
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
    setSelectedNodeId(null)
  }

  const changeMode = (next: 'v1' | 'v2') => {
    if (next === mode) return
    setMode(next)
    edit()
    form.setFieldValue('comparisonVersion', '')
  }

  const load = async ({releaseVersion, comparisonVersion = ''}: LookupForm) => {
    const comparing = mode === 'v1' && comparisonVersion !== ''
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
      if (mode === 'v2') {
        const snapshot = await processActivationsApi.getRelease(tenant, releaseVersion, controller.signal)
        if (isCurrent()) {
          setSelectedNodeId(null)
          setState({phase: 'v2-snapshot', snapshot})
        }
      } else if (comparing) {
        const baseline = processReleasesApi.get(tenant, releaseVersion, controller.signal)
        const [source, comparison] = await Promise.all([
          baseline, processReleasesApi.get(tenant, comparisonVersion, controller.signal),
        ])
        if (isCurrent()) setState({phase: 'comparison', baseline: source, comparison})
      } else {
        const snapshot = await processReleasesApi.get(tenant, releaseVersion, controller.signal)
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
      setState({phase: 'error', message: mode === 'v2'
        ? unavailable ? '当前无法读取该流程发布版本。' : '暂时无法读取流程 V2 发布设计。'
        : comparing
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
        <Typography.Text type="secondary">{mode === 'v1'
          ? '输入已知发布版本，查看传统流程模型元数据。填写对比版本可查看差异。'
          : '输入已知发布版本，查看固定的 V2 模型源、生效状态与技术流程图。'}</Typography.Text>
      </div>
    </div>
    <Card variant="borderless" className="surface-card" title="查询流程发布">
      <Space direction="vertical" size="middle" className="full-width">
        <div>
          <Typography.Text strong>发布格式</Typography.Text>
          <Select aria-label="发布格式" value={mode} style={{display: 'block', maxWidth: 320, marginTop: 8}}
            options={[{value: 'v1', label: '传统发布（V1）'}, {value: 'v2', label: '流程 V2'}]}
            onChange={(value: 'v1' | 'v2') => changeMode(value)} />
        </div>
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
          {mode === 'v1' && <Form.Item name="comparisonVersion" label="对比版本（可选）" validateTrigger="onSubmit"
            rules={[{validator: (_, value: unknown) => {
              if (value === undefined || value === '') return Promise.resolve()
              if (!isProcessReleaseVersion(value)) return Promise.reject(new Error(INVALID_COMPARISON))
              return value === form.getFieldValue('releaseVersion')
                ? Promise.reject(new Error(DUPLICATE_COMPARISON)) : Promise.resolve()
            }}]}>
            <Input autoComplete="off" maxLength={128} />
          </Form.Item>}
          <Form.Item>
            <Button type="primary" htmlType="submit" disabled={state.phase === 'loading'}>
              {mode === 'v1' ? '查询发布' : '查询 V2 发布'}
            </Button>
          </Form.Item>
        </Form>
      </Space>
    </Card>
    {state.phase === 'loading' && <div role="status">正在查询发布元数据</div>}
    {state.phase === 'error' && <Alert type="warning" showIcon title={state.message} />}
    {state.phase === 'comparison' && <ProcessReleaseComparison baseline={state.baseline} comparison={state.comparison} />}
    {state.phase === 'v2-snapshot' && <Card variant="borderless" className="surface-card" title="V2 流程发布设计">
      <Space orientation="vertical" size="middle" className="full-width">
        <DescriptionsBlock release={state.snapshot} />
        <div>
          <Typography.Title level={4}>固定模型源</Typography.Title>
          <Space orientation="vertical" className="full-width">
            {state.snapshot.artifact.models.map(model => <section key={model.definitionKey} className="surface-card">
              <Space wrap>
                <Tag>{model.type}</Tag>
                <Typography.Text strong>{model.definitionKey}</Typography.Text>
              </Space>
              <pre className="process-editor-source" tabIndex={0} aria-label={model.definitionKey + ' 模型源'}>
                {model.xml}
              </pre>
            </section>)}
          </Space>
        </div>
        <div>
          <Typography.Title level={4}>已声明的数据结构</Typography.Title>
          <Typography.Text>输入</Typography.Text>
          <pre className="process-editor-source" tabIndex={0}>{JSON.stringify(state.snapshot.artifact.inputSchema, null, 2)}</pre>
          <Typography.Text>输出</Typography.Text>
          <pre className="process-editor-source" tabIndex={0}>{JSON.stringify(state.snapshot.artifact.outputSchema, null, 2)}</pre>
          {state.snapshot.artifact.nodeBindings.length > 0 && <>
            <Typography.Text>节点绑定</Typography.Text>
            <pre className="process-editor-source" tabIndex={0}>{JSON.stringify(state.snapshot.artifact.nodeBindings, null, 2)}</pre>
          </>}
          {state.snapshot.artifact.eventRoutes.length > 0 && <>
            <Typography.Text>事件路由</Typography.Text>
            <pre className="process-editor-source" tabIndex={0}>{JSON.stringify(state.snapshot.artifact.eventRoutes, null, 2)}</pre>
          </>}
        </div>
        <div className="process-instance-layout">
          <div>
            <Typography.Title level={4}>流程逻辑图</Typography.Title>
            <ProcessGraph graph={state.snapshot.graph} executions={[]} selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId} />
            <ProcessGraphList graph={state.snapshot.graph} executions={[]} selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId} />
          </div>
          <ProcessActivationPanel definitionKey={state.snapshot.graph.definitionKey}
            releaseVersion={state.snapshot.releaseVersion} />
        </div>
        {allows(COPY) && <Link to="/process-definitions/new"
          state={{copyFrom: {definitionKey: state.snapshot.graph.definitionKey, releaseVersion: state.snapshot.releaseVersion}}}>
          复制为草稿
        </Link>}
      </Space>
    </Card>}
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

function DescriptionsBlock({release}: {release: AutomationReleaseDTO}) {
  return <section aria-label="发布来源与摘要" className="surface-card">
    <Space orientation="vertical">
      <Typography.Text>发布版本：{release.releaseVersion}</Typography.Text>
      <Typography.Text>流程定义：{release.graph.definitionKey}</Typography.Text>
      <Typography.Text>编译器版本：{release.compilerVersion}</Typography.Text>
      <Typography.Text>来源草稿：{release.sourceDraftId}</Typography.Text>
      <Typography.Text>来源草稿修订：{release.sourceDraftRevision}</Typography.Text>
      <Typography.Text>来源清单 SHA-256：<Typography.Text code>{release.sourceManifestSha256}</Typography.Text></Typography.Text>
      <Typography.Text>编译清单 SHA-256：<Typography.Text code>{release.compiledManifestSha256}</Typography.Text></Typography.Text>
      <Typography.Text>依赖清单 SHA-256：<Typography.Text code>{release.dependencyManifestSha256}</Typography.Text></Typography.Text>
    </Space>
  </section>
}
