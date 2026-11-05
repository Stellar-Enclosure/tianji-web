import {requestJson} from './client'
import {isProcessCorrelationUtc} from './processCorrelations'
import {isProcessReleaseVersion} from './processReleases'
import {isProcessInstanceId} from './processWorkerFailures'

const statuses = ['NATIVE_STRUCTURE_VALIDATED_ONLY', 'INSTANCE_NOT_LIVE', 'TARGET_UNAVAILABLE', 'TARGET_PIN_MISMATCH',
  'RELEASE_PAIR_UNSUPPORTED', 'SHAPE_UNSUPPORTED', 'ACTIVE_EVIDENCE_UNSAFE', 'NATIVE_REJECTED'] as const

export type ProcessMigrationPreflightStatus = typeof statuses[number]
export type ProcessMigrationPreflight = Readonly<{
  instanceId: string
  sourceReleaseVersion: string
  targetReleaseVersion: string
  status: ProcessMigrationPreflightStatus
  activityId: string | null
  observedAt: string
}>
export type ProcessMigrationTarget = Readonly<{
  instanceId: string
  sourceReleaseVersion: string
  targetReleaseVersion: string
  expectedTargetManifestSha256: string
}>

const fields = ['instanceId', 'sourceReleaseVersion', 'targetReleaseVersion', 'status', 'activityId', 'observedAt']
const hash = /^[0-9a-f]{64}(?![\s\S])/
const activity = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}(?![\s\S])/
const invalid = (): never => { throw new Error('服务返回的迁移预检证据无效') }

function parsePreflight(value: unknown, target: ProcessMigrationTarget): ProcessMigrationPreflight {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const result = value as Record<string, unknown>
  if (Object.keys(result).length !== fields.length || !fields.every(field => Object.hasOwn(result, field))
      || result.instanceId !== target.instanceId || result.sourceReleaseVersion !== target.sourceReleaseVersion
      || result.targetReleaseVersion !== target.targetReleaseVersion || !isProcessCorrelationUtc(result.observedAt)) return invalid()
  const {status, activityId, observedAt} = result
  if (typeof status !== 'string' || !statuses.includes(status as ProcessMigrationPreflightStatus)) return invalid()
  const nativeChecked = status === 'NATIVE_STRUCTURE_VALIDATED_ONLY' || status === 'NATIVE_REJECTED'
  if (nativeChecked ? typeof activityId !== 'string' || !activity.test(activityId) : activityId !== null) return invalid()
  return {instanceId: target.instanceId, sourceReleaseVersion: target.sourceReleaseVersion,
    targetReleaseVersion: target.targetReleaseVersion, status: status as ProcessMigrationPreflightStatus,
    activityId: activityId as string | null, observedAt}
}

export const processMigrationPreflightApi = {
  async get(tenant: string, target: ProcessMigrationTarget, signal?: AbortSignal): Promise<ProcessMigrationPreflight> {
    if (!isProcessInstanceId(target.instanceId) || !isProcessReleaseVersion(target.sourceReleaseVersion)
        || !isProcessReleaseVersion(target.targetReleaseVersion) || !hash.test(target.expectedTargetManifestSha256)) {
      throw new Error('迁移预检条件无效')
    }
    const captured = {...target}
    const params = new URLSearchParams({targetReleaseVersion: captured.targetReleaseVersion,
      expectedTargetManifestSha256: captured.expectedTargetManifestSha256})
    const url = '/api/tianji/v1/process-instances/' + encodeURIComponent(captured.instanceId) + '/migration-preflight?' + params.toString()
    const result = await requestJson<unknown>(url, tenant, {method: 'GET', cache: 'no-store', signal})
    return parsePreflight(result, captured)
  },
}
