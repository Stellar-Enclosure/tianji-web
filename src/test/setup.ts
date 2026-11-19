import '@testing-library/jest-dom/vitest'
import {afterEach, beforeEach, vi} from 'vitest'
import {gatewayAuth} from '../auth/gatewayAuth'
import {cleanup} from '@testing-library/react'
import {webcrypto} from 'node:crypto'

beforeEach(() => {
  vi.spyOn(gatewayAuth, 'authority').mockImplementation(() => ({apiBaseUrl: 'https://tianji.example.invalid',
    resource: 'https://tianji.example.invalid/resource', context: gatewayAuth.context,
    authorizationHeader: () => 'Bearer tianji-resource-token', invalidate: () => gatewayAuth.context.invalidate()}))
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', {value: webcrypto})
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void { }
    unobserve(): void { }
    disconnect(): void { }
  }
}
if (!window.matchMedia) {
  window.matchMedia = query => ({matches: false, media: query, onchange: null, addListener: () => {},
    removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
    dispatchEvent: () => false}) as MediaQueryList
}
