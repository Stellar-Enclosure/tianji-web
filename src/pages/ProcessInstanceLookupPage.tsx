import {useEmbeddedWorkbench} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Form, Input, Typography} from 'antd'
import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {isProcessInstanceId} from '../api/processWorkerFailures'
import {useAuth} from '../auth/AuthContext'

const PAGE = 'tianji.page.processInstances'
const INVALID_ID = '请输入有效的流程实例标识。'

type LookupForm = {instanceId: string}

export default function ProcessInstanceLookupPage() {
  const {embedded} = useEmbeddedWorkbench()
  const {status, authorization, allows} = useAuth()
  const navigate = useNavigate()
  const [form] = Form.useForm<LookupForm>()
  const [fieldError, setFieldError] = useState<string>()

  if (status !== 'ready' || !authorization || !allows(PAGE)) {
    return <Alert type="warning" showIcon title="当前身份不能查找流程实例。" />
  }

  const submit = ({instanceId}: LookupForm) => {
    if (!allows(PAGE)) return
    if (!isProcessInstanceId(instanceId)) {
      setFieldError(INVALID_ID)
      form.setFields([{name: 'instanceId', errors: [INVALID_ID]}])
      form.focusField('instanceId')
      return
    }
    setFieldError(undefined)
    navigate('/process-instances/' + encodeURIComponent(instanceId))
  }

  return <section aria-labelledby={embedded ? undefined : 'process-instance-lookup-title'} aria-label={embedded ? '流程实例查找' : undefined} className="page-stack">
    {!embedded && (
      <div className="page-heading">
        <div>
          <Typography.Title id="process-instance-lookup-title" level={2}>流程实例查找</Typography.Title>
          <Typography.Text type="secondary">输入已知实例标识，查看当前身份可访问的流程运行。</Typography.Text>
        </div>
      </div>
    )}
    <Card variant="borderless" className="surface-card" title="查询流程实例">
      <Form form={form} layout="vertical" initialValues={{instanceId: ''}}
        onValuesChange={() => {
          setFieldError(undefined)
          form.setFields([{name: 'instanceId', errors: []}])
        }}
        onFinish={values => submit(values)}
        onFinishFailed={() => form.focusField('instanceId')}>
        <Form.Item name="instanceId" label="流程实例标识" validateTrigger="onSubmit"
          validateStatus={fieldError ? 'error' : undefined}
          help={fieldError}
          rules={[{validator: (_rule, value: unknown) => isProcessInstanceId(value)
            ? Promise.resolve() : Promise.reject(new Error(INVALID_ID))}]}>
          <Input autoComplete="off" maxLength={255} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">查询实例</Button>
        </Form.Item>
      </Form>
    </Card>
  </section>
}
