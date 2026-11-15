import {beforeEach, describe, expect, it, vi} from 'vitest'
import {requestJson} from './client'
import {processActivationsApi} from './processActivations'

vi.mock('./client', () => ({requestJson: vi.fn()}))
const request = vi.mocked(requestJson)

const manifests = {
  sourceManifestSha256: 'a'.repeat(64),
  compiledManifestSha256: 'b'.repeat(64),
  dependencyManifestSha256: 'c'.repeat(64),
}
const activatedAt = '2026-11-12T08:35:00.123456Z'
const graph = {
  definitionKey: 'flow',
  nodes: [{id: 'start', kind: 'START', name: '开始'}, {id: 'end', kind: 'END', name: '结束'}],
  edges: [{id: 'flowToEnd', source: 'start', target: 'end', label: null}],
}
const objectSchema = {type: 'object', properties: {}, required: [], additionalProperties: false}
const artifact = {
  profile: 'AUTOMATION_V2',
  models: [{type: 'BPMN', definitionKey: 'flow', xml: '<definitions/>'}],
  inputSchema: objectSchema,
  outputSchema: objectSchema,
  nodeBindings: [],
  eventRoutes: [],
}
const retry = {maxAttempts: 2, backoff: 'PT0S', retryableCodes: ['TECHNICAL']}
const policy = {
  nodeTimeout: 'PT2M', attemptTimeout: 'PT1M', dispatchTimeout: 'PT15S',
  onFailure: {action: 'END', branchTarget: null}, onAttemptTimeout: {action: 'RETRY'},
  onNodeTimeout: {action: 'END'}, retry, cancel: 'BEST_EFFORT_STOP', onUnknownEffect: 'WAIT_RECOVERY',
}
const release = {
  releaseVersion: 'auto-1',
  ...manifests,
  compilerVersion: 'automation-bpmn-2',
  artifact,
  graph,
  sourceDraftId: 'pd-101',
  sourceDraftRevision: 7,
}
const command = {releaseVersion: 'auto-1', expectedActivationRevision: 0, commandId: 'intent:activate-1'}
const receipt = {
  ...command, ...manifests, definitionKey: 'flow', revision: 1, previousRevision: null, activatedAt,
}
const pointer = {revision: 2, releaseVersion: 'auto-2', activatedAt}
const page = {
  definitionKey: 'flow', observedAt: '2026-11-12T08:36:00Z', current: pointer, items: [receipt], nextCursor: null,
}
const activationPath = '/api/tianji/v2/process-definitions/flow/activations'

beforeEach(() => request.mockReset())

describe('Process activation client', () => {
  it('reads the exact v2 released design and preserves independently named digests and graph', async () => {
    const signal = new AbortController().signal
    request.mockResolvedValueOnce(release)

    await expect(processActivationsApi.getRelease('20', 'auto-1', signal)).resolves.toEqual(release)
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/tianji/v2/process-releases/auto-1',
      '20', {method: 'GET', cache: 'no-store', signal}, 200)
  })

  it('accepts bounded patterns, special bindings and the fixed event route inside a released design', async () => {
    const rich = {
      ...release,
      artifact: {
        ...artifact,
        inputSchema: {
          ...objectSchema,
          required: ['amount'],
          properties: {
            amount: {type: 'string', format: 'decimal:2', pattern: '^[0-9]{1,10}[.][0-9]{2}$'},
            values: {type: 'array', items: {type: 'integer', minimum: -1, maximum: 2}, maxItems: 8},
          },
        },
        nodeBindings: [{
          nodeId: 'batched', kind: 'MULTI_INSTANCE', inputSchema: objectSchema, outputSchema: objectSchema,
          inputMapping: [{target: 'values', source: 'scope.values'}], outputMapping: [], policy,
          control: {
            itemsSource: 'input.values', sequential: false, maxItems: 8,
            completionCondition: {op: 'GT', args: [{path: 'summary.count'}, {literal: 2}]},
          },
          merge: [{target: 'results', sourceNodeIds: ['batched'], reducer: 'COLLECT_INDEXED'}],
        }, {
          nodeId: 'service', kind: 'SERVICE', inputSchema: objectSchema, outputSchema: objectSchema,
          inputMapping: [], outputMapping: [], policy,
          service: {
            capabilityKey: '_billing', version: 3, inputSchemaSha256: manifests.sourceManifestSha256,
            outputSchemaSha256: manifests.compiledManifestSha256, effectMode: 'READ_ONLY',
          },
        }],
        eventRoutes: [{
          routeKey: 'scheduled', version: 1, type: '_BILLING', mode: 'START', sourceRef: 'producer',
          payloadSchema: objectSchema, mapping: [{target: 'amount', source: 'event.amount'}], ttl: 'P1D',
          targetDefinitionKey: 'flow', schedule: {startAt: activatedAt, interval: 'PT1H', maxOccurrences: 2},
        }],
      },
    }
    request.mockResolvedValueOnce(rich)
    await expect(processActivationsApi.getRelease('20', 'auto-1')).resolves.toEqual(rich)

    const [binding, service] = rich.artifact.nodeBindings
    const [route] = rich.artifact.eventRoutes
    for (const badArtifact of [
      {...rich.artifact, nodeBindings: [{...binding, merge: undefined}]},
      {...rich.artifact, nodeBindings: [{...service, service: {...service.service, capabilityKey: 'billing:read'}}]},
      {...rich.artifact, eventRoutes: [{...route, mode: 'SIGNAL', targetNodeId: 'wait'}]},
      ...['(a|b)', '[z-a]', 'a{128}b', 'a{5,2}', 'a+', 'a$tail'].map(pattern => ({
        ...rich.artifact, inputSchema: {...objectSchema, properties: {amount: {type: 'string', pattern}}},
      })),
      {...rich.artifact, inputSchema: {...objectSchema, properties: {amount: {type: 'string', format: 'decimal:19'}}}},
    ]) {
      request.mockResolvedValueOnce({...rich, artifact: badArtifact})
      await expect(processActivationsApi.getRelease('20', 'auto-1')).rejects.toThrow()
    }
  })

  it('reports an empty history and absent current pointer explicitly', async () => {
    const signal = new AbortController().signal
    const empty = {...page, current: null, items: []}
    request.mockResolvedValueOnce(empty)

    await expect(processActivationsApi.list('20', 'flow', {limit: 20}, signal)).resolves.toEqual(empty)
    expect(request).toHaveBeenCalledExactlyOnceWith(activationPath + '?limit=20',
      '20', {method: 'GET', cache: 'no-store', signal}, 200)
  })

  it('looks up only the original actor command and preserves a newer current pointer', async () => {
    request.mockResolvedValueOnce(page).mockResolvedValueOnce({...page, items: []})

    await expect(processActivationsApi.list('20', 'flow', {commandId: command.commandId})).resolves.toEqual(page)
    await expect(processActivationsApi.list('20', 'flow', {commandId: 'intent:unknown'}))
      .resolves.toEqual({...page, items: []})
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      activationPath + '?commandId=intent%3Aactivate-1', activationPath + '?commandId=intent%3Aunknown',
    ])
  })

  it('reads bounded ordinary history with the requested opaque cursor', async () => {
    const cursor = 'a'.repeat(2048)
    const partial = {...page, nextCursor: 'next-cursor'}
    request.mockResolvedValueOnce(partial)
    await expect(processActivationsApi.list('20', 'flow', {cursor, limit: 1})).resolves.toEqual(partial)
    expect(request).toHaveBeenCalledExactlyOnceWith(activationPath + '?cursor=' + cursor + '&limit=1',
      '20', {method: 'GET', cache: 'no-store', signal: undefined}, 200)
  })

  it('posts only the exact activation command including zero for the first revision', async () => {
    const signal = new AbortController().signal
    request.mockResolvedValueOnce(receipt)

    await expect(processActivationsApi.activate('20', 'flow', command, signal)).resolves.toEqual(receipt)
    expect(request).toHaveBeenCalledExactlyOnceWith(activationPath, '20', {
      method: 'POST', cache: 'no-store', signal, headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(command),
    }, 200)
  })

  it('propagates authorization, resource, availability and CAS errors without a second request', async () => {
    for (const status of [401, 403, 404, 503]) {
      const failure = {status}
      request.mockImplementationOnce(async () => { throw failure })
      await expect(processActivationsApi.list('20', 'flow', {})).rejects.toBe(failure)
    }
    const conflict = {status: 409, code: 'TIANJI_PROCESS_VERSION_CONFLICT'}
    request.mockImplementationOnce(async () => { throw conflict })
    await expect(processActivationsApi.activate('20', 'flow', command)).rejects.toBe(conflict)
    expect(request).toHaveBeenCalledTimes(5)
    expect(JSON.parse(String(request.mock.calls[4]?.[2]?.body))).toEqual(command)
  })

  it('rejects out-of-scope or malformed request inputs before transport', async () => {
    const badCommand = {...command, actor: 'another-owner'}
    await expect(processActivationsApi.activate('20', 'flow', badCommand)).rejects.toThrow()
    for (const expectedActivationRevision of [-1, 1.5, 1000000000000000]) {
      await expect(processActivationsApi.activate('20', 'flow', {...command, expectedActivationRevision}))
        .rejects.toThrow()
    }
    await expect(processActivationsApi.list('20', '../flow', {})).rejects.toThrow()
    await expect(processActivationsApi.getRelease('20', 'auto-1\n')).rejects.toThrow()
    // @ts-expect-error Runtime callers must also reject this invalid query.
    await expect(processActivationsApi.list('20', 'flow', {commandId: command.commandId, cursor: 'cursor'}))
      .rejects.toThrow()
    for (const limit of [0, 1.5, 101]) {
      await expect(processActivationsApi.list('20', 'flow', {limit})).rejects.toThrow()
    }
    await expect(processActivationsApi.list('20', 'flow', {cursor: 'a'.repeat(2049)})).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })

  it('rejects overbroad and inconsistent release projections including closed nested fields', async () => {
    for (const invalid of [
      {...release, deploymentId: 'hidden'},
      {...release, sourceDraftRevision: 1000000000000000},
      {...release, dependencyManifestSha256: 'A'.repeat(64)},
      {...release, releaseVersion: 'auto-2'},
      {...release, artifact: {...artifact, deploymentId: 'hidden'}},
      {...release, artifact: {...artifact, models: [{...artifact.models[0], compiledXml: 'hidden'}]}},
      {...release, artifact: {...artifact, inputSchema: {...objectSchema, properties: {count: {type: 'integer', default: 0}}}}},
      {...release, graph: {...graph, definitionKey: 'another'}},
    ]) {
      request.mockResolvedValueOnce(invalid)
      await expect(processActivationsApi.getRelease('20', 'auto-1')).rejects.toThrow()
    }
  })

  it('rejects invalid pointers, receipts, timestamps and command-specific results', async () => {
    const {current: omitted, ...withoutCurrent} = page
    expect(omitted).toEqual(pointer)
    for (const invalid of [
      withoutCurrent,
      {...page, current: null},
      {...page, current: null, items: [], nextCursor: 'cursor'},
      {...page, nextCursor: ''},
      {...page, observedAt: '2026-11-12T08:36:00+00:00'},
      {...page, observedAt: '2026-02-30T08:36:00Z'},
      {...page, current: {revision: 0, releaseVersion: 'auto-1', activatedAt}},
      {...page, items: [{...receipt, previousRevision: 1}]},
      {...page, items: [{...receipt, definitionKey: 'another'}]},
      {...page, items: [{...receipt, actor: 'private'}]},
      {...page, items: [receipt, receipt]},
      {...page, items: [{...receipt, commandId: 'another'}]},
      {...page, nextCursor: 'cursor'},
    ]) {
      request.mockResolvedValueOnce(invalid)
      await expect(processActivationsApi.list('20', 'flow', {commandId: command.commandId})).rejects.toThrow()
    }
    request.mockResolvedValueOnce({...receipt, releaseVersion: 'auto-2'})
    await expect(processActivationsApi.activate('20', 'flow', command)).rejects.toThrow()
  })
})
