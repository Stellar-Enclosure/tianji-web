import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {humanTask, humanTaskPage, humanTaskReceipt} from '../test/humanTaskFixtures'
import {setAuthFailureHandler} from './client'
import {humanTasksApi, type ClaimHumanTaskCommand, type CompleteHumanTaskCommand, type ListHumanTasksQuery,
  type TransferHumanTaskCommand, type UnclaimHumanTaskCommand} from './humanTasks'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}})
const gatewayPath = (route: string): string => new URL(`${gatewayAuth.applicationBaseUrl.replace(/\/$/, '')}${route}`, 'https://example.test').pathname
const query: ListHumanTasksQuery = {scopeType: 'PROCESS', selection: 'ALL', releaseVersion: 'release-1', scopeId: 'process-1',
  taskDefinitionKey: 'managerReview', afterTaskId: null, limit: 20}
const source = humanTask()
const claimSource = humanTask({assigned: false, assignedToMe: false})
const claim: ClaimHumanTaskCommand = {commandId: 'claim-1', taskId: source.taskId, expectedVersion: source.version}
const unclaim: UnclaimHumanTaskCommand = {commandId: 'unclaim-1', taskId: source.taskId, expectedVersion: source.version}
const transfer: TransferHumanTaskCommand = {commandId: 'transfer-1', taskId: source.taskId, expectedVersion: source.version, targetLane: 'manager'}
const complete: CompleteHumanTaskCommand = {commandId: 'complete-1', taskId: source.taskId, expectedVersion: source.version,
  form: {approved: false, comment: '需补充票据', amount: 1200}}
const rejected = (call: () => unknown) => expect(Promise.resolve().then(call)).rejects.toThrow()

describe('Human task current-user JSON client', () => {
  beforeEach(() => {
    gatewayAuth.context.invalidate()
    vi.spyOn(gatewayAuth, 'csrf').mockResolvedValue({headerName: 'X-CSRF-TOKEN', token: 'test-csrf', expiresAt: new Date(Date.now() + 60_000).toISOString()})
  })
  afterEach(() => { gatewayAuth.context.invalidate(); setAuthFailureHandler(() => {}); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('uses only the six private POST routes with exact bodies, tenant affinity, CSRF, and the caller signal', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json(humanTaskPage()))
      .mockResolvedValueOnce(json(source))
      .mockResolvedValueOnce(json(humanTaskReceipt('CLAIM')))
      .mockResolvedValueOnce(json(humanTaskReceipt('UNCLAIM')))
      .mockResolvedValueOnce(json(humanTaskReceipt('TRANSFER', {lane: 'manager'})))
      .mockResolvedValueOnce(json(humanTaskReceipt('COMPLETE')))
    vi.stubGlobal('fetch', fetcher)

    await expect(humanTasksApi.query('20', query, controller.signal)).resolves.toEqual(humanTaskPage())
    await expect(humanTasksApi.get('20', {taskId: source.taskId}, controller.signal)).resolves.toEqual(source)
    await expect(humanTasksApi.claim('20', claim, claimSource, controller.signal)).resolves.toEqual(humanTaskReceipt('CLAIM'))
    await expect(humanTasksApi.unclaim('20', unclaim, source, controller.signal)).resolves.toEqual(humanTaskReceipt('UNCLAIM'))
    await expect(humanTasksApi.transfer('20', transfer, source, controller.signal)).resolves.toEqual(humanTaskReceipt('TRANSFER', {lane: 'manager'}))
    await expect(humanTasksApi.complete('20', complete, source, controller.signal)).resolves.toEqual(humanTaskReceipt('COMPLETE'))

    expect(fetcher).toHaveBeenCalledTimes(6)
    expect(fetcher.mock.calls.map(call => new URL(String(call[0]), 'https://example.test').pathname)).toEqual([
      '/api/tianji/v1/human-tasks/query', '/api/tianji/v1/human-tasks/get', '/api/tianji/v1/human-tasks/claim',
      '/api/tianji/v1/human-tasks/unclaim', '/api/tianji/v1/human-tasks/transfer', '/api/tianji/v1/human-tasks/complete',
    ].map(gatewayPath))
    const bodies = [query, {taskId: source.taskId}, claim, unclaim, transfer, complete]
    fetcher.mock.calls.forEach((call, index) => {
      const request = call[1] as RequestInit
      expect(request.method).toBe('POST')
      expect(request.signal).toBeInstanceOf(AbortSignal)
      expect(request.signal?.aborted).toBe(false)
      expect(JSON.parse(String(request.body))).toEqual(bodies[index])
      expect(request.credentials).toBe('include')
      expect(new Headers(request.headers).get('Authorization')).toBeNull()
      expect(new Headers(request.headers).get('X-CSRF-TOKEN')).toBe('test-csrf')
      expect(new Headers(request.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
    })
    controller.abort()
    fetcher.mock.calls.forEach(call => expect((call[1] as RequestInit).signal?.aborted).toBe(true))
    expect(fetcher.mock.calls.map(call => String(call[0]).includes('/admin/') || String(call[0]).includes('/approvals/verify'))).toEqual(Array(6).fill(false))
  })

  it('rejects unchecked foreign and malformed task projections after exactly one response', async () => {
    const reservedSchema = {...source, formSchema: {approved: 'BOOLEAN', true: 'BOOLEAN'}}
    const unknownSchemaType = {...source, formSchema: {approved: 'BOOLEAN', comment: 'FLAG'}}
    const oversizedSchema = {...source, formSchema: Object.fromEntries([['approved', 'BOOLEAN'],
      ...Array.from({length: 16}, (_, index) => [`field${index}`, 'STRING'])])}
    const missingApproval = {...source} as Record<string, unknown>; delete missingApproval.approvalField
    const missingVersion = {...source} as Record<string, unknown>; delete missingVersion.version
    const invalid: unknown[] = [
      {...source, taskId: 'other'}, {...source, nativeAssignee: 'private'}, {...source, assigned: 'true'}, {...source, assigned: false, assignedToMe: true},
      {...source, scopeType: 'WORKFLOW'}, {...source, kind: 'APPROVAL', approvalField: 'missing'}, {...source, kind: 'ACTION', approvalField: 'approved'},
      {...source, availableLanes: ['finance', 'finance']}, {...source, availableLanes: ['manager']}, {...source, version: 7},
      reservedSchema, unknownSchemaType, oversizedSchema, {...source, formSchema: {approved: null}}, missingApproval, missingVersion,
      {...source, taskId: 'bad\u0000id'}, {...source, taskId: ' task-1'}, {...source, taskId: '\u1680'}, {...source, name: '\ud800'},
      {...source, createdAt: '2026-11-04T08:00:00'}, {...source, createdAt: '2026-02-30T08:00:00Z'},
      {...source, createdAt: '2026-11-04T08:00:00.1234567890Z'}, {...source, createdAt: '2026-11-04T08:00:00+19:00'}, [], null,
    ]
    for (const value of invalid) {
      const fetcher = vi.fn().mockResolvedValue(json(value)); vi.stubGlobal('fetch', fetcher)
      await expect(humanTasksApi.get('20', {taskId: source.taskId})).rejects.toThrow('服务返回的任务数据无效')
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
  })

  it('normalizes only the codec-compatible missing nullable task and receipt fields', async () => {
    const actionSource = humanTask({kind: 'ACTION', approvalField: null})
    const taskWire = {...actionSource} as Record<string, unknown>
    delete taskWire.approvalField; delete taskWire.dueAt
    const receiptWire = {...humanTaskReceipt('CLAIM')} as Record<string, unknown>
    delete receiptWire.resultingVersion; receiptWire.resultingVersion = 'b'.repeat(64)
    delete receiptWire.approvalReceiptId; delete receiptWire.approved
    const fetcher = vi.fn().mockResolvedValueOnce(json(taskWire)).mockResolvedValueOnce(json(receiptWire)); vi.stubGlobal('fetch', fetcher)
    await expect(humanTasksApi.get('20', {taskId: actionSource.taskId})).resolves.toEqual({...actionSource, approvalField: null, dueAt: null})
    await expect(humanTasksApi.claim('20', claim, claimSource)).resolves.toEqual({...humanTaskReceipt('CLAIM'), approvalReceiptId: null, approved: null})
  })

  it('preserves the valid __proto__ schema key through response decoding and an exact complete request body', async () => {
    const protoSchema: Record<string, 'STRING'> = Object.fromEntries([['__proto__', 'STRING']])
    const protoSource = humanTask({taskId: 'task-proto', kind: 'ACTION', approvalField: null, formSchema: protoSchema})
    const protoForm: Record<string, string> = Object.fromEntries([['__proto__', 'preserved']])
    const protoCommand: CompleteHumanTaskCommand = {commandId: 'complete-proto', taskId: protoSource.taskId,
      expectedVersion: protoSource.version, form: protoForm}
    const protoReceipt = humanTaskReceipt('COMPLETE', {commandId: protoCommand.commandId, taskId: protoSource.taskId, kind: 'ACTION',
      approvalReceiptId: null, approved: null})
    const fetcher = vi.fn().mockResolvedValueOnce(json(protoSource)).mockResolvedValueOnce(json(protoReceipt)); vi.stubGlobal('fetch', fetcher)
    const decoded = await humanTasksApi.get('20', {taskId: protoSource.taskId})
    expect(Object.prototype.hasOwnProperty.call(decoded.formSchema, '__proto__')).toBe(true)
    expect(decoded.formSchema).toEqual(protoSchema)
    await expect(humanTasksApi.complete('20', protoCommand, decoded)).resolves.toEqual(protoReceipt)
    const sent = JSON.parse(String((fetcher.mock.calls[1][1] as RequestInit).body)) as {form: Record<string, unknown>}
    expect(Object.prototype.hasOwnProperty.call(sent.form, '__proto__')).toBe(true)
    expect(sent.form).toEqual(protoForm)
  })

  it('preserves Java-compatible Unicode identifiers, offsets, and nanoseconds without rewriting raw strings', async () => {
    const unicode = humanTask({taskId: 'task\u00a0', scopeId: 'scope\ufeff', name: '审批\u00a0',
      createdAt: '2026-11-04T16:00:00.123456789+08:00', dueAt: '2026-11-05T08:00:00.000000001Z'})
    const fetcher = vi.fn().mockResolvedValue(json(unicode)); vi.stubGlobal('fetch', fetcher)
    await expect(humanTasksApi.get('20', {taskId: unicode.taskId})).resolves.toEqual(unicode)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('validates query filters, bounded UTF-8 cursor order, continuation pages, and selection semantics', async () => {
    const emptyContinuation = humanTaskPage({items: [], nextAfterTaskId: 'scanned-z'})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(emptyContinuation)))
    await expect(humanTasksApi.query('20', query)).resolves.toEqual(emptyContinuation)

    const invalidPages: unknown[] = [
      {...humanTaskPage(), scopeType: 'CASE'}, {...humanTaskPage(), selection: 'ASSIGNED'},
      {...humanTaskPage(), items: [humanTask({scopeType: 'CASE'})]},
      {...humanTaskPage(), items: [humanTask({releaseVersion: 'other'})]},
      {...humanTaskPage(), items: [humanTask({scopeId: 'other'})]},
      {...humanTaskPage(), items: [humanTask({taskDefinitionKey: 'other'})]},
      {...humanTaskPage(), items: [humanTask({taskId: 'task-b'}), humanTask({taskId: 'task-a'})]},
      {...humanTaskPage(), items: [humanTask(), humanTask()]},
      {...humanTaskPage(), nextAfterTaskId: 'task-0'},
      {...humanTaskPage(), items: Array.from({length: 21}, (_, index) => humanTask({taskId: `task-${String(index).padStart(2, '0')}`}))},
      {...humanTaskPage(), nativeCursor: 'private'},
    ]
    const missingNext = {...humanTaskPage()} as Record<string, unknown>; delete missingNext.nextAfterTaskId
    invalidPages.push(missingNext)
    for (const page of invalidPages) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(page)))
      await expect(humanTasksApi.query('20', query)).rejects.toThrow('服务返回的任务数据无效')
    }

    const assignedQuery = {...query, selection: 'ASSIGNED'} as const
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(humanTaskPage({selection: 'ASSIGNED', items: [humanTask({assignedToMe: false})]}))))
    await expect(humanTasksApi.query('20', assignedQuery)).rejects.toThrow('服务返回的任务数据无效')
    const candidateQuery = {...query, selection: 'CANDIDATE'} as const
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(humanTaskPage({selection: 'CANDIDATE', items: [humanTask({assigned: true})]}))))
    await expect(humanTasksApi.query('20', candidateQuery)).rejects.toThrow('服务返回的任务数据无效')

    const unicodeQuery = {...query, releaseVersion: null, scopeId: null, taskDefinitionKey: null}
    const utf8Ordered = humanTaskPage({items: [humanTask({taskId: 'id-\ue000'}), humanTask({taskId: 'id-\u{10000}'})], nextAfterTaskId: 'id-\u{10001}'})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(utf8Ordered)))
    await expect(humanTasksApi.query('20', unicodeQuery)).resolves.toEqual(utf8Ordered)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({...utf8Ordered, items: [...utf8Ordered.items].reverse()})))
    await expect(humanTasksApi.query('20', unicodeQuery)).rejects.toThrow('服务返回的任务数据无效')
    const afterQuery = {...unicodeQuery, afterTaskId: 'id-\u{10001}'}
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(humanTaskPage({items: [], nextAfterTaskId: afterQuery.afterTaskId}))))
    await expect(humanTasksApi.query('20', afterQuery)).rejects.toThrow('服务返回的任务数据无效')
  })

  it('rejects invalid requests and source-ineligible actions before transport', async () => {
    const fetcher = vi.fn().mockResolvedValue(json(humanTaskPage())); vi.stubGlobal('fetch', fetcher)
    const missingCursor = {...query} as Record<string, unknown>; delete missingCursor.afterTaskId
    for (const invalidQuery of [{...query, limit: 0}, {...query, limit: 51}, {...query, releaseVersion: '-bad'},
      {...query, taskDefinitionKey: 'bad key'}, {...query, afterTaskId: ' cursor'}, {...query, nativeCursor: 'private'}, missingCursor]) {
      await rejected(() => humanTasksApi.query('20', invalidQuery as unknown as ListHumanTasksQuery))
    }
    await rejected(() => humanTasksApi.get('20', {taskId: ' task-1'}))
    await rejected(() => humanTasksApi.get('20', {taskId: source.taskId, native: true} as unknown as {taskId: string}))
    await rejected(() => humanTasksApi.claim('20', claim, source))
    await rejected(() => humanTasksApi.claim('20', {...claim, native: true} as unknown as ClaimHumanTaskCommand, claimSource))
    await rejected(() => humanTasksApi.unclaim('20', unclaim, humanTask({assigned: false, assignedToMe: false})))
    await rejected(() => humanTasksApi.transfer('20', {...transfer, targetLane: 'unknown'}, source))
    await rejected(() => humanTasksApi.complete('20', complete, humanTask({suspended: true})))
    await rejected(() => humanTasksApi.complete('20', {...complete, form: {approved: false, comment: 'ok'}}, source))
    await rejected(() => humanTasksApi.complete('20', {...complete, form: {...complete.form, extra: 'not declared'}}, source))
    await rejected(() => humanTasksApi.complete('20', {...complete, form: {...complete.form, amount: 1_000_000_000_000_000}}, source))
    await rejected(() => humanTasksApi.complete('20', {...complete, form: {...complete.form, amount: -1_000_000_000_000_000}}, source))
    await rejected(() => humanTasksApi.complete('20', {...complete, form: {...complete.form, amount: 1.5}}, source))
    await rejected(() => humanTasksApi.complete('20', {...complete, form: {...complete.form, amount: '1e3'}}, source))
    await rejected(() => humanTasksApi.complete('20', {...complete, form: {...complete.form, comment: 'x'.repeat(1025)}}, source))
    await rejected(() => humanTasksApi.complete('20', {...complete, form: {...complete.form, comment: 'bad\u0000text'}}, source))
    await rejected(() => humanTasksApi.complete('20', {...complete, form: {...complete.form, comment: '\ud800'}}, source))
    await rejected(() => humanTasksApi.complete('20', {...complete, form: {...complete.form, approved: undefined}} as unknown as CompleteHumanTaskCommand, source))
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('accepts explicit false, empty and 1024-unit strings, and both fifteen-digit integer boundaries', async () => {
    const maximum: CompleteHumanTaskCommand = {...complete, commandId: 'complete-max', form: {approved: false, comment: 'x'.repeat(1024), amount: 999_999_999_999_999}}
    const minimum: CompleteHumanTaskCommand = {...complete, commandId: 'complete-min', form: {approved: false, comment: '', amount: -999_999_999_999_999}}
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json(humanTaskReceipt('COMPLETE', {commandId: maximum.commandId, approved: false})))
      .mockResolvedValueOnce(json(humanTaskReceipt('COMPLETE', {commandId: minimum.commandId, approved: false})))
    vi.stubGlobal('fetch', fetcher)
    await expect(humanTasksApi.complete('20', maximum, source)).resolves.toEqual(humanTaskReceipt('COMPLETE', {commandId: maximum.commandId, approved: false}))
    await expect(humanTasksApi.complete('20', minimum, source)).resolves.toEqual(humanTaskReceipt('COMPLETE', {commandId: minimum.commandId, approved: false}))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('binds every receipt to the exact command and captured source without retrying a mutation', async () => {
    const invalidComplete = [
      {...humanTaskReceipt('COMPLETE'), commandId: 'other'}, {...humanTaskReceipt('COMPLETE'), taskId: 'other'},
      {...humanTaskReceipt('COMPLETE'), action: 'CLAIM'}, {...humanTaskReceipt('COMPLETE'), scopeId: 'other'},
      {...humanTaskReceipt('COMPLETE'), releaseVersion: 'other'}, {...humanTaskReceipt('COMPLETE'), previousVersion: 'b'.repeat(64)},
      {...humanTaskReceipt('COMPLETE'), resultingVersion: 'b'.repeat(64)}, {...humanTaskReceipt('COMPLETE'), approved: true},
      {...humanTaskReceipt('COMPLETE'), approvalReceiptId: null}, {...humanTaskReceipt('COMPLETE'), occurredAt: '2026-11-04T08:01:00'},
      {...humanTaskReceipt('COMPLETE'), occurredAt: '2026-02-30T08:01:00Z'},
      {...humanTaskReceipt('COMPLETE'), occurredAt: '2026-11-04T08:01:00.1234567890Z'},
      {...humanTaskReceipt('COMPLETE'), occurredAt: '2026-11-04T08:01:00+19:00'},
    ]
    for (const receipt of invalidComplete) {
      const fetcher = vi.fn().mockResolvedValue(json(receipt)); vi.stubGlobal('fetch', fetcher)
      await expect(humanTasksApi.complete('20', complete, source)).rejects.toThrow('服务返回的任务数据无效')
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
    const transferFetcher = vi.fn().mockResolvedValue(json(humanTaskReceipt('TRANSFER', {lane: 'finance'}))); vi.stubGlobal('fetch', transferFetcher)
    await expect(humanTasksApi.transfer('20', transfer, source)).rejects.toThrow('服务返回的任务数据无效')
    expect(transferFetcher).toHaveBeenCalledTimes(1)
    const unavailable = vi.fn().mockResolvedValue(json({code: 'TIANJI_DEPENDENCY_UNAVAILABLE'}, 503)); vi.stubGlobal('fetch', unavailable)
    await expect(humanTasksApi.complete('20', complete, source)).rejects.toMatchObject({status: 503})
    expect(unavailable).toHaveBeenCalledTimes(1)
  })
})
