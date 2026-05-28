import { server } from '@/__tests__/mocks';
import { act, renderHook } from '@testing-library/react';
import { makeRouterWrapper } from '@tests/wrappers';
import { http, HttpResponse } from 'msw';
import { useTwoFactorPolling } from '../model/useTwoFactorPolling';

describe('useTwoFactorPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('마운트 시 상태를 조회하고 PENDING이면 options를 설정한다', async () => {
    server.use(
      http.get('/api/auth/2fa/challenge/:id/status', () =>
        HttpResponse.json({
          status: 'PENDING',
          options: ['47', '82', '13'],
          remainingSeconds: 55,
        }),
      ),
    );

    const { result } = renderHook(() => useTwoFactorPolling('challenge-id-1'), { wrapper: makeRouterWrapper() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.options).toEqual(['47', '82', '13']);
    expect(result.current.remainingSeconds).toBe(55);
  });

  it('APPROVED 이후 effect 가 재실행돼도 completeMutation 은 1회만 호출된다', async () => {
    server.use(http.get('/api/auth/2fa/challenge/:id/status', () => HttpResponse.json({ status: 'APPROVED' })));

    let completeCalls = 0;
    server.use(
      http.post(/\/auth\/2fa\/.+\/complete$/, () => {
        completeCalls += 1;
        return HttpResponse.json({
          status: 'AUTHENTICATED',
          accessToken: 'tok',
          user: { id: 'u1', username: 'u', nickname: 'u', permissions: [] },
        });
      }),
    );

    renderHook(() => useTwoFactorPolling('challenge-id-2'), { wrapper: makeRouterWrapper() });

    // setAuth 호출로 store 가 변경되면 hook 이 재실행되며 effect 도 재진입한다.
    // 가드가 없으면 같은 challengeId 로 complete 가 다시 호출되어 카운트가 2 이상이 됨.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(completeCalls).toBe(1);
  });
});
