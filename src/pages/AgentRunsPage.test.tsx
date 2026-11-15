import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter, Route, Routes} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {agentApi} from '../api/agent'
import {useAuth} from '../auth/AuthContext'
import {authorization, run} from '../test/fixtures'
import AgentRunsPage from './AgentRunsPage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
vi.mock('../api/agent', async original => {
  const actual = await original<typeof import('../api/agent')>()
  return {...actual, agentApi: {list: vi.fn(), get: vi.fn(), result: vi.fn(), cancel: vi.fn()}}
})

const auth = (tenant = '20') => ({status: 'ready' as const, authorization: authorization(tenant),
  allows: () => true, login: () => {},
  logout: async () => {}, retry: async () => {}})
const view = () => <MemoryRouter initialEntries={['/runs']}><Routes>
  <Route path="/runs" element={<AgentRunsPage />} /><Route path="/runs/:id" element={<div>详情页面</div>} />
</Routes></MemoryRouter>

describe('Agent run list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue(auth())
    vi.mocked(agentApi.list).mockResolvedValue({items: [run()], nextCursor: null})
  })

  it('keeps existing run navigation without exposing a legacy direct start', async () => {
    render(view())
    expect(await screen.findByText('research')).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '启动运行'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '查看'}))
    expect(await screen.findByText('详情页面')).toBeInTheDocument()
    expect(agentApi.list).toHaveBeenCalledWith('20', undefined, expect.any(AbortSignal))
  })

  it('does not render a late page from the previous tenant', async () => {
    let finishOld: ((value: {items: ReturnType<typeof run>[]; nextCursor: null}) => void) | undefined
    vi.mocked(agentApi.list).mockImplementation(tenant => tenant === '20'
      ? new Promise(resolve => { finishOld = resolve })
      : Promise.resolve({items: [{...run('run-2'), definitionKey: 'new-tenant-run'}], nextCursor: null}))
    const rendered = render(view())
    await waitFor(() => expect(finishOld).toBeDefined())
    vi.mocked(useAuth).mockReturnValue(auth('21'))
    rendered.rerender(view())
    expect(await screen.findByText('new-tenant-run')).toBeInTheDocument()
    await act(async () => { finishOld?.({items: [{...run(), definitionKey: 'old-tenant-run'}], nextCursor: null}); await Promise.resolve() })
    expect(screen.queryByText('old-tenant-run')).not.toBeInTheDocument()
    expect(screen.getByText('new-tenant-run')).toBeInTheDocument()
  })
})
