import {requestJson} from './client'

export const HUMAN_TASK_SCOPE_TYPES = ['PROCESS', 'CASE'] as const
export const HUMAN_TASK_SELECTIONS = ['CANDIDATE', 'ASSIGNED', 'ALL'] as const
export const HUMAN_TASK_KINDS = ['ACTION', 'APPROVAL'] as const
export const HUMAN_TASK_ACTIONS = ['CLAIM', 'UNCLAIM', 'TRANSFER', 'COMPLETE'] as const
export const PROCESS_VALUE_TYPES = ['STRING', 'INTEGER', 'BOOLEAN'] as const

export type HumanTaskScopeType = typeof HUMAN_TASK_SCOPE_TYPES[number]
export type HumanTaskSelection = typeof HUMAN_TASK_SELECTIONS[number]
export type HumanTaskKind = typeof HUMAN_TASK_KINDS[number]
export type HumanTaskAction = typeof HUMAN_TASK_ACTIONS[number]
export type ProcessValueType = typeof PROCESS_VALUE_TYPES[number]
export type HumanTaskFormValue = string | number | boolean

export type ListHumanTasksQuery = Readonly<{
  scopeType: HumanTaskScopeType
  selection: HumanTaskSelection
  releaseVersion: string | null
  scopeId: string | null
  taskDefinitionKey: string | null
  afterTaskId: string | null
  limit: number
}>

export type GetHumanTaskQuery = Readonly<{taskId: string}>
export type HumanTask = Readonly<{
  taskId: string
  scopeType: HumanTaskScopeType
  scopeId: string
  releaseVersion: string
  definitionKey: string
  taskDefinitionKey: string
  name: string
  kind: HumanTaskKind
  approvalField: string | null
  version: string
  lane: string
  availableLanes: readonly string[]
  assigned: boolean
  assignedToMe: boolean
  suspended: boolean
  formSchema: Readonly<Record<string, ProcessValueType>>
  createdAt: string
  dueAt: string | null
}>
export type HumanTaskPage = Readonly<{
  scopeType: HumanTaskScopeType
  selection: HumanTaskSelection
  items: readonly HumanTask[]
  nextAfterTaskId: string | null
}>

export type ClaimHumanTaskCommand = Readonly<{commandId: string; taskId: string; expectedVersion: string}>
export type UnclaimHumanTaskCommand = ClaimHumanTaskCommand
export type TransferHumanTaskCommand = ClaimHumanTaskCommand & Readonly<{targetLane: string}>
export type CompleteHumanTaskCommand = ClaimHumanTaskCommand & Readonly<{form: Readonly<Record<string, HumanTaskFormValue>>}>
export type HumanTaskActionReceipt = Readonly<{
  commandId: string
  taskId: string
  action: HumanTaskAction
  scopeType: HumanTaskScopeType
  scopeId: string
  releaseVersion: string
  definitionKey: string
  taskDefinitionKey: string
  kind: HumanTaskKind
  lane: string
  previousVersion: string
  resultingVersion: string | null
  approvalReceiptId: string | null
  approved: boolean | null
  occurredAt: string
}>

const BASE = '/api/tianji/v1/human-tasks'
const TASK_KEYS = ['taskId', 'scopeType', 'scopeId', 'releaseVersion', 'definitionKey', 'taskDefinitionKey', 'name', 'kind', 'approvalField',
  'version', 'lane', 'availableLanes', 'assigned', 'assignedToMe', 'suspended', 'formSchema', 'createdAt', 'dueAt'] as const
const QUERY_KEYS = ['scopeType', 'selection', 'releaseVersion', 'scopeId', 'taskDefinitionKey', 'afterTaskId', 'limit'] as const
const RECEIPT_KEYS = ['commandId', 'taskId', 'action', 'scopeType', 'scopeId', 'releaseVersion', 'definitionKey', 'taskDefinitionKey', 'kind',
  'lane', 'previousVersion', 'resultingVersion', 'approvalReceiptId', 'approved', 'occurredAt'] as const
const RESERVED = new Set(['true', 'false', 'null', 'empty', 'and', 'or', 'not', 'div', 'mod', 'eq', 'ne', 'lt', 'gt', 'le', 'ge',
  'instanceof', 'execution', 'task', 'authenticatedUserId'])
const encoder = new TextEncoder()
const has = (value: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key)
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const closed = (value: unknown, required: readonly string[], optional: readonly string[] = []): value is Record<string, unknown> => {
  if (!record(value)) return false
  const allowed = new Set([...required, ...optional])
  return required.every(key => has(value, key)) && Object.keys(value).every(key => allowed.has(key))
}
const oneOf = <T extends string>(value: unknown, values: readonly T[]): value is T => typeof value === 'string' && values.includes(value as T)
const hash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const release = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value)
const definition = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(value)
const commandId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value)
const variable = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(value) && !RESERVED.has(value)
const safeText = (value: string, allowControls: boolean): boolean => {
  for (let index = 0; index < value.length; index++) {
    const current = value.charCodeAt(index)
    if (current === 0 || !allowControls && (current < 32 || current === 127) || current >= 0xdc00 && current <= 0xdfff) return false
    if (current >= 0xd800 && current <= 0xdbff) {
      if (++index >= value.length) return false
      const next = value.charCodeAt(index)
      if (next < 0xdc00 || next > 0xdfff) return false
    }
  }
  return true
}
const javaWhitespace = (codePoint: number): boolean => codePoint >= 0x9 && codePoint <= 0xd || codePoint >= 0x1c && codePoint <= 0x20
  || codePoint === 0x1680 || codePoint >= 0x2000 && codePoint <= 0x2006 || codePoint >= 0x2008 && codePoint <= 0x200a
  || codePoint === 0x2028 || codePoint === 0x2029 || codePoint === 0x205f || codePoint === 0x3000
const id = (value: unknown, max = 255): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
  && value.charCodeAt(0) > 0x20 && value.charCodeAt(value.length - 1) > 0x20
  && ![...value].every(character => javaWhitespace(character.codePointAt(0) ?? 0)) && safeText(value, false)
const instant = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value)
  if (!match) return false
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]), hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6])
  const offsetHour = match[10] === undefined ? 0 : Number(match[10]), offsetMinute = match[11] === undefined ? 0 : Number(match[11])
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0) && hour <= 23 && minute <= 59 && second <= 59
    && offsetMinute <= 59 && (offsetHour < 18 || offsetHour === 18 && offsetMinute === 0)
}
const invalidRequest = (): never => { throw new Error('任务请求无效') }
const invalidResponse = (): never => { throw new Error('服务返回的任务数据无效') }
const optionalString = (value: Record<string, unknown>, key: string): string | null | undefined => {
  if (!has(value, key) || value[key] === null) return null
  return typeof value[key] === 'string' ? value[key] : undefined
}
const schema = (value: unknown, invalid: () => never): Readonly<Record<string, ProcessValueType>> => {
  if (!record(value) || Object.keys(value).length > 16) return invalid()
  const entries: [string, ProcessValueType][] = []
  for (const [key, type] of Object.entries(value)) {
    if (!variable(key) || !oneOf(type, PROCESS_VALUE_TYPES)) return invalid()
    entries.push([key, type])
  }
  return Object.fromEntries(entries)
}
const task = (value: unknown, invalid: () => never = invalidResponse): HumanTask => {
  const required = TASK_KEYS.filter(key => key !== 'approvalField' && key !== 'dueAt')
  if (!closed(value, required, ['approvalField', 'dueAt'])) return invalid()
  const approvalField = optionalString(value, 'approvalField'), dueAt = optionalString(value, 'dueAt')
  if (approvalField === undefined || dueAt === undefined || !id(value.taskId) || !oneOf(value.scopeType, HUMAN_TASK_SCOPE_TYPES)
    || !id(value.scopeId) || !release(value.releaseVersion) || !definition(value.definitionKey) || !definition(value.taskDefinitionKey)
    || !id(value.name, 512) || !oneOf(value.kind, HUMAN_TASK_KINDS) || !hash(value.version) || !definition(value.lane)
    || !Array.isArray(value.availableLanes) || value.availableLanes.length < 1 || value.availableLanes.length > 8
    || !value.availableLanes.every(definition) || new Set(value.availableLanes).size !== value.availableLanes.length || !value.availableLanes.includes(value.lane)
    || typeof value.assigned !== 'boolean' || typeof value.assignedToMe !== 'boolean' || typeof value.suspended !== 'boolean'
    || value.assignedToMe && !value.assigned || !instant(value.createdAt) || dueAt !== null && !instant(dueAt)) return invalid()
  const formSchema = schema(value.formSchema, invalid)
  if (value.kind === 'APPROVAL' && (approvalField === null || formSchema[approvalField] !== 'BOOLEAN')
    || value.kind === 'ACTION' && approvalField !== null) return invalid()
  return {taskId: value.taskId, scopeType: value.scopeType, scopeId: value.scopeId, releaseVersion: value.releaseVersion,
    definitionKey: value.definitionKey, taskDefinitionKey: value.taskDefinitionKey, name: value.name, kind: value.kind, approvalField,
    version: value.version, lane: value.lane, availableLanes: [...value.availableLanes], assigned: value.assigned,
    assignedToMe: value.assignedToMe, suspended: value.suspended, formSchema, createdAt: value.createdAt, dueAt}
}
const listQuery = (value: unknown): ListHumanTasksQuery => {
  if (!closed(value, QUERY_KEYS) || !oneOf(value.scopeType, HUMAN_TASK_SCOPE_TYPES) || !oneOf(value.selection, HUMAN_TASK_SELECTIONS)
    || !(value.releaseVersion === null || release(value.releaseVersion)) || !(value.scopeId === null || id(value.scopeId))
    || !(value.taskDefinitionKey === null || definition(value.taskDefinitionKey)) || !(value.afterTaskId === null || id(value.afterTaskId))
    || !Number.isInteger(value.limit) || (value.limit as number) < 1 || (value.limit as number) > 50) return invalidRequest()
  return {scopeType: value.scopeType, selection: value.selection, releaseVersion: value.releaseVersion, scopeId: value.scopeId,
    taskDefinitionKey: value.taskDefinitionKey, afterTaskId: value.afterTaskId, limit: value.limit as number}
}
const getQuery = (value: unknown): GetHumanTaskQuery => {
  if (!closed(value, ['taskId']) || !id(value.taskId)) return invalidRequest()
  return {taskId: value.taskId}
}
const compareIds = (left: string, right: string): number => {
  const a = encoder.encode(left), b = encoder.encode(right), length = Math.min(a.length, b.length)
  for (let index = 0; index < length; index++) if (a[index] !== b[index]) return (a[index] ?? 0) - (b[index] ?? 0)
  return a.length - b.length
}
const page = (value: unknown, query: ListHumanTasksQuery): HumanTaskPage => {
  if (!closed(value, ['scopeType', 'selection', 'items', 'nextAfterTaskId']) || value.scopeType !== query.scopeType
    || value.selection !== query.selection || !Array.isArray(value.items) || value.items.length > 50 || value.items.length > query.limit) return invalidResponse()
  const items = value.items.map(item => task(item))
  let previous = query.afterTaskId
  for (const item of items) {
    if (item.scopeType !== query.scopeType || query.releaseVersion !== null && item.releaseVersion !== query.releaseVersion || query.scopeId !== null && item.scopeId !== query.scopeId
      || query.taskDefinitionKey !== null && item.taskDefinitionKey !== query.taskDefinitionKey || previous !== null && compareIds(previous, item.taskId) >= 0
      || query.selection === 'ASSIGNED' && !item.assignedToMe || query.selection === 'CANDIDATE' && item.assigned) return invalidResponse()
    previous = item.taskId
  }
  if (!(value.nextAfterTaskId === null || id(value.nextAfterTaskId))) return invalidResponse()
  const next = value.nextAfterTaskId
  if (next !== null && (query.afterTaskId !== null && compareIds(query.afterTaskId, next) >= 0 || previous !== null && compareIds(previous, next) > 0)) return invalidResponse()
  return {scopeType: query.scopeType, selection: query.selection, items, nextAfterTaskId: next}
}
const taskSource = (value: HumanTask): HumanTask => {
  try { return task(value, invalidRequest) } catch { return invalidRequest() }
}
const baseCommand = (value: unknown, keys: readonly string[]): ClaimHumanTaskCommand => {
  if (!closed(value, keys) || !commandId(value.commandId) || !id(value.taskId) || !hash(value.expectedVersion)) return invalidRequest()
  return {commandId: value.commandId, taskId: value.taskId, expectedVersion: value.expectedVersion}
}
const bind = (command: ClaimHumanTaskCommand, source: HumanTask): HumanTask => {
  const current = taskSource(source)
  if (command.taskId !== current.taskId || command.expectedVersion !== current.version) return invalidRequest()
  return current
}
const form = (value: unknown, expected: Readonly<Record<string, ProcessValueType>>): Readonly<Record<string, HumanTaskFormValue>> => {
  if (!record(value) || Object.keys(value).length !== Object.keys(expected).length || Object.keys(value).some(key => !has(expected as Record<string, unknown>, key))) return invalidRequest()
  const entries: [string, HumanTaskFormValue][] = []
  for (const [key, type] of Object.entries(expected)) {
    if (!has(value, key)) return invalidRequest()
    const entry = value[key]
    if (type === 'STRING' && (typeof entry !== 'string' || entry.length > 1024 || !safeText(entry, true) || encoder.encode(entry).length > 4096)
      || type === 'INTEGER' && (typeof entry !== 'number' || !Number.isSafeInteger(entry) || Math.abs(entry) > 999_999_999_999_999)
      || type === 'BOOLEAN' && typeof entry !== 'boolean') return invalidRequest()
    entries.push([key, entry as HumanTaskFormValue])
  }
  return Object.fromEntries(entries)
}
const receipt = (value: unknown, action: HumanTaskAction, command: ClaimHumanTaskCommand, source: HumanTask,
  targetLane?: string, submittedForm?: Readonly<Record<string, HumanTaskFormValue>>): HumanTaskActionReceipt => {
  const required = RECEIPT_KEYS.filter(key => !['resultingVersion', 'approvalReceiptId', 'approved'].includes(key))
  if (!closed(value, required, ['resultingVersion', 'approvalReceiptId', 'approved'])) return invalidResponse()
  const resultingVersion = optionalString(value, 'resultingVersion'), approvalReceiptId = optionalString(value, 'approvalReceiptId')
  const approved = !has(value, 'approved') || value.approved === null ? null : typeof value.approved === 'boolean' ? value.approved : undefined
  if (resultingVersion === undefined || approvalReceiptId === undefined || approved === undefined || !commandId(value.commandId) || !id(value.taskId)
    || !oneOf(value.action, HUMAN_TASK_ACTIONS) || !oneOf(value.scopeType, HUMAN_TASK_SCOPE_TYPES) || !id(value.scopeId)
    || !release(value.releaseVersion) || !definition(value.definitionKey) || !definition(value.taskDefinitionKey) || !oneOf(value.kind, HUMAN_TASK_KINDS)
    || !definition(value.lane) || !hash(value.previousVersion) || resultingVersion !== null && !hash(resultingVersion)
    || approvalReceiptId !== null && !id(approvalReceiptId) || !instant(value.occurredAt)) return invalidResponse()
  const complete = action === 'COMPLETE', approval = complete && source.kind === 'APPROVAL'
  if (value.commandId !== command.commandId || value.taskId !== command.taskId || value.action !== action || value.previousVersion !== command.expectedVersion
    || value.scopeType !== source.scopeType || value.scopeId !== source.scopeId || value.releaseVersion !== source.releaseVersion
    || value.definitionKey !== source.definitionKey || value.taskDefinitionKey !== source.taskDefinitionKey || value.kind !== source.kind
    || value.lane !== (action === 'TRANSFER' ? targetLane : source.lane) || complete !== (resultingVersion === null)
    || !complete && resultingVersion === value.previousVersion || approval !== (approvalReceiptId !== null && approved !== null)
    || (approvalReceiptId === null) !== (approved === null)
    || approval && (source.approvalField === null || submittedForm?.[source.approvalField] !== approved)) return invalidResponse()
  return {commandId: value.commandId, taskId: value.taskId, action: value.action, scopeType: value.scopeType, scopeId: value.scopeId,
    releaseVersion: value.releaseVersion, definitionKey: value.definitionKey, taskDefinitionKey: value.taskDefinitionKey, kind: value.kind,
    lane: value.lane, previousVersion: value.previousVersion, resultingVersion, approvalReceiptId, approved, occurredAt: value.occurredAt}
}
const post = <T>(path: string, tenant: string, body: unknown, signal?: AbortSignal): Promise<T> =>
  requestJson<T>(`${BASE}/${path}`, tenant, {method: 'POST', body: JSON.stringify(body), signal})

export const humanTasksApi = {
  async query(tenant: string, input: ListHumanTasksQuery, signal?: AbortSignal): Promise<HumanTaskPage> {
    const query = listQuery(input)
    return page(await post<unknown>('query', tenant, query, signal), query)
  },
  async get(tenant: string, input: GetHumanTaskQuery, signal?: AbortSignal): Promise<HumanTask> {
    const query = getQuery(input), result = task(await post<unknown>('get', tenant, query, signal))
    return result.taskId === query.taskId ? result : invalidResponse()
  },
  async claim(tenant: string, input: ClaimHumanTaskCommand, source: HumanTask, signal?: AbortSignal): Promise<HumanTaskActionReceipt> {
    const command = baseCommand(input, ['commandId', 'taskId', 'expectedVersion']), current = bind(command, source)
    if (current.assigned || current.suspended) return invalidRequest()
    return receipt(await post<unknown>('claim', tenant, command, signal), 'CLAIM', command, current)
  },
  async unclaim(tenant: string, input: UnclaimHumanTaskCommand, source: HumanTask, signal?: AbortSignal): Promise<HumanTaskActionReceipt> {
    const command = baseCommand(input, ['commandId', 'taskId', 'expectedVersion']), current = bind(command, source)
    if (!current.assignedToMe || current.suspended) return invalidRequest()
    return receipt(await post<unknown>('unclaim', tenant, command, signal), 'UNCLAIM', command, current)
  },
  async transfer(tenant: string, input: TransferHumanTaskCommand, source: HumanTask, signal?: AbortSignal): Promise<HumanTaskActionReceipt> {
    const base = baseCommand(input, ['commandId', 'taskId', 'expectedVersion', 'targetLane']), current = bind(base, source)
    if (!closed(input, ['commandId', 'taskId', 'expectedVersion', 'targetLane']) || !definition(input.targetLane)
      || !current.availableLanes.includes(input.targetLane) || current.suspended) return invalidRequest()
    const command: TransferHumanTaskCommand = {...base, targetLane: input.targetLane}
    return receipt(await post<unknown>('transfer', tenant, command, signal), 'TRANSFER', command, current, command.targetLane)
  },
  async complete(tenant: string, input: CompleteHumanTaskCommand, source: HumanTask, signal?: AbortSignal): Promise<HumanTaskActionReceipt> {
    const base = baseCommand(input, ['commandId', 'taskId', 'expectedVersion', 'form']), current = bind(base, source)
    if (!current.assignedToMe || current.suspended) return invalidRequest()
    const submitted = form(input.form, current.formSchema), command: CompleteHumanTaskCommand = {...base, form: submitted}
    return receipt(await post<unknown>('complete', tenant, command, signal), 'COMPLETE', command, current, undefined, submitted)
  },
}
