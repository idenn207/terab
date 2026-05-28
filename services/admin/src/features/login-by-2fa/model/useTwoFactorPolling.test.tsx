import { server } from '@/__tests__/mocks';
import { act, renderHook } from '@testing-library/react';
import { makeRouterWrapper } from '@tests/wrappers';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/shared/lib', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib')>('@/shared/lib');
  return {
    ...actual,
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  };
});

const { logger } = await import('@/shared/lib');
const { useTwoFactorPolling } = await import('../model/useTwoFactorPolling');

describe('useTwoFactorPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigateMock.mockClear();
    vi.mocked(logger.error).mockClear();
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

  it('B6 — DENIED 응답 시 /login?error=2fa_denied 로 redirect 한다', async () => {
    server.use(
      http.get('/api/auth/2fa/challenge/:id/status', () =>
        HttpResponse.json({ status: 'DENIED' }),
      ),
    );

    renderHook(() => useTwoFactorPolling('chal-denied'), { wrapper: makeRouterWrapper() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(navigateMock).toHaveBeenCalledWith('/login?error=2fa_denied');
  });

  it('B6 — EXPIRED 응답 시 /login?error=2fa_denied 로 redirect 한다 (DENIED 와 동일 redirect)', async () => {
    server.use(
      http.get('/api/auth/2fa/challenge/:id/status', () =>
        HttpResponse.json({ status: 'EXPIRED' }),
      ),
    );

    renderHook(() => useTwoFactorPolling('chal-expired'), { wrapper: makeRouterWrapper() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(navigateMock).toHaveBeenCalledWith('/login?error=2fa_denied');
  });

  it('B6 — polling 5xx 시 logger.error + /login?error=2fa_polling_error redirect (H4 의 새 분기)', async () => {
    server.use(
      http.get('/api/auth/2fa/challenge/:id/status', () => new HttpResponse(null, { status: 500 })),
    );

    renderHook(() => useTwoFactorPolling('chal-5xx'), { wrapper: makeRouterWrapper() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(navigateMock).toHaveBeenCalledWith('/login?error=2fa_polling_error');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ challengeId: 'chal-5xx' }),
      '2FA polling failed',
    );
  });

  it('B6 — unmount 시 폴링이 정지된다 (이후 timer advance 해도 추가 호출 없음)', async () => {
    let callCount = 0;
    server.use(
      http.get('/api/auth/2fa/challenge/:id/status', () => {
        callCount += 1;
        return HttpResponse.json({ status: 'PENDING', options: ['1', '2', '3'], remainingSeconds: 30 });
      }),
    );

    const { unmount } = renderHook(() => useTwoFactorPolling('chal-unmount'), { wrapper: makeRouterWrapper() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    const beforeUnmount = callCount;

    unmount();

    // refetchInterval = 3000 — unmount 후 3초 폴링 두 번을 시뮬레이션해도 호출 0 추가여야 함
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(callCount).toBe(beforeUnmount);
  });
});
