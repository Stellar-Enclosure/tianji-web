import {describe, expect, it} from 'vitest'
import {
  validatePageDescriptor,
  validateRelativeRoutePath,
} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {resourceRegistry} from '../permissions/registry'
import {authorization} from '../test/fixtures'
import {
  buildTianjiCatalogPages,
  canAccessTianjiRoute,
  matchTianjiRoute,
  tianjiWorkbenchRoutes,
} from './routes'

const makeChecker = (codes: string[]) => {
  const {snapshot, binding} = authorization('20', codes)
  return {
    allows: (resourceKey: string) => resourceRegistry.canAccessResource(resourceKey, snapshot, binding),
  }
}

describe('tianjiWorkbenchRoutes', () => {
  it('registers all 15 Spec §12.1 routes including legacy handoffs and excludes OAuth callbacks', () => {
    expect(tianjiWorkbenchRoutes.map((route) => route.pattern)).toEqual([
      '/process-definitions',
      '/process-definitions/new',
      '/process-definitions/drafts/:draftId',
      '/process-instances',
      '/process-instances/:instanceId',
      '/runs',
      '/runs/:runId',
      '/cases',
      '/cases/:caseInstanceId',
      '/operations/worker-failures',
      '/operations/process-releases',
      '/operations/process-correlations',
      '/tasks',
      '/tasks/:taskId',
      '/memory',
    ])

    for (const route of tianjiWorkbenchRoutes) {
      expect(validateRelativeRoutePath(route.pattern)).toBe(route.pattern)
      expect(route.pattern).not.toMatch(/\/auth\/|\/login/)
    }
  })

  it('builds validated nav catalog entries filtered strictly by permissions and excludes legacy/detail routes', () => {
    const full = makeChecker([
      'TIANJI_PROCESS_RELEASE_PUBLISH',
      'TIANJI_PROCESS_RELEASE_READ',
      'TIANJI_PROCESS_READ',
      'TIANJI_PROCESS_WORKER_RECOVER',
      'TIANJI_AGENT_READ',
      'TIANJI_CASE_READ',
    ])
    const pages = buildTianjiCatalogPages(full)
    expect(pages.map((page) => page.pattern)).toEqual([
      '/process-definitions',
      '/operations/process-releases',
      '/operations/process-correlations',
      '/process-instances',
      '/operations/worker-failures',
      '/runs',
      '/cases',
    ])
    for (const page of pages) {
      expect(validatePageDescriptor(page)).toBe(true)
    }

    const readOnlyProcess = makeChecker(['TIANJI_PROCESS_READ'])
    expect(buildTianjiCatalogPages(readOnlyProcess).map((page) => page.pattern)).toEqual([
      '/operations/process-correlations',
      '/process-instances',
    ])

    const empty = makeChecker([])
    expect(buildTianjiCatalogPages(empty)).toEqual([])
    expect(canAccessTianjiRoute(empty, tianjiWorkbenchRoutes[0]!)).toBe(false)
  })

  it('matches parameterized and static routes cleanly including legacy business bookmarks', () => {
    expect(matchTianjiRoute('/process-definitions/new')?.route.pattern).toBe('/process-definitions/new')
    const draft = matchTianjiRoute('/process-definitions/drafts/draft-42')
    expect(draft?.route.pattern).toBe('/process-definitions/drafts/:draftId')
    expect(draft?.params).toEqual({draftId: 'draft-42'})

    const run = matchTianjiRoute('/runs/run-9')
    expect(run?.route.pattern).toBe('/runs/:runId')
    expect(run?.params).toEqual({runId: 'run-9'})

    const legacy = matchTianjiRoute('/tasks/task-7')
    expect(legacy?.route.pattern).toBe('/tasks/:taskId')
    expect(legacy?.route.legacyHandoff).toBe(true)
    expect(legacy?.params).toEqual({taskId: 'task-7'})
  })
})
