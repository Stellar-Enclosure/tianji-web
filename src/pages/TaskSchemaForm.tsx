import {Button, Form, Input, Select} from 'antd'
import type {HumanTaskFormValue, HumanTaskKind, ProcessValueType} from '../api/humanTasks'

export type TaskSchemaFormProps = Readonly<{
  schema: Readonly<Record<string, ProcessValueType>>
  kind: HumanTaskKind
  approvalField: string | null
  disabled: boolean
  onSubmit: (form: Readonly<Record<string, HumanTaskFormValue>>) => void
}>

export default function TaskSchemaForm(props: TaskSchemaFormProps) {
  return <TaskFields key={JSON.stringify([props.schema, props.kind, props.approvalField])} {...props} />
}

const encoder = new TextEncoder()
const fieldName = (index: number): string => `field_${index}`
const validString = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 1024 || encoder.encode(value).length > 4096) return false
  for (let index = 0; index < value.length; index++) {
    const character = value.charCodeAt(index)
    if (character === 0 || character >= 0xdc00 && character <= 0xdfff) return false
    if (character >= 0xd800 && character <= 0xdbff) {
      const next = value.charCodeAt(++index)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
    }
  }
  return true
}
const validInteger = (value: unknown): value is string => typeof value === 'string' && /^-?(?:0|[1-9][0-9]{0,14})$/.test(value)
  && Number.isSafeInteger(Number(value)) && Math.abs(Number(value)) <= 999_999_999_999_999

function TaskFields({schema, kind, approvalField, disabled, onSubmit}: TaskSchemaFormProps) {
  const [form] = Form.useForm<Record<string, string | boolean | undefined>>()
  const entries = Object.entries(schema)
  const initialValues = Object.fromEntries(entries.map(([, type], index) => [fieldName(index), type === 'STRING' ? '' : undefined]))
  return <Form form={form} layout="vertical" className="full-width" initialValues={initialValues} disabled={disabled}
    onFinish={values => {
      if (disabled) return
      const result = Object.fromEntries(entries.map(([key, type], index) => [key,
        type === 'INTEGER' ? Number(values[fieldName(index)]) : type === 'BOOLEAN' ? values[fieldName(index)] === 'true'
          : values[fieldName(index)] as HumanTaskFormValue]))
      onSubmit(result)
    }}>
    {entries.map(([key, type], index) => {
      const approval = kind === 'APPROVAL' && key === approvalField
      return <Form.Item key={key} name={fieldName(index)} label={approval ? `${key}（审批决定）` : key} rules={[{validator: (_, value: unknown) => {
        const valid = type === 'STRING' ? validString(value) : type === 'INTEGER' ? validInteger(value) : value === 'true' || value === 'false'
        return valid ? Promise.resolve() : Promise.reject(new Error(type === 'STRING' ? '请输入有效字符串，最多 1024 个字符，不包含空字符或无效 Unicode'
          : type === 'INTEGER' ? '请输入范围为 -999999999999999 至 999999999999999 的整数' : approval ? '请选择批准或拒绝' : '请选择是或否'))
      }}]}>
        {type === 'STRING' ? <Input.TextArea autoComplete="off" rows={3} />
          : type === 'INTEGER' ? <Input autoComplete="off" inputMode="numeric" />
            : <Select options={approval ? [{value: 'true', label: '批准'}, {value: 'false', label: '拒绝'}] : [{value: 'true', label: '是'}, {value: 'false', label: '否'}]} />}
      </Form.Item>
    })}
    <Form.Item><Button type="primary" htmlType="submit" disabled={disabled}>提交处理结果</Button></Form.Item>
  </Form>
}
