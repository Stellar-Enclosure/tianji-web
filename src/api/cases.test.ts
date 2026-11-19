import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {caseActionCommand, caseInstance, caseOperationResult, casePlanItem} from '../test/caseFixtures'
import {casesApi, type ActOnPlanItemCommand, type CaseInstance, type CasePlanItemAction, type CasePlanItemState} from './cases'
import {setAuthFailureHandler} from './client'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}})
const gatewayPath = (route: string): string => new URL(`${gatewayAuth.authority('20').apiBaseUrl.replace(/\/$/, '')}${route}`, 'https://example.test').pathname
const source = caseInstance()
const command = caseActionCommand()
const rejected = (call: () => unknown) => expect(Promise.resolve().then(call)).rejects.toThrow()

const actionSource = (action: CasePlanItemAction): readonly [CaseInstance, ActOnPlanItemCommand] => {
  const states: Record<CasePlanItemAction, CasePlanItemState> = {DISABLE: 'ENABLED', ENABLE: 'DISABLED', START: 'ENABLED', TERMINATE: 'ACTIVE'}
  const item = casePlanItem({state: states[action], availableActions: [action]})
  const current = caseInstance({planItems: [item]})
  return [current, caseActionCommand({action, expectedVersion: item.version})]
}

describe('Formal Case current-user JSON client', () => {
  beforeEach(() => {
    gatewayAuth.context.invalidate()
  })
  afterEach(() => { gatewayAuth.context.invalidate(); setAuthFailureHandler(() => {}); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('uses only get and act-plan-item private POST routes with exact command bodies and no captured source fields', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn().mockResolvedValueOnce(json(source)).mockResolvedValueOnce(json(caseOperationResult(command)))
    vi.stubGlobal('fetch', fetcher)
    await expect(casesApi.get('20', {caseInstanceId: source.caseInstanceId}, controller.signal)).resolves.toEqual(source)
    await expect(casesApi.actPlanItem('20', command, source, controller.signal)).resolves.toEqual(caseOperationResult(command))
    expect(Object.keys(casesApi).sort()).toEqual(['actPlanItem', 'get'])
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls.map(call => new URL(String(call[0]), 'https://example.test').pathname)).toEqual([
      '/api/tianji/v1/cases/get', '/api/tianji/v1/cases/act-plan-item',
    ].map(gatewayPath))
    const bodies = [{caseInstanceId: source.caseInstanceId}, command]
    fetcher.mock.calls.forEach((call, index) => {
      const request = call[1] as RequestInit
      expect(request.method).toBe('POST')
      expect(request.signal).toBeInstanceOf(AbortSignal)
      expect(request.signal?.aborted).toBe(true)
      expect(JSON.parse(String(request.body))).toEqual(bodies[index])
      expect(request.credentials).toBe('omit')
      expect(new Headers(request.headers).get('Authorization')).toBe('Bearer tianji-resource-token')
      expect(new Headers(request.headers).get('X-CSRF-TOKEN')).toBeNull()
      expect(new Headers(request.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
    })
    expect(controller.signal.aborted).toBe(false)
  })

  it('rejects unchecked foreign, missing, coerced, and extra Case projections after one response', async () => {
    const missingFinished = {...source} as Record<string, unknown>; delete missingFinished.finishedAt
    const missingItemState = {...casePlanItem()} as Record<string, unknown>; delete missingItemState.state
    const missingItemActions = {...casePlanItem()} as Record<string, unknown>; delete missingItemActions.availableActions
    const seventeenItems = Array.from({length: 17}, (_, index) => casePlanItem({planItemInstanceId: `item-${index}`, planItemDefinitionKey: `item${index}`}))
    const invalid: unknown[] = [
      {...source, caseInstanceId: 'other'}, {...source, nativeCaseId: 'private'}, missingFinished, {...source, status: 'RUNNING'},
      {...source, finishedAt: '2026-11-04T08:00:00Z'}, {...source, submittedAt: '2026-11-04T08:00:00'},
      {...source, submittedAt: '2026-02-30T08:00:00Z'}, {...source, submittedAt: '2026-11-04T08:00:00.1234567890Z'},
      {...source, submittedAt: '2026-11-04T08:00:00+19:00'}, {...source, caseInstanceId: '\u1680'}, {...source, planItems: 'items'},
      {...source, planItems: [casePlanItem({availableActions: ['START', 'START']})]},
      {...source, planItems: [casePlanItem(), casePlanItem({planItemInstanceId: 'primary-1', planItemDefinitionKey: 'otherTask'})]},
      {...source, planItems: [casePlanItem(), casePlanItem({planItemInstanceId: 'other-1', planItemDefinitionKey: 'primaryTask'})]},
      {...source, planItems: [casePlanItem({kind: 'MILESTONE', availableActions: ['START']})]},
      {...source, planItems: [missingItemState]}, {...source, planItems: [missingItemActions]}, {...source, planItems: seventeenItems},
      {...source, status: 'COMPLETED', finishedAt: '2026-11-04T08:30:00Z', planItems: [casePlanItem()]}, [], null,
    ]
    for (const value of invalid) {
      const fetcher = vi.fn().mockResolvedValue(json(value)); vi.stubGlobal('fetch', fetcher)
      await expect(casesApi.get('20', {caseInstanceId: source.caseInstanceId})).rejects.toThrow('服务返回的案件数据无效')
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
  })

  it('accepts sparse terminal snapshots and preserves Java-compatible IDs, offsets, and nanoseconds', async () => {
    const terminal = caseInstance({caseInstanceId: 'case\u00a0', businessKey: 'expense\ufeff', status: 'COMPLETED',
      submittedAt: '2026-11-04T16:00:00.123456789+08:00', finishedAt: '2026-11-04T08:30:00.000000001Z',
      planItems: [casePlanItem({state: 'AVAILABLE', availableActions: []})]})
    const emptyTerminal = caseInstance({caseInstanceId: 'case-empty', status: 'TERMINATED', finishedAt: '2026-11-04T08:31:00Z', planItems: []})
    const fetcher = vi.fn().mockResolvedValueOnce(json(terminal)).mockResolvedValueOnce(json(emptyTerminal)); vi.stubGlobal('fetch', fetcher)
    await expect(casesApi.get('20', {caseInstanceId: terminal.caseInstanceId})).resolves.toEqual(terminal)
    await expect(casesApi.get('20', {caseInstanceId: emptyTerminal.caseInstanceId})).resolves.toEqual(emptyTerminal)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('accepts all four immutable transitions while binding the result to the captured Case and command', async () => {
    for (const action of ['DISABLE', 'ENABLE', 'START', 'TERMINATE'] as const) {
      const [current, currentCommand] = actionSource(action)
      const result = caseOperationResult(currentCommand)
      const fetcher = vi.fn().mockResolvedValue(json(result)); vi.stubGlobal('fetch', fetcher)
      await expect(casesApi.actPlanItem('20', currentCommand, current)).resolves.toEqual(result)
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
  })

  it('rejects invalid query and action snapshots before transport', async () => {
    const fetcher = vi.fn().mockResolvedValue(json(caseOperationResult(command))); vi.stubGlobal('fetch', fetcher)
    await rejected(() => casesApi.get('20', {caseInstanceId: ' case-1'}))
    await rejected(() => casesApi.get('20', {caseInstanceId: 'case-1', native: true} as unknown as {caseInstanceId: string}))
    await rejected(() => casesApi.get('20', {} as {caseInstanceId: string}))
    await rejected(() => casesApi.actPlanItem('20', {...command, commandId: '-bad'}, source))
    await rejected(() => casesApi.actPlanItem('20', {...command, native: true} as unknown as ActOnPlanItemCommand, source))
    const missingAction = {...command} as Record<string, unknown>; delete missingAction.action
    await rejected(() => casesApi.actPlanItem('20', missingAction as unknown as ActOnPlanItemCommand, source))
    await rejected(() => casesApi.actPlanItem('20', {...command, caseInstanceId: 'other'}, source))
    await rejected(() => casesApi.actPlanItem('20', {...command, planItemInstanceId: 'missing'}, source))
    await rejected(() => casesApi.actPlanItem('20', {...command, expectedVersion: '0'.repeat(64)}, source))
    await rejected(() => casesApi.actPlanItem('20', {...command, action: 'TERMINATE'}, source))
    await rejected(() => casesApi.actPlanItem('20', command, caseInstance({status: 'COMPLETED', finishedAt: '2026-11-04T08:30:00Z',
      planItems: [casePlanItem({availableActions: []})]})))
    await rejected(() => casesApi.actPlanItem('20', command, caseInstance({planItems: [casePlanItem(), casePlanItem()]})))
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects foreign operation metadata, illegal transitions, and same versions without replaying', async () => {
    const invalid: unknown[] = [
      {...caseOperationResult(command), commandId: 'other'}, {...caseOperationResult(command), caseInstanceId: 'other'},
      {...caseOperationResult(command), planItemInstanceId: 'other'}, {...caseOperationResult(command), planItemDefinitionKey: 'otherTask'},
      {...caseOperationResult(command), action: 'DISABLE'}, {...caseOperationResult(command), releaseVersion: 'other'},
      {...caseOperationResult(command), definitionKey: 'other'}, {...caseOperationResult(command), previousVersion: '0'.repeat(64)},
      {...caseOperationResult(command), previousState: 'DISABLED'}, {...caseOperationResult(command), resultingState: 'COMPLETED'},
      {...caseOperationResult(command), resultingVersion: command.expectedVersion}, {...caseOperationResult(command), occurredAt: '2026-11-04T08:02:00'},
      {...caseOperationResult(command), occurredAt: '2026-02-30T08:02:00Z'},
      {...caseOperationResult(command), occurredAt: '2026-11-04T08:02:00.1234567890Z'},
      {...caseOperationResult(command), occurredAt: '2026-11-04T08:02:00+19:00'},
      {...caseOperationResult(command), internalRevision: 7},
    ]
    const missingResult = {...caseOperationResult(command)} as Record<string, unknown>; delete missingResult.resultingState; invalid.push(missingResult)
    for (const result of invalid) {
      const fetcher = vi.fn().mockResolvedValue(json(result)); vi.stubGlobal('fetch', fetcher)
      await expect(casesApi.actPlanItem('20', command, source)).rejects.toThrow('服务返回的案件数据无效')
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
    const unavailable = vi.fn().mockResolvedValue(json({code: 'TIANJI_DEPENDENCY_UNAVAILABLE'}, 503)); vi.stubGlobal('fetch', unavailable)
    await expect(casesApi.actPlanItem('20', command, source)).rejects.toMatchObject({status: 503})
    expect(unavailable).toHaveBeenCalledTimes(1)
  })
})
