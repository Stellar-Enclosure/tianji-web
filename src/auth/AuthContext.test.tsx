import {webcrypto} from 'node:crypto'
import type {PublicOAuthRegistration} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {notifyAuthFailure} from '../api/client'
import {identity, snapshot} from '../test/fixtures'
import {AuthProvider, useAuth} from './AuthContext'
import {createTianjiAuth, gatewayAuth} from './gatewayAuth'

function Probe() {
  const auth = useAuth()
  return <div><span data-testid="status">{auth.status}</span>
    <span data-testid="tenant">{auth.authorization?.identity.tenantId ?? ''}</span>
    <span data-testid="can-cancel-run">{String(auth.allows('tianji.button.runDetail.cancel'))}</span>
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
    expect(screen.getByTestId('can-cancel-run')).toHaveTextContent('true')
    act(() => gatewayAuth.context.invalidate())
    expect(screen.getByTestId('status')).toHaveTextContent('signed-out')
    expect(screen.getByTestId('tenant')).toHaveTextContent('')
  })

  it('rejects a permission snapshot from another tenant', async () => {
    vi.mocked(gatewayAuth.bootstrap).mockResolvedValue(snapshot('21'))
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('error')).toBeInTheDocument()
    expect(screen.getByTestId('tenant')).toHaveTextContent('')
    expect(screen.getByTestId('can-cancel-run')).toHaveTextContent('false')
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
    expect(screen.getByTestId('can-cancel-run')).toHaveTextContent('false')
  })

  it('admits a Process-only snapshot and invalidates its permission with the request epoch', async () => {
    vi.mocked(gatewayAuth.bootstrap).mockResolvedValue(snapshot('20', [releaseRead]))
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('ready')).toBeInTheDocument()
    expect(screen.getByTestId('can-read-release')).toHaveTextContent('true')
    expect(screen.getByTestId('can-cancel-run')).toHaveTextContent('false')
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
      ...identity(), accessExpiresAt: identity().accessExpiresAt + 120_000,
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

  it('clears only registered recovery pointers after a successful local logout', async () => {
    await storePointers()
    sessionStorage.setItem('portal.navigation', 'keep')
    vi.spyOn(gatewayAuth, 'logout').mockImplementation(async () => {
      gatewayAuth.context.invalidate()
    })
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('ready')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: '退出登录'}))

    await waitFor(() => expect(recoverySlots.every(([key]) => sessionStorage.getItem(key) === null)).toBe(true))
    expect(screen.getByTestId('status')).toHaveTextContent('signed-out')
    for (const [key] of recoverySlots) expect(sessionStorage.getItem(key)).toBeNull()
    expect(sessionStorage.getItem('portal.navigation')).toBe('keep')
  })

  it('preserves pointers after logout fails or completes after a newer session', async () => {
    await storePointers()
    const completion = deferred<void>()
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
    await act(async () => { completion.resolve(); await completion.promise })
    expect(screen.queryByText('本地会话已关闭，远端退出状态尚未确认。')).not.toBeInTheDocument()
    for (const [key] of recoverySlots) expect(sessionStorage.getItem(key)).not.toBeNull()
  })
})

const webOrigin = 'https://tianji.example.invalid'
const base = '/console/'
const resource = webOrigin + '/resource'
const registration = (tenantId: string): PublicOAuthRegistration => {
  const issuer = 'https://identity.example.invalid/tenants/' + tenantId
  const id = 'tianji-' + tenantId
  return {id, tenantId, clientId: id, issuer, resource, apiBaseUrl: webOrigin, scopes: ['openid', 'tianji:read'],
    redirectUri: webOrigin + base + 'auth/oidc/callback/' + id,
    popupRedirectUri: webOrigin + base + 'auth/oidc/popup/' + id,
    authorizationEndpoint: issuer + '/oauth2/authorize', tokenEndpoint: issuer + '/oauth2/token',
    jwksUri: issuer + '/.well-known/jwks.json', browserBound: false}
}
const tenant = registration('20')
const otherTenant = registration('21')
const config = JSON.stringify({webOrigin, activeResource: tenant.id, resource, apiBaseUrl: webOrigin,
  registrations: [tenant, otherTenant]})
const encodeJwtPart = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

it('uses the installed SDK for PKCE, signed Resource authorization and direct permission bootstrap', async () => {
  sessionStorage.clear()
  const fetcher = vi.fn<typeof fetch>()
  const navigate = vi.fn<(url: string) => void>()
  const options = {crypto: webcrypto as unknown as Crypto, sessionStorage, fetch: fetcher, navigate,
    replaceLocation: vi.fn<(url: string) => void>()}
  const browser = {location: {origin: webOrigin}} as Window
  const create = () => createTianjiAuth(config, base, browser, options)
  const start = create()
  const algorithm = 'RSASSA-PKCS1-v1_5'
  const keys = await webcrypto.subtle.generateKey({name: algorithm, modulusLength: 2048, hash: 'SHA-256',
    publicExponent: new Uint8Array([1, 0, 1])}, true, ['verify', 'sign'])
  const publicKey = {...await webcrypto.subtle.exportKey('jwk', keys.publicKey), alg: 'RS256', kid: 'test-key'}
  const now = Math.floor(Date.now() / 1000)
  const sign = async (typ: 'JWT' | 'at+jwt', claims: object) => {
    const content = encodeJwtPart({alg: 'RS256', typ, kid: 'test-key'}) + '.'
      + encodeJwtPart({iss: tenant.issuer, sub: 'verified-user', iat: now, exp: now + 300, ...claims})
    const signature = await webcrypto.subtle.sign(algorithm, keys.privateKey, new TextEncoder().encode(content))
    return content + '.' + Buffer.from(signature).toString('base64url')
  }
  const issue = async (authorization: URL, audience: string) => {
    const id_token = await sign('JWT', {aud: [tenant.clientId], nonce: authorization.searchParams.get('nonce')})
    const access_token = await sign('at+jwt', {aud: [audience], tenant_id: tenant.tenantId,
      client_id: tenant.clientId, principal_type: 'USER', scope_context: 'TENANT', scope: tenant.scopes.join(' ')})
    fetcher.mockResolvedValueOnce(Response.json({id_token, access_token, token_type: 'Bearer', expires_in: 300}))
      .mockResolvedValueOnce(Response.json({keys: [publicKey]}))
    return access_token
  }
  const callbackFor = (authorization: URL) => {
    const callback = new URL(tenant.redirectUri)
    callback.search = new URLSearchParams({state: authorization.searchParams.get('state')!, code: 'test-one-use-code'}).toString()
    return callback.href
  }

  await start.login('/runs/run-1')
  const authorization = new URL(navigate.mock.lastCall![0])
  expect(authorization.origin + authorization.pathname).toBe(tenant.authorizationEndpoint)
  expect(authorization.searchParams.get('code_challenge_method')).toBe('S256')
  expect(authorization.searchParams.get('resource')).toBe(resource)
  const accessToken = await issue(authorization, resource)

  const reloaded = create()
  const callback = callbackFor(authorization)
  const finishing = reloaded.completeCallback(callback, false)
  expect(reloaded.completeCallback(callback, false)).toBe(finishing)
  await expect(finishing).resolves.toBe('/runs/run-1')
  await expect(reloaded.identity()).resolves.toMatchObject({tenantId: '20', subject: 'verified-user', resource})
  expect(options.replaceLocation).toHaveBeenCalledWith(tenant.redirectUri)
  await expect(reloaded.completeCallback(callback, false)).rejects.toMatchObject({code: 'INVALID_CALLBACK'})
  expect(() => reloaded.authority('21')).toThrow(expect.objectContaining({status: 409}))
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([tenant.tokenEndpoint, tenant.jwksUri])

  const permissionPath = '/api/v1/authorization/effective-permissions'
  fetcher.mockResolvedValueOnce(Response.json({success: true, data: {subject: 'verified-user'}}))
  await expect(reloaded.bootstrap(permissionPath)).resolves.toEqual({subject: 'verified-user'})
  const [url, request] = fetcher.mock.lastCall!
  expect(url).toBe(webOrigin + permissionPath)
  expect(request?.credentials).toBe('omit')
  expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer ' + accessToken)
  const oldRequest = reloaded.context.capture()
  await reloaded.logout(true)
  expect(oldRequest.signal.aborted).toBe(true)
  expect(navigate.mock.lastCall![0]).toBe(tenant.issuer + '/logout')

  await reloaded.login('/')
  const second = new URL(navigate.mock.lastCall![0])
  await issue(second, webOrigin + '/other-resource')
  await expect(reloaded.completeCallback(callbackFor(second), false)).rejects.toMatchObject({code: 'INVALID_TOKEN'})
  await expect(reloaded.identity()).resolves.toBeUndefined()
  expect(sessionStorage.length).toBe(0)
})

it('accepts only the configured tenant and Resource hints for an embedded popup', async () => {
  const open = vi.fn().mockReturnValue(null)
  const browser = {origin: webOrigin, location: {origin: webOrigin}, open, __POWERED_BY_WUJIE__: true,
    $wujie: {props: {resourceContext: {issuer: otherTenant.issuer, tenantId: '21', resource}}}}
  const auth = createTianjiAuth(config, base, browser as unknown as Window, {crypto: webcrypto as unknown as Crypto})
  expect(auth.standaloneUrl()).toBe(webOrigin + base)
  await expect(auth.login('/')).rejects.toMatchObject({code: 'POPUP_UNAVAILABLE'})
  expect(open).toHaveBeenCalledTimes(1)

  browser.$wujie.props.resourceContext.resource = webOrigin + '/other-resource'
  await expect(auth.login('/')).rejects.toMatchObject({code: 'INVALID_CONFIGURATION'})
  expect(open).toHaveBeenCalledTimes(1)
  browser.$wujie.props.resourceContext.resource = resource
  browser.origin = 'https://different-portal.example.invalid'
  await expect(auth.login('/')).rejects.toMatchObject({code: 'POPUP_UNAVAILABLE'})
  expect(open).toHaveBeenCalledTimes(1)
})
