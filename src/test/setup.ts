import '@testing-library/jest-dom/vitest'
import {afterEach} from 'vitest'
import {cleanup} from '@testing-library/react'
import {webcrypto} from 'node:crypto'

afterEach(() => cleanup())

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
