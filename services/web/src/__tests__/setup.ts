import '@testing-library/jest-dom'
import { expect } from 'vitest'
import { toHaveNoViolations } from 'vitest-axe/matchers'
import { server } from './mocks/server'

// vitest-axe 의 `extend-expect` 자동 등록은 chai-style augmentation 이라 vitest 4 의 expect 시스템에 매처를 주입하지 못한다 — 명시 호출 필요
expect.extend({ toHaveNoViolations })

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
