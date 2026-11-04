import type {ActOnPlanItemCommand, CaseInstance, CaseOperationResult, CasePlanItem, CasePlanItemAction, CasePlanItemState} from '../api/cases'

export const casePlanItem = (overrides: Partial<CasePlanItem> = {}): CasePlanItem => ({
  planItemInstanceId: 'primary-1', planItemDefinitionKey: 'primaryTask', kind: 'HUMAN_TASK', state: 'ENABLED',
  version: 'c'.repeat(64), availableActions: ['DISABLE', 'START'], ...overrides,
})

export const caseInstance = (overrides: Partial<CaseInstance> = {}): CaseInstance => ({
  caseInstanceId: 'case-1', definitionKey: 'formalCase', releaseVersion: 'release-1', businessKey: 'expense-1',
  correlationId: 'correlation-1', status: 'ACTIVE', submittedAt: '2026-11-04T08:00:00.123456789Z', finishedAt: null,
  planItems: [casePlanItem(), casePlanItem({planItemInstanceId: 'supplemental-1', planItemDefinitionKey: 'supplementalTask', state: 'DISABLED',
    version: 'd'.repeat(64), availableActions: ['ENABLE']}), casePlanItem({planItemInstanceId: 'milestone-1', planItemDefinitionKey: 'acceptedMilestone',
    kind: 'MILESTONE', state: 'AVAILABLE', version: 'e'.repeat(64), availableActions: []})], ...overrides,
})

const transitions: Record<CasePlanItemAction, readonly [CasePlanItemState, CasePlanItemState]> = {
  DISABLE: ['ENABLED', 'DISABLED'], ENABLE: ['DISABLED', 'ENABLED'], START: ['ENABLED', 'ACTIVE'], TERMINATE: ['ACTIVE', 'TERMINATED'],
}

export const caseActionCommand = (overrides: Partial<ActOnPlanItemCommand> = {}): ActOnPlanItemCommand => ({
  commandId: 'case-action-1', caseInstanceId: 'case-1', planItemInstanceId: 'primary-1', expectedVersion: 'c'.repeat(64), action: 'START', ...overrides,
})

export const caseOperationResult = (command: ActOnPlanItemCommand = caseActionCommand(), overrides: Partial<CaseOperationResult> = {}): CaseOperationResult => {
  const [previousState, resultingState] = transitions[command.action]
  return {
    commandId: command.commandId, caseInstanceId: command.caseInstanceId, planItemInstanceId: command.planItemInstanceId,
    planItemDefinitionKey: 'primaryTask', action: command.action, releaseVersion: 'release-1', definitionKey: 'formalCase', previousState,
    previousVersion: command.expectedVersion, resultingState, resultingVersion: 'f'.repeat(64), occurredAt: '2026-11-04T08:02:00.987654321+00:00', ...overrides,
  }
}
