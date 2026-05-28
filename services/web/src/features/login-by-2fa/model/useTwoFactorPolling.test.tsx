import { server } from '@/__tests__/mocks';
import { act, renderHook, waitFor } from '@testing-library/react';
import { makeRouterWrapper } from '@tests/wrappers';
import { http, HttpResponse } from 'msw';
import { useTwoFactorPolling } from '../model/useTwoFactorPolling';

describe('useTwoFactorPolling', () => {
  describe('초기 PENDING (fake timers)', () => {
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

      const { result } = renderHook(() => useTwoFactorPolling('challenge-id-1', false), {
        wrapper: makeRouterWrapper(),
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(result.current.options).toEqual(['47', '82', '13']);
      expect(result.current.remainingSeconds).toBe(55);
    });
  });

  describe('APPROVED → complete (real timers)', () => {
    it('APPROVED 응답이 두 번 연속 도착해도 complete 는 1회만 호출 (idempotency)', async () => {
      let completeCallCount = 0;
      server.use(
        http.get('/api/auth/2fa/challenge/:id/status', () =>
          HttpResponse.json({ status: 'APPROVED', userId: 'u-1' }),
        ),
        http.post('/api/auth/2fa/challenge/:id/complete', () => {
          completeCallCount += 1;
          return HttpResponse.json({
            status: 'AUTHENTICATED',
            accessToken: 'jwt',
            user: { id: 'u-1', username: 'a', nickname: 'A' },
          });
        }),
      );

      const { rerender } = renderHook(() => useTwoFactorPolling('challenge-id-2', false), {
        wrapper: makeRouterWrapper(),
      });

      await waitFor(() => expect(completeCallCount).toBe(1));

      rerender();
      rerender();
      await new Promise((r) => setTimeout(r, 50));

      expect(completeCallCount).toBe(1);
    });

    it('trustDevice=true 시 mutation body 에 trustDevice 가 전달된다', async () => {
      let receivedBody: unknown;
      server.use(
        http.get('/api/auth/2fa/challenge/:id/status', () =>
          HttpResponse.json({ status: 'APPROVED', userId: 'u-1' }),
        ),
        http.post('/api/auth/2fa/challenge/:id/complete', async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({
            status: 'AUTHENTICATED',
            accessToken: 'jwt',
            user: { id: 'u-1', username: 'a', nickname: 'A' },
          });
        }),
      );

      renderHook(() => useTwoFactorPolling('challenge-id-3', true), {
        wrapper: makeRouterWrapper(),
      });

      await waitFor(() => expect(receivedBody).toMatchObject({ trustDevice: true }));
    });

    it('trustDevice=false 시 mutation body 에 trustDevice=false 전달', async () => {
      let receivedBody: unknown;
      server.use(
        http.get('/api/auth/2fa/challenge/:id/status', () =>
          HttpResponse.json({ status: 'APPROVED', userId: 'u-1' }),
        ),
        http.post('/api/auth/2fa/challenge/:id/complete', async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({
            status: 'AUTHENTICATED',
            accessToken: 'jwt',
            user: { id: 'u-1', username: 'a', nickname: 'A' },
          });
        }),
      );

      renderHook(() => useTwoFactorPolling('challenge-id-4', false), {
        wrapper: makeRouterWrapper(),
      });

      await waitFor(() => expect(receivedBody).toMatchObject({ trustDevice: false }));
    });
  });
});
