import {requestJson} from './client'
import {isProcessCorrelationId, isProcessCorrelationUtc, type ProcessInstanceSnapshot} from './processCorrelations'
import {isProcessReleaseVersion} from './processReleases'
import {isProcessInstanceId} from './processWorkerFailures'

export type TypedJsonValue = null | boolean | string | number | TypedDataObject | readonly TypedJsonValue[]
export type TypedDataObject = {readonly [key: string]: TypedJsonValue}

type TemplateRef = Readonly<{key: string; version: number; contentSha256: string}>
type AgentTaskOverride = Readonly<{templateRef: TemplateRef; parameters?: TypedDataObject}>
  | Readonly<{templateRef?: TemplateRef; parameters: TypedDataObject}>

export type AutomationStartCommand = Readonly<{
  definitionKey: string
  businessKey: string
  commandId: string
  correlationId: string
  variables: TypedDataObject
  agentTaskOverrides?: Readonly<Record<string, AgentTaskOverride>>
}>

type GraphNode = Readonly<{id: string; kind: string; name: string}>
type GraphEdge = Readonly<{id: string; source: string; target: string; label: string | null}>
export type GraphVO = Readonly<{definitionKey: string; nodes: readonly GraphNode[]; edges: readonly GraphEdge[]}>

const instanceStates = ['ACTIVE', 'SUSPENDED', 'COMPLETED', 'FAILED', 'CANCELLED'] as const
const nodeKinds = ['HUMAN', 'SERVICE', 'RULE', 'AGENT', 'EVENT_WAIT', 'TIMER', 'SUBPROCESS', 'LOOP', 'MULTI_INSTANCE', 'AND_JOIN'] as const
const nodeStates = ['SCHEDULED', 'RUNNING', 'WAITING', 'RESULT_ACCEPTED', 'WAIT_RECOVERY', 'COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED'] as const
const effectOutcomes = ['NONE', 'CONFIRMED', 'UNKNOWN'] as const
const terminalNodeStates = ['COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED'] as const
const cancelStates = ['COMPLETED', 'CANCELLED'] as const
const controlStates = ['ACTIVE', 'SUSPENDED', ...cancelStates] as const
const controlBlockReasons = ['NONE', 'PROCESS_TERMINAL', 'MODEL_CONTAINS_CASE_SOURCE'] as const
const waitKinds = ['HUMAN_TASK', 'EXTERNAL_WORKER', 'AGENT_RESULT_WAIT', 'CASE_COMPLETION_WAIT', 'TIMER'] as const

export type AutomationInstanceDTO = Readonly<{
  instanceId: string
  definitionKey: string
  releaseVersion: string
  activationRevision: number
  profile: 'AUTOMATION_V2'
  businessKey: string
  correlationId: string
  state: typeof instanceStates[number]
  version: string
  configurationSha256: string
  submittedAt: string
  finishedAt: string | null
  output: TypedDataObject | null
  availableActions: readonly 'CANCEL'[]
  graph: GraphVO
}>

export type NodeExecutionQuery = Readonly<{nodeId?: string; cursor?: string; limit?: number}>
export type NodeExecutionDTO = Readonly<{
  nodeId: string
  occurrenceId: string
  attempt: number
  nodeExecutionRef: string
  kind: typeof nodeKinds[number]
  state: typeof nodeStates[number]
  inputSha256: string
  outputSchemaSha256: string
  startedAt: string
  finishedAt: string | null
  deadlineAt: string
  errorCode: string | null
  sideEffectOutcome: typeof effectOutcomes[number]
  agentRunId: string | null
  output: TypedDataObject | null
  eventReceiptIds: readonly string[]
  version: string
  availableActions: readonly 'RETRY'[]
}>
export type NodeExecutionPageDTO = Readonly<{
  instanceId: string
  releaseVersion: string
  observedAt: string
  items: readonly NodeExecutionDTO[]
  nextCursor: string | null
}>

export type NodeRetryCommand = Readonly<{
  commandId: string
  nodeExecutionRef: string
  expectedVersion: string
  reason: string
  businessReceiptRef?: string | null
}>
export type NodeRetryResultDTO = Readonly<{
  commandId: string
  instanceId: string
  occurrenceId: string
  attempt: number
  nodeExecutionRef: string
  state: 'SCHEDULED'
}>

type ProcessActiveWait = Readonly<{
  activityKey: string
  kind: typeof waitKinds[number]
  occurrences: number
}>
export type ProcessControlSnapshotDTO = Readonly<{
  process: ProcessInstanceSnapshot
  activeWaits: readonly ProcessActiveWait[]
  allowedActions: readonly 'CANCEL'[]
  cancellationBlockReason: typeof controlBlockReasons[number]
  version: string
  observedAt: string
}>
export type CancelProcessCommand = Readonly<{instanceId: string; commandId: string; expectedVersion: string; reason: string}>
export type CancelProcessResult = Readonly<{
  instanceId: string
  commandId: string
  accepted: boolean
  status: typeof cancelStates[number]
  resultingVersion: string
  finishedAt: string
  decidedAt: string
  linkedAgentClosureScheduled: boolean
}>

const v1Instances = '/api/tianji/v1/process-instances'
const v2Instances = '/api/tianji/v2/process-instances'
const maxInteger = 999_999_999_999_999
const typedBytes = 64 * 1024
const overrideBytes = 256 * 1024
const maxStartBodyBytes = 384 * 1024
const typedDepth = 8
const utf8 = new TextEncoder()
const unpairedSurrogate = /[\uD800-\uDFFF]/u
const javaWhitespace = '[\u0009-\u000D\u001C-\u0020\u1680\u2000-\u2006\u2008-\u200A\u2028\u2029\u205F\u3000]'
const blank = new RegExp('^' + javaWhitespace + '*(?![\\s\\S])')
const boundaryWhitespace = new RegExp('^' + javaWhitespace + '|' + javaWhitespace + '(?![\\s\\S])')
const logicalId = (value: unknown): value is string => matches(value, /^[A-Za-z][A-Za-z0-9_.:-]{0,127}(?![\s\S])/)
const nodeObservationId = (value: unknown): value is string => matches(value, /^[A-Za-z][A-Za-z0-9_.:-]{0,254}(?![\s\S])/)
const sha256 = (value: unknown): value is string => matches(value, /^[a-f0-9]{64}(?![\s\S])/)
const nodeCursor = (value: unknown): value is string => matches(value, /^[A-Za-z0-9_-]{1,2048}(?![\s\S])/)

const invalidStart = (): never => { throw new Error('START 请求无效') }
const invalidTypedData = (): never => { throw new Error('流程类型化数据无效') }
const invalidGraph = (): never => { throw new Error('服务返回的流程图无效') }
const invalidResponse = (): never => { throw new Error('服务返回的流程运行数据无效') }
const invalidRequest = (): never => { throw new Error('流程运行请求无效') }

type Fail = () => never

function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value)
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum
}

function validUnicode(value: string): boolean {
  return !value.includes('\0') && !unpairedSurrogate.test(value)
}

function hasControl(value: string, lastControl: number): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code < 0x20 || code >= 0x7f && code <= lastControl) return true
  }
  return false
}

function v1Text(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength && !blank.test(value)
    && !value.startsWith(' ') && !value.endsWith(' ') && !hasControl(value, 0x7f) && validUnicode(value)
}

function opaque(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength && !blank.test(value)
    && !hasControl(value, 0x9f) && validUnicode(value)
}

function oneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return choices.some(choice => choice === value)
}

function record(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  if (prototype !== null && prototype !== Object.prototype) return false
  return Reflect.ownKeys(value).every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return typeof key === 'string' && descriptor?.enumerable === true && Object.hasOwn(descriptor, 'value')
  })
}

function closed(value: unknown, required: readonly string[], optional: readonly string[] = []): value is Record<string, unknown> {
  return record(value) && required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => required.includes(key) || optional.includes(key))
}

function list(value: unknown, maxLength: number, fail: Fail): readonly unknown[] {
  if (!Array.isArray(value) || value.length > maxLength || Reflect.ownKeys(value).length !== value.length + 1) return fail()
  const values: unknown[] = []
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index)
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return fail()
    values.push(descriptor.value)
  }
  return values
}

function presentationText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= typedBytes && validUnicode(value)
    && utf8.encode(value).byteLength <= typedBytes
}

export function parseAutomationGraph(value: unknown): GraphVO {
  if (!closed(value, ['definitionKey', 'nodes', 'edges']) || !logicalId(value.definitionKey)) return invalidGraph()
  const nodes: GraphNode[] = list(value.nodes, 128, invalidGraph).map(node => {
    if (!closed(node, ['id', 'kind', 'name']) || !logicalId(node.id)
        || !matches(node.kind, /^[A-Z][A-Z0-9_]{0,63}(?![\s\S])/) || !presentationText(node.name)) return invalidGraph()
    return {id: node.id, kind: node.kind, name: node.name}
  })
  const nodeIds = new Set(nodes.map(node => node.id))
  if (nodeIds.size !== nodes.length) return invalidGraph()
  const edges: GraphEdge[] = list(value.edges, Infinity, invalidGraph).map(edge => {
    if (!closed(edge, ['id', 'source', 'target', 'label']) || !logicalId(edge.id) || !logicalId(edge.source)
        || !nodeIds.has(edge.source) || !logicalId(edge.target) || !nodeIds.has(edge.target)
        || edge.label !== null && !presentationText(edge.label)) return invalidGraph()
    return {id: edge.id, source: edge.source, target: edge.target, label: edge.label}
  })
  if (new Set(edges.map(edge => edge.id)).size !== edges.length) return invalidGraph()
  return {definitionKey: value.definitionKey, nodes, edges}
}

function typedJson(value: unknown, maxBytes = typedBytes, maxDepth = typedDepth): {value: TypedJsonValue; json: string} {
  const parts: string[] = []
  let codeUnits = 0

  function append(part: string) {
    codeUnits += part.length
    if (codeUnits > maxBytes) invalidTypedData()
    parts.push(part)
  }

  function appendString(text: string) {
    if (text.length > maxBytes - codeUnits || !validUnicode(text)) invalidTypedData()
    append(JSON.stringify(text))
  }

  function visit(item: unknown, depth: number): TypedJsonValue {
    if (depth > maxDepth) return invalidTypedData()
    if (item === null || typeof item === 'boolean' || integer(item, -maxInteger, maxInteger)) {
      append(String(item))
      return item === 0 ? 0 : item
    }
    if (typeof item === 'string') {
      appendString(item)
      return item
    }
    if (Array.isArray(item)) {
      append('[')
      const values = list(item, 256, invalidTypedData).map((element, index) => {
        if (index > 0) append(',')
        return visit(element, depth + 1)
      })
      append(']')
      return values
    }
    if (!record(item)) return invalidTypedData()
    append('{')
    // Emit members directly so numeric-looking keys keep Java's UTF-16 sort order.
    const entries = Object.keys(item).sort().map((key, index) => {
      if (index > 0) append(',')
      appendString(key)
      append(':')
      return [key, visit(item[key], depth + 1)] as const
    })
    append('}')
    return Object.fromEntries(entries)
  }

  const checked = visit(value, 0)
  const json = parts.join('')
  if (utf8.encode(json).byteLength > maxBytes) return invalidTypedData()
  return {value: checked, json}
}

export function parseTypedJsonValue(value: unknown): TypedJsonValue {
  return typedJson(value).value
}

export function parseTypedDataObject(value: unknown): TypedDataObject {
  const checked = parseTypedJsonValue(value)
  if (checked === null || typeof checked !== 'object' || isArray(checked)) return invalidTypedData()
  return checked
}

function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}

/** Read source form JSON before duplicate keys or numeric token spelling are lost. */
export function parseStartVariablesJson(source: string): TypedDataObject {
  if (source.length > maxStartBodyBytes || utf8.encode(source).byteLength > maxStartBodyBytes) return invalidTypedData()
  const value: unknown = JSON.parse(source)
  const objects: (Set<string> | null)[] = []
  const tokens = /"(?:[^"\\]|\\.)*"|[{}[\]]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g
  const separator = /\s*:/y
  for (const match of source.matchAll(tokens)) {
    const token = match[0]
    switch (token) {
      case '{': objects.push(new Set()); break
      case '[': objects.push(null); break
      case '}':
      case ']': objects.pop(); break
      default:
        if (token.startsWith('"')) {
          const keys = objects.at(-1)
          const end = match.index + token.length
          separator.lastIndex = end
          if (!keys || !separator.test(source)) break
          const key: unknown = JSON.parse(token)
          if (typeof key !== 'string' || keys.has(key)) return invalidTypedData()
          keys.add(key)
        } else if (!/^-?\d+(?![\s\S])/.test(token)) return invalidTypedData()
    }
  }
  return parseTypedDataObject(value)
}

function startWire(value: unknown) {
  const required = ['definitionKey', 'businessKey', 'commandId', 'correlationId', 'variables']
  if (!closed(value, required, ['agentTaskOverrides']) || !logicalId(value.definitionKey)
      || !logicalId(value.commandId) || value.commandId.startsWith('evt-v2-') || !logicalId(value.correlationId)
      || !opaque(value.businessKey, 255) || boundaryWhitespace.test(value.businessKey) || !record(value.variables)) return invalidStart()

  const hasOverrides = Object.hasOwn(value, 'agentTaskOverrides')
  const overrides = hasOverrides ? value.agentTaskOverrides : {}
  if (!record(overrides) || Object.keys(overrides).length > 128) return invalidStart()
  for (const [node, override] of Object.entries(overrides)) {
    if (!logicalId(node) || !closed(override, [], ['templateRef', 'parameters']) || Object.keys(override).length === 0) return invalidStart()
    if (Object.hasOwn(override, 'templateRef')) {
      const ref = override.templateRef
      if (!closed(ref, ['key', 'version', 'contentSha256']) || !logicalId(ref.key)
          || !integer(ref.version, 1, maxInteger) || !sha256(ref.contentSha256)) return invalidStart()
    }
    if (Object.hasOwn(override, 'parameters')) {
      if (!record(override.parameters)) return invalidStart()
      typedJson(override.parameters, overrideBytes)
    }
  }

  const variables = typedJson(value.variables).json
  const overridesJson = typedJson(overrides, overrideBytes, typedDepth + 2).json
  const {definitionKey, businessKey, commandId, correlationId} = value
  const prefix = JSON.stringify({definitionKey, businessKey, commandId, correlationId}).slice(0, -1)
  const body = prefix + ',"variables":' + variables + (hasOverrides ? ',"agentTaskOverrides":' + overridesJson : '') + '}'
  return {definitionKey, businessKey, correlationId, variables, overridesJson, body}
}

export async function startRequestSha256(command: unknown): Promise<string> {
  const wire = startWire(command)
  const segments = ['AUTOMATION_START_REQUEST_V2', wire.definitionKey, wire.businessKey,
    wire.correlationId, wire.variables, wire.overridesJson].map(segment => utf8.encode(segment))

  const framed = new Uint8Array(segments.reduce((total, segment) => total + 4 + segment.byteLength, 0))
  const sizes = new DataView(framed.buffer)
  let offset = 0
  for (const segment of segments) {
    sizes.setUint32(offset, segment.byteLength)
    framed.set(segment, offset + 4)
    offset += 4 + segment.byteLength
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', framed)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function encodeInstanceId(instanceId: unknown, isV1 = false): string {
  if (typeof instanceId !== 'string' || !(isV1 ? isProcessInstanceId(instanceId) : opaque(instanceId, 255))
      || instanceId === '.' || instanceId === '..') return invalidRequest()
  return encodeURIComponent(instanceId)
}

function microsecondOrder(instant: string): string {
  return instant.slice(0, 19) + instant.slice(20, -1).padEnd(6, '0')
}

function actions<T extends string>(value: unknown, action: T, permitted: boolean): readonly T[] {
  const items = list(value, permitted ? 1 : 0, invalidResponse)
  if (items.length === 0) return []
  if (items[0] !== action) return invalidResponse()
  return [action]
}

function parseInstance(value: unknown, expected: {instanceId?: string; definitionKey?: string; businessKey?: string; correlationId?: string}): AutomationInstanceDTO {
  if (!closed(value, ['instanceId', 'definitionKey', 'releaseVersion', 'activationRevision', 'profile', 'businessKey', 'correlationId',
    'state', 'version', 'configurationSha256', 'submittedAt', 'finishedAt', 'output', 'availableActions', 'graph'])
      || !opaque(value.instanceId, 255) || !logicalId(value.definitionKey) || !isProcessReleaseVersion(value.releaseVersion)
      || !integer(value.activationRevision, 1, maxInteger) || value.profile !== 'AUTOMATION_V2' || !opaque(value.businessKey, 255)
      || !logicalId(value.correlationId) || !oneOf(value.state, instanceStates) || !opaque(value.version, 128)
      || !sha256(value.configurationSha256) || !isProcessCorrelationUtc(value.submittedAt)
      || value.finishedAt !== null && !isProcessCorrelationUtc(value.finishedAt)
      || expected.instanceId !== undefined && value.instanceId !== expected.instanceId
      || expected.definitionKey !== undefined && value.definitionKey !== expected.definitionKey
      || expected.businessKey !== undefined && value.businessKey !== expected.businessKey
      || expected.correlationId !== undefined && value.correlationId !== expected.correlationId) return invalidResponse()

  const {instanceId, definitionKey, releaseVersion, activationRevision, profile, businessKey, correlationId,
    state, version, configurationSha256, submittedAt, finishedAt} = value
  const open = state === 'ACTIVE' || state === 'SUSPENDED'
  const graph = parseAutomationGraph(value.graph)
  if (graph.definitionKey !== definitionKey || open !== (finishedAt === null)
      || finishedAt !== null && microsecondOrder(finishedAt) < microsecondOrder(submittedAt)
      || value.output !== null && state !== 'COMPLETED') return invalidResponse()
  return {instanceId, definitionKey, releaseVersion, activationRevision, profile, businessKey, correlationId,
    state, version, configurationSha256, submittedAt, finishedAt, graph,
    output: value.output === null ? null : parseTypedDataObject(value.output),
    availableActions: actions(value.availableActions, 'CANCEL', open)}
}

function parseNode(value: unknown): NodeExecutionDTO {
  if (!closed(value, ['nodeId', 'occurrenceId', 'attempt', 'nodeExecutionRef', 'kind', 'state', 'inputSha256', 'outputSchemaSha256',
    'startedAt', 'finishedAt', 'deadlineAt', 'errorCode', 'sideEffectOutcome', 'agentRunId', 'output', 'eventReceiptIds',
    'version', 'availableActions']) || !nodeObservationId(value.nodeId) || !logicalId(value.occurrenceId) || !integer(value.attempt, 1, 10)
      || !logicalId(value.nodeExecutionRef) || !oneOf(value.kind, nodeKinds) || !oneOf(value.state, nodeStates)
      || !sha256(value.inputSha256) || !sha256(value.outputSchemaSha256) || !isProcessCorrelationUtc(value.startedAt)
      || value.finishedAt !== null && !isProcessCorrelationUtc(value.finishedAt) || !isProcessCorrelationUtc(value.deadlineAt)
      || value.errorCode !== null && !matches(value.errorCode, /^[A-Z][A-Z0-9_]{0,127}(?![\s\S])/)
      || !oneOf(value.sideEffectOutcome, effectOutcomes) || value.agentRunId !== null && !opaque(value.agentRunId, 64)
      || !opaque(value.version, 128)) return invalidResponse()

  const {occurrenceId, attempt, nodeExecutionRef, kind, state, inputSha256, outputSchemaSha256,
    startedAt, finishedAt, deadlineAt, errorCode, sideEffectOutcome, agentRunId, version} = value
  const terminal = oneOf(state, terminalNodeStates)
  if (agentRunId !== null && kind !== 'AGENT' || terminal && finishedAt === null
      || microsecondOrder(deadlineAt) <= microsecondOrder(startedAt)
      || finishedAt !== null && (!(terminal || state === 'WAIT_RECOVERY') || microsecondOrder(finishedAt) < microsecondOrder(startedAt))
      || value.output !== null && !terminal && state !== 'RESULT_ACCEPTED') return invalidResponse()
  const eventReceiptIds = list(value.eventReceiptIds, Infinity, invalidResponse)
    .map(id => logicalId(id) ? id : invalidResponse())
  return {nodeId: value.nodeId, occurrenceId, attempt, nodeExecutionRef, kind, state, inputSha256, outputSchemaSha256,
    startedAt, finishedAt, deadlineAt, errorCode, sideEffectOutcome, agentRunId, version, eventReceiptIds,
    output: value.output === null ? null : parseTypedDataObject(value.output),
    availableActions: actions(value.availableActions, 'RETRY', state === 'WAIT_RECOVERY')}
}

function parseNodePage(value: unknown, instanceId: string, query: {nodeId?: string; limit: number}): NodeExecutionPageDTO {
  if (!closed(value, ['instanceId', 'releaseVersion', 'observedAt', 'items', 'nextCursor']) || value.instanceId !== instanceId
      || !isProcessReleaseVersion(value.releaseVersion) || !isProcessCorrelationUtc(value.observedAt)
      || value.nextCursor !== null && !nodeCursor(value.nextCursor)) return invalidResponse()
  const items = list(value.items, query.limit, invalidResponse).map(parseNode)
  if (query.nodeId !== undefined && items.some(item => item.nodeId !== query.nodeId)) return invalidResponse()
  return {instanceId, releaseVersion: value.releaseVersion, observedAt: value.observedAt, items, nextCursor: value.nextCursor}
}

function nodeSearch(query: NodeExecutionQuery) {
  if (!closed(query, [], ['nodeId', 'cursor', 'limit'])
      || query.nodeId !== undefined && !nodeObservationId(query.nodeId)
      || query.cursor !== undefined && !nodeCursor(query.cursor)
      || query.limit !== undefined && !integer(query.limit, 1, 100)) return invalidRequest()
  const {nodeId, cursor, limit} = query
  const params = new URLSearchParams()
  if (nodeId !== undefined) params.set('nodeId', nodeId)
  if (cursor !== undefined) params.set('cursor', cursor)
  if (limit !== undefined) params.set('limit', String(limit))
  return {search: params.size > 0 ? '?' + params : '', nodeId, limit: limit ?? 20}
}

function retryBody(value: NodeRetryCommand): string {
  if (!closed(value, ['commandId', 'nodeExecutionRef', 'expectedVersion', 'reason'], ['businessReceiptRef'])
      || !logicalId(value.commandId) || !logicalId(value.nodeExecutionRef) || !opaque(value.expectedVersion, 128)
      || !opaque(value.reason, 512)
      || value.businessReceiptRef !== undefined && value.businessReceiptRef !== null && !opaque(value.businessReceiptRef, 255)) return invalidRequest()
  const {commandId, nodeExecutionRef, expectedVersion, reason, businessReceiptRef} = value
  return JSON.stringify({commandId, nodeExecutionRef, expectedVersion, reason, businessReceiptRef})
}

function parseScheduled(value: unknown, instanceId: string, commandId: string): NodeRetryResultDTO {
  if (!closed(value, ['commandId', 'instanceId', 'occurrenceId', 'attempt', 'nodeExecutionRef', 'state'])
      || value.commandId !== commandId || value.instanceId !== instanceId || !logicalId(value.occurrenceId)
      || !integer(value.attempt, 1, 10) || !logicalId(value.nodeExecutionRef) || value.state !== 'SCHEDULED') return invalidResponse()
  return {commandId, instanceId, occurrenceId: value.occurrenceId, attempt: value.attempt,
    nodeExecutionRef: value.nodeExecutionRef, state: value.state}
}

function cancellationBody(value: CancelProcessCommand, instanceId: string): string {
  if (!closed(value, ['instanceId', 'commandId', 'expectedVersion', 'reason']) || value.instanceId !== instanceId
      || !isProcessCorrelationId(value.commandId) || !sha256(value.expectedVersion) || !v1Text(value.reason, 512)) return invalidRequest()
  return JSON.stringify({instanceId, commandId: value.commandId, expectedVersion: value.expectedVersion, reason: value.reason})
}

function v1Instant(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(.{19})(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))(?![\s\S])/.exec(value)
  if (!match || !isProcessCorrelationUtc(match[1] + 'Z')) return false
  if (match[2] === 'Z') return true
  const hours = Number(match[4]), minutes = Number(match[5])
  return minutes < 60 && (hours < 18 || hours === 18 && minutes === 0)
}

function v1Definition(value: unknown): value is string {
  return matches(value, /^[A-Za-z_][A-Za-z0-9_.-]{0,127}(?![\s\S])/)
}

function parseControlProcess(value: unknown, instanceId: string): ProcessInstanceSnapshot {
  if (!closed(value, ['instanceId', 'definitionKey', 'releaseVersion', 'businessKey', 'correlationId', 'status', 'submittedAt', 'finishedAt'])
      || value.instanceId !== instanceId || !v1Definition(value.definitionKey) || !isProcessReleaseVersion(value.releaseVersion)
      || !v1Text(value.businessKey, 255) || !isProcessCorrelationId(value.correlationId) || !oneOf(value.status, controlStates)
      || !v1Instant(value.submittedAt) || value.finishedAt !== null && !v1Instant(value.finishedAt)
      || oneOf(value.status, cancelStates) !== (value.finishedAt !== null)) return invalidResponse()
  const {definitionKey, releaseVersion, businessKey, correlationId, status, submittedAt, finishedAt} = value
  return {instanceId, definitionKey, releaseVersion, businessKey, correlationId, status, submittedAt, finishedAt}
}

function parseControl(value: unknown, instanceId: string): ProcessControlSnapshotDTO {
  if (!closed(value, ['process', 'activeWaits', 'allowedActions', 'cancellationBlockReason', 'version', 'observedAt'])
      || !oneOf(value.cancellationBlockReason, controlBlockReasons) || !sha256(value.version)
      || !v1Instant(value.observedAt)) return invalidResponse()
  const process = parseControlProcess(value.process, instanceId)
  const {cancellationBlockReason, version, observedAt} = value
  const terminal = oneOf(process.status, cancelStates)
  if (terminal !== (cancellationBlockReason === 'PROCESS_TERMINAL')) return invalidResponse()
  const cancellable = cancellationBlockReason === 'NONE'
  const allowedActions = actions(value.allowedActions, 'CANCEL', cancellable)
  if (cancellable && allowedActions.length !== 1) return invalidResponse()

  let previous = ''
  let occurrences = 0
  const activeWaits = list(value.activeWaits, terminal ? 0 : 256, invalidResponse).map(wait => {
    if (!closed(wait, ['activityKey', 'kind', 'occurrences']) || !v1Definition(wait.activityKey)
        || !oneOf(wait.kind, waitKinds) || !integer(wait.occurrences, 1, 256)) return invalidResponse()
    const orderKey = wait.kind + ':' + wait.activityKey
    occurrences += wait.occurrences
    if (orderKey <= previous || occurrences > 256) return invalidResponse()
    previous = orderKey
    return {activityKey: wait.activityKey, kind: wait.kind, occurrences: wait.occurrences}
  })
  return {process, activeWaits, allowedActions, cancellationBlockReason, version, observedAt}
}

function parseCancellation(value: unknown, instanceId: string, commandId: string): CancelProcessResult {
  if (!closed(value, ['instanceId', 'commandId', 'accepted', 'status', 'resultingVersion', 'finishedAt', 'decidedAt',
    'linkedAgentClosureScheduled']) || value.instanceId !== instanceId || value.commandId !== commandId
      || typeof value.accepted !== 'boolean' || !oneOf(value.status, cancelStates) || !sha256(value.resultingVersion)
      || !v1Instant(value.finishedAt) || !v1Instant(value.decidedAt) || typeof value.linkedAgentClosureScheduled !== 'boolean'
      || (value.accepted ? value.status !== 'CANCELLED' : value.linkedAgentClosureScheduled)) return invalidResponse()
  return {instanceId, commandId, accepted: value.accepted, status: value.status, resultingVersion: value.resultingVersion,
    finishedAt: value.finishedAt, decidedAt: value.decidedAt, linkedAgentClosureScheduled: value.linkedAgentClosureScheduled}
}

export const processAutomationApi = {
  startRequestSha256,
  async start(tenant: string, command: AutomationStartCommand, signal?: AbortSignal): Promise<AutomationInstanceDTO> {
    const wire = startWire(command)
    const value = await requestJson<unknown>(v2Instances, tenant, {method: 'POST', cache: 'no-store', body: wire.body, signal}, 200)
    return parseInstance(value, wire)
  },
  async get(tenant: string, instanceId: string, signal?: AbortSignal): Promise<AutomationInstanceDTO> {
    const path = v2Instances + '/' + encodeInstanceId(instanceId)
    const value = await requestJson<unknown>(path, tenant, {method: 'GET', cache: 'no-store', signal}, 200)
    return parseInstance(value, {instanceId})
  },
  async listNodeExecutions(tenant: string, instanceId: string, query: NodeExecutionQuery = {}, signal?: AbortSignal): Promise<NodeExecutionPageDTO> {
    const checked = nodeSearch(query)
    const path = v2Instances + '/' + encodeInstanceId(instanceId) + '/node-executions' + checked.search
    const value = await requestJson<unknown>(path, tenant, {method: 'GET', cache: 'no-store', signal}, 200)
    return parseNodePage(value, instanceId, checked)
  },
  async retryNode(tenant: string, instanceId: string, command: NodeRetryCommand, signal?: AbortSignal): Promise<NodeRetryResultDTO> {
    const path = v2Instances + '/' + encodeInstanceId(instanceId) + '/node-retries'
    const body = retryBody(command), {commandId} = command
    const value = await requestJson<unknown>(path, tenant, {method: 'POST', cache: 'no-store', body, signal}, 202)
    return parseScheduled(value, instanceId, commandId)
  },
  async getControl(tenant: string, instanceId: string, signal?: AbortSignal): Promise<ProcessControlSnapshotDTO> {
    const path = v1Instances + '/' + encodeInstanceId(instanceId, true) + '/control'
    const value = await requestJson<unknown>(path, tenant, {method: 'GET', cache: 'no-store', signal}, 200)
    return parseControl(value, instanceId)
  },
  async cancel(tenant: string, instanceId: string, command: CancelProcessCommand, signal?: AbortSignal): Promise<CancelProcessResult> {
    const path = v1Instances + '/' + encodeInstanceId(instanceId, true) + '/cancellations'
    const body = cancellationBody(command, instanceId), {commandId} = command
    const value = await requestJson<unknown>(path, tenant, {method: 'POST', cache: 'no-store', body, signal}, 200)
    return parseCancellation(value, instanceId, commandId)
  },
}
