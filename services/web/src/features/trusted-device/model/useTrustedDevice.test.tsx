import { server } from '@tests/mocks';
import { makeQueryWrapper } from '@tests/wrappers';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useTrustedDevice } from './useTrustedDevice';

describe('useTrustedDevice', () => {
  it('register 호출 시 codegen 의 POST /trusted-device 가 hit 되고 isRegistering 이 false 로 복귀한다', async () => {
    let registerHit = false;
    server.use(
      http.post('/api/trusted-device', () => {
        registerHit = true;
        return HttpResponse.json({ id: 'device-new', label: 'Chromium', registeredAt: '2026-05-25T10:00:00Z' });
      }),
    );

    const { result } = renderHook(() => useTrustedDevice(), { wrapper: makeQueryWrapper() });
    expect(result.current.isRegistering).toBe(false);

    await act(() => {
      result.current.register();
      return Promise.resolve();
    });

    await waitFor(() => expect(registerHit).toBe(true));
    await waitFor(() => expect(result.current.isRegistering).toBe(false));
  });

  it('revoke 호출 시 path 의 id 가 codegen URL 에 정확히 전달되고 isRevoking 이 false 로 복귀한다', async () => {
    let receivedId: string | null = null;
    server.use(
      http.delete('/api/trusted-device/:id', ({ params }) => {
        receivedId = params.id as string;
        return HttpResponse.json({});
      }),
    );

    const { result } = renderHook(() => useTrustedDevice(), { wrapper: makeQueryWrapper() });

    await act(() => {
      result.current.revoke('device-id-1');
      return Promise.resolve();
    });

    await waitFor(() => expect(receivedId).toBe('device-id-1'));
    await waitFor(() => expect(result.current.isRevoking).toBe(false));
  });

  it('register 가 500 으로 실패해도 isRegistering 이 false 로 복귀한다', async () => {
    server.use(
      http.post('/api/trusted-device', () =>
        HttpResponse.json({ code: 'INTERNAL', message: 'oops' }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useTrustedDevice(), { wrapper: makeQueryWrapper() });

    await act(() => {
      result.current.register();
      return Promise.resolve();
    });

    await waitFor(() => expect(result.current.isRegistering).toBe(false));
  });
});
