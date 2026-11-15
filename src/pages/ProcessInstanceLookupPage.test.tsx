import {fireEvent, render, screen} from '@testing-library/react'
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {useAuth} from '../auth/AuthContext'
import {authorization} from '../test/fixtures'
import ProcessInstanceLookupPage from './ProcessInstanceLookupPage'

vi.mock('../auth/AuthContext', () => ({useAuth: vi.fn()}))
const PROCESS_LIST = 'tianji.page.processInstances'
let current: ReturnType<typeof useAuth>

function RouteAddress() {
  const location = useLocation()
  return <output aria-label="当前地址">{location.pathname}</output>
}

function Harness() {
  return <MemoryRouter initialEntries={['/process-instances']}>
    <Routes>
      <Route path="/process-instances" element={<ProcessInstanceLookupPage />} />
      <Route path="/process-instances/:instanceId" element={<RouteAddress />} />
    </Routes>
  </MemoryRouter>
}

const auth = (allowed = true): ReturnType<typeof useAuth> => {
  const frame = authorization('20', ['TIANJI_PROCESS_READ'])
  return {
    status: 'ready', authorization: frame,
    allows: resource => resource === PROCESS_LIST && allowed,
    login: () => {}, logout: async () => {}, retry: async () => {},
  }
}

describe('Process instance lookup', () => {
  beforeEach(() => {
    current = auth()
    vi.mocked(useAuth).mockImplementation(() => current)
  })

  it('only renders a known-ID search and navigates by one encoded path segment', async () => {
    render(<Harness />)
    expect(screen.getByRole('heading', {name: '流程实例查找'})).toBeInTheDocument()
    expect(screen.getByLabelText('流程实例标识')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('流程实例标识'), {target: {value: 'pi/ expense + 1'}})
    fireEvent.click(screen.getByRole('button', {name: '查询实例'}))
    expect(await screen.findByLabelText('当前地址')).toHaveTextContent('/process-instances/pi%2F%20expense%20%2B%201')
  })

  it('rejects invalid identifiers locally and shows a field error without issuing a read', async () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('流程实例标识'), {target: {value: '..'}})
    fireEvent.click(screen.getByRole('button', {name: '查询实例'}))
    expect(await screen.findByText('请输入有效的流程实例标识。')).toBeInTheDocument()
    expect(screen.getByRole('button', {name: '查询实例'})).toBeInTheDocument()
    expect(screen.queryByLabelText('当前地址')).not.toBeInTheDocument()
  })

  it('does not expose the lookup or navigate without instance read permission', () => {
    current = auth(false)
    render(<Harness />)
    expect(screen.getByText('当前身份不能查找流程实例。')).toBeInTheDocument()
    expect(screen.queryByLabelText('流程实例标识')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '查询实例'})).not.toBeInTheDocument()
  })
})
