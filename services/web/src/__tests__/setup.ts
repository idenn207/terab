import '@testing-library/jest-dom'
import { server } from './mocks/server'

// jsdom 에는 ResizeObserver 가 없음 — Headless UI v2 Menu/Combobox 등의 floating element 추적에 필수
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

// MSW 서버 lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
