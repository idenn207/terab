import { useUserStore } from '@/entities';
import { act, renderHook } from '@testing-library/react';
import { server } from '@tests/mocks';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { useLogin } from '../model/useLogin';

const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter initialEntries={['/login']}>{children}</MemoryRouter>;

describe('useLogin', () => {
  afterEach(() => {
    useUserStore.getState().clearAuth();
  });

  it('should set accessToken and user on successful login', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({
          accessToken: 'mock-access-token',
          user: { id: 'uuid-1', username: 'testuser', nickname: '테스트유저' },
        }),
      ),
    );

    const { result } = renderHook(() => useLogin(), { wrapper });
    await act(() => result.current.login({ username: 'testuser', password: 'pass123' }));

    expect(useUserStore.getState().accessToken).toBe('mock-access-token');
    expect(useUserStore.getState().user?.username).toBe('testuser');
  });

  it('should set error on INVALID_CREDENTIALS', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ code: 'INVALID_CREDENTIALS', message: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 }),
      ),
    );

    const { result } = renderHook(() => useLogin(), { wrapper });
    await act(() => result.current.login({ username: 'wrong', password: 'wrong' }));

    expect(result.current.error?.code).toBe('INVALID_CREDENTIALS');
    expect(useUserStore.getState().accessToken).toBeNull();
  });
});
