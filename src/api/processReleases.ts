import {requestJson} from './client'

const MODEL_TYPES = ['BPMN', 'CMMN', 'DMN'] as const
const VALUE_TYPES = ['STRING', 'INTEGER', 'BOOLEAN'] as const
type ModelType = typeof MODEL_TYPES[number]
type ValueType = typeof VALUE_TYPES[number]

export type ProcessReleaseModel = Readonly<{
  type: ModelType
  definitionKey: string
  contentSha256: string
  inputs: Readonly<Record<string, ValueType>>
}>

export type ProcessRelease = Readonly<{
  releaseVersion: string
  manifestSha256: string
  createdAt: string
  models: readonly ProcessReleaseModel[]
}>

const RELEASE_KEYS = ['releaseVersion', 'manifestSha256', 'createdAt', 'models']
const MODEL_KEYS = ['type', 'definitionKey', 'contentSha256', 'inputs']
const VERSION = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}(?![\s\S])/
const DEFINITION = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}(?![\s\S])/
const INPUT = /^[A-Za-z_][A-Za-z0-9_]{0,63}(?![\s\S])/
const SHA = /^[0-9a-f]{64}(?![\s\S])/
const RESERVED = new Set(['true', 'false', 'null', 'empty', 'and', 'or', 'not', 'div', 'mod', 'eq', 'ne',
  'lt', 'le', 'gt', 'ge', 'instanceof', 'authenticatedUserId'])
const UTC_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}(?:\d{3}){0,2}))?Z(?![\s\S])/

export function isProcessReleaseVersion(value: unknown): value is string {
  return typeof value === 'string' && VERSION.test(value)
}

const invalidResponse = (): never => { throw new Error('服务返回的流程发布元数据无效') }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

function enumValue<T extends string>(choices: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (choices as readonly string[]).includes(value)
}

function canonicalUtc(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = UTC_INSTANT.exec(value)
  if (!match) return false
  const [, y, m, d, h, min, sec, fraction] = match
  const year = Number(y), month = Number(m), day = Number(d)
  if (year < 1 || month < 1 || month > 12 || day < 1 || Number(h) > 23 || Number(min) > 59 || Number(sec) > 59
      || fraction?.endsWith('000')) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = month === 2 ? (leap ? 29 : 28) : ([4, 6, 9, 11].includes(month) ? 30 : 31)
  return day <= days
}

function parseModel(value: unknown): ProcessReleaseModel {
  if (!exactObject(value, MODEL_KEYS)) return invalidResponse()
  const {type, definitionKey, contentSha256, inputs} = value
  if (!enumValue(MODEL_TYPES, type) || typeof definitionKey !== 'string' || !DEFINITION.test(definitionKey)
      || typeof contentSha256 !== 'string' || !SHA.test(contentSha256) || !isRecord(inputs)) return invalidResponse()
  const entries = Object.entries(inputs)
  if (entries.length > 16) return invalidResponse()
  const fields: [string, ValueType][] = []
  for (const [key, inputType] of entries) {
    if (!INPUT.test(key) || RESERVED.has(key) || !enumValue(VALUE_TYPES, inputType)) return invalidResponse()
    fields.push([key, inputType])
  }
  return {type, definitionKey, contentSha256, inputs: Object.fromEntries(fields)}
}

function parseRelease(value: unknown, requestedVersion: string): ProcessRelease {
  if (!exactObject(value, RELEASE_KEYS)) return invalidResponse()
  const {releaseVersion, manifestSha256, createdAt, models} = value
  if (releaseVersion !== requestedVersion || typeof manifestSha256 !== 'string' || !SHA.test(manifestSha256)
      || !canonicalUtc(createdAt) || !Array.isArray(models) || models.length < 1 || models.length > 16) return invalidResponse()
  const keys = new Set<string>()
  const rows = models.map(model => {
    const parsed = parseModel(model)
    const key = parsed.type + ':' + parsed.definitionKey
    if (keys.has(key)) return invalidResponse()
    keys.add(key)
    return parsed
  })
  return {releaseVersion, manifestSha256, createdAt, models: rows}
}

export const processReleasesApi = {
  async get(tenant: string, releaseVersion: string, signal?: AbortSignal): Promise<ProcessRelease> {
    if (!isProcessReleaseVersion(releaseVersion)) throw new Error('发布版本无效')
    const value = await requestJson<unknown>(`/api/tianji/v1/process-releases/${encodeURIComponent(releaseVersion)}`,
      tenant, {method: 'GET', cache: 'no-store', signal})
    return parseRelease(value, releaseVersion)
  },
}
