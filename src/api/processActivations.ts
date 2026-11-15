import {requestJson} from './client'
import {
  parseAutomationGraph, parseTypedDataObject, parseTypedJsonValue, type GraphVO, type TypedJsonValue,
} from './processAutomation'
import {isProcessCorrelationId, isProcessCorrelationUtc} from './processCorrelations'
import {isProcessReleaseVersion} from './processReleases'

export type ObjectProcessSchemaVO = Readonly<{
  type: 'object'
  properties: Readonly<Record<string, ProcessSchemaVO>>
  required: readonly string[]
  additionalProperties: false
}>

export type ProcessSchemaVO = ObjectProcessSchemaVO | Readonly<
  | {type: 'array'; items: ProcessSchemaVO; maxItems: number}
  | {type: 'string'; enum?: readonly string[]; maxLength?: number; pattern?: string; format?: string}
  | {type: 'integer'; minimum?: number; maximum?: number}
  | {type: 'boolean'}
  | {type: 'null'}
>

type ManifestDigests = Readonly<{
  sourceManifestSha256: string
  compiledManifestSha256: string
  dependencyManifestSha256: string
}>

export type AutomationReleaseDTO = ManifestDigests & Readonly<{
  releaseVersion: string
  compilerVersion: string
  artifact: ReturnType<typeof parseArtifact>
  graph: GraphVO
  sourceDraftId: string
  sourceDraftRevision: number
}>

export type ActivationCommand = Readonly<{
  releaseVersion: string
  expectedActivationRevision: number
  commandId: string
}>

export type CurrentActivationVO = Readonly<{revision: number; releaseVersion: string; activatedAt: string}>
export type AutomationActivationDTO = ActivationCommand & ManifestDigests & CurrentActivationVO & Readonly<{
  definitionKey: string
  previousRevision: number | null
}>
export type ActivationPageDTO = Readonly<{
  definitionKey: string
  observedAt: string
  current: CurrentActivationVO | null
  items: readonly AutomationActivationDTO[]
  nextCursor: string | null
}>
export type ActivationHistoryQuery = Readonly<
  | {limit?: number; cursor?: string; commandId?: never}
  | {limit?: number; commandId: string; cursor?: never}
>

const MAX_INTEGER = 999_999_999_999_999
const DEFINITION_KEY = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}(?![\s\S])/
const LOGICAL_ID = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}(?![\s\S])/
const SHA256 = /^[a-f0-9]{64}(?![\s\S])/
const CURSOR = /^[A-Za-z0-9_-]{1,2048}(?![\s\S])/
const FIELD_PATH = /^[A-Za-z_][A-Za-z0-9_]*(?:\[(?:0|[1-9][0-9]{0,2})\])*(?:\.[A-Za-z_][A-Za-z0-9_]*(?:\[(?:0|[1-9][0-9]{0,2})\])*)*(?![\s\S])/
const DURATION = /^P(?=\d|T)(?:\d+D)?(?:T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d{1,9})?S)?)?(?![\s\S])/
const MANIFEST_FIELDS = ['sourceManifestSha256', 'compiledManifestSha256', 'dependencyManifestSha256']
const COMMAND_FIELDS = ['releaseVersion', 'expectedActivationRevision', 'commandId']
const POINTER_FIELDS = ['revision', 'releaseVersion', 'activatedAt']
const ACTIVATION_FIELDS = ['definitionKey', 'previousRevision', 'commandId', 'expectedActivationRevision',
  ...POINTER_FIELDS, ...MANIFEST_FIELDS]

const utf8 = new TextEncoder()
function invalid(): never {
  throw new Error('流程发布或生效数据无效')
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const prototype: unknown = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return invalid()
  return value as Record<string, unknown>
}

function closed(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  const result = record(value)
  if (!required.every(key => Object.hasOwn(result, key))
      || !Object.keys(result).every(key => required.includes(key) || optional.includes(key))) return invalid()
  return result
}

function text(value: unknown): string {
  if (typeof value !== 'string' || (value.includes('\u0000') || /\p{Surrogate}/u.test(value))) return invalid()
  return value
}

function matches(value: unknown, pattern: RegExp): string {
  if (typeof value !== 'string' || !pattern.test(value)) return invalid()
  return value
}

function integer(value: unknown, minimum = 1, maximum = MAX_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) return invalid()
  return value
}

function utc(value: unknown): string {
  if (!isProcessCorrelationUtc(value)) return invalid()
  return value
}

function releaseId(value: unknown): string {
  if (!isProcessReleaseVersion(value)) return invalid()
  return value
}

function commandId(value: unknown): string {
  if (!isProcessCorrelationId(value)) return invalid()
  return value
}

function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  const selected = choices.find(candidate => candidate === value)
  if (selected === undefined) return invalid()
  return selected
}

function list<T>(value: unknown, parse: (item: unknown) => T, max?: number, min = 0): T[] {
  if (!Array.isArray(value) || value.length < min || (max !== undefined && value.length > max)) return invalid()
  return Array.from(value, parse)
}

function distinct<T>(items: T[], key: (item: T) => string): T[] {
  if (new Set(items.map(key)).size !== items.length) return invalid()
  return items
}

function optional<T>(object: Record<string, unknown>, key: string, parse: (value: unknown) => T): T | undefined {
  return Object.hasOwn(object, key) ? parse(object[key]) : undefined
}

// Read only the portable tokens from the release contract. Never execute a supplied expression.
function portablePattern(value: unknown): string {
  const pattern = matches(value, /^[ -~]{0,128}(?![\s\S])/)
  const escapes = '\\.^$|?*+()[]{}-/'
  let position = pattern.startsWith('^') ? 1 : 0
  let width = 0

  const literal = (forbidden: string): string => {
    const character = pattern[position++]
    if (character === undefined || forbidden.includes(character)) return invalid()
    if (character !== '\\') return character
    const escaped = pattern[position++]
    if (escaped === undefined || !escapes.includes(escaped)) return invalid()
    return escaped
  }

  while (position < pattern.length && pattern[position] !== '$') {
    if (pattern[position] === '[') {
      position++
      const start = position
      while (position < pattern.length && pattern[position] !== ']') {
        const first = literal('[]^')
        if (pattern[position] === '-' && position + 1 < pattern.length && pattern[position + 1] !== ']') {
          position++
          if (first > literal('[]^')) return invalid()
        }
      }
      if (position === start || pattern[position++] !== ']') return invalid()
    } else {
      literal('.^$|?*+()[]{}')
    }

    let maximum = 1
    if (pattern[position] === '?') position++
    else if (pattern[position] === '{') {
      const quantifier = /^\{(0|[1-9]\d{0,2})(?:,(0|[1-9]\d{0,2}))?\}/.exec(pattern.slice(position))
      if (!quantifier) return invalid()
      const [matched, min, max = min] = quantifier
      maximum = Number(max)
      if (Number(min) > maximum) return invalid()
      position += matched.length
    }
    width += maximum
    if (width > 128) return invalid()
  }
  if (position < pattern.length - 1) return invalid()
  return pattern
}

function parseSchema(value: unknown, depth = 0): ProcessSchemaVO {
  if (depth > 8) return invalid()
  const {type} = record(value)
  switch (type) {
    case 'object': {
      const schema = closed(value, ['type', 'properties', 'required', 'additionalProperties'])
      if (schema.additionalProperties !== false) return invalid()
      const properties = Object.fromEntries(Object.entries(record(schema.properties))
        .map(([key, child]) => [text(key), parseSchema(child, depth + 1)]))
      const required = distinct(list(schema.required, text), key => key)
      if (!required.every(key => Object.hasOwn(properties, key))) return invalid()
      return {type, properties, required, additionalProperties: false}
    }
    case 'array': {
      const schema = closed(value, ['type', 'items', 'maxItems'])
      return {type, items: parseSchema(schema.items, depth + 1), maxItems: integer(schema.maxItems, 0, 256)}
    }
    case 'string': {
      const schema = closed(value, ['type'], ['enum', 'maxLength', 'pattern', 'format'])
      const enumeration = optional(schema, 'enum', input => distinct(list(input, text, undefined, 1), item => item))
      const maxLength = optional(schema, 'maxLength', input => integer(input, 0, 2_147_483_647))
      const pattern = optional(schema, 'pattern', portablePattern)
      const format = optional(schema, 'format',
        input => matches(input, /^(?:date|date-time|decimal:(?:[0-9]|1[0-8]))(?![\s\S])/))
      return {type, ...(enumeration === undefined ? {} : {enum: enumeration}), ...(maxLength === undefined ? {} : {maxLength}),
        ...(pattern === undefined ? {} : {pattern}), ...(format === undefined ? {} : {format})}
    }
    case 'integer': {
      const schema = closed(value, ['type'], ['minimum', 'maximum'])
      const minimum = optional(schema, 'minimum', input => integer(input, -MAX_INTEGER))
      const maximum = optional(schema, 'maximum', input => integer(input, -MAX_INTEGER))
      if (minimum !== undefined && maximum !== undefined && minimum > maximum) return invalid()
      return {type, ...(minimum === undefined ? {} : {minimum}), ...(maximum === undefined ? {} : {maximum})}
    }
    case 'boolean':
    case 'null':
      closed(value, ['type'])
      return {type}
    default:
      return invalid()
  }
}

function schema(value: unknown): ProcessSchemaVO {
  const result = parseSchema(value)
  if (utf8.encode(JSON.stringify(result)).length > 32 * 1024) return invalid()
  return result
}

function objectSchema(value: unknown): ObjectProcessSchemaVO {
  const result = schema(value)
  if (result.type !== 'object') return invalid()
  return result
}

function logicalId(value: unknown): string {
  return matches(value, LOGICAL_ID)
}

function fieldPath(value: unknown): string {
  const path = matches(value, FIELD_PATH)
  if (path.length > 256 || (path.match(/[.[]/g)?.length ?? 0) >= 8) return invalid()
  return path
}

function sourcePath(value: unknown): string {
  const path = text(value)
  if (path.length > 256 || (path.match(/[.[]/g)?.length ?? 0) >= 8) return invalid()
  if (/^(?:input|scope|event)\./.test(path)) {
    fieldPath(path.slice(path.indexOf('.') + 1))
    return path
  }
  const reference = /^nodes\.([A-Za-z][A-Za-z0-9_.:-]{0,127})\.output\.(.+)(?![\s\S])/.exec(path)
  if (!reference) return invalid()
  fieldPath(reference[2])
  return path
}

function mappings(value: unknown) {
  return distinct(list(value, item => {
    const mapping = closed(item, ['target', 'source'])
    return {target: fieldPath(mapping.target), source: sourcePath(mapping.source)}
  }), item => item.target)
}

function duration(value: unknown): string {
  const result = matches(value, DURATION)
  if (result.length > 128) return invalid()
  return result
}

function policyAction(value: unknown) {
  const item = closed(value, ['action'], ['branchTarget'])
  const action = choice(item.action, ['BRANCH', 'END', 'WAIT_RECOVERY', 'RETRY'] as const)
  if (action === 'BRANCH') return {action, branchTarget: logicalId(item.branchTarget)}
  if (Object.hasOwn(item, 'branchTarget')) {
    if (item.branchTarget !== null) return invalid()
    return {action, branchTarget: null}
  }
  return {action}
}

function nodePolicy(value: unknown) {
  const policy = closed(value, ['nodeTimeout', 'attemptTimeout', 'dispatchTimeout', 'onFailure', 'onAttemptTimeout',
    'onNodeTimeout', 'retry', 'cancel', 'onUnknownEffect'])
  const retry = closed(policy.retry, ['maxAttempts', 'backoff', 'retryableCodes'])
  const onNodeTimeout = policyAction(policy.onNodeTimeout)
  if (onNodeTimeout.action !== 'BRANCH' && onNodeTimeout.action !== 'END') return invalid()
  return {
    nodeTimeout: duration(policy.nodeTimeout),
    attemptTimeout: duration(policy.attemptTimeout),
    dispatchTimeout: duration(policy.dispatchTimeout),
    onFailure: policyAction(policy.onFailure),
    onAttemptTimeout: policyAction(policy.onAttemptTimeout),
    onNodeTimeout,
    retry: {
      maxAttempts: integer(retry.maxAttempts, 1, 10),
      backoff: duration(retry.backoff),
      retryableCodes: distinct(list(retry.retryableCodes, item => matches(item, /^[A-Z][A-Z0-9_]{0,127}(?![\s\S])/), 16),
        item => item),
    },
    cancel: choice(policy.cancel, ['BEST_EFFORT_STOP'] as const),
    onUnknownEffect: choice(policy.onUnknownEffect, ['WAIT_RECOVERY'] as const),
  }
}

type Condition = Readonly<{op: string; args: readonly Condition[]} | {path: string} | {literal: TypedJsonValue}>

function condition(value: unknown, depth = 0, count = {remaining: 64}): Condition {
  if (depth > 8 || --count.remaining < 0) return invalid()
  const item = record(value)
  if (Object.hasOwn(item, 'path')) return {path: fieldPath(closed(item, ['path']).path)}
  if (Object.hasOwn(item, 'literal')) return {literal: parseTypedJsonValue(closed(item, ['literal']).literal)}
  const operation = closed(item, ['op', 'args'])
  const op = choice(operation.op, ['EQ', 'NE', 'GT', 'GE', 'LT', 'LE', 'AND', 'OR', 'NOT'] as const)
  const minimum = op === 'NOT' ? 1 : 2
  const maximum = op === 'AND' || op === 'OR' ? 63 : minimum
  return {op, args: list(operation.args, child => condition(child, depth + 1, count), maximum, minimum)}
}

function template(value: unknown) {
  const ref = closed(value, ['key', 'version', 'contentSha256'])
  return {key: logicalId(ref.key), version: integer(ref.version), contentSha256: matches(ref.contentSha256, SHA256)}
}

function modelIdentity(ref: Record<string, unknown>) {
  return {definitionKey: logicalId(ref.definitionKey), modelSha256: matches(ref.modelSha256, SHA256)}
}

function decisionRef(value: unknown) {
  const item = closed(value, ['definitionKey', 'modelSha256', 'inputMapping', 'outputMapping'])
  return {...modelIdentity(item), inputMapping: mappings(item.inputMapping), outputMapping: mappings(item.outputMapping)}
}

function capability(value: unknown) {
  const ref = closed(value, ['capabilityKey', 'version', 'inputSchemaSha256', 'outputSchemaSha256', 'effectMode'])
  return {
    capabilityKey: matches(ref.capabilityKey, DEFINITION_KEY),
    version: integer(ref.version),
    inputSchemaSha256: matches(ref.inputSchemaSha256, SHA256),
    outputSchemaSha256: matches(ref.outputSchemaSha256, SHA256),
    effectMode: choice(ref.effectMode, ['READ_ONLY', 'TRANSACTIONAL_RECEIPT', 'EXTERNAL_IDEMPOTENT'] as const),
  }
}

function agentBinding(value: unknown) {
  const item = closed(value, ['defaultTemplate', 'allowedTemplates', 'parameterSchema', 'parameterDefaults',
    'overridableParameters'], ['configurationRef'])
  const defaultTemplate = template(item.defaultTemplate)
  const allowedTemplates = distinct(list(item.allowedTemplates, template, 16, 1), ref => ref.key + '/' + ref.version)
  if (!allowedTemplates.some(ref => ref.key === defaultTemplate.key && ref.version === defaultTemplate.version
      && ref.contentSha256 === defaultTemplate.contentSha256)) return invalid()
  const parameterSchema = objectSchema(item.parameterSchema)
  const parameterDefaults = parseTypedDataObject(item.parameterDefaults)
  const overridableParameters = distinct(list(item.overridableParameters, text, 16), name => name)
  if (![...Object.keys(parameterDefaults), ...overridableParameters].every(key => Object.hasOwn(parameterSchema.properties, key))) {
    return invalid()
  }
  const configurationRef = optional(item, 'configurationRef', template)
  return {defaultTemplate, allowedTemplates, parameterSchema, parameterDefaults, overridableParameters,
    ...(configurationRef === undefined ? {} : {configurationRef})}
}

function humanBinding(value: unknown) {
  const item = closed(value, ['candidateBindingRef', 'resultSchema', 'dueAfter'])
  const resultSchema = objectSchema(item.resultSchema)
  if (Object.values(resultSchema.properties).some(child => child.type !== 'string'
      && child.type !== 'integer' && child.type !== 'boolean')) return invalid()
  return {candidateBindingRef: logicalId(item.candidateBindingRef), resultSchema, dueAfter: duration(item.dueAfter)}
}

function loopControl(value: unknown) {
  const item = closed(value, ['maxIterations', 'condition', 'carrySchema', 'initialCarry', 'carryMapping'])
  return {
    maxIterations: integer(item.maxIterations, 1, 1000),
    condition: condition(item.condition),
    carrySchema: objectSchema(item.carrySchema),
    initialCarry: parseTypedDataObject(item.initialCarry),
    carryMapping: mappings(item.carryMapping),
  }
}

function multiInstanceControl(value: unknown) {
  const item = closed(value, ['itemsSource', 'sequential', 'maxItems'], ['completionCondition'])
  if (typeof item.sequential !== 'boolean') return invalid()
  const completionCondition = optional(item, 'completionCondition', condition)
  return {
    itemsSource: sourcePath(item.itemsSource), sequential: item.sequential, maxItems: integer(item.maxItems, 1, 256),
    ...(completionCondition === undefined ? {} : {completionCondition}),
  }
}

function merges(value: unknown) {
  return distinct(list(value, entry => {
    const item = closed(entry, ['target', 'sourceNodeIds', 'reducer'])
    return {
      target: fieldPath(item.target),
      sourceNodeIds: distinct(list(item.sourceNodeIds, logicalId, 128, 1), id => id),
      reducer: choice(item.reducer, ['EXCLUSIVE', 'COLLECT_INDEXED', 'ALL', 'ANY', 'SUM'] as const),
    }
  }), item => item.target)
}

function parseBinding(value: unknown) {
  const fields = ['nodeId', 'kind', 'inputSchema', 'outputSchema', 'inputMapping', 'outputMapping', 'policy']
  const item = record(value)
  const base = {
    nodeId: logicalId(item.nodeId), inputSchema: schema(item.inputSchema), outputSchema: schema(item.outputSchema),
    inputMapping: mappings(item.inputMapping), outputMapping: mappings(item.outputMapping), policy: nodePolicy(item.policy),
  }
  const kind = item.kind
  switch (kind) {
    case 'AGENT':
      closed(item, [...fields, 'agent'])
      return {...base, kind, agent: agentBinding(item.agent)}
    case 'HUMAN':
      closed(item, [...fields, 'human'])
      return {...base, kind, human: humanBinding(item.human)}
    case 'SERVICE':
      closed(item, [...fields, 'service'])
      return {...base, kind, service: capability(item.service)}
    case 'RULE':
      if (Object.hasOwn(item, 'rule')) {
        closed(item, [...fields, 'rule'])
        return {...base, kind, rule: decisionRef(item.rule)}
      }
      closed(item, [...fields, 'service'])
      return {...base, kind, service: capability(item.service)}
    case 'SUBPROCESS':
      closed(item, [...fields, 'control'])
      return {...base, kind, control: modelIdentity(closed(item.control, ['definitionKey', 'modelSha256']))}
    case 'LOOP':
      closed(item, [...fields, 'control'])
      return {...base, kind, control: loopControl(item.control)}
    case 'MULTI_INSTANCE':
      closed(item, [...fields, 'control', 'merge'])
      return {...base, kind, control: multiInstanceControl(item.control), merge: merges(item.merge)}
    case 'AND_JOIN':
      closed(item, [...fields, 'merge'])
      return {...base, kind, merge: merges(item.merge)}
    case 'TIMER':
    case 'EVENT_WAIT':
      closed(item, fields)
      return {...base, kind}
    default:
      return invalid()
  }
}

function parseSchedule(value: unknown) {
  const item = closed(value, ['startAt', 'interval'], ['endAt', 'maxOccurrences'])
  const endAt = optional(item, 'endAt', utc)
  const maxOccurrences = optional(item, 'maxOccurrences', entry => integer(entry, 1, 10_000))
  if (endAt === undefined && maxOccurrences === undefined) return invalid()
  return {startAt: utc(item.startAt), interval: duration(item.interval),
    ...(endAt === undefined ? {} : {endAt}), ...(maxOccurrences === undefined ? {} : {maxOccurrences})}
}

function parseRoute(value: unknown) {
  const fields = ['routeKey', 'version', 'type', 'mode', 'sourceRef', 'payloadSchema', 'mapping', 'ttl']
  const item = record(value)
  const base = {
    routeKey: logicalId(item.routeKey), version: integer(item.version), sourceRef: logicalId(item.sourceRef),
    type: matches(item.type, /^[A-Za-z_][A-Za-z0-9_.:-]{0,127}(?![\s\S])/),
    payloadSchema: objectSchema(item.payloadSchema), mapping: mappings(item.mapping), ttl: duration(item.ttl),
  }
  if (!base.mapping.every(mapping => mapping.source.startsWith('event.'))) return invalid()
  const mode = item.mode
  if (mode === 'START') {
    closed(item, [...fields, 'targetDefinitionKey'], ['schedule'])
    const schedule = optional(item, 'schedule', parseSchedule)
    return {...base, mode, targetDefinitionKey: logicalId(item.targetDefinitionKey),
      ...(schedule === undefined ? {} : {schedule})}
  }
  if (mode !== 'SIGNAL') return invalid()
  closed(item, [...fields, 'targetNodeId'])
  return {...base, mode, targetNodeId: logicalId(item.targetNodeId)}
}

function parseArtifact(value: unknown) {
  const item = closed(value, ['profile', 'models', 'inputSchema', 'outputSchema', 'nodeBindings', 'eventRoutes'])
  const models = distinct(list(item.models, entry => {
    const model = closed(entry, ['type', 'definitionKey', 'xml'])
    const xml = text(model.xml)
    if (!xml.trim()) return invalid()
    return {type: choice(model.type, ['BPMN', 'DMN'] as const), definitionKey: logicalId(model.definitionKey), xml}
  }, 64, 1), model => model.definitionKey)
  if (models[0]?.type !== 'BPMN' || models.reduce((size, model) => size + utf8.encode(model.xml).length, 0) > 4 * 1024 ** 2) {
    return invalid()
  }
  return {
    profile: choice(item.profile, ['AUTOMATION_V2'] as const), models,
    inputSchema: objectSchema(item.inputSchema), outputSchema: objectSchema(item.outputSchema),
    nodeBindings: distinct(list(item.nodeBindings, parseBinding, 128), binding => binding.nodeId),
    eventRoutes: distinct(list(item.eventRoutes, parseRoute, 32), route => route.routeKey + '/' + route.version),
  }
}

function manifests(value: Record<string, unknown>): ManifestDigests {
  return {
    sourceManifestSha256: matches(value.sourceManifestSha256, SHA256),
    compiledManifestSha256: matches(value.compiledManifestSha256, SHA256),
    dependencyManifestSha256: matches(value.dependencyManifestSha256, SHA256),
  }
}

function parseRelease(value: unknown, requestedRelease: string): AutomationReleaseDTO {
  const item = closed(value, ['releaseVersion', 'compilerVersion', 'artifact', 'graph', 'sourceDraftId',
    'sourceDraftRevision', ...MANIFEST_FIELDS])
  const compilerVersion = text(item.compilerVersion)
  if (item.releaseVersion !== requestedRelease || compilerVersion.length > 128 || !compilerVersion.trim()
      || /\p{Cc}/u.test(compilerVersion)) return invalid()
  const artifact = parseArtifact(item.artifact)
  const graph = parseAutomationGraph(item.graph)
  if (artifact.models[0]?.definitionKey !== graph.definitionKey) return invalid()
  return {...manifests(item), releaseVersion: requestedRelease, compilerVersion, artifact, graph,
    sourceDraftId: logicalId(item.sourceDraftId), sourceDraftRevision: integer(item.sourceDraftRevision)}
}

function commandBody(value: unknown): ActivationCommand {
  const item = closed(value, COMMAND_FIELDS)
  return {releaseVersion: releaseId(item.releaseVersion), expectedActivationRevision: integer(item.expectedActivationRevision, 0),
    commandId: commandId(item.commandId)}
}

function pointer(item: Record<string, unknown>): CurrentActivationVO {
  return {releaseVersion: releaseId(item.releaseVersion), revision: integer(item.revision), activatedAt: utc(item.activatedAt)}
}

function parseReceipt(value: unknown, definitionKey: string): AutomationActivationDTO {
  const item = closed(value, ACTIVATION_FIELDS)
  if (item.definitionKey !== definitionKey) return invalid()
  const current = pointer(item)
  const expectedActivationRevision = integer(item.expectedActivationRevision, 0)
  const previousRevision = item.previousRevision === null ? null : integer(item.previousRevision)
  if (current.revision !== expectedActivationRevision + 1
      || previousRevision !== (expectedActivationRevision === 0 ? null : expectedActivationRevision)) return invalid()
  return {...current, ...manifests(item), definitionKey, previousRevision,
    expectedActivationRevision, commandId: commandId(item.commandId)}
}

function historyQuery(value: unknown) {
  const query = closed(value, [], ['commandId', 'cursor', 'limit'])
  const id = optional(query, 'commandId', commandId)
  const cursor = optional(query, 'cursor', entry => matches(entry, CURSOR))
  const limit = optional(query, 'limit', entry => integer(entry, 1, 100))
  if (id !== undefined && cursor !== undefined) return invalid()
  const params = new URLSearchParams()
  if (id !== undefined) params.set('commandId', id)
  if (cursor !== undefined) params.set('cursor', cursor)
  if (limit !== undefined) params.set('limit', String(limit))
  return {id, limit: limit ?? 20, search: params.size === 0 ? '' : '?' + params.toString()}
}

function parsePage(value: unknown, definitionKey: string, query: ReturnType<typeof historyQuery>): ActivationPageDTO {
  const item = closed(value, ['definitionKey', 'observedAt', 'current', 'items', 'nextCursor'])
  if (item.definitionKey !== definitionKey) return invalid()
  const current = item.current === null ? null : pointer(closed(item.current, POINTER_FIELDS))
  const items = list(item.items, entry => parseReceipt(entry, definitionKey), query.id === undefined ? query.limit : 1)
  const nextCursor = item.nextCursor === null ? null : matches(item.nextCursor, CURSOR)
  if (current === null) {
    if (items.length !== 0 || nextCursor !== null) return invalid()
    return {definitionKey, observedAt: utc(item.observedAt), current, items, nextCursor}
  }
  if (query.id !== undefined && (nextCursor !== null || items.some(receipt => receipt.commandId !== query.id))) return invalid()
  let upperRevision = current.revision + 1
  for (const receipt of items) {
    if (receipt.revision >= upperRevision) return invalid()
    upperRevision = receipt.revision
  }
  return {definitionKey, observedAt: utc(item.observedAt), current, items, nextCursor}
}

function definitionPath(definitionKey: string): string {
  return '/api/tianji/v2/process-definitions/' + encodeURIComponent(matches(definitionKey, DEFINITION_KEY)) + '/activations'
}

export const processActivationsApi = {
  async getRelease(tenant: string, releaseVersion: string, signal?: AbortSignal): Promise<AutomationReleaseDTO> {
    const path = '/api/tianji/v2/process-releases/' + encodeURIComponent(releaseId(releaseVersion))
    const value = await requestJson<unknown>(path, tenant, {method: 'GET', cache: 'no-store', signal}, 200)
    return parseRelease(value, releaseVersion)
  },

  async list(tenant: string, definitionKey: string, query: ActivationHistoryQuery, signal?: AbortSignal): Promise<ActivationPageDTO> {
    const checked = historyQuery(query)
    const path = definitionPath(definitionKey) + checked.search
    const value = await requestJson<unknown>(path, tenant, {method: 'GET', cache: 'no-store', signal}, 200)
    return parsePage(value, definitionKey, checked)
  },

  async activate(tenant: string, definitionKey: string, command: ActivationCommand, signal?: AbortSignal): Promise<AutomationActivationDTO> {
    const path = definitionPath(definitionKey)
    const body = commandBody(command)
    const value = await requestJson<unknown>(path, tenant, {
      method: 'POST', cache: 'no-store', signal, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
    }, 200)
    const receipt = parseReceipt(value, definitionKey)
    if (receipt.releaseVersion !== body.releaseVersion || receipt.commandId !== body.commandId
        || receipt.expectedActivationRevision !== body.expectedActivationRevision) return invalid()
    return receipt
  },
}
