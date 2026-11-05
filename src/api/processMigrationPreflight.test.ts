import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {processMigrationPreflightApi, type ProcessMigrationPreflight, type ProcessMigrationTarget} from './processMigrationPreflight'

const target: ProcessMigrationTarget = {instanceId: 'instance-1', sourceReleaseVersion: 'release-1',
  targetReleaseVersion: 'release-2', expectedTargetManifestSha256: 'a'.repeat(64)}
const report: ProcessMigrationPreflight = {instanceId: target.instanceId, sourceReleaseVersion: target.sourceReleaseVersion,
  targetReleaseVersion: target.targetReleaseVersion, status: 'NATIVE_STRUCTURE_VALIDATED_ONLY',
  activityId: 'waitForExpiry', observedAt: '2026-11-05T10:20:30.123456Z'}
const stub = (value: unknown) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(value),
    {headers: {'Content-Type': 'application/json'}}))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

describe('Process owner migration preflight client', () => {
  beforeEach(() => { gatewayAuth.context.invalidate() })
  afterEach(() => { gatewayAuth.context.invalidate(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('rejects a preflight report for a different target release', async () => {
    const fetcher = stub({...report, targetReleaseVersion: 'release-other'})
    await expect(processMigrationPreflightApi.get('20', target)).rejects.toThrow('服务返回的迁移预检证据无效')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('uses only the exact encoded GET with both pinned parameters and current tenant', async () => {
    const instanceId = 'process /+账'
    const fetcher = stub({...report, instanceId})
    const controller = new AbortController()
    await expect(processMigrationPreflightApi.get('20', {...target, instanceId}, controller.signal))
      .resolves.toEqual({...report, instanceId})
    const prefix = new URL(gatewayAuth.applicationBaseUrl, 'https://example.test').pathname.replace(/\/$/, '')
    const [url, request] = fetcher.mock.calls[0]
    const uri = new URL(String(url), 'https://example.test')
    expect(uri.pathname).toBe(prefix + '/api/tianji/v1/process-instances/process%20%2F%2B%E8%B4%A6/migration-preflight')
    expect(Object.fromEntries(uri.searchParams)).toEqual({targetReleaseVersion: 'release-2',
      expectedTargetManifestSha256: 'a'.repeat(64)})
    expect(request).toMatchObject({method: 'GET', cache: 'no-store', credentials: 'include'})
    expect(new Headers(request?.headers).get('X-Egon-Tianji-Tenant')).toBe('20')
    controller.abort()
    expect(request?.signal?.aborted).toBe(true)
  })

  it('rejects mismatched sources, unexpected fields and invalid native evidence', async () => {
    for (const malformed of [
      {...report, instanceId: 'other'}, {...report, sourceReleaseVersion: 'other'},
      {...report, nativeExecutionId: 'private'}, {...report, activityId: null},
      {...report, status: 'SHAPE_UNSUPPORTED'}, {...report, status: 'APPROVED'},
      {...report, observedAt: '2026-11-05T10:20:30+00:00'},
    ]) {
      stub(malformed)
      await expect(processMigrationPreflightApi.get('20', target)).rejects.toThrow('服务返回的迁移预检证据无效')
    }
    const shape = {...report, status: 'SHAPE_UNSUPPORTED', activityId: null}
    stub(shape)
    await expect(processMigrationPreflightApi.get('20', target)).resolves.toEqual(shape)
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    for (const input of [{...target, instanceId: '..'}, {...target, expectedTargetManifestSha256: 'A'.repeat(64)},
      {...target, targetReleaseVersion: ' release-2'}, {...target, sourceReleaseVersion: '../release'}]) {
      await expect(processMigrationPreflightApi.get('20', input)).rejects.toThrow('迁移预检条件无效')
    }
    expect(fetcher).not.toHaveBeenCalled()
  })
})
