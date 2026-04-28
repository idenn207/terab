import { useUserStore } from '@/entities';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@tests/mocks';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { LoginForm } from '../ui/LoginForm';

const renderWithRouter = (children: React.ReactNode) => render(<MemoryRouter initialEntries={['/login']}>{children}</MemoryRouter>);

describe('LoginForm', () => {
  afterEach(() => useUserStore.getState().clearAuth());

  it('아이디와 비밀번호 입력 필드가 렌더링된다', () => {
    renderWithRouter(<LoginForm />);
    expect(screen.getByLabelText('아이디')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
  });

  it('INVALID_CREDENTIALS 응답 시 오류 메시지를 표시한다', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ code: 'INVALID_CREDENTIALS', message: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderWithRouter(<LoginForm />);

    await user.type(screen.getByLabelText('아이디'), 'wrong');
    await user.type(screen.getByLabelText('비밀번호'), 'wrong');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('아이디 또는 비밀번호가 올바르지 않습니다')).toBeInTheDocument();
  });
});
