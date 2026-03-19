// ┌──────────────────────────────────────────────────────────────┐
// │ API Mocking Test Template                                     │
// │ MSW + React Testing Library 기반 API 연동 테스트용            │
// │ 복사 후 파일명을 [Feature].test.tsx 로 변경하여 사용          │
// └──────────────────────────────────────────────────────────────┘

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../test/mocks/server'
// import { YourComponent } from '../components/YourComponent'

// 테스트 데이터
const mockItems = [
  { id: 1, name: 'document.pdf', type: 'FILE' },
  { id: 2, name: 'photos', type: 'FOLDER' },
]

describe('YourComponent (API 연동)', () => {
  describe('데이터 로딩', () => {
    it('should display items after successful fetch', async () => {
      // API 핸들러 등록
      server.use(
        http.get('/api/items', () => {
          return HttpResponse.json(mockItems)
        })
      )

      // render(<YourComponent />)

      // 비동기 데이터 로딩 대기
      // await waitFor(() => {
      //   expect(screen.getByText('document.pdf')).toBeInTheDocument()
      //   expect(screen.getByText('photos')).toBeInTheDocument()
      // })
    })

    it('should show loading state', () => {
      // 응답을 지연시켜 로딩 상태 테스트
      server.use(
        http.get('/api/items', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return HttpResponse.json(mockItems)
        })
      )

      // render(<YourComponent />)
      // expect(screen.getByText('로딩 중...')).toBeInTheDocument()
    })

    it('should show error message on API failure', async () => {
      server.use(
        http.get('/api/items', () => {
          return HttpResponse.json(
            { message: '서버 오류' },
            { status: 500 }
          )
        })
      )

      // render(<YourComponent />)

      // await waitFor(() => {
      //   expect(screen.getByRole('alert')).toBeInTheDocument()
      // })
    })
  })

  describe('데이터 제출', () => {
    it('should submit form and show success message', async () => {
      const user = userEvent.setup()

      server.use(
        http.post('/api/items', async ({ request }) => {
          const body = await request.json()
          return HttpResponse.json({ id: 3, ...body as object }, { status: 201 })
        })
      )

      // render(<YourComponent />)

      // 폼 입력
      // await user.type(screen.getByLabelText('이름'), 'new-file.txt')
      // await user.click(screen.getByRole('button', { name: '생성' }))

      // 성공 메시지 확인
      // await waitFor(() => {
      //   expect(screen.getByText('생성되었습니다')).toBeInTheDocument()
      // })
    })
  })
})
