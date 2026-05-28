import { useUserStore } from '@/entities';
import { server } from '@tests/mocks';
import { makeRouterWrapper } from '@tests/wrappers';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLogout } from './useLogout';

describe('useLogout', () => {
  beforeEach(() => {
    useUserStore.getState().setAuth('initial-token', { id: 'u1', username: 'testuser', nickname: 't', permissions: [] });
  });

  afterEach(() => {
    useUserStore.getState().clearAuth();
  });

  it('logout 성공 시 clearAuth 가 호출되어 store 가 초기화된다', async () => {
    server.use(http.post('/api/auth/logout', () => HttpResponse.json({}, { status: 200 })));

    const { result } = renderHook(() => useLogout(), { wrapper: makeRouterWrapper({ initialEntries: ['/drive'] }) });
    expect(useUserStore.getState().accessToken).toBe('initial-token');

    await act(() => {
      result.current.logout();
      return Promise.resolve();
    });

    await waitFor(() => expect(useUserStore.getState().accessToken).toBeNull());
    expect(useUserStore.getState().user).toBeNull();
  });

  it('logout API 가 500 으로 실패해도 onSettled 에서 clearAuth 가 호출된다', async () => {
    server.use(http.post('/api/auth/logout', () => HttpResponse.json({ code: 'INTERNAL', message: 'oops' }, { status: 500 })));

    const { result } = renderHook(() => useLogout(), { wrapper: makeRouterWrapper({ initialEntries: ['/drive'] }) });

    await act(() => {
      result.current.logout();
      return Promise.resolve();
    });

    await waitFor(() => expect(useUserStore.getState().accessToken).toBeNull());
    expect(useUserStore.getState().user).toBeNull();
  });

  it('logout 이 codegen 의 /auth/logout 으로 POST 한다', async () => {
    let logoutHit = false;
    let method: string | null = null;
    server.use(
      http.post('/api/auth/logout', ({ request }) => {
        logoutHit = true;
        method = request.method;
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    const { result } = renderHook(() => useLogout(), { wrapper: makeRouterWrapper({ initialEntries: ['/drive'] }) });
    await act(() => {
      result.current.logout();
      return Promise.resolve();
    });

    await waitFor(() => expect(logoutHit).toBe(true));
    expect(method).toBe('POST');
  });
});
