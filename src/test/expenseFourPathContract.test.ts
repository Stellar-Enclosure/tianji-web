import {createHash} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {afterEach, expect, it, vi} from 'vitest'
import {casesApi} from '../api/cases'
import {setAuthFailureHandler} from '../api/client'
import {humanTasksApi} from '../api/humanTasks'
import {gatewayAuth} from '../auth/gatewayAuth'

const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/expense-four-path-contract.json')
const fixtureSha256 = 'e40621b736dcaf1685c4335acba70f000c9a9c01e443f743edc25640ce2b7cb7'
const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'Content-Type': 'application/json'}})

const readFixture = (): Buffer => {
  expect(existsSync(fixturePath), 'committed canonical expense fixture').toBe(true)
  const bytes = readFileSync(fixturePath)
  expect(bytes.byteLength).toBe(3084)
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

it('decodes the expense ACTION task and formal Case using current clients', async () => {
  const fixture: unknown = JSON.parse(readFixture().toString('utf8'))
  if (fixture === null || typeof fixture !== 'object' || !('humanTask' in fixture) || !('caseInstance' in fixture)) {
    throw new Error('Canonical expense fixture projections are missing')
  }
  expect(Object.keys(fixture).sort()).toEqual([
    'caseInstance', 'humanTask', 'models', 'paths', 'releaseVersion', 'schemaVersion', 'startInputs',
  ])
  expect(fixture).toMatchObject({schemaVersion: 1, releaseVersion: 'expense-v1'})

  gatewayAuth.context.invalidate()
  vi.spyOn(gatewayAuth, 'csrf').mockResolvedValue({
    headerName: 'X-CSRF-TOKEN', token: 'test-csrf', expiresAt: new Date(Date.now() + 60_000).toISOString(),
  })
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(json(fixture.humanTask))
    .mockResolvedValueOnce(json(fixture.caseInstance))
  vi.stubGlobal('fetch', fetcher)

  const taskId = 'expense-review-task-fixture'
  const caseInstanceId = 'expense-case-fixture'
  const task = await humanTasksApi.get('20', {taskId})
  const formalCase = await casesApi.get('20', {caseInstanceId})
  expect(task).toEqual(fixture.humanTask)
  expect(task).toMatchObject({
    scopeType: 'PROCESS', releaseVersion: 'expense-v1', definitionKey: 'expenseReview',
    taskDefinitionKey: 'reviewExpense', kind: 'ACTION', approvalField: null, lane: 'exception',
    formSchema: {finding: 'STRING'}, createdAt: '2026-11-05T00:00:00.123456Z', dueAt: null,
  })
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

  const baseUrl = gatewayAuth.applicationBaseUrl.replace(/\/$/, '')
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher.mock.calls.map(([url]) => new URL(String(url), 'https://example.test').pathname)).toEqual([
    '/api/tianji/v1/human-tasks/get', '/api/tianji/v1/cases/get',
  ].map(route => new URL(baseUrl + route, 'https://example.test').pathname))
  expect(fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([{taskId}, {caseInstanceId}])
  for (const [, init] of fetcher.mock.calls) {
    const headers = new Headers(init?.headers)
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('include')
    expect(headers.get('X-Egon-Tianji-Tenant')).toBe('20')
    expect(headers.get('X-CSRF-TOKEN')).toBe('test-csrf')
    expect(headers.get('Authorization')).toBeNull()
  }
})
