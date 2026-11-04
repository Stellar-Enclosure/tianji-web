import type {HumanTask, HumanTaskAction, HumanTaskActionReceipt, HumanTaskPage} from '../api/humanTasks'

export const humanTask = (overrides: Partial<HumanTask> = {}): HumanTask => ({
  taskId: 'task-1', scopeType: 'PROCESS', scopeId: 'process-1', releaseVersion: 'release-1', definitionKey: 'expenseReview',
  taskDefinitionKey: 'managerReview', name: '费用审批', kind: 'APPROVAL', approvalField: 'approved', version: 'a'.repeat(64),
  lane: 'finance', availableLanes: ['finance', 'manager'], assigned: true, assignedToMe: true, suspended: false,
  formSchema: {approved: 'BOOLEAN', comment: 'STRING', amount: 'INTEGER'}, createdAt: '2026-11-04T08:00:00.123456789Z',
  dueAt: '2026-11-05T16:00:00.123456789+08:00', ...overrides,
})

export const humanTaskPage = (overrides: Partial<HumanTaskPage> = {}): HumanTaskPage => ({
  scopeType: 'PROCESS', selection: 'ALL', items: [humanTask()], nextAfterTaskId: 'task-z', ...overrides,
})

export const humanTaskReceipt = (action: HumanTaskAction = 'CLAIM', overrides: Partial<HumanTaskActionReceipt> = {}): HumanTaskActionReceipt => {
  const complete = action === 'COMPLETE'
  return {
    commandId: `${action.toLowerCase()}-1`, taskId: 'task-1', action, scopeType: 'PROCESS', scopeId: 'process-1', releaseVersion: 'release-1',
    definitionKey: 'expenseReview', taskDefinitionKey: 'managerReview', kind: 'APPROVAL', lane: 'finance', previousVersion: 'a'.repeat(64),
    resultingVersion: complete ? null : 'b'.repeat(64), approvalReceiptId: complete ? 'approval-1' : null, approved: complete ? false : null,
    occurredAt: '2026-11-04T08:01:00.987654321Z', ...overrides,
  }
}
