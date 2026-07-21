import { server } from '@tests/mocks';
import { makeQueryWrapper } from '@tests/wrappers';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useTrustedDeviceList } from './useTrustedDeviceList';

describe('useTrustedDeviceList', () => {
  it('초기 isLoading 은 true, 응답 후 devices 배열이 채워진다', async () => {
    server.use(
      http.get('/api/trusted-device', () =>
        HttpResponse.json([
          { id: 'd1', userAgent: 'Pixel 9 / Chrome 134', createdAt: '2026-05-01T09:00:00.000Z' },
          { id: 'd2', userAgent: 'iPhone 15 / Safari', createdAt: '2026-05-15T10:30:00.000Z' },
        ]),
      ),
    );

    const { result } = renderHook(() => useTrustedDeviceList(), { wrapper: makeQueryWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.devices).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.devices).toHaveLength(2);
    expect(result.current.devices[0]).toMatchObject({ id: 'd1', userAgent: 'Pixel 9 / Chrome 134' });
  });

  it('빈 응답이면 devices 는 빈 배열', async () => {
    server.use(http.get('/api/trusted-device', () => HttpResponse.json([])));

    const { result } = renderHook(() => useTrustedDeviceList(), { wrapper: makeQueryWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.devices).toEqual([]);
  });

  it('500 응답이어도 devices 는 빈 배열 + error 가 채워진다', async () => {
    server.use(http.get('/api/trusted-device', () => HttpResponse.json({ code: 'INTERNAL', message: 'oops' }, { status: 500 })));

    const { result } = renderHook(() => useTrustedDeviceList(), { wrapper: makeQueryWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.devices).toEqual([]);
    expect(result.current.error).not.toBeNull();
  });
});
