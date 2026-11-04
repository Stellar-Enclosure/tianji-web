import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {ProcessValueType} from '../api/humanTasks'
import TaskSchemaForm, {type TaskSchemaFormProps} from './TaskSchemaForm'

const choose = async (label: string | RegExp, option: string) => {
  fireEvent.mouseDown(screen.getByLabelText(label))
  fireEvent.click(await screen.findByText(option, {selector: '.ant-select-item-option-content'}))
}
const submit = () => fireEvent.click(screen.getByRole('button', {name: '提交处理结果'}))
const onSubmit = vi.fn()
const props = (overrides: Partial<TaskSchemaFormProps> = {}): TaskSchemaFormProps => ({
  schema: {approved: 'BOOLEAN', comment: 'STRING', amount: 'INTEGER'}, kind: 'APPROVAL', approvalField: 'approved',
  disabled: false, onSubmit, ...overrides,
})

describe('Released task schema form', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires an explicit approval decision and accepts false with an empty string and numeric zero', async () => {
    render(<TaskSchemaForm {...props()} />)
    expect(screen.getByLabelText(/approved/)).toHaveValue('')
    fireEvent.change(screen.getByLabelText('amount'), {target: {value: '0'}})
    submit()
    await screen.findByText(/请选择.*(?:决定|批准|拒绝)/)
    expect(onSubmit).not.toHaveBeenCalled()
    await choose(/approved/, '拒绝')
    submit()
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({approved: false, comment: '', amount: 0}))
    expect(Object.keys(onSubmit.mock.calls[0][0]).sort()).toEqual(['amount', 'approved', 'comment'])
  })

  it('supports explicit approval true and ordinary boolean false without selecting either by default', async () => {
    render(<TaskSchemaForm {...props({schema: {approved: 'BOOLEAN', acknowledged: 'BOOLEAN'}})} />)
    expect(screen.getByLabelText(/approved/)).toHaveValue('')
    expect(screen.getByLabelText('acknowledged')).toHaveValue('')
    await choose(/approved/, '批准')
    submit()
    await screen.findByText(/请选择/)
    expect(onSubmit).not.toHaveBeenCalled()
    await choose('acknowledged', '否')
    submit()
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({approved: true, acknowledged: false}))
  })

  it.each(['999999999999999', '-999999999999999'])('submits the exact bounded integer %s as a JSON number', async value => {
    render(<TaskSchemaForm {...props({kind: 'ACTION', approvalField: null, schema: {amount: 'INTEGER'}})} />)
    fireEvent.change(screen.getByLabelText('amount'), {target: {value}})
    submit()
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({amount: Number(value)}))
    expect(typeof onSubmit.mock.calls[0][0].amount).toBe('number')
  })

  it.each(['1000000000000000', '-1000000000000000', '1.5', '1e3', 'NaN', 'Infinity', '', ' 1 '])(
    'rejects invalid or out-of-range integer input %j before emitting a form', async value => {
      render(<TaskSchemaForm {...props({kind: 'ACTION', approvalField: null, schema: {amount: 'INTEGER'}})} />)
      fireEvent.change(screen.getByLabelText('amount'), {target: {value}})
      submit()
      await screen.findByText(/整数/)
      expect(onSubmit).not.toHaveBeenCalled()
    },
  )

  it.each(['', '中'.repeat(1024), '𠮷'.repeat(512), 'line one\nline two\tvalue'])('preserves a valid bounded string (%#)', async value => {
    render(<TaskSchemaForm {...props({kind: 'ACTION', approvalField: null, schema: {comment: 'STRING'}})} />)
    fireEvent.change(screen.getByLabelText('comment'), {target: {value}})
    submit()
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({comment: value}))
  })

  it.each(['x'.repeat(1025), '𠮷'.repeat(513), 'before\0after', '\ud800', '\udc00'])('rejects invalid string content (%#)', async value => {
    render(<TaskSchemaForm {...props({kind: 'ACTION', approvalField: null, schema: {comment: 'STRING'}})} />)
    fireEvent.change(screen.getByLabelText('comment'), {target: {value}})
    submit()
    await screen.findByText(/字符串/)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('emits an exact empty object for a released task with no form fields', async () => {
    render(<TaskSchemaForm {...props({kind: 'ACTION', approvalField: null, schema: {}})} />)
    submit()
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({}))
    expect(Object.keys(onSubmit.mock.calls[0][0])).toHaveLength(0)
  })

  it('preserves declared prototype-shaped field names as own values without extra keys', async () => {
    const schema = Object.fromEntries([['constructor', 'STRING'], ['__proto__', 'STRING'], ['toString', 'BOOLEAN']]) as Record<string, ProcessValueType>
    render(<TaskSchemaForm {...props({kind: 'ACTION', approvalField: null, schema})} />)
    fireEvent.change(screen.getByLabelText('constructor'), {target: {value: 'declared constructor'}})
    fireEvent.change(screen.getByLabelText('__proto__'), {target: {value: 'declared prototype'}})
    await choose('toString', '否')
    submit()
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const value = onSubmit.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(value).sort()).toEqual(['__proto__', 'constructor', 'toString'])
    expect(Object.prototype.hasOwnProperty.call(value, '__proto__')).toBe(true)
    expect(value.__proto__).toBe('declared prototype')
    expect(value.constructor).toBe('declared constructor')
    expect(value.toString).toBe(false)
    expect(({} as Record<string, unknown>)['declared prototype']).toBeUndefined()
  })

  it('resets drafts on a source key change and submits only the current schema', async () => {
    const current = render(<TaskSchemaForm key="task-1-version-a" {...props({kind: 'ACTION', approvalField: null, schema: {oldField: 'STRING'}})} />)
    fireEvent.change(screen.getByLabelText('oldField'), {target: {value: 'old draft'}})
    current.rerender(<TaskSchemaForm key="task-1-version-b" {...props({kind: 'ACTION', approvalField: null, schema: {newField: 'BOOLEAN'}})} />)
    expect(screen.queryByLabelText('oldField')).not.toBeInTheDocument()
    expect(screen.getByLabelText('newField')).toHaveValue('')
    await choose('newField', '否')
    submit()
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({newField: false}))
  })

  it('disables all editable fields and prevents submission while its parent freezes the operation', async () => {
    render(<TaskSchemaForm {...props({disabled: true})} />)
    expect(screen.getByLabelText(/approved/)).toBeDisabled()
    expect(screen.getByLabelText('comment')).toBeDisabled()
    expect(screen.getByLabelText('amount')).toBeDisabled()
    expect(screen.getByRole('button', {name: '提交处理结果'})).toBeDisabled()
    submit()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
