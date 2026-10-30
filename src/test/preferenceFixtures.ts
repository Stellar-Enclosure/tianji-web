import type {PreferencePreparation, PreferenceResult} from '../api/memoryPreferences'

export const preferencePreparation = (subject = 'subject-20'): PreferencePreparation => ({
  command: {owner: {type: 'USER', id: subject}, scopeId: 'research', runId: 'run-1', sourceEventId: 'terminal-1', bindingId: 'approved-source', policyRef: `preferences@1#${'a'.repeat(64)}`},
  outcome: 'ELIGIBLE', candidateCount: 1, preferenceKeys: ['language'], sensitivity: 'CONFIDENTIAL',
})
export const preferenceResult = (prepared = preferencePreparation()): PreferenceResult => ({
  ...prepared.command, outcome: 'ELIGIBLE', items: [{preferenceKey: 'language', receipt: {
    commandId: '60d3d51a-98d6-3412-8266-d0756b01919f', owner: prepared.command.owner, scopeId: prepared.command.scopeId,
    memoryId: 'candidate-1', revision: 1, outcome: 'CREATED', stateAtMutation: 'CANDIDATE', occurredAt: '2026-10-31T00:00:00Z',
  }}],
})
