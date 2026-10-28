import {act, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {notifyAuthFailure} from '../api/client'
import {identity, snapshot} from '../test/fixtures'
import {AuthProvider, useAuth} from './AuthContext'
import {gatewayAuth} from './gatewayAuth'

function Probe() {
  const auth = useAuth()
  return <div><span data-testid="status">{auth.status}</span>
    <span data-testid="tenant">{auth.authorization?.identity.tenantId ?? ''}</span>
    <span data-testid="can-start">{String(auth.allows('tianji.button.runs.start'))}</span></div>
}

describe('authenticated tenant context', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PERMISSION_NAMESPACE', 'default')
    vi.stubEnv('VITE_PERMISSION_ENVIRONMENT', 'local')
    vi.spyOn(gatewayAuth, 'identity').mockResolvedValue(identity())
    vi.spyOn(gatewayAuth, 'bootstrap').mockResolvedValue(snapshot())
  })
  afterEach(() => { gatewayAuth.context.invalidate(); vi.restoreAllMocks(); vi.unstubAllEnvs() })

  it('accepts only the matching verified permission view and clears it on context change', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('ready')).toBeInTheDocument()
    expect(screen.getByTestId('tenant')).toHaveTextContent('20')
    expect(screen.getByTestId('can-start')).toHaveTextContent('true')
    act(() => gatewayAuth.context.invalidate())
    expect(screen.getByTestId('status')).toHaveTextContent('signed-out')
    expect(screen.getByTestId('tenant')).toHaveTextContent('')
  })

  it('rejects a permission snapshot from another tenant', async () => {
    vi.mocked(gatewayAuth.bootstrap).mockResolvedValue(snapshot('21'))
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('error')).toBeInTheDocument()
    expect(screen.getByTestId('tenant')).toHaveTextContent('')
    expect(screen.getByTestId('can-start')).toHaveTextContent('false')
  })

  it('does not restore an old snapshot after the session changes during bootstrap', async () => {
    let finish: ((value: unknown) => void) | undefined
    vi.mocked(gatewayAuth.bootstrap).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(finish).toBeDefined())
    act(() => gatewayAuth.context.invalidate())
    await act(async () => { finish?.(snapshot()); await Promise.resolve() })
    expect(screen.getByTestId('status')).toHaveTextContent('signed-out')
    expect(screen.getByTestId('tenant')).toHaveTextContent('')
  })

  it('clears authorization and blocks actions on an expected-tenant mismatch', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('ready')).toBeInTheDocument()
    act(() => notifyAuthFailure('tenant-changed'))
    expect(screen.getByTestId('status')).toHaveTextContent('forbidden')
    expect(screen.getByTestId('can-start')).toHaveTextContent('false')
  })
})
