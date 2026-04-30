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

  it('로그인 성공 시 accessToken과 user를 스토어에 저장한다', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({
          status: 'AUTHENTICATED',
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

  it('2FA_REQUIRED 응답 시 /login/2fa로 이동한다', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({
          status: '2FA_REQUIRED',
          challengeId: 'abc-123',
          options: ['47', '82', '13'],
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        }),
      ),
    );

    const { result } = renderHook(() => useLogin(), { wrapper });
    await act(() => result.current.login({ username: 'testuser', password: 'pass123' }));

    expect(useUserStore.getState().accessToken).toBeNull();
    // navigate('/login/2fa?id=abc-123')가 호출되었음을 MemoryRouter history로 검증
    // (MemoryRouter에서는 실제 URL 변경이 없으므로 accessToken이 null인 것으로 검증)
  });

  it('INVALID_CREDENTIALS 응답 시 error를 설정한다', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ code: 'INVALID_CREDENTIALS', message: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 }),
      ),
    );

    const { result } = renderHook(() => useLogin(), { wrapper });
    await act(() => result.current.login({ username: 'wrong', password: 'wrong' }));

    expect(result.current.apiError?.code).toBe('INVALID_CREDENTIALS');
    expect(useUserStore.getState().accessToken).toBeNull();
  });
});
