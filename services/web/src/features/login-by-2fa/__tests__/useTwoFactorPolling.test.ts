import { server } from '@/__tests__/mocks';
import { act, renderHook } from '@testing-library/react';
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

    const { result } = renderHook(() => useTwoFactorPolling('challenge-id-1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.options).toEqual(['47', '82', '13']);
    expect(result.current.remainingSeconds).toBe(55);
    expect(result.current.pollStatus).toBe('polling');
  });

  it('APPROVED 응답 수신 시 pollStatus를 approved로 설정한다', async () => {
    server.use(
      http.get('/api/auth/2fa/challenge/:id/status', () =>
        HttpResponse.json({
          status: 'APPROVED',
          accessToken: 'tok-abc',
          user: { id: 'u1', username: 'user1', nickname: '유저' },
        }),
      ),
    );

    const { result } = renderHook(() => useTwoFactorPolling('challenge-id-2'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.pollStatus).toBe('approved');
    expect(result.current.approvedData?.accessToken).toBe('tok-abc');
  });
});
