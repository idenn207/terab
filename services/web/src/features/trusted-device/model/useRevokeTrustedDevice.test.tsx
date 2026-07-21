import { server } from '@tests/mocks';
import { makeQueryWrapper } from '@tests/wrappers';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useRevokeTrustedDevice } from './useRevokeTrustedDevice';

describe('useRevokeTrustedDevice', () => {
  it('revoke 호출 시 path 의 id 가 codegen URL 에 정확히 전달되고 mutateAsync 가 resolve 한다', async () => {
    let receivedId: string | null = null;
    server.use(
      http.delete('/api/trusted-device/:id', ({ params }) => {
        receivedId = params.id as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useRevokeTrustedDevice(), { wrapper: makeQueryWrapper() });
    expect(result.current.isPending).toBe(false);

    await result.current.revoke({ id: 'device-id-1' });

    expect(receivedId).toBe('device-id-1');
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('TRUSTED_DEVICE_NOT_FOUND 응답 시 revoke 가 reject 하며 error 가 채워진다', async () => {
    server.use(
      http.delete('/api/trusted-device/:id', () =>
        HttpResponse.json({ code: 'TRUSTED_DEVICE_NOT_FOUND', message: '신뢰기기를 찾을 수 없습니다.' }, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useRevokeTrustedDevice(), { wrapper: makeQueryWrapper() });

    await expect(result.current.revoke({ id: 'missing-id' })).rejects.toBeDefined();
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it('reset 호출 후 error 가 null 로 복귀한다', async () => {
    server.use(http.delete('/api/trusted-device/:id', () => HttpResponse.json({ code: 'TRUSTED_DEVICE_NOT_FOUND', message: '없음' }, { status: 404 })));

    const { result } = renderHook(() => useRevokeTrustedDevice(), { wrapper: makeQueryWrapper() });

    await expect(result.current.revoke({ id: 'x' })).rejects.toBeDefined();
    await waitFor(() => expect(result.current.error).not.toBeNull());

    result.current.reset();

    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
