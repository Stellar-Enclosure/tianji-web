import {createHash} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {afterEach, expect, it, vi} from 'vitest'
import {casesApi} from '../api/cases'
import {setAuthFailureHandler} from '../api/client'
import {gatewayAuth} from '../auth/gatewayAuth'

const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/expense-four-path-contract.json')
const fixtureSha256 = '7d4d7af3c05a0888b77800a8b58af990cc08a2ff5daf9e8bb3b4b9374ceb43bc'
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'Content-Type': 'application/json'}})

const readFixture = (): Buffer => {
  expect(existsSync(fixturePath), 'committed canonical expense fixture').toBe(true)
  const bytes = readFileSync(fixturePath)
  expect(bytes.byteLength).toBe(2384)
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(fixtureSha256)
  return bytes
}

afterEach(() => {
  gatewayAuth.context.invalidate()
  setAuthFailureHandler(() => {})
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('contains the canonical expense contract fixture', () => {
  readFixture()
})

it('keeps the expense fixture as a formal Case projection only', async () => {
  const fixture: unknown = JSON.parse(readFixture().toString('utf8'))
  if (fixture === null || typeof fixture !== 'object' || !('caseInstance' in fixture)) {
    throw new Error('Canonical Case fixture projection is missing')
  }
  expect(Object.keys(fixture).sort()).toEqual([
    'caseInstance', 'models', 'paths', 'releaseVersion', 'schemaVersion', 'startInputs',
  ])
  expect(fixture).toMatchObject({schemaVersion: 1, releaseVersion: 'expense-v1'})

  gatewayAuth.context.invalidate()

  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(fixture.caseInstance))
  vi.stubGlobal('fetch', fetcher)

  const caseInstanceId = 'expense-case-fixture'
  const formalCase = await casesApi.get('20', {caseInstanceId})
  expect(formalCase).toEqual(fixture.caseInstance)
  expect(formalCase).toMatchObject({
    definitionKey: 'expenseException', releaseVersion: 'expense-v1', status: 'ACTIVE',
    submittedAt: '2026-11-05T00:00:01.123456Z', finishedAt: null,
  })
  expect(formalCase.planItems.map(({planItemDefinitionKey, kind, state, availableActions}) => ({
    planItemDefinitionKey, kind, state, availableActions,
  }))).toEqual([
    {planItemDefinitionKey: 'primaryTask', kind: 'HUMAN_TASK', state: 'COMPLETED', availableActions: []},
    {planItemDefinitionKey: 'supplementalTask', kind: 'HUMAN_TASK', state: 'ENABLED', availableActions: ['DISABLE', 'START']},
    {planItemDefinitionKey: 'completionMilestone', kind: 'MILESTONE', state: 'AVAILABLE', availableActions: []},
  ])

  const baseUrl = gatewayAuth.authority('20').apiBaseUrl.replace(/\/$/, '')
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls.map(([url]) => new URL(String(url), 'https://example.test').pathname)).toEqual([
    new URL(baseUrl + '/api/tianji/v1/cases/get', 'https://example.test').pathname,
  ])
  expect(fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([{caseInstanceId}])
  for (const [, init] of fetcher.mock.calls) {
    const headers = new Headers(init?.headers)
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('omit')
    expect(headers.get('X-Egon-Tianji-Tenant')).toBe('20')
    expect(headers.get('X-CSRF-TOKEN')).toBeNull()
    expect(headers.get('Authorization')).toBe('Bearer tianji-resource-token')
  }
})
