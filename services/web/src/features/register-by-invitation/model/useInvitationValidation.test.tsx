import { server } from '@tests/mocks';
import { makeQueryWrapper } from '@tests/wrappers';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useInvitationValidation } from './useInvitationValidation';

describe('useInvitationValidation', () => {
  it('빈 token 인 경우 query 를 발사하지 않고 valid 가 즉시 false 가 된다', () => {
    const { result } = renderHook(() => useInvitationValidation(''), { wrapper: makeQueryWrapper() });

    expect(result.current.valid).toBe(false);
  });

  it('valid 토큰 + data.valid=true 응답 시 valid 가 true 가 된다', async () => {
    server.use(
      http.get('/api/invitations/:token', () => HttpResponse.json({ valid: true })),
    );

    const { result } = renderHook(() => useInvitationValidation('good-token'), { wrapper: makeQueryWrapper() });

    await waitFor(() => expect(result.current.valid).toBe(true));
  });

  it('valid 토큰 + data.valid=false 응답 시 valid 가 false 가 된다', async () => {
    server.use(
      http.get('/api/invitations/:token', () => HttpResponse.json({ valid: false })),
    );

    const { result } = renderHook(() => useInvitationValidation('expired-token'), { wrapper: makeQueryWrapper() });

    await waitFor(() => expect(result.current.valid).toBe(false));
  });

  it('valid 토큰 + 서버 4xx error 응답 시 valid 가 false 가 된다', async () => {
    server.use(
      http.get('/api/invitations/:token', () =>
        HttpResponse.json({ code: 'INVITATION_NOT_FOUND', message: 'not found' }, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useInvitationValidation('bad-token'), { wrapper: makeQueryWrapper() });

    await waitFor(() => expect(result.current.valid).toBe(false));
  });
});
