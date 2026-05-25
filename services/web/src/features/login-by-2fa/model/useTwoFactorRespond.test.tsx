import { server } from '@tests/mocks';
import { makeRouterWrapper } from '@tests/wrappers';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useTwoFactorRespond } from './useTwoFactorRespond';

const challengeId = 'challenge-id-1';

describe('useTwoFactorRespond', () => {
  it('status PENDING 응답 시 respondStatus 가 selecting 으로 전이되고 options 가 채워진다', async () => {
    server.use(
      http.get('/api/auth/2fa/challenge/:id/status', () =>
        HttpResponse.json({ status: 'PENDING', options: ['47', '82', '13'], remainingSeconds: 55 }),
      ),
    );

    const { result } = renderHook(() => useTwoFactorRespond(challengeId), { wrapper: makeRouterWrapper() });

    await waitFor(() => expect(result.current.respondStatus).toBe('selecting'));
    expect(result.current.options).toEqual(['47', '82', '13']);
  });

  it('status PENDING 이 아닌 응답 시 respondStatus 가 expired 로 전이되고 options 는 빈 배열이다', async () => {
    server.use(
      http.get('/api/auth/2fa/challenge/:id/status', () =>
        HttpResponse.json({ status: 'DENIED' }),
      ),
    );

    const { result } = renderHook(() => useTwoFactorRespond(challengeId), { wrapper: makeRouterWrapper() });

    await waitFor(() => expect(result.current.respondStatus).toBe('expired'));
    expect(result.current.options).toEqual([]);
  });

  it('query 가 error 를 반환하면 respondStatus 가 expired 로 전이된다', async () => {
    server.use(
      http.get('/api/auth/2fa/challenge/:id/status', () =>
        HttpResponse.json({ code: 'CHALLENGE_NOT_FOUND', message: 'not found' }, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useTwoFactorRespond(challengeId), { wrapper: makeRouterWrapper() });

    await waitFor(() => expect(result.current.respondStatus).toBe('expired'));
    expect(result.current.options).toEqual([]);
  });

  it('respond 호출 시 codegen 의 respond URL 로 mutation 이 호출되고 성공 시 respondStatus 가 done 으로 전이된다', async () => {
    const captured: { hit: boolean; id: string | null; body: { selectedNumber?: string } | null } = {
      hit: false,
      id: null,
      body: null,
    };

    server.use(
      http.get('/api/auth/2fa/challenge/:id/status', () =>
        HttpResponse.json({ status: 'PENDING', options: ['47', '82', '13'], remainingSeconds: 55 }),
      ),
      http.post('/api/auth/2fa/challenge/:id/respond', async ({ params, request }) => {
        captured.hit = true;
        captured.id = params.id as string;
        captured.body = (await request.json()) as { selectedNumber?: string };
        return HttpResponse.json({ status: 'AUTHENTICATED' });
      }),
    );

    const { result } = renderHook(() => useTwoFactorRespond(challengeId), { wrapper: makeRouterWrapper() });
    await waitFor(() => expect(result.current.respondStatus).toBe('selecting'));

    await act(() => result.current.respond('47'));

    await waitFor(() => expect(result.current.respondStatus).toBe('done'));
    expect(captured.hit).toBe(true);
    expect(captured.id).toBe(challengeId);
    expect(captured.body?.selectedNumber).toBe('47');
  });
});
