import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {processDraftsApi} from './processDrafts'

const base = '/api/tianji/v2'
const draftId = 'pd:order-1'
const definitionKey = 'orderFlow'
const digest = 'a'.repeat(64)
const timestamp = '2026-11-12T08:00:00.123456Z'
const overview = {
  draftId, definitionKey, title: '  审批草稿  ', baseReleaseVersion: null, state: 'EDITING', revision: 1,
  contentSha256: digest, publishedReleaseVersion: null, createdAt: timestamp, updatedAt: timestamp,
  availableActions: ['SAVE', 'VALIDATE', 'PUBLISH', 'DISCARD'],
}
const content = {
  models: [{type: 'BPMN', definitionKey: '', xml: '\r\n<process id="审批🚀"\r\n'}],
  inputSchemaSource: '  {"fields": [\r\n', outputSchemaSource: null,
  nodeBindingsSource: '', eventRoutesSource: '  [',
} as const
const detail = {
  ...overview, revision: 4, baseSourceManifestSha256: null, content, lastCommandId: 'save:4',
  publication: null, commandReceipt: null,
}
const receipt = {
  commandId: 'save:2', operation: 'SAVE', requestSha256: digest, resultRevision: 2,
  resultContentSha256: 'b'.repeat(64), releaseVersion: null, completedAt: timestamp,
}
const expected = {draftId, expectedRevision: 4, expectedContentSha256: digest}
const validation = {
  draftId, revision: 4, contentSha256: digest, valid: false, compilerVersion: 'compiler-2',
  sourceManifestSha256: null, graph: null,
  issues: [{path: 'models[0].xml', code: 'INVALID_XML', message: '模型未闭合', nodeId: null}],
}
const graph = {
  definitionKey, nodes: [{id: 'start', kind: 'START', name: '开始'}, {id: 'end', kind: 'END', name: '结束'}],
  edges: [{id: 'flow', source: 'start', target: 'end', label: null}],
}
const valid = {...validation, valid: true, sourceManifestSha256: digest, graph, issues: []}
const publish = {...expected, releaseVersion: 'order-2', commandId: 'publish:5'}
const publication = {
  draftId, publishedRevision: 4, draftRevision: 5, releaseVersion: publish.releaseVersion,
  sourceManifestSha256: digest, compiledManifestSha256: 'c'.repeat(64), dependencyManifestSha256: 'd'.repeat(64),
  compilerVersion: 'compiler-2', publishedAt: timestamp, commandId: publish.commandId,
}
const save = {commandId: 'save:5', expectedRevision: 4, title: overview.title, content}
const mutation = {draftId, state: 'EDITING', revision: 5, contentSha256: digest, updatedAt: timestamp, commandId: save.commandId}
const discard = {commandId: 'discard:5', expectedRevision: 4}
const creation = {title: overview.title, baseReleaseVersion: null, commandId: 'create:1'}
const page = {observedAt: timestamp, items: [overview], nextCursor: 'next_token'}

const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'},
})

function mockFetch() {
  const fetcher = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

function expectRequest(call: Parameters<typeof fetch>, method: string, path: string, query: string, body?: unknown) {
  const [url, init] = call
  const prefix = new URL(gatewayAuth.applicationBaseUrl, 'https://example.test').pathname.replace(/\/$/, '')
  const uri = new URL(String(url), 'https://example.test')
  expect(uri.pathname).toBe(prefix + base + path)
  expect(uri.search).toBe(query)
  expect(init).toMatchObject({method, cache: 'no-store', credentials: 'include'})
  const headers = new Headers(init?.headers)
  expect(headers.get('X-Egon-Tianji-Tenant')).toBe('20')
  if (body === undefined) {
    expect(init?.body).toBeUndefined()
  } else {
    expect(headers.get('X-CSRF-TOKEN')).toBe('test-csrf')
    expect(headers.get('Content-Type')).toContain('application/json')
    expect(JSON.parse(String(init?.body))).toEqual(body)
  }
}

function withoutField(value: Record<string, unknown>, field: string) {
  const copy = {...value}
  delete copy[field]
  return copy
}

beforeEach(() => {
  gatewayAuth.context.invalidate()
  vi.spyOn(gatewayAuth, 'csrf').mockResolvedValue({headerName: 'X-CSRF-TOKEN', token: 'test-csrf',
    expiresAt: new Date(Date.now() + 60_000).toISOString()})
})

afterEach(() => {
  gatewayAuth.context.invalidate()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Owner draft client', () => {
  it('validates a saved revision and consumes only closed typed validation results', async () => {
    const fetcher = mockFetch().mockResolvedValueOnce(response(validation)).mockResolvedValueOnce(response(valid))
    const controller = new AbortController()
    await expect(processDraftsApi.validate('20', expected, controller.signal)).resolves.toEqual(validation)
    await expect(processDraftsApi.validate('20', expected)).resolves.toEqual(valid)
    expectRequest(fetcher.mock.calls[0], 'POST', '/process-model-validations', '', expected)
    controller.abort()
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true)

    for (const malformed of [withoutField(validation, 'graph'), {...validation, graph}, {...validation, sourceManifestSha256: digest},
      {...valid, issues: validation.issues}, {...valid, graph: {...graph, engineId: 'private'}},
      {...validation, revision: 3}, {...validation, revision: 4.5}, {...validation, contentSha256: 'e'.repeat(64)},
      {...validation, issues: [{...validation.issues[0], details: 'private'}]}]) {
      fetcher.mockResolvedValueOnce(response(malformed))
      await expect(processDraftsApi.validate('20', expected)).rejects.toThrow()
    }
    expect(fetcher).toHaveBeenCalledTimes(11)
  })

  it('publishes the exact saved revision and retains both original and sealed revisions', async () => {
    const fetcher = mockFetch().mockResolvedValueOnce(response(publication))
    await expect(processDraftsApi.publish('20', publish)).resolves.toEqual(publication)
    expectRequest(fetcher.mock.calls[0], 'POST', '/process-releases', '', publish)

    for (const malformed of [{...publication, draftRevision: 4}, {...publication, publishedRevision: 5, draftRevision: 6},
      {...publication, releaseVersion: 'other'}, {...publication, commandId: 'other'}, {...publication, activationRevision: 1}]) {
      fetcher.mockResolvedValueOnce(response(malformed))
      await expect(processDraftsApi.publish('20', publish)).rejects.toThrow()
    }
    expect(fetcher).toHaveBeenCalledTimes(6)
  })

  it('creates with a fixed command and recovers a lost create response only by the original command id', async () => {
    const discarded = {...overview, state: 'DISCARDED', revision: 3, availableActions: []}
    const fetcher = mockFetch().mockRejectedValueOnce(new TypeError('connection lost'))
      .mockResolvedValueOnce(response({observedAt: timestamp, items: [discarded], nextCursor: null}))
    await expect(processDraftsApi.create('20', definitionKey, creation)).rejects.toThrow()
    await expect(processDraftsApi.list('20', {creationCommandId: creation.commandId})).resolves.toMatchObject({items: [discarded]})
    expectRequest(fetcher.mock.calls[0], 'POST', '/process-definitions/orderFlow/drafts', '', creation)
    expectRequest(fetcher.mock.calls[1], 'GET', '/process-drafts', '?creationCommandId=create%3A1')
    expect(fetcher).toHaveBeenCalledTimes(2)

    const withoutBase = {title: creation.title, commandId: 'create:2'}
    fetcher.mockResolvedValueOnce(response(overview))
    await expect(processDraftsApi.create('20', definitionKey, withoutBase)).resolves.toEqual(overview)
    expectRequest(fetcher.mock.calls[2], 'POST', '/process-definitions/orderFlow/drafts', '', withoutBase)

    const copied = {...creation, baseReleaseVersion: 'order-1', commandId: 'create:3'}
    fetcher.mockResolvedValueOnce(response({...overview, baseReleaseVersion: 'order-1'}))
    await expect(processDraftsApi.create('20', definitionKey, copied)).resolves.toMatchObject({baseReleaseVersion: 'order-1'})
    expectRequest(fetcher.mock.calls[3], 'POST', '/process-definitions/orderFlow/drafts', '', copied)
    fetcher.mockResolvedValueOnce(response({...overview, definitionKey: 'otherFlow'}))
    await expect(processDraftsApi.create('20', definitionKey, creation)).rejects.toThrow()
  })

  it('reads the saved draft and the requested historical receipt without conflating their revisions', async () => {
    const fetcher = mockFetch().mockResolvedValueOnce(response(detail)).mockResolvedValueOnce(response({...detail, commandReceipt: receipt}))
    await expect(processDraftsApi.get('20', draftId)).resolves.toEqual(detail)
    await expect(processDraftsApi.get('20', draftId, receipt.commandId)).resolves.toEqual({...detail, commandReceipt: receipt})
    expectRequest(fetcher.mock.calls[0], 'GET', '/process-drafts/pd%3Aorder-1', '')
    expectRequest(fetcher.mock.calls[1], 'GET', '/process-drafts/pd%3Aorder-1', '?commandId=save%3A2')
    for (const malformed of [withoutField(detail, 'publication'), {...detail, owner: 12}, {...detail, draftId: 'other'},
      {...detail, createdAt: '2026-02-30T08:00:00Z'}, {...detail, updatedAt: '2026-11-12T08:00:00.123455Z'},
      {...detail, baseSourceManifestSha256: digest}, {...detail, publication},
      {...detail, commandReceipt: {...receipt, resultRevision: 5}}, {...detail, commandReceipt: {...receipt, commandId: 'other'}},
      {...detail, commandReceipt: {...receipt, releaseVersion: 'order-2'}}, {...detail, content: {...content, models: [null]}}]) {
      fetcher.mockResolvedValueOnce(response(malformed))
      await expect(processDraftsApi.get('20', draftId, receipt.commandId)).rejects.toThrow()
    }
    fetcher.mockResolvedValueOnce(response(detail))
    await expect(processDraftsApi.get('20', draftId, 'unknown:1')).resolves.toMatchObject({commandReceipt: null, revision: 4})
  })

  it('saves original incomplete XML and JSON verbatim after checking their serialized UTF-8 bounds', async () => {
    const fetcher = mockFetch().mockResolvedValueOnce(response(mutation))
    await expect(processDraftsApi.save('20', draftId, save)).resolves.toEqual(mutation)
    expectRequest(fetcher.mock.calls[0], 'PUT', '/process-drafts/pd%3Aorder-1', '', save)

    const contentBytes = 4 * 1024 ** 2
    const encoder = new TextEncoder()
    const prefix = {...content, inputSchemaSource: '审🚀\r\n'}
    const remaining = contentBytes - encoder.encode(JSON.stringify(prefix)).length
    const accepted = {...prefix, inputSchemaSource: prefix.inputSchemaSource + 'a'.repeat(remaining)}
    fetcher.mockResolvedValueOnce(response(mutation))
    await expect(processDraftsApi.save('20', draftId, {...save, content: accepted})).resolves.toEqual(mutation)
    expect(encoder.encode(JSON.stringify(accepted)).length).toBe(contentBytes)
    for (const invalid of [{...accepted, inputSchemaSource: accepted.inputSchemaSource + 'a'},
      {...content, inputSchemaSource: '界'.repeat(1_500_000)}, {...content, inputSchemaSource: '\u0001'.repeat(700_000)},
      {...content, inputSchemaSource: '\u0000'},
      {...content, nodeBindingsSource: '\ud800'}, {...content, eventRoutesSource: '\udfff'},
      {...content, models: [{...content.models[0], xml: '\udfff'}]},
      {...content, models: [{...content.models[0], definitionKey: '\ud800'}]},
      {...content, models: [...Array(65).fill(content.models[0])]}, {...content, models: [{...content.models[0], id: 'extra'}]},
      {...content, language: 'JSON'}, {...content, nodeBindingsSource: undefined}, {...content, inputSchemaSource: 0},
      withoutField(content, 'eventRoutesSource')]) {
      // Exercise a JSON boundary even for values outside the public TypeScript command type.
      const unchecked = {...save, content: invalid} as typeof save
      await expect(processDraftsApi.save('20', draftId, unchecked)).rejects.toThrow()
    }
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('lists owner drafts with bounded filters and a specifically isolated create recovery query', async () => {
    const fetcher = mockFetch().mockResolvedValueOnce(response(page)).mockResolvedValueOnce(response(page))
    await expect(processDraftsApi.list('20', {})).resolves.toEqual(page)
    await expect(processDraftsApi.list('20', {definitionKey, state: 'EDITING', limit: 2, cursor: 'next_token'})).resolves.toEqual(page)
    expectRequest(fetcher.mock.calls[0], 'GET', '/process-drafts', '?state=EDITING&limit=20')
    expectRequest(fetcher.mock.calls[1], 'GET', '/process-drafts', '?definitionKey=orderFlow&state=EDITING&limit=2&cursor=next_token')
    for (const invalid of [{creationCommandId: 'create:1', definitionKey}, {creationCommandId: 'create:1', state: 'EDITING' as const},
      {creationCommandId: 'create:1', cursor: 'cursor'}, {state: null}, {cursor: '!'}, {limit: 1.5}, {limit: 101}, {unknown: 'key'}]) {
      const unchecked = invalid as Parameters<typeof processDraftsApi.list>[1]
      await expect(processDraftsApi.list('20', unchecked)).rejects.toThrow()
    }
    expect(fetcher).toHaveBeenCalledTimes(2)
    for (const malformed of [{...page, items: [overview, overview], nextCursor: null}, page, {...page, items: [], observedAt: null}]) {
      fetcher.mockResolvedValueOnce(response(malformed))
      await expect(processDraftsApi.list('20', {creationCommandId: 'create:1'})).rejects.toThrow()
    }
  })

  it('binds the page to the query sent, even if the caller changes its filter object', async () => {
    const fetcher = mockFetch().mockResolvedValueOnce(response(page))
    const filters = {definitionKey, state: 'EDITING' as const}
    const pending = processDraftsApi.list('20', filters)
    filters.definitionKey = 'otherFlow'
    await expect(pending).resolves.toEqual(page)
    expectRequest(fetcher.mock.calls[0], 'GET', '/process-drafts', '?definitionKey=orderFlow&state=EDITING&limit=20')
  })

  it('discards with the fixed CAS version and propagates transport failures without retrying', async () => {
    const discarded = {...mutation, state: 'DISCARDED', commandId: discard.commandId}
    const fetcher = mockFetch().mockResolvedValueOnce(response(discarded))
    await expect(processDraftsApi.discard('20', draftId, discard)).resolves.toEqual(discarded)
    expectRequest(fetcher.mock.calls[0], 'POST', '/process-drafts/pd%3Aorder-1/discard-commands', '', discard)
    for (const [status, code] of [[409, 'TIANJI_DRAFT_VERSION_CONFLICT'], [404, 'TIANJI_RESOURCE_NOT_FOUND'], [413, 'TIANJI_REQUEST_TOO_LARGE']] as const) {
      fetcher.mockResolvedValueOnce(response({code, correlationId: null}, status))
      await expect(processDraftsApi.save('20', draftId, save)).rejects.toMatchObject({status, code})
    }
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  it('rejects out-of-contract command shapes, ids and integers before any transport call', async () => {
    const fetcher = mockFetch()
    const extra = {...expected, state: 'EDITING'}
    const absent = {draftId, expectedContentSha256: digest} as typeof expected
    for (const invalid of [extra, absent, {...expected, expectedRevision: 0}, {...expected, expectedRevision: 4.01},
      {...expected, expectedRevision: 1_000_000_000_000_000}, {...expected, expectedContentSha256: 'A'.repeat(64)}]) {
      await expect(processDraftsApi.validate('20', invalid)).rejects.toThrow()
    }
    await expect(processDraftsApi.create('20', definitionKey, {...creation, title: ' \u2003 '})).rejects.toThrow()
    await expect(processDraftsApi.create('20', definitionKey, {...creation, title: 'foo\n'})).rejects.toThrow()
    await expect(processDraftsApi.get('20', '../other')).rejects.toThrow()
    await expect(processDraftsApi.get('20', draftId, 'command\n')).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects a status other than 200 even when the response body matches', async () => {
    const fetcher = mockFetch().mockResolvedValueOnce(response(overview, 201))
    await expect(processDraftsApi.create('20', definitionKey, creation)).rejects.toMatchObject({status: 201, code: 'INVALID_RESPONSE'})
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
