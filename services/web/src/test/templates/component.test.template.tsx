// ┌──────────────────────────────────────────────────────────────┐
// │ Component Test Template                                       │
// │ React Testing Library 기반 컴포넌트 테스트용                  │
// │ 복사 후 파일명을 [Component].test.tsx 로 변경하여 사용        │
// └──────────────────────────────────────────────────────────────┘

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// import { YourComponent } from '../components/YourComponent'

describe('YourComponent', () => {
  // 공통 렌더링 헬퍼 (필요시)
  // const renderComponent = (props = {}) => {
  //   const defaultProps = { title: 'Test', items: [] }
  //   return render(<YourComponent {...defaultProps} {...props} />)
  // }

  describe('렌더링', () => {
    it('should render title', () => {
      // renderComponent({ title: 'Hello' })
      // expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument()
    });

    it('should render empty state when no items', () => {
      // renderComponent({ items: [] })
      // expect(screen.getByText('항목이 없습니다')).toBeInTheDocument()
    });
  });

  describe('사용자 인터랙션', () => {
    it('should call onClick when button is clicked', async () => {
      const user = userEvent.setup();
      // const handleClick = vi.fn()
      // renderComponent({ onClick: handleClick })

      // await user.click(screen.getByRole('button', { name: '확인' }))

      // expect(handleClick).toHaveBeenCalledTimes(1)
    });

    it('should update input value on type', async () => {
      const user = userEvent.setup();
      // renderComponent()

      // const input = screen.getByRole('textbox', { name: '이름' })
      // await user.type(input, 'Hello')

      // expect(input).toHaveValue('Hello')
    });
  });

  describe('조건부 렌더링', () => {
    it('should show loading spinner when loading', () => {
      // renderComponent({ isLoading: true })
      // expect(screen.getByRole('progressbar')).toBeInTheDocument()
    });

    it('should show error message on error', () => {
      // renderComponent({ error: '오류가 발생했습니다' })
      // expect(screen.getByRole('alert')).toHaveTextContent('오류가 발생했습니다')
    });
  });
});
