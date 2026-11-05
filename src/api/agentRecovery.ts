import {requestJson} from './client'
import {isProcessCorrelationUtc} from './processCorrelations'

const lifecycleByReason = {
  QUEUE_DISCOVERY: 'QUEUED', CURRENT_LEASE: 'ACTIVE', CANCEL_REQUESTED: 'ACTIVE',
  DEADLINE_DUE: 'STALLED', LEASE_MISSING: 'STALLED', LEASE_EXPIRED: 'STALLED',
  AUTHORIZATION_DENIED: 'STALLED', AUTHORIZATION_UNAVAILABLE: 'STALLED',
  FENCE_UNVERIFIED: 'UNVERIFIED', SUSPENSION_UNVERIFIED: 'UNVERIFIED',
  LEGACY_WAIT_UNVERIFIED: 'UNVERIFIED', SOURCE_UNAVAILABLE: 'UNVERIFIED', TERMINAL_RECORDED: 'TERMINAL',
} as const

export type RecoveryReason = keyof typeof lifecycleByReason
export type RecoveryLifecycle = typeof lifecycleByReason[RecoveryReason]
export type RecoveryEffect = 'RECORDED_NONE' | 'RECORDED_CONFIRMED' | 'UNKNOWN' | 'UNVERIFIED'
export type RecoveryCoverage = 'COMPLETE' | 'TRUNCATED' | 'UNAVAILABLE'

export type RecoveryDisposition = Readonly<{
  runId: string
  observedAt: string
  lifecycle: RecoveryLifecycle
  reason: RecoveryReason
  agentEffect: RecoveryEffect
  toolEvidence: Readonly<{
    coverage: RecoveryCoverage
    hasDispatching: boolean | null
    hasUnknownResult: boolean | null
    hasUnresolvedWrite: boolean | null
    hasLocalReceipt: boolean | null
  }>
  evidenceConflict: boolean
}>

const toolFlags = ['hasDispatching', 'hasUnknownResult', 'hasUnresolvedWrite', 'hasLocalReceipt'] as const
const responseFields = ['runId', 'observedAt', 'lifecycle', 'reason', 'agentEffect', 'toolEvidence', 'evidenceConflict']
const invalid = (): never => { throw new Error('服务返回的恢复证据无效') }

function exact(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field))
}

function isReason(value: unknown): value is RecoveryReason {
  return typeof value === 'string' && Object.hasOwn(lifecycleByReason, value)
}

function flag(value: unknown): value is boolean | null {
  return value === null || typeof value === 'boolean'
}

function parseDisposition(value: unknown, runId: string): RecoveryDisposition {
  if (!exact(value, responseFields) || value.runId !== runId || !isProcessCorrelationUtc(value.observedAt)
      || !isReason(value.reason) || value.lifecycle !== lifecycleByReason[value.reason]) return invalid()
  const {reason, observedAt, agentEffect, evidenceConflict, toolEvidence} = value
  const lifecycle = lifecycleByReason[reason]
  if ((agentEffect !== 'RECORDED_NONE' && agentEffect !== 'RECORDED_CONFIRMED'
      && agentEffect !== 'UNKNOWN' && agentEffect !== 'UNVERIFIED')
      || (lifecycle !== 'TERMINAL' && agentEffect !== 'UNVERIFIED')
      || !exact(toolEvidence, ['coverage', ...toolFlags])) return invalid()
  const {coverage, hasDispatching, hasUnknownResult, hasUnresolvedWrite, hasLocalReceipt} = toolEvidence
  if (!flag(hasDispatching) || !flag(hasUnknownResult) || !flag(hasUnresolvedWrite) || !flag(hasLocalReceipt)) return invalid()
  const flags = [hasDispatching, hasUnknownResult, hasUnresolvedWrite, hasLocalReceipt]
  if ((coverage !== 'COMPLETE' && coverage !== 'TRUNCATED' && coverage !== 'UNAVAILABLE')
      || (coverage === 'COMPLETE' && flags.some(value => value === null))
      || (coverage === 'TRUNCATED' && flags.some(value => value === false))
      || (coverage === 'UNAVAILABLE' && flags.some(value => value !== null))
      || (hasUnresolvedWrite === true && hasDispatching !== true && hasUnknownResult !== true)
      || evidenceConflict !== (agentEffect === 'RECORDED_NONE' && hasUnresolvedWrite === true)) return invalid()
  return {runId, observedAt, lifecycle, reason, agentEffect,
    toolEvidence: {coverage, hasDispatching, hasUnknownResult, hasUnresolvedWrite, hasLocalReceipt}, evidenceConflict}
}

export const agentRecoveryApi = {
  async get(tenant: string, runId: string, signal?: AbortSignal): Promise<RecoveryDisposition> {
    if (!/^[A-Za-z0-9_-]{1,64}(?![\s\S])/.test(runId)) throw new Error('运行标识无效')
    const url = '/api/tianji/v1/agent-runs/' + encodeURIComponent(runId) + '/recovery-disposition'
    const value = await requestJson<unknown>(url, tenant, {method: 'GET', cache: 'no-store', signal})
    return parseDisposition(value, runId)
  },
}
