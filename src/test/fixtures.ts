import {snapshotContext, type PermissionSnapshot} from '@stellar-enclosure/stellar-enclosure-web-shared/permissions'
import type {PublicOAuthIdentity} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {gatewayAuth} from '../auth/gatewayAuth'
import type {AgentRun} from '../api/agent'

export const identity = (tenantId = '20'): PublicOAuthIdentity => ({
  issuer: `https://idp.example/tenants/${tenantId}`, subject: `subject-${tenantId}`, tenantId,
  clientId: 'tianji-web', resource: 'https://tianji.example.invalid/resource', accessExpiresAt: Date.now() + 120_000,
})
export const snapshot = (tenantId = '20', permissions = ['TIANJI_AGENT_READ', 'TIANJI_AGENT_CANCEL']): PermissionSnapshot => ({
  issuer: `https://idp.example/tenants/${tenantId}`, subject: `subject-${tenantId}`,
  catalogScope: {catalogScopeId: '10', tenantId, businessCode: 'xingyuan', applicationCode: 'tianji', namespaceCode: 'default', environment: 'local'},
  catalogVersion: '1', authVersion: '2', policyVersion: '3',
  activeRoleContext: {applicationCode: 'tianji', rootRoleIds: ['11'], effectiveRoleIds: ['11']},
  permissionCodes: permissions, snapshotExpiresAt: new Date(Date.now() + 120_000).toISOString(),
})
export const authorization = (tenantId = '20', permissions?: string[]) => {
  const value = snapshot(tenantId, permissions)
  return {identity: identity(tenantId), snapshot: value, binding: snapshotContext(value, gatewayAuth.context.epoch)}
}
export const run = (id = 'run-1', status: AgentRun['status'] = 'RUNNING'): AgentRun => ({
  runId: id, definitionKey: 'research', definitionVersion: 1, sessionId: null, status, waitReason: null,
  cancelRequested: false, attempt: 1, revision: 2, lastEventSequence: 1,
  deadlineAt: '2026-10-28T01:00:00Z', createdAt: '2026-10-28T00:00:00Z', finishedAt: null,
})
