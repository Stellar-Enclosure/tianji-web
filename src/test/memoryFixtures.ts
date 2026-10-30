import type {MemoryCandidate} from '../api/memory'

export const candidate = (id = 'candidate-1', tenant = '20'): MemoryCandidate => ({
  owner: {type: 'USER', id: `subject-${tenant}`}, scopeId: 'research', memoryId: id, kind: 'PREFERENCE', revision: 1, supersedesRevision: null,
  state: 'CANDIDATE', confirmed: false, content: {text: `候选内容 ${id}`, facts: {language: '中文'}}, contentSha256: 'a'.repeat(64),
  source: {reference: 'declared-preference', evidenceSha256: 'b'.repeat(64), sourceRunId: null, sourceEventId: null}, confidence: 0.5,
  sensitivity: 'CONFIDENTIAL', retentionPolicyRef: `retention@1#${'c'.repeat(64)}`, effectiveAt: '2026-10-31T00:00:00Z', expiresAt: '2026-11-30T00:00:00Z',
  createdAt: '2026-10-31T00:00:00Z', updatedAt: '2026-10-31T00:00:00Z',
})
