import type {PreferenceIntentCancellation, PreferenceIntentQuery, PreferenceIntentState, PreferenceIntentStatus} from '../api/memoryPreferenceIntents'

export const preferenceIntentQuery = (): PreferenceIntentQuery => ({owner: {type: 'USER', id: 'subject-20'}, scopeId: 'research', runId: 'run-1'})
export const preferenceIntentStatus = (state: PreferenceIntentState = 'READY', revision = 3): PreferenceIntentStatus => ({
  ...preferenceIntentQuery(), intent: {
    intentId: '00000000-0000-0000-0000-000000000001', bindingId: 'source', policyRef: `preferences@1#${'a'.repeat(64)}`, state, revision,
    nextIndex: state === 'APPLIED' ? 1 : 0, totalCount: state === 'APPLIED' ? 1 : null, attemptCount: 1, reasonCode: state === 'CANCELLED' ? 'USER_CANCELLED' : null,
    createdAt: '2026-10-31T00:00:00Z', updatedAt: '2026-10-31T00:00:01Z', closedAt: ['RESERVED', 'READY', 'CLAIMED'].includes(state) ? null : '2026-10-31T00:00:01Z',
  },
})
export const preferenceIntentCancellation = (commandId = 'cancel-1'): PreferenceIntentCancellation => ({commandId, status: preferenceIntentStatus('CANCELLED', 4)})
