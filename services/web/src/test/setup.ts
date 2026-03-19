import '@testing-library/jest-dom'
import { server } from './mocks/server'

// MSW 서버 lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
