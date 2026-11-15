import {webcrypto} from 'node:crypto'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {parseAutomationGraph, parseStartOverridesJson, parseStartVariablesJson, processAutomationApi,
  startRequestSha256} from './processAutomation'

const digest = 'a'.repeat(64)
const timestamp = '2026-11-12T08:40:00.123456Z'
const instanceId = 'pi-一'
const graph = {
  definitionKey: 'autoFlow',
  nodes: [{id: 'start', kind: 'START', name: '开始'}, {id: 'end', kind: 'END', name: '结束'}],
  edges: [{id: 'done', source: 'start', target: 'end', label: null}],
}
const instance = {
  instanceId, definitionKey: 'autoFlow', releaseVersion: 'auto-2', activationRevision: 2, profile: 'AUTOMATION_V2',
  businessKey: 'order-101', correlationId: 'corr-101', state: 'ACTIVE', version: digest, configurationSha256: digest,
  submittedAt: timestamp, finishedAt: null, output: null, availableActions: ['CANCEL'], graph,
}
const start = {
  definitionKey: 'autoFlow', businessKey: 'order-101', commandId: 'start-101', correlationId: 'corr-101', variables: {},
}
const decimal = (amount: string, version = 999_999_999_999_999) => ({
  ...start,
  variables: {'10': '十', '2': '二', amount, 'é': '\n', '\u{10000}': true, '\uE000': null},
  agentTaskOverrides: {agentNode: {templateRef: {key: 'template', version, contentSha256: digest}}},
})
const node = {
  nodeId: 'extract', occurrenceId: 'occ-101', attempt: 1, nodeExecutionRef: 'nx-101', kind: 'AGENT', state: 'WAIT_RECOVERY',
  inputSha256: digest, outputSchemaSha256: digest, startedAt: timestamp, finishedAt: null, deadlineAt: '2026-11-12T08:42:00Z',
  errorCode: null, sideEffectOutcome: 'UNKNOWN', agentRunId: null, output: null, eventReceiptIds: ['receipt-1'],
  version: 'opaque v3', availableActions: ['RETRY'],
}
const page = {instanceId, releaseVersion: 'auto-2', observedAt: timestamp, items: [node], nextCursor: 'next_1'}
const retry = {commandId: 'retry-1', nodeExecutionRef: 'nx-101', expectedVersion: node.version, reason: '权威证据已核验', businessReceiptRef: null}
const scheduled = {commandId: 'retry-1', instanceId, occurrenceId: 'occ-101', attempt: 2, nodeExecutionRef: 'nx-102', state: 'SCHEDULED'}
const cancel = {instanceId, commandId: 'cancel-1', expectedVersion: digest, reason: '用户要求终止'}
const cancelled = {
  instanceId, commandId: 'cancel-1', accepted: false, status: 'COMPLETED', resultingVersion: digest,
  finishedAt: '2026-11-12T08:40:00.123456789Z', decidedAt: timestamp, linkedAgentClosureScheduled: false,
}
const v2 = '/api/tianji/v2/process-instances'
const encodedInstanceId = encodeURIComponent(instanceId)

function stub(value: unknown, status = 200) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(value),
    {status, headers: {'Content-Type': 'application/json'}}))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

function requestFor(fetcher: ReturnType<typeof stub>) {
  expect(fetcher).toHaveBeenCalledTimes(1)
  const [url, init] = fetcher.mock.calls[0]
  const uri = new URL(String(url), 'https://example.test')
  const prefix = new URL(gatewayAuth.applicationBaseUrl, 'https://example.test').pathname.replace(/\/$/, '')
  const headers = new Headers(init?.headers)
  expect(init).toMatchObject({cache: 'no-store', credentials: 'include'})
  expect(headers.get('X-Egon-Tianji-Tenant')).toBe('20')
  expect(headers.get('Authorization')).toBeNull()
  if (init?.method === 'POST') expect(headers.get('X-CSRF-TOKEN')).toBe('test-csrf')
  return {path: uri.pathname.slice(prefix.length), query: uri.search, init}
}

describe('Versioned process automation client', () => {
  beforeEach(() => {
    gatewayAuth.context.invalidate()
    vi.stubGlobal('crypto', webcrypto)
    vi.spyOn(gatewayAuth, 'csrf').mockResolvedValue({headerName: 'X-CSRF-TOKEN', token: 'test-csrf', expiresAt: new Date(Date.now() + 60_000).toISOString()})
  })
  afterEach(() => { gatewayAuth.context.invalidate(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('sends an exact START command once and returns the server-selected release and activation', async () => {
    const fetcher = stub(instance)
    const controller = new AbortController()
    await expect(processAutomationApi.start('20', start, controller.signal)).resolves.toEqual(instance)
    const request = requestFor(fetcher)
    expect(request).toMatchObject({path: v2, query: '', init: {method: 'POST'}})
    expect(JSON.parse(String(request.init?.body))).toEqual(start)
    controller.abort()
    expect(request.init?.signal?.aborted).toBe(true)
  })

  it('reads only the versioned instance and node query and retains the occurrence, attempt and opaque version', async () => {
    const get = stub(instance)
    await expect(processAutomationApi.get('20', instanceId)).resolves.toEqual(instance)
    expect(requestFor(get)).toMatchObject({path: v2 + '/' + encodedInstanceId, query: '', init: {method: 'GET'}})
    const list = stub(page)
    await expect(processAutomationApi.listNodeExecutions('20', instanceId, {nodeId: 'extract', cursor: 'next_1', limit: 20}))
      .resolves.toEqual(page)
    expect(requestFor(list)).toMatchObject({path: v2 + '/' + encodedInstanceId + '/node-executions',
      query: '?nodeId=extract&cursor=next_1&limit=20', init: {method: 'GET'}})
    expect(list.mock.calls[0][1]?.body).toBeUndefined()
  })

  it('checks node responses against the filter sent on the original request', async () => {
    const fetcher = stub(page)
    const filter = {nodeId: 'extract', limit: 20}
    const pending = processAutomationApi.listNodeExecutions('20', instanceId, filter)
    filter.nodeId = 'different'
    filter.limit = 0
    await expect(pending).resolves.toEqual(page)
    expect(requestFor(fetcher).query).toBe('?nodeId=extract&limit=20')

    stub(page)
    await expect(processAutomationApi.listNodeExecutions('20', instanceId, {nodeId: 'different'})).rejects.toThrow()
  })

  it('accepts only HTTP 202 with exact SCHEDULED evidence and preserves write errors without replay', async () => {
    const fetcher = stub(scheduled, 202)
    await expect(processAutomationApi.retryNode('20', instanceId, retry)).resolves.toEqual(scheduled)
    const request = requestFor(fetcher)
    expect(request).toMatchObject({path: v2 + '/' + encodedInstanceId + '/node-retries', query: '', init: {method: 'POST'}})
    expect(JSON.parse(String(request.init?.body))).toEqual(retry)
    for (const [result, status] of [[scheduled, 200], [{...scheduled, state: 'COMPLETED'}, 202],
      [{...scheduled, commandId: 'retry-other'}, 202]] as const) {
      stub(result, status)
      await expect(processAutomationApi.retryNode('20', instanceId, retry)).rejects.toThrow()
    }
    for (const status of [400, 409, 503]) {
      const failed = stub({code: 'TIANJI_NODE_RETRY_REJECTED', correlationId: null}, status)
      await expect(processAutomationApi.retryNode('20', instanceId, retry)).rejects.toMatchObject({status, code: 'TIANJI_NODE_RETRY_REJECTED'})
      expect(failed).toHaveBeenCalledTimes(1)
    }
  })

  it('reads the owner-gated V1 control version and rejects inconsistent control snapshots', async () => {
    const controlVersion = 'b'.repeat(64)
    const process = {
      instanceId, definitionKey: 'autoFlow', releaseVersion: 'auto-2', businessKey: 'order-101', correlationId: 'corr-101',
      status: 'ACTIVE', submittedAt: timestamp, finishedAt: null,
    }
    const waits = [{activityKey: 'agent', kind: 'AGENT_RESULT_WAIT', occurrences: 1},
      {activityKey: 'work', kind: 'EXTERNAL_WORKER', occurrences: 1}]
    const control = {
      process, activeWaits: waits, allowedActions: ['CANCEL'], cancellationBlockReason: 'NONE',
      version: controlVersion, observedAt: timestamp,
    }
    const controller = new AbortController()
    const fetcher = stub(control)
    const result = await processAutomationApi.getControl('20', instanceId, controller.signal)
    expect(result).toEqual(control)
    const request = requestFor(fetcher)
    expect(request).toMatchObject({path: '/api/tianji/v1/process-instances/' + encodedInstanceId + '/control',
      query: '', init: {method: 'GET'}})
    expect(request.init?.body).toBeUndefined()
    controller.abort()
    expect(request.init?.signal?.aborted).toBe(true)
    const blocked = {...control, cancellationBlockReason: 'MODEL_CONTAINS_CASE_SOURCE', allowedActions: []}
    stub(blocked)
    await expect(processAutomationApi.getControl('20', instanceId)).resolves.toEqual(blocked)
    const terminal = {...control, process: {...process, status: 'CANCELLED', finishedAt: timestamp},
      cancellationBlockReason: 'PROCESS_TERMINAL', activeWaits: [], allowedActions: []}
    stub(terminal)
    await expect(processAutomationApi.getControl('20', instanceId)).resolves.toEqual(terminal)
    for (const invalid of [
      {...control, process: {...process, instanceId: 'different'}}, {...control, process: {...process, privateField: 'unexpected'}},
      {...control, activeWaits: [...waits].reverse()}, {...control, activeWaits: [...waits, waits[1]]},
      {...control, activeWaits: [{...waits[0], occurrences: 256}, waits[1]]}, {...control, allowedActions: []},
      {...blocked, allowedActions: ['CANCEL']}, {...terminal, activeWaits: [waits[0]]}, {...terminal, process},
    ]) {
      stub(invalid)
      await expect(processAutomationApi.getControl('20', instanceId)).rejects.toThrow()
    }

    for (const status of [403, 404]) {
      const failed = stub({}, status)
      await expect(processAutomationApi.getControl('20', instanceId)).rejects.toMatchObject({status})
      expect(failed).toHaveBeenCalledTimes(1)
    }
    const write = stub(cancelled)
    await expect(processAutomationApi.cancel('20', instanceId, {...cancel, expectedVersion: result.version})).resolves.toEqual(cancelled)
    expect(JSON.parse(String(requestFor(write).init?.body)).expectedVersion).toBe(controlVersion)
  })

  it('retains V1 cancellation route and accepts a terminal no-op with independent timestamps', async () => {
    const fetcher = stub(cancelled)
    await expect(processAutomationApi.cancel('20', instanceId, cancel)).resolves.toEqual(cancelled)
    const request = requestFor(fetcher)
    expect(request).toMatchObject({path: '/api/tianji/v1/process-instances/' + encodedInstanceId + '/cancellations',
      query: '', init: {method: 'POST'}})
    expect(JSON.parse(String(request.init?.body))).toEqual(cancel)
    stub({...cancelled, linkedAgentClosureScheduled: true})
    await expect(processAutomationApi.cancel('20', instanceId, cancel)).rejects.toThrow()
    const badPath = stub(cancelled)
    await expect(processAutomationApi.cancel('20', 'different', cancel)).rejects.toThrow()
    expect(badPath).not.toHaveBeenCalled()
  })

  it('rejects unknown graph fields and broken endpoints, and screens closed instance and node projections', async () => {
    expect(parseAutomationGraph(graph)).toEqual(graph)
    expect(() => parseAutomationGraph({...graph, deploymentId: 'internal'})).toThrow()
    expect(() => parseAutomationGraph({...graph, nodes: [...graph.nodes, graph.nodes[0]]})).toThrow()
    expect(() => parseAutomationGraph({...graph, edges: [{...graph.edges[0], target: 'missing'}]})).toThrow()
    for (const invalid of [
      {...instance, activationRevision: 1_000_000_000_000_000}, {...instance, output: {internalData: true}},
      {...instance, configurationSha256: 'invalid'}, {...instance, instanceId: 'different'},
      {...instance, graph: {...graph, nodes: [{...graph.nodes[0], nativeId: 'internal'}]}}
    ]) {
      stub(invalid)
      await expect(processAutomationApi.get('20', instanceId)).rejects.toThrow()
    }
    for (const invalid of [
      {...node, attempt: 11}, {...node, input: {}}, {...node, state: 'RUNNING'}, {...node, kind: 'SERVICE', agentRunId: 'run-1'},
    ]) {
      stub({...page, items: [invalid]})
      await expect(processAutomationApi.listNodeExecutions('20', instanceId)).rejects.toThrow()
    }
  })

  it('matches the Java length-framed digest for both decimal literals and only defaults omitted overrides', async () => {
    await expect(startRequestSha256(decimal('1.00'))).resolves.toBe('7cfa4c0086eaadc9837ce74cbf54d7420a290d50fdad3d30db4ed485ff411323')
    await expect(startRequestSha256(decimal('1.0'))).resolves.toBe('8758777d98df5e731e4ac50e896692e0cec31a15d4b00236c0d388399c82bac2')
    expect(await startRequestSha256(start)).toBe(await startRequestSha256({...start, agentTaskOverrides: {}}))
    expect(await startRequestSha256(start)).toBe(await startRequestSha256({...start, commandId: 'second-attempt'}))
    const withArray = (values: readonly number[]) => startRequestSha256({...start, variables: {values}})
    expect(await withArray([1, 2])).not.toBe(await withArray([2, 1]))
  })

  it('rejects malformed START before digesting or dispatching and rejects malformed filters before reading', async () => {
    const fetcher = stub(instance)
    const overrides = {...start, agentTaskOverrides: null}
    await expect(startRequestSha256(overrides)).rejects.toThrow()
    for (const invalid of [
      {...start, releaseVersion: 'auto-2'}, {...start, channel: 'old'}, {...start, activationRevision: 1},
      {...start, tenant: '21'}, {...start, authorization: 'ignored'}, {...start, commandId: 'evt-v2-reserved'},
      {...start, variables: {amount: Number.MAX_SAFE_INTEGER + 1}}, {...start, variables: {amount: 1_000_000_000_000_000}},
      {...start, variables: {amount: 1.5}}, {...start, variables: {bad: '\uD800'}}, {...start, variables: {'\u0000': true}},
      {...start, variables: {nonData: new Date()}}, decimal('1.0', 1_000_000_000_000_000),
    ]) {
      await expect(startRequestSha256(invalid)).rejects.toThrow()
    }
    const forbiddenFields = {...start, releaseVersion: 'auto-2'}
    await expect(processAutomationApi.start('20', forbiddenFields)).rejects.toThrow()
    await expect(processAutomationApi.listNodeExecutions('20', instanceId, {cursor: 'bad/cursor'})).rejects.toThrow()
    const foreignFilter = {limit: 20, releaseVersion: 'auto-2'}
    await expect(processAutomationApi.listNodeExecutions('20', instanceId, foreignFilter)).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects raw duplicate keys including escaped equivalents and nonintegral numeric tokens before they are lost', () => {
    const value = {variables: [{value: 12}, {value: '1.00'}], text: '{"value":6e1}'}
    expect(parseStartVariablesJson(' ' + JSON.stringify(value) + ' ')).toEqual(value)
    for (const raw of [
      '{"key":1,"key":2}', '{"data":[{"key":1,"k\\u0065y":2}]}', '{"number":1.0}', '{"number":1e0}',
      '{"number":1.000000000000000001}', '{"number":1e-3000}', '{"number":1000000000000000}', '{"bad":"\\ud800"}',
      '{"missing":}', '[]',
    ]) expect(() => parseStartVariablesJson(raw)).toThrow()
  })

  it('validates the raw START override object with its independent UTF-8 budget', async () => {
    const overrides = {agentNode: {parameters: {amount: '1.00', text: '中'.repeat(24 * 1024)}}}
    const source = JSON.stringify(overrides)
    const checked = parseStartOverridesJson(source)
    expect(checked).toEqual(overrides)
    expect(() => parseStartVariablesJson(source)).toThrow()
    await expect(startRequestSha256({...start, agentTaskOverrides: checked})).resolves.toMatch(/^[a-f0-9]{64}$/)
    const overflow = {agentNode: {parameters: {text: '中'.repeat(88 * 1024)}}}
    expect(() => parseStartOverridesJson(JSON.stringify(overflow))).toThrow()
  })

  it('rejects duplicate escaped keys, fractional tokens and unknown fields in raw overrides', () => {
    for (const source of [
      'null',
      '{"agentNode":null}',
      '{"agentNode":{}}',
      '{"agentNode":{"parameters":{},"extra":0}}',
      '{"agentNode":{"parameters":{"number":1,"\\u006eumber":2}}}',
      '{"agentNode":{"parameters":{"number":1.000000000000000001}}}',
      '{"agentNode":{"parameters":{"number":1e0}}}',
    ]) expect(() => parseStartOverridesJson(source)).toThrow()
  })
})
