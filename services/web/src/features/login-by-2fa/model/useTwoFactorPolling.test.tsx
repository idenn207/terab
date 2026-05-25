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
      http.get('/api/2fa/challenge/:id/status', () =>
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
});
