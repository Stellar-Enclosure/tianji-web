import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {isProcessReleaseVersion, processReleasesApi, type ProcessReleaseModel} from './processReleases'

const VERSION = 'release-1.2'
const INSTANT = '2026-11-05T10:00:00.123456Z'
const model = (change: Partial<ProcessReleaseModel> = {}): ProcessReleaseModel => ({
  type: 'BPMN', definitionKey: 'expense', contentSha256: 'b'.repeat(64), inputs: {amount: 'INTEGER'}, ...change,
})
const release = (releaseVersion = VERSION, models: readonly ProcessReleaseModel[] = [model()]) =>
  ({releaseVersion, createdAt: INSTANT, manifestSha256: 'a'.repeat(64), models})
const mockFetch = (value: unknown) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(value),
    {headers: {'Content-Type': 'application/json'}}))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

describe('Process release metadata through existing gateway transport', () => {
  beforeEach(() => gatewayAuth.context.invalidate())
  afterEach(() => {
    gatewayAuth.context.invalidate()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('rejects a different release version', async () => {
    const fetcher = mockFetch(release('another-release'))
    await expect(processReleasesApi.get('20', VERSION)).rejects.toThrow('服务返回的流程发布元数据无效')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('uses one exact no-store GET with current tenant and abort', async () => {
    const result = release(VERSION, [model(), model({type: 'CMMN', inputs: {}}), model({type: 'DMN'})])
    const fetcher = mockFetch(result)
    const controller = new AbortController()
    await expect(processReleasesApi.get('20', VERSION, controller.signal)).resolves.toEqual(result)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0]
    const prefix = new URL(gatewayAuth.applicationBaseUrl, 'https://example.test').pathname.replace(/\/$/, '')
    const target = new URL(String(url), 'https://example.test')
    expect(target.pathname).toBe(prefix + '/api/tianji/v1/process-releases/' + VERSION)
    expect(target.search).toBe('')
    expect(init).toMatchObject({method: 'GET', cache: 'no-store', credentials: 'include', redirect: 'error'})
    expect(init?.body).toBeUndefined()
    expect(new Headers(init?.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
    expect(new Headers(init?.headers).get('Authorization')).toBeNull()
    expect(Object.keys(processReleasesApi)).toEqual(['get'])
    controller.abort()
    expect(init?.signal?.aborted).toBe(true)
  })

  it('rejects malformed release versions locally', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    for (const value of ['', '.', '../release', ' release', 'release ', 'release\n', 'release%2F', 'a'.repeat(129)]) {
      expect(isProcessReleaseVersion(value)).toBe(false)
      await expect(processReleasesApi.get('20', value)).rejects.toThrow('发布版本无效')
    }
    expect(isProcessReleaseVersion('a'.repeat(128))).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('validates model and schema bounds and preserves an own literal prototype-like input', async () => {
    const maximum = Array.from({length: 16}, (_, index) => model({definitionKey: 'model_' + index}))
    const unusual = JSON.parse('{"__proto__":"BOOLEAN","constructor":"STRING"}') as ProcessReleaseModel['inputs']
    const expected = release(VERSION, [model({inputs: unusual}), ...maximum.slice(1)])
    mockFetch(expected)
    const result = await processReleasesApi.get('20', VERSION)
    expect(result).toEqual(expected)
    expect(Object.hasOwn(result.models[0].inputs, '__proto__')).toBe(true)
    expect(result.models[0].inputs['__proto__']).toBe('BOOLEAN')

    const invalid: unknown[] = [
      {...release(), engineDefinitionId: 'private'}, {...release(), manifestSha256: 'A'.repeat(64)},
      {...release(), createdAt: '2026-02-30T10:00:00Z'}, {...release(), createdAt: '2026-11-05T10:00:00.123000Z'},
      {...release(), createdAt: '2026-11-05T10:00:00+00:00'}, {...release(), createdAt: 1_700_000_000},
      {...release(), models: []}, {...release(), models: [...maximum, model()]}, {...release(), models: [model(), model()]},
      {...release(), models: [{...model(), type: 'UNKNOWN'}]}, {...release(), models: [{...model(), inputs: []}]},
      {...release(), models: [{...model(), inputs: {true: 'STRING'}}]},
      {...release(), models: [{...model(), inputs: {amount: 'DECIMAL'}}]},
      {...release(), models: [{...model(), inputs: Object.fromEntries(Array.from({length: 17}, (_, index) => ['input_' + index, 'STRING']))}]},
      {...release(), models: [{...model(), definitionKey: 'expense\n'}]},
    ]
    for (const value of invalid) {
      const fetcher = mockFetch(value)
      await expect(processReleasesApi.get('20', VERSION)).rejects.toThrow('服务返回的流程发布元数据无效')
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
  })
})
