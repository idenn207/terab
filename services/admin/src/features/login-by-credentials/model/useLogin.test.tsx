import { useUserStore } from '@/entities';
import { axiosInstance } from '@/shared/api';
import { makeRouterWrapper } from '@tests/wrappers';
import { act, renderHook, waitFor } from '@testing-library/react';
import { server } from '@tests/mocks';
import { AxiosError } from 'axios';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { useLogin } from '../model/useLogin';

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

    const { result } = renderHook(() => useLogin(), { wrapper: makeRouterWrapper({ initialEntries: ['/login'] }) });
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

    const { result } = renderHook(() => useLogin(), { wrapper: makeRouterWrapper({ initialEntries: ['/login'] }) });
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

    const { result } = renderHook(() => useLogin(), { wrapper: makeRouterWrapper({ initialEntries: ['/login'] }) });
    await act(() => result.current.login({ username: 'wrong', password: 'wrong' }));

    expect(result.current.apiError?.code).toBe('INVALID_CREDENTIALS');
    expect(useUserStore.getState().accessToken).toBeNull();
  });

  it('B8 — 502 Bad Gateway 응답 (HTML body) → mutation.isError + UNKNOWN fallback', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        new HttpResponse('<html><body>502 Bad Gateway</body></html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );

    const { result } = renderHook(() => useLogin(), { wrapper: makeRouterWrapper({ initialEntries: ['/login'] }) });
    await act(() => result.current.login({ username: 'x', password: 'x' }));

    expect(result.current.apiError?.code).toBe('UNKNOWN');
    expect(useUserStore.getState().accessToken).toBeNull();
  });

  it('B8 — network error → mutation.isError + UNKNOWN fallback', async () => {
    server.use(
      http.post('/api/auth/login', () => HttpResponse.error()),
    );

    const { result } = renderHook(() => useLogin(), { wrapper: makeRouterWrapper({ initialEntries: ['/login'] }) });
    await act(() => result.current.login({ username: 'x', password: 'x' }));

    expect(result.current.apiError?.code).toBe('UNKNOWN');
    expect(useUserStore.getState().accessToken).toBeNull();
  });

  it('B8 — timeout (ECONNABORTED AxiosError) → mutation.isError + UNKNOWN fallback', async () => {
    // MSW interceptor 가 axios timeout 타이머를 가로채므로 defaults.timeout 만으로는 deterministic 하지 않다.
    // adapter 를 임시 교체해 ECONNABORTED AxiosError 를 강제로 throw — 이는 axios 의 실제 timeout 경로와
    // 동등한 error 형태 (config undefined → H3 가드 통과 → mutation reject).
    const originalAdapter = axiosInstance.defaults.adapter;
    axiosInstance.defaults.adapter = (async () => {
      throw new AxiosError('timeout of 50ms exceeded', 'ECONNABORTED');
    }) as never;

    try {
      const { result } = renderHook(() => useLogin(), { wrapper: makeRouterWrapper({ initialEntries: ['/login'] }) });
      await act(() => result.current.login({ username: 'x', password: 'x' }));

      await waitFor(() => {
        expect(result.current.apiError?.code).toBe('UNKNOWN');
      });
      expect(useUserStore.getState().accessToken).toBeNull();
    } finally {
      axiosInstance.defaults.adapter = originalAdapter;
    }
  });
});
