// API 핸들러 정의
// 글로벌 핸들러는 최소화하고, 테스트별로 server.use()를 사용하여 개별 핸들러를 추가한다.
//
// 사용 예시:
// import { http, HttpResponse } from 'msw'
// import { server } from '../test/mocks/server'
//
// server.use(
//   http.get('/api/files', () => {
//     return HttpResponse.json([{ id: 1, name: 'test.txt' }])
//   })
// )

import type { RequestHandler } from 'msw'

export const handlers: RequestHandler[] = []
