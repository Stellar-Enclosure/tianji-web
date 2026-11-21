import {cleanup, render, screen, waitFor} from '@testing-library/react'
import {createElement, type ReactNode} from 'react'
import {MemoryRouter, Route, Routes} from 'react-router-dom'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {
  EmbeddedWorkbench,
  validatePageDescriptor,
  validateRelativeRoutePath,
  type WorkbenchHost,
} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {agentApi} from '../api/agent'
import {AuthProvider} from '../auth/AuthContext'
import AgentRunsPage from '../pages/AgentRunsPage'
import {resourceRegistry} from '../permissions/registry'
import {authorization, run} from '../test/fixtures'
import {
  buildTianjiCatalogPages,
  canAccessTianjiRoute,
  matchTianjiRoute,
  tianjiWorkbenchRoutes,
} from './routes'

const mockedAuth = vi.hoisted(() => ({
  status: 'ready' as const,
  authorization: null as ReturnType<typeof authorization> | null,
  allows: () => true,
  login: () => {},
  logout: async () => {},
  retry: async () => {},
}))

vi.mock('../auth/AuthContext', () => ({
  AuthProvider: ({children}: {children: ReactNode}) => children,
  useAuth: () => mockedAuth,
}))

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

describe('tianji embedded AgentRunsPage WorkspaceList', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders AgentRunsPage inside WorkspaceList regions when embedded', async () => {
    vi.spyOn(agentApi, 'list').mockResolvedValue({
      items: [run()],
      nextCursor: 'cursor-2',
    })
    mockedAuth.authorization = authorization('20', ['TIANJI_AGENT_READ'])
    const host: WorkbenchHost = {
      attach: () => ({ok: true}),
      reportCatalog: () => ({ok: true}),
      requestNavigation: () => ({ok: true}),
    }

    const {container} = render(
      createElement(
        AuthProvider,
        null,
        createElement(
          MemoryRouter,
          {initialEntries: ['/runs']},
          createElement(EmbeddedWorkbench, {
            host,
            status: 'ready',
            pages: [],
            onPresent: async () => ({ok: true as const}),
            children: createElement(
              Routes,
              null,
              createElement(Route, {path: '/runs', element: createElement(AgentRunsPage)}),
            ),
          }),
        ),
      ),
    )

    expect(await screen.findByText('research')).toBeInTheDocument()
    await waitFor(() => expect(container.querySelector('[data-region="table"]')).toBeInTheDocument())
    expect(container.querySelector('[data-region="toolbar"]')).toBeInTheDocument()
    expect(container.querySelector('[data-region="pagination"]')).toBeInTheDocument()
  })
})
