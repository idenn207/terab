import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@tests/mocks';
import { makeQueryWrapper } from '@tests/wrappers';
import { useInvite } from './useInvite';

const handlerUrl = '/api/admin/users/invitations';

const sampleInvitation = {
  token: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  url: 'https://drive.skypark207.com/register/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  expiresAt: '2026-06-05T10:00:00.000Z',
};

describe('useInvite', () => {
  it('초기 상태에 invitation 이 null 이다', () => {
    const { result } = renderHook(() => useInvite(), { wrapper: makeQueryWrapper() });
    expect(result.current.invitation).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('invite 호출 성공 시 invitation 이 채워진다', async () => {
    server.use(http.post(handlerUrl, () => HttpResponse.json(sampleInvitation, { status: 201 })));
    const { result } = renderHook(() => useInvite(), { wrapper: makeQueryWrapper() });

    act(() => result.current.invite(7));
    await waitFor(() => expect(result.current.invitation).toEqual(sampleInvitation));
    expect(result.current.errorMessage).toBeNull();
  });

  it('서버 오류 시 errorMessage 가 채워진다', async () => {
    server.use(http.post(handlerUrl, () => new HttpResponse(null, { status: 500 })));
    const { result } = renderHook(() => useInvite(), { wrapper: makeQueryWrapper() });

    act(() => result.current.invite(7));
    await waitFor(() => expect(result.current.errorMessage).not.toBeNull());
    expect(result.current.invitation).toBeNull();
  });

  it('reset 호출 시 상태가 초기화된다', async () => {
    server.use(http.post(handlerUrl, () => HttpResponse.json(sampleInvitation, { status: 201 })));
    const { result } = renderHook(() => useInvite(), { wrapper: makeQueryWrapper() });

    act(() => result.current.invite(7));
    await waitFor(() => expect(result.current.invitation).not.toBeNull());

    act(() => result.current.reset());
    expect(result.current.invitation).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });
});
