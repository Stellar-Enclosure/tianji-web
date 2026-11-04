import {requestJson} from './client'

export const CASE_STATUSES = ['ACTIVE', 'COMPLETED', 'TERMINATED'] as const
export const CASE_PLAN_ITEM_KINDS = ['HUMAN_TASK', 'MILESTONE'] as const
export const CASE_PLAN_ITEM_STATES = ['AVAILABLE', 'ENABLED', 'DISABLED', 'ACTIVE', 'COMPLETED', 'TERMINATED'] as const
export const CASE_PLAN_ITEM_ACTIONS = ['DISABLE', 'ENABLE', 'START', 'TERMINATE'] as const

export type CaseStatus = typeof CASE_STATUSES[number]
export type CasePlanItemKind = typeof CASE_PLAN_ITEM_KINDS[number]
export type CasePlanItemState = typeof CASE_PLAN_ITEM_STATES[number]
export type CasePlanItemAction = typeof CASE_PLAN_ITEM_ACTIONS[number]
export type CaseInstanceQuery = Readonly<{caseInstanceId: string}>
export type CasePlanItem = Readonly<{
  planItemInstanceId: string
  planItemDefinitionKey: string
  kind: CasePlanItemKind
  state: CasePlanItemState
  version: string
  availableActions: readonly CasePlanItemAction[]
}>
export type CaseInstance = Readonly<{
  caseInstanceId: string
  definitionKey: string
  releaseVersion: string
  businessKey: string
  correlationId: string
  status: CaseStatus
  submittedAt: string
  finishedAt: string | null
  planItems: readonly CasePlanItem[]
}>
export type ActOnPlanItemCommand = Readonly<{
  commandId: string
  caseInstanceId: string
  planItemInstanceId: string
  expectedVersion: string
  action: CasePlanItemAction
}>
export type CaseOperationResult = Readonly<{
  commandId: string
  caseInstanceId: string
  planItemInstanceId: string
  planItemDefinitionKey: string
  action: CasePlanItemAction
  releaseVersion: string
  definitionKey: string
  previousState: CasePlanItemState
  previousVersion: string
  resultingState: CasePlanItemState
  resultingVersion: string
  occurredAt: string
}>

const BASE = '/api/tianji/v1/cases'
const INSTANCE_KEYS = ['caseInstanceId', 'definitionKey', 'releaseVersion', 'businessKey', 'correlationId', 'status', 'submittedAt', 'finishedAt', 'planItems'] as const
const ITEM_KEYS = ['planItemInstanceId', 'planItemDefinitionKey', 'kind', 'state', 'version', 'availableActions'] as const
const RESULT_KEYS = ['commandId', 'caseInstanceId', 'planItemInstanceId', 'planItemDefinitionKey', 'action', 'releaseVersion', 'definitionKey',
  'previousState', 'previousVersion', 'resultingState', 'resultingVersion', 'occurredAt'] as const
const has = (value: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key)
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const closed = (value: unknown, required: readonly string[]): value is Record<string, unknown> => record(value)
  && required.every(key => has(value, key)) && Object.keys(value).every(key => required.includes(key))
const oneOf = <T extends string>(value: unknown, values: readonly T[]): value is T => typeof value === 'string' && values.includes(value as T)
const hash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const release = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value)
const definition = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(value)
const commandId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value)
const safeText = (value: string): boolean => {
  for (let index = 0; index < value.length; index++) {
    const current = value.charCodeAt(index)
    if (current === 0 || current < 32 || current === 127 || current >= 0xdc00 && current <= 0xdfff) return false
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
  && ![...value].every(character => javaWhitespace(character.codePointAt(0) ?? 0)) && safeText(value)
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
const invalidRequest = (): never => { throw new Error('案件请求无效') }
const invalidResponse = (): never => { throw new Error('服务返回的案件数据无效') }
const allowedActions = (state: CasePlanItemState): readonly CasePlanItemAction[] => {
  if (state === 'ENABLED') return ['DISABLE', 'START']
  if (state === 'DISABLED') return ['ENABLE']
  if (state === 'ACTIVE') return ['TERMINATE']
  return []
}
const planItem = (value: unknown, invalid: () => never): CasePlanItem => {
  if (!closed(value, ITEM_KEYS) || !id(value.planItemInstanceId) || !definition(value.planItemDefinitionKey)
    || !oneOf(value.kind, CASE_PLAN_ITEM_KINDS) || !oneOf(value.state, CASE_PLAN_ITEM_STATES) || !hash(value.version)
    || !Array.isArray(value.availableActions) || value.availableActions.length > 4
    || !value.availableActions.every(action => oneOf(action, CASE_PLAN_ITEM_ACTIONS))) return invalid()
  const actions = value.availableActions as CasePlanItemAction[], state = value.state
  if (new Set(actions).size !== actions.length || actions.some(action => !allowedActions(state).includes(action))
    || value.kind === 'MILESTONE' && actions.length > 0) return invalid()
  return {planItemInstanceId: value.planItemInstanceId, planItemDefinitionKey: value.planItemDefinitionKey, kind: value.kind,
    state, version: value.version, availableActions: [...actions]}
}
const instance = (value: unknown, invalid: () => never = invalidResponse): CaseInstance => {
  if (!closed(value, INSTANCE_KEYS) || !id(value.caseInstanceId) || !definition(value.definitionKey) || !release(value.releaseVersion)
    || !id(value.businessKey) || !commandId(value.correlationId) || !oneOf(value.status, CASE_STATUSES) || !instant(value.submittedAt)
    || !(value.finishedAt === null || instant(value.finishedAt)) || !Array.isArray(value.planItems) || value.planItems.length > 16
    || (value.status === 'ACTIVE') !== (value.finishedAt === null)) return invalid()
  const planItems = value.planItems.map(item => planItem(item, invalid)), instanceIds = new Set<string>(), definitionKeys = new Set<string>()
  for (const item of planItems) {
    if (instanceIds.has(item.planItemInstanceId) || definitionKeys.has(item.planItemDefinitionKey)
      || value.status !== 'ACTIVE' && item.availableActions.length > 0) return invalid()
    instanceIds.add(item.planItemInstanceId); definitionKeys.add(item.planItemDefinitionKey)
  }
  return {caseInstanceId: value.caseInstanceId, definitionKey: value.definitionKey, releaseVersion: value.releaseVersion,
    businessKey: value.businessKey, correlationId: value.correlationId, status: value.status, submittedAt: value.submittedAt,
    finishedAt: value.finishedAt, planItems}
}
const query = (value: unknown): CaseInstanceQuery => {
  if (!closed(value, ['caseInstanceId']) || !id(value.caseInstanceId)) return invalidRequest()
  return {caseInstanceId: value.caseInstanceId}
}
const sourceInstance = (value: CaseInstance): CaseInstance => {
  try { return instance(value, invalidRequest) } catch { return invalidRequest() }
}
const actionCommand = (value: unknown, source: CaseInstance): readonly [ActOnPlanItemCommand, CaseInstance, CasePlanItem] => {
  if (!closed(value, ['commandId', 'caseInstanceId', 'planItemInstanceId', 'expectedVersion', 'action']) || !commandId(value.commandId)
    || !id(value.caseInstanceId) || !id(value.planItemInstanceId) || !hash(value.expectedVersion) || !oneOf(value.action, CASE_PLAN_ITEM_ACTIONS)) return invalidRequest()
  const current = sourceInstance(source), matches = current.planItems.filter(item => item.planItemInstanceId === value.planItemInstanceId)
  if (current.status !== 'ACTIVE' || value.caseInstanceId !== current.caseInstanceId || matches.length !== 1
    || matches[0]?.version !== value.expectedVersion || !matches[0].availableActions.includes(value.action)) return invalidRequest()
  return [{commandId: value.commandId, caseInstanceId: value.caseInstanceId, planItemInstanceId: value.planItemInstanceId,
    expectedVersion: value.expectedVersion, action: value.action}, current, matches[0]]
}
const transition = (action: CasePlanItemAction, previous: CasePlanItemState, resulting: CasePlanItemState): boolean =>
  action === 'DISABLE' && previous === 'ENABLED' && resulting === 'DISABLED'
  || action === 'ENABLE' && previous === 'DISABLED' && resulting === 'ENABLED'
  || action === 'START' && previous === 'ENABLED' && resulting === 'ACTIVE'
  || action === 'TERMINATE' && previous === 'ACTIVE' && resulting === 'TERMINATED'
const operation = (value: unknown, command: ActOnPlanItemCommand, source: CaseInstance, item: CasePlanItem): CaseOperationResult => {
  if (!closed(value, RESULT_KEYS) || !commandId(value.commandId) || !id(value.caseInstanceId) || !id(value.planItemInstanceId)
    || !definition(value.planItemDefinitionKey) || !oneOf(value.action, CASE_PLAN_ITEM_ACTIONS) || !release(value.releaseVersion)
    || !definition(value.definitionKey) || !oneOf(value.previousState, CASE_PLAN_ITEM_STATES) || !hash(value.previousVersion)
    || !oneOf(value.resultingState, CASE_PLAN_ITEM_STATES) || !hash(value.resultingVersion) || !instant(value.occurredAt)
    || !transition(value.action, value.previousState, value.resultingState) || value.previousVersion === value.resultingVersion
    || value.commandId !== command.commandId || value.caseInstanceId !== command.caseInstanceId || value.planItemInstanceId !== command.planItemInstanceId
    || value.action !== command.action || value.previousVersion !== command.expectedVersion || value.planItemDefinitionKey !== item.planItemDefinitionKey
    || value.previousState !== item.state || value.releaseVersion !== source.releaseVersion || value.definitionKey !== source.definitionKey) return invalidResponse()
  return {commandId: value.commandId, caseInstanceId: value.caseInstanceId, planItemInstanceId: value.planItemInstanceId,
    planItemDefinitionKey: value.planItemDefinitionKey, action: value.action, releaseVersion: value.releaseVersion, definitionKey: value.definitionKey,
    previousState: value.previousState, previousVersion: value.previousVersion, resultingState: value.resultingState,
    resultingVersion: value.resultingVersion, occurredAt: value.occurredAt}
}
const post = <T>(path: string, tenant: string, body: unknown, signal?: AbortSignal): Promise<T> =>
  requestJson<T>(`${BASE}/${path}`, tenant, {method: 'POST', body: JSON.stringify(body), signal})

export const casesApi = {
  async get(tenant: string, input: CaseInstanceQuery, signal?: AbortSignal): Promise<CaseInstance> {
    const expected = query(input), result = instance(await post<unknown>('get', tenant, expected, signal))
    return result.caseInstanceId === expected.caseInstanceId ? result : invalidResponse()
  },
  async actPlanItem(tenant: string, input: ActOnPlanItemCommand, source: CaseInstance, signal?: AbortSignal): Promise<CaseOperationResult> {
    const [command, current, item] = actionCommand(input, source)
    return operation(await post<unknown>('act-plan-item', tenant, command, signal), command, current, item)
  },
}
