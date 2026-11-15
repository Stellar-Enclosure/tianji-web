import {requestJson} from './client'
import {parseAutomationGraph, type GraphVO} from './processAutomation'
import {isProcessCorrelationUtc} from './processCorrelations'
import {isProcessReleaseVersion} from './processReleases'

const STATES = ['EDITING', 'PUBLISHED', 'DISCARDED'] as const
const ACTIONS = ['SAVE', 'VALIDATE', 'PUBLISH', 'DISCARD'] as const
const OPERATIONS = ['CREATE', 'SAVE', 'DISCARD', 'PUBLISH'] as const
const MODEL_TYPES = ['BPMN', 'DMN'] as const

export type DraftState = typeof STATES[number]
export type DraftAction = typeof ACTIONS[number]
export type DraftModelSourceVO = Readonly<{
  type: typeof MODEL_TYPES[number]
  definitionKey: string
  xml: string
}>
export type DraftContentVO = Readonly<{
  models: readonly DraftModelSourceVO[] | null
  inputSchemaSource: string | null
  outputSchemaSource: string | null
  nodeBindingsSource: string | null
  eventRoutesSource: string | null
}>
export type DraftSummaryDTO = Readonly<{
  draftId: string
  definitionKey: string
  title: string
  baseReleaseVersion: string | null
  state: DraftState
  revision: number
  contentSha256: string
  publishedReleaseVersion: string | null
  createdAt: string
  updatedAt: string
  availableActions: readonly DraftAction[]
}>
export type DraftPublicationVO = Readonly<{
  draftId: string
  publishedRevision: number
  draftRevision: number
  releaseVersion: string
  sourceManifestSha256: string
  compiledManifestSha256: string
  dependencyManifestSha256: string
  compilerVersion: string
  publishedAt: string
  commandId: string
}>
export type DraftCommandReceiptDTO = Readonly<{
  commandId: string
  operation: typeof OPERATIONS[number]
  requestSha256: string
  resultRevision: number
  resultContentSha256: string
  releaseVersion: string | null
  completedAt: string
}>
export type ProcessDraftDTO = DraftSummaryDTO & Readonly<{
  baseSourceManifestSha256: string | null
  content: DraftContentVO
  lastCommandId: string
  publication: DraftPublicationVO | null
  commandReceipt: DraftCommandReceiptDTO | null
}>
export type ProcessDraftPageDTO = Readonly<{
  observedAt: string
  items: readonly DraftSummaryDTO[]
  nextCursor: string | null
}>
export type DraftMutationResultDTO = Readonly<{
  draftId: string
  state: 'EDITING' | 'DISCARDED'
  revision: number
  contentSha256: string
  updatedAt: string
  commandId: string
}>
export type DraftValidationIssueVO = Readonly<{path: string; code: string; message: string; nodeId: string | null}>
export type DraftValidationResultDTO = Readonly<{
  draftId: string
  revision: number
  contentSha256: string
  compilerVersion: string
}> & (
  | Readonly<{valid: true; sourceManifestSha256: string; graph: GraphVO; issues: readonly []}>
  | Readonly<{valid: false; sourceManifestSha256: null; graph: null; issues: readonly DraftValidationIssueVO[]}>
)

export type ValidateProcessDraftQuery = Readonly<{draftId: string; expectedRevision: number; expectedContentSha256: string}>
export type PublishProcessDraftCommand = ValidateProcessDraftQuery & Readonly<{releaseVersion: string; commandId: string}>
export type CreateProcessDraftCommand = Readonly<{title: string; baseReleaseVersion?: string | null; commandId: string}>
export type DiscardProcessDraftCommand = Readonly<{commandId: string; expectedRevision: number}>
export type SaveProcessDraftCommand = DiscardProcessDraftCommand & Readonly<{title: string; content: DraftContentVO}>
export type PreparedDraftSave = Readonly<{
  draftId: string
  path: string
  body: SaveProcessDraftCommand
  serializedBody: string
}>
export type ListProcessDraftsQuery = Readonly<{limit?: number}> & (
  | Readonly<{definitionKey?: string; state?: DraftState; cursor?: string; creationCommandId?: never}>
  | Readonly<{creationCommandId: string; definitionKey?: never; state?: never; cursor?: never}>
)

const BASE = '/api/tianji/v2'
const DRAFTS = `${BASE}/process-drafts`
const LOGICAL_ID = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}(?![\s\S])/
const DEFINITION_KEY = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}(?![\s\S])/
const COMMAND_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}(?![\s\S])/
const SHA256 = /^[0-9a-f]{64}(?![\s\S])/
const CURSOR = /^[A-Za-z0-9_-]{1,2048}(?![\s\S])/
const UNPAIRED_SURROGATE = /[\ud800-\udfff]/u
const CONTROL = /\p{Cc}/u
const JAVA_WHITESPACE = /[ \t\n\v\f\r\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]/u
const MAX_REVISION = 999_999_999_999_999
const MAX_CONTENT_BYTES = 4 * 1024 ** 2
const MAX_SAVE_BYTES = 5 * 1024 ** 2
const utf8 = new TextEncoder()

const REVISION_FIELDS = ['draftId', 'expectedRevision', 'expectedContentSha256']
const MUTATION_FIELDS = ['commandId', 'expectedRevision']
const LIST_FIELDS = ['definitionKey', 'state', 'cursor', 'limit', 'creationCommandId']
const SUMMARY_FIELDS = ['draftId', 'definitionKey', 'title', 'baseReleaseVersion', 'state', 'revision', 'contentSha256',
  'publishedReleaseVersion', 'createdAt', 'updatedAt', 'availableActions']
const DETAIL_FIELDS = [...SUMMARY_FIELDS, 'baseSourceManifestSha256', 'content', 'lastCommandId', 'publication', 'commandReceipt']
const CONTENT_FIELDS = ['models', 'inputSchemaSource', 'outputSchemaSource', 'nodeBindingsSource', 'eventRoutesSource']
const PUBLICATION_FIELDS = ['draftId', 'publishedRevision', 'draftRevision', 'releaseVersion', 'sourceManifestSha256',
  'compiledManifestSha256', 'dependencyManifestSha256', 'compilerVersion', 'publishedAt', 'commandId']

const invalidRequest = (): never => { throw new Error('流程草稿请求无效') }
const invalidResponse = (): never => { throw new Error('服务返回的流程草稿数据无效') }

function exactObject(value: unknown, required: readonly string[], optional: readonly string[] = []): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => required.includes(key) || optional.includes(key))
}

function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value)
}

function enumValue<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return choices.some(choice => choice === value)
}

function boundedArray(value: unknown, max: number): value is readonly unknown[] {
  return Array.isArray(value) && value.length <= max
}

function revision(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_REVISION
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && !value.includes('\0') && !UNPAIRED_SURROGATE.test(value)
}

function nonblankText(value: unknown): value is string {
  if (!isText(value)) return false
  for (const character of value) {
    if ((character < '\u001c' || character > '\u001f') && !JAVA_WHITESPACE.test(character)) return true
  }
  return false
}

function titleText(value: unknown): value is string {
  return nonblankText(value) && value.length <= 256 && !CONTROL.test(value) && [...value].length <= 128
}

function compilerText(value: unknown): value is string {
  return nonblankText(value) && value.length <= 128 && !CONTROL.test(value)
}

function editorText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_CONTENT_BYTES && isText(value)
}

function nullableEditorText(value: unknown): value is string | null {
  return value === null || editorText(value)
}

function decodeContent(value: unknown, invalid: () => never): DraftContentVO {
  if (!exactObject(value, CONTENT_FIELDS)) return invalid()
  const {models, inputSchemaSource, outputSchemaSource, nodeBindingsSource, eventRoutesSource} = value
  if (!nullableEditorText(inputSchemaSource) || !nullableEditorText(outputSchemaSource)
      || !nullableEditorText(nodeBindingsSource) || !nullableEditorText(eventRoutesSource)) return invalid()
  let minimumBytes = (inputSchemaSource?.length ?? 0) + (outputSchemaSource?.length ?? 0)
    + (nodeBindingsSource?.length ?? 0) + (eventRoutesSource?.length ?? 0)
  let modelSources: DraftModelSourceVO[] | null = null
  if (models !== null) {
    if (!boundedArray(models, 64)) return invalid()
    modelSources = []
    for (const model of models) {
      if (!exactObject(model, ['type', 'definitionKey', 'xml'])) return invalid()
      const {type, definitionKey, xml} = model
      if (!enumValue(type, MODEL_TYPES) || !isText(definitionKey) || definitionKey.length > 256
          || [...definitionKey].length > 128 || !editorText(xml)) return invalid()
      minimumBytes += definitionKey.length + xml.length
      modelSources.push({type, definitionKey, xml})
    }
  }
  const content = {models: modelSources, inputSchemaSource, outputSchemaSource, nodeBindingsSource, eventRoutesSource}
  // Sorting the fixed ASCII keys in the server's canonical writer changes order but never the serialized size.
  if (minimumBytes > MAX_CONTENT_BYTES || utf8.encode(JSON.stringify(content)).length > MAX_CONTENT_BYTES) return invalid()
  return content
}

function instantKey(instant: string): string {
  return instant.slice(0, 19) + instant.slice(20, -1).padEnd(6, '0')
}

function summaryFields(value: Record<string, unknown>): DraftSummaryDTO {
  const {draftId, definitionKey, title, baseReleaseVersion, state, revision: currentRevision, contentSha256,
    publishedReleaseVersion, createdAt, updatedAt, availableActions} = value
  if (!matches(draftId, LOGICAL_ID) || !matches(definitionKey, DEFINITION_KEY) || !titleText(title)
      || !(baseReleaseVersion === null || isProcessReleaseVersion(baseReleaseVersion))
      || !enumValue(state, STATES) || !revision(currentRevision) || !matches(contentSha256, SHA256)
      || !(publishedReleaseVersion === null || isProcessReleaseVersion(publishedReleaseVersion))
      || (state === 'PUBLISHED') !== (publishedReleaseVersion !== null)
      || !isProcessCorrelationUtc(createdAt) || !isProcessCorrelationUtc(updatedAt) || instantKey(updatedAt) < instantKey(createdAt)
      || !boundedArray(availableActions, 4)) return invalidResponse()
  const actions = new Set<DraftAction>()
  for (const action of availableActions) {
    if (!enumValue(action, ACTIONS) || actions.has(action) || (state !== 'EDITING' && action !== 'VALIDATE')) return invalidResponse()
    actions.add(action)
  }
  return {draftId, definitionKey, title, baseReleaseVersion, state, revision: currentRevision, contentSha256,
    publishedReleaseVersion, createdAt, updatedAt, availableActions: [...actions]}
}

function parseSummary(value: unknown): DraftSummaryDTO {
  if (!exactObject(value, SUMMARY_FIELDS)) return invalidResponse()
  return summaryFields(value)
}

function parsePublication(value: unknown): DraftPublicationVO {
  if (!exactObject(value, PUBLICATION_FIELDS)) return invalidResponse()
  const {draftId, publishedRevision, draftRevision, releaseVersion, sourceManifestSha256, compiledManifestSha256,
    dependencyManifestSha256, compilerVersion, publishedAt, commandId} = value
  if (!matches(draftId, LOGICAL_ID) || !revision(publishedRevision) || !revision(draftRevision) || draftRevision !== publishedRevision + 1
      || !isProcessReleaseVersion(releaseVersion) || !matches(sourceManifestSha256, SHA256) || !matches(compiledManifestSha256, SHA256)
      || !matches(dependencyManifestSha256, SHA256) || !compilerText(compilerVersion) || !isProcessCorrelationUtc(publishedAt)
      || !matches(commandId, COMMAND_ID)) return invalidResponse()
  return {draftId, publishedRevision, draftRevision, releaseVersion, sourceManifestSha256, compiledManifestSha256,
    dependencyManifestSha256, compilerVersion, publishedAt, commandId}
}

function parseReceipt(value: unknown): DraftCommandReceiptDTO {
  if (!exactObject(value, ['commandId', 'operation', 'requestSha256', 'resultRevision', 'resultContentSha256', 'releaseVersion', 'completedAt'])) {
    return invalidResponse()
  }
  const {commandId, operation, requestSha256, resultRevision, resultContentSha256, releaseVersion, completedAt} = value
  if (!matches(commandId, COMMAND_ID) || !enumValue(operation, OPERATIONS) || !matches(requestSha256, SHA256)
      || !revision(resultRevision) || !matches(resultContentSha256, SHA256) || !isProcessCorrelationUtc(completedAt)
      || !(releaseVersion === null || isProcessReleaseVersion(releaseVersion))
      || (operation === 'PUBLISH') !== (releaseVersion !== null)) return invalidResponse()
  return {commandId, operation, requestSha256, resultRevision, resultContentSha256, releaseVersion, completedAt}
}

function parseDetail(value: unknown, requestedDraft: string, requestedCommand: string | undefined): ProcessDraftDTO {
  if (!exactObject(value, DETAIL_FIELDS)) return invalidResponse()
  const summary = summaryFields(value)
  const {baseSourceManifestSha256, lastCommandId} = value
  if (summary.draftId !== requestedDraft || !matches(lastCommandId, COMMAND_ID)
      || !(baseSourceManifestSha256 === null || matches(baseSourceManifestSha256, SHA256))
      || (summary.baseReleaseVersion === null) !== (baseSourceManifestSha256 === null)) {
    return invalidResponse()
  }
  const publication = value.publication === null ? null : parsePublication(value.publication)
  if ((summary.state === 'PUBLISHED') !== (publication !== null)
      || (publication !== null && (publication.draftId !== summary.draftId || publication.draftRevision !== summary.revision
        || publication.releaseVersion !== summary.publishedReleaseVersion || publication.commandId !== lastCommandId
        || instantKey(publication.publishedAt) !== instantKey(summary.updatedAt)))) return invalidResponse()
  const commandReceipt = value.commandReceipt === null ? null : parseReceipt(value.commandReceipt)
  if (commandReceipt !== null && (commandReceipt.commandId !== requestedCommand || commandReceipt.resultRevision > summary.revision)) {
    return invalidResponse()
  }
  return {...summary, baseSourceManifestSha256, content: decodeContent(value.content, invalidResponse), lastCommandId, publication, commandReceipt}
}

function parseValidationIssue(value: unknown): DraftValidationIssueVO {
  if (!exactObject(value, ['path', 'code', 'message', 'nodeId'])) return invalidResponse()
  const {path, code, message, nodeId} = value
  if (!isText(path) || !nonblankText(code) || !nonblankText(message) || !(nodeId === null || matches(nodeId, LOGICAL_ID))) {
    return invalidResponse()
  }
  return {path, code, message, nodeId}
}

function parseValidation(value: unknown, expected: ValidateProcessDraftQuery): DraftValidationResultDTO {
  if (!exactObject(value, ['draftId', 'revision', 'contentSha256', 'valid', 'compilerVersion', 'sourceManifestSha256', 'graph', 'issues'])) {
    return invalidResponse()
  }
  const {draftId, revision, contentSha256, valid, compilerVersion, sourceManifestSha256, graph, issues} = value
  if (draftId !== expected.draftId || revision !== expected.expectedRevision || contentSha256 !== expected.expectedContentSha256
      || !compilerText(compilerVersion) || typeof valid !== 'boolean' || !boundedArray(issues, 128)) return invalidResponse()
  const evidence = {draftId, revision, contentSha256, compilerVersion}
  if (valid) {
    if (!matches(sourceManifestSha256, SHA256) || issues.length !== 0) return invalidResponse()
    return {...evidence, valid, sourceManifestSha256, graph: parseAutomationGraph(graph), issues: []}
  }
  if (sourceManifestSha256 !== null || graph !== null) return invalidResponse()
  return {...evidence, valid, sourceManifestSha256, graph, issues: issues.map(parseValidationIssue)}
}

function parseMutation(value: unknown, draftId: string, command: DiscardProcessDraftCommand,
                       state: DraftMutationResultDTO['state']): DraftMutationResultDTO {
  if (!exactObject(value, ['draftId', 'state', 'revision', 'contentSha256', 'updatedAt', 'commandId'])) return invalidResponse()
  const {revision: nextRevision, contentSha256, updatedAt} = value
  if (value.draftId !== draftId || value.state !== state || value.commandId !== command.commandId
      || !revision(nextRevision) || nextRevision !== command.expectedRevision + 1
      || !matches(contentSha256, SHA256) || !isProcessCorrelationUtc(updatedAt)) return invalidResponse()
  return {draftId, state, revision: nextRevision, contentSha256, updatedAt, commandId: command.commandId}
}

function parsePage(value: unknown, params: URLSearchParams): ProcessDraftPageDTO {
  if (!exactObject(value, ['observedAt', 'items', 'nextCursor'])) return invalidResponse()
  const {observedAt, items, nextCursor} = value
  const recovering = params.has('creationCommandId')
  if (!isProcessCorrelationUtc(observedAt) || !boundedArray(items, recovering ? 1 : Number(params.get('limit')))
      || !(nextCursor === null || (!recovering && matches(nextCursor, CURSOR)))) return invalidResponse()
  const rows = items.map(parseSummary)
  if (!recovering) {
    const definitionKey = params.get('definitionKey')
    const state = params.get('state')
    const seen = new Set<string>()
    let previous: DraftSummaryDTO | undefined
    for (const row of rows) {
      if (seen.has(row.draftId) || row.state !== state
          || (definitionKey !== null && row.definitionKey !== definitionKey)) return invalidResponse()
      if (previous) {
        const currentTime = instantKey(row.createdAt), previousTime = instantKey(previous.createdAt)
        if (currentTime > previousTime || (currentTime === previousTime && row.draftId >= previous.draftId)) return invalidResponse()
      }
      seen.add(row.draftId)
      previous = row
    }
  }
  return {observedAt, items: rows, nextCursor}
}

function draftPath(draftId: string): string {
  if (!matches(draftId, LOGICAL_ID)) return invalidRequest()
  return `${DRAFTS}/${encodeURIComponent(draftId)}`
}

function checkExpectedRevision(value: ValidateProcessDraftQuery) {
  const {draftId, expectedRevision, expectedContentSha256} = value
  if (!matches(draftId, LOGICAL_ID) || !revision(expectedRevision) || !matches(expectedContentSha256, SHA256)) return invalidRequest()
  return {draftId, expectedRevision, expectedContentSha256}
}

function checkMutation(value: DiscardProcessDraftCommand) {
  const {commandId, expectedRevision} = value
  if (!matches(commandId, COMMAND_ID) || !revision(expectedRevision)) return invalidRequest()
  return {commandId, expectedRevision}
}

function listParameters(query: ListProcessDraftsQuery): URLSearchParams {
  if (!exactObject(query, [], LIST_FIELDS)) return invalidRequest()
  const {definitionKey, state, limit, cursor, creationCommandId} = query
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) return invalidRequest()
  if (creationCommandId !== undefined) {
    if (!matches(creationCommandId, COMMAND_ID) || definitionKey !== undefined || state !== undefined || cursor !== undefined) {
      return invalidRequest()
    }
    const params = new URLSearchParams({creationCommandId})
    if (limit !== undefined) params.set('limit', String(limit))
    return params
  }
  if ((definitionKey !== undefined && !matches(definitionKey, DEFINITION_KEY))
      || (state !== undefined && !enumValue(state, STATES)) || (cursor !== undefined && !matches(cursor, CURSOR))) return invalidRequest()
  const params = new URLSearchParams()
  if (definitionKey !== undefined) params.set('definitionKey', definitionKey)
  params.set('state', state ?? 'EDITING')
  params.set('limit', String(limit ?? 20))
  if (cursor !== undefined) params.set('cursor', cursor)
  return params
}

function write(path: string, tenant: string, value: object, signal?: AbortSignal) {
  const body = JSON.stringify(value)
  return requestJson<unknown>(path, tenant, {method: 'POST', cache: 'no-store', body, signal}, 200)
}

function read(path: string, tenant: string, signal?: AbortSignal) {
  return requestJson<unknown>(path, tenant, {method: 'GET', cache: 'no-store', signal}, 200)
}

export function prepareDraftSave(draftId: string, body: SaveProcessDraftCommand): PreparedDraftSave {
  const path = draftPath(draftId)
  if (!exactObject(body, [...MUTATION_FIELDS, 'title', 'content']) || !titleText(body.title)) return invalidRequest()
  const expected = checkMutation(body)
  const content = decodeContent(body.content, invalidRequest)
  const preparedBody: SaveProcessDraftCommand = {
    commandId: expected.commandId,
    expectedRevision: expected.expectedRevision,
    title: body.title,
    content,
  }
  const serializedBody = JSON.stringify(preparedBody)
  if (utf8.encode(serializedBody).length > MAX_SAVE_BYTES) return invalidRequest()
  return {draftId, path, body: preparedBody, serializedBody}
}

export const processDraftsApi = {
  async validate(tenant: string, body: ValidateProcessDraftQuery, signal?: AbortSignal): Promise<DraftValidationResultDTO> {
    if (!exactObject(body, REVISION_FIELDS)) return invalidRequest()
    const expected = checkExpectedRevision(body)
    return parseValidation(await write(`${BASE}/process-model-validations`, tenant, expected, signal), expected)
  },

  async publish(tenant: string, body: PublishProcessDraftCommand, signal?: AbortSignal): Promise<DraftPublicationVO> {
    if (!exactObject(body, [...REVISION_FIELDS, 'releaseVersion', 'commandId'])) return invalidRequest()
    const {releaseVersion, commandId} = body
    if (!isProcessReleaseVersion(releaseVersion) || !matches(commandId, COMMAND_ID)) return invalidRequest()
    const expected = checkExpectedRevision(body)
    const result = parsePublication(await write(`${BASE}/process-releases`, tenant, {...expected, releaseVersion, commandId}, signal))
    if (result.draftId !== expected.draftId || result.publishedRevision !== expected.expectedRevision
        || result.releaseVersion !== releaseVersion || result.commandId !== commandId) return invalidResponse()
    return result
  },

  async create(tenant: string, definitionKey: string, body: CreateProcessDraftCommand, signal?: AbortSignal): Promise<DraftSummaryDTO> {
    if (!matches(definitionKey, DEFINITION_KEY) || !exactObject(body, ['title', 'commandId'], ['baseReleaseVersion'])) return invalidRequest()
    const {title, baseReleaseVersion, commandId} = body
    if (!titleText(title) || !matches(commandId, COMMAND_ID)
        || !(baseReleaseVersion === undefined || baseReleaseVersion === null || isProcessReleaseVersion(baseReleaseVersion))) {
      return invalidRequest()
    }
    const path = `${BASE}/process-definitions/${encodeURIComponent(definitionKey)}/drafts`
    const summary = parseSummary(await write(path, tenant, {title, baseReleaseVersion, commandId}, signal))
    if (summary.definitionKey !== definitionKey || summary.title !== title || summary.baseReleaseVersion !== (baseReleaseVersion ?? null)
        || summary.state !== 'EDITING' || summary.revision !== 1) return invalidResponse()
    return summary
  },

  async get(tenant: string, draftId: string, commandId?: string, signal?: AbortSignal): Promise<ProcessDraftDTO> {
    if (commandId !== undefined && !matches(commandId, COMMAND_ID)) return invalidRequest()
    const query = commandId === undefined ? '' : '?' + new URLSearchParams({commandId})
    return parseDetail(await read(draftPath(draftId) + query, tenant, signal), draftId, commandId)
  },

  async list(tenant: string, query: ListProcessDraftsQuery = {}, signal?: AbortSignal): Promise<ProcessDraftPageDTO> {
    const params = listParameters(query)
    return parsePage(await read(`${DRAFTS}?${params}`, tenant, signal), params)
  },

  async save(tenant: string, draftId: string, body: SaveProcessDraftCommand, signal?: AbortSignal): Promise<DraftMutationResultDTO> {
    const prepared = prepareDraftSave(draftId, body)
    const value = await requestJson<unknown>(prepared.path, tenant,
      {method: 'PUT', cache: 'no-store', body: prepared.serializedBody, signal}, 200)
    return parseMutation(value, prepared.draftId, prepared.body, 'EDITING')
  },

  async discard(tenant: string, draftId: string, body: DiscardProcessDraftCommand, signal?: AbortSignal): Promise<DraftMutationResultDTO> {
    if (!exactObject(body, MUTATION_FIELDS)) return invalidRequest()
    const expected = checkMutation(body)
    const value = await write(`${draftPath(draftId)}/discard-commands`, tenant, expected, signal)
    return parseMutation(value, draftId, expected, 'DISCARDED')
  },
}
