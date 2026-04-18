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

  it('should return 아이디 and 비밀번호 fields', () => {
    renderWithRouter(<LoginForm />);
    expect(screen.getByLabelText('아이디')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
  });

  it('should show error message on INVALID_CREDENTIALS', async () => {
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

    expect(await screen.findByText('ID 또는 비밀번호가 올바르지 않습니다')).toBeInTheDocument();
  });
});
