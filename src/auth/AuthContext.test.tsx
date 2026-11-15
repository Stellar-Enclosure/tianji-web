import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {notifyAuthFailure} from '../api/client'
import {identity, snapshot} from '../test/fixtures'
import {AuthProvider, useAuth} from './AuthContext'
import {gatewayAuth} from './gatewayAuth'

function Probe() {
  const auth = useAuth()
  return <div><span data-testid="status">{auth.status}</span>
    <span data-testid="tenant">{auth.authorization?.identity.tenantId ?? ''}</span>
    <span data-testid="can-start">{String(auth.allows('tianji.button.runs.start'))}</span>
    <span data-testid="can-read-release">{String(auth.allows('tianji.page.processReleases'))}</span>
    <span>{auth.error}</span>
    <button onClick={() => void auth.retry()}>重新验证</button>
    <button onClick={() => void auth.logout()}>退出登录</button></div>
}

const releaseRead = 'TIANJI_PROCESS_RELEASE_READ'
const draftDomain = 'TIANJI_PROCESS_DRAFT_OWNER_V1'
const recoverySlots = [
  ['tianji.process-draft-create.v1', draftDomain],
  ['tianji.process-start.v2', draftDomain],
  ['tianji.process-draft-editor.v1:20:pd-1', draftDomain],
  ['tianji.process-activation.v1:20:orders', 'TIANJI_PROCESS_ACTIVATION_OWNER_V1'],
  ['tianji.process-instance-cancel.v1:20:pi-1', 'TIANJI_PROCESS_CANCEL_OWNER_V1'],
] as const

async function storePointers(actor = identity()) {
  for (const [key, domain] of recoverySlots) {
    const bytes = new TextEncoder().encode(JSON.stringify([domain, actor.issuer, actor.subject]))
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const actorFingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    sessionStorage.setItem(key, JSON.stringify({tenantId: actor.tenantId, actorFingerprint}))
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(fulfill => { resolve = fulfill })
  return {promise, resolve}
}

const closedLogout = {
  operationId: 'f34bb1e7-5204-45e8-9b75-a67dd68955a1',
  status: 'LOCAL_CLOSED', remoteState: 'PENDING', ssoLogoutUri: identity().ssoLogoutUri,
} as const

describe('authenticated tenant context', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubEnv('VITE_PERMISSION_NAMESPACE', 'default')
    vi.stubEnv('VITE_PERMISSION_ENVIRONMENT', 'local')
    vi.spyOn(gatewayAuth, 'identity').mockResolvedValue(identity())
    vi.spyOn(gatewayAuth, 'bootstrap').mockResolvedValue(snapshot())
  })
  afterEach(() => { gatewayAuth.context.invalidate(); vi.restoreAllMocks(); vi.unstubAllEnvs(); sessionStorage.clear() })

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

  it('admits a Process-only snapshot and invalidates its permission with the request epoch', async () => {
    vi.mocked(gatewayAuth.bootstrap).mockResolvedValue(snapshot('20', [releaseRead]))
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('ready')).toBeInTheDocument()
    expect(screen.getByTestId('can-read-release')).toHaveTextContent('true')
    expect(screen.getByTestId('can-start')).toHaveTextContent('false')
    act(() => gatewayAuth.context.invalidate())
    expect(screen.getByTestId('can-read-release')).toHaveTextContent('false')
  })

  it('prunes the old actor’s recovery pointers before bootstrap even when the new actor has no APP access', async () => {
    await storePointers()
    sessionStorage.setItem('tianji.process-start.v2-unrelated', 'keep')
    sessionStorage.setItem('tianji.process-draft-editor.v1:20:broken', '{')
    const nextActor = {...identity(), subject: 'other-subject'}
    vi.mocked(gatewayAuth.identity).mockResolvedValue(nextActor)
    const pointersAtBootstrap: (string | null)[] = []
    vi.mocked(gatewayAuth.bootstrap).mockImplementation(async <T,>() => {
      pointersAtBootstrap.push(...recoverySlots.map(([key]) => sessionStorage.getItem(key)))
      return {...snapshot('20', ['TIANJI_PROCESS_NODE_RETRY']), subject: nextActor.subject} as T
    })

    render(<AuthProvider><Probe /></AuthProvider>)

    expect(await screen.findByText('forbidden')).toBeInTheDocument()
    expect(pointersAtBootstrap).toEqual(recoverySlots.map(() => null))
    expect(sessionStorage.getItem('tianji.process-draft-editor.v1:20:broken')).toBeNull()
    expect(sessionStorage.getItem('tianji.process-start.v2-unrelated')).toBe('keep')
  })

  it('prunes recovery pointers after a tenant-only replacement identity even if permissions fail to load', async () => {
    await storePointers()
    const nextActor = {...identity(), tenantId: '21'}
    vi.mocked(gatewayAuth.identity).mockResolvedValue(nextActor)
    vi.mocked(gatewayAuth.bootstrap).mockRejectedValue(new Error('network unavailable'))

    render(<AuthProvider><Probe /></AuthProvider>)

    expect(await screen.findByText('error')).toBeInTheDocument()
    for (const [key] of recoverySlots) expect(sessionStorage.getItem(key)).toBeNull()
  })

  it('keeps recovery pointers intact when the returned tenant is not canonical', async () => {
    await storePointers()
    vi.mocked(gatewayAuth.identity).mockResolvedValue({...identity(), tenantId: '0020'})

    render(<AuthProvider><Probe /></AuthProvider>)

    expect(await screen.findByText('error')).toBeInTheDocument()
    expect(gatewayAuth.bootstrap).not.toHaveBeenCalled()
    for (const [key] of recoverySlots) expect(sessionStorage.getItem(key)).not.toBeNull()
  })

  it('preserves same-actor pointers across revalidation and temporary authentication failures', async () => {
    await storePointers()
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('ready')).toBeInTheDocument()
    const prior = recoverySlots.map(([key]) => sessionStorage.getItem(key))
    expect(prior.every(Boolean)).toBe(true)
    act(() => notifyAuthFailure('tenant-changed'))
    expect(screen.getByTestId('status')).toHaveTextContent('forbidden')
    vi.mocked(gatewayAuth.identity).mockRejectedValueOnce({status: 401})
    fireEvent.click(screen.getByRole('button', {name: '重新验证'}))
    expect(await screen.findByText('signed-out')).toBeInTheDocument()
    expect(recoverySlots.map(([key]) => sessionStorage.getItem(key))).toEqual(prior)

    vi.mocked(gatewayAuth.identity).mockResolvedValue({
      ...identity(), authorizationExpiresAt: identity().authorizationExpiresAt + 120,
      securityVersion: {realm: '2', client: '3', subject: '4'},
    })
    fireEvent.click(screen.getByRole('button', {name: '重新验证'}))
    expect(await screen.findByText('ready')).toBeInTheDocument()
    expect(recoverySlots.map(([key]) => sessionStorage.getItem(key))).toEqual(prior)
  })

  it('discards a stale fingerprint calculation before pruning current pointers', async () => {
    const current = identity()
    const stale = {...current, subject: 'stale-actor'}
    await storePointers(current)
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    const oldDigests: {promise: Promise<ArrayBuffer>; complete: (result: ArrayBuffer) => void; result: Promise<ArrayBuffer>}[] = []
    const hash = vi.spyOn(crypto.subtle, 'digest').mockImplementation((algorithm, data) => {
      const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data)
      if (!new TextDecoder().decode(bytes).includes(stale.subject)) return digest(algorithm, data)
      const delayed = deferred<ArrayBuffer>()
      oldDigests.push({promise: delayed.promise, complete: delayed.resolve, result: digest(algorithm, data)})
      return delayed.promise
    })
    vi.mocked(gatewayAuth.identity).mockResolvedValueOnce(stale)
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(hash).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', {name: '重新验证'}))
    expect(await screen.findByText('ready')).toBeInTheDocument()
    await act(async () => {
      await Promise.all(oldDigests.map(async pending => pending.complete(await pending.result)))
      await Promise.all(oldDigests.map(pending => pending.promise))
    })
    expect(screen.getByTestId('status')).toHaveTextContent('ready')
    for (const [key] of recoverySlots) expect(sessionStorage.getItem(key)).not.toBeNull()
    expect(gatewayAuth.bootstrap).toHaveBeenCalledTimes(1)
  })

  it('clears only registered recovery pointers after a current LOCAL_CLOSED logout', async () => {
    await storePointers()
    sessionStorage.setItem('portal.navigation', 'keep')
    vi.spyOn(gatewayAuth, 'logout').mockImplementation(async () => {
      gatewayAuth.context.invalidate()
      return closedLogout
    })
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('ready')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '退出登录'}))

    expect(await screen.findByText('本地会话已关闭，远端退出状态尚未确认。')).toBeInTheDocument()
    expect(screen.getByTestId('status')).toHaveTextContent('signed-out')
    for (const [key] of recoverySlots) expect(sessionStorage.getItem(key)).toBeNull()
    expect(sessionStorage.getItem('portal.navigation')).toBe('keep')
  })

  it('preserves pointers after logout fails or completes after a newer session', async () => {
    await storePointers()
    const completion = deferred<typeof closedLogout>()
    vi.spyOn(gatewayAuth, 'logout')
      .mockImplementationOnce(async () => { gatewayAuth.context.invalidate(); throw new Error('logout failed') })
      .mockImplementationOnce(() => { gatewayAuth.context.invalidate(); return completion.promise })
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('ready')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '退出登录'}))
    expect(await screen.findByText('退出操作未完成，请重试。')).toBeInTheDocument()
    for (const [key] of recoverySlots) expect(sessionStorage.getItem(key)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', {name: '退出登录'}))
    fireEvent.click(screen.getByRole('button', {name: '重新验证'}))
    expect(await screen.findByText('ready')).toBeInTheDocument()
    await act(async () => { completion.resolve(closedLogout); await completion.promise })
    expect(screen.queryByText('本地会话已关闭，远端退出状态尚未确认。')).not.toBeInTheDocument()
    for (const [key] of recoverySlots) expect(sessionStorage.getItem(key)).not.toBeNull()
  })
})
