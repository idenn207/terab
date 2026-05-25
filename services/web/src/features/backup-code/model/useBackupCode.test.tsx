import { server } from '@tests/mocks';
import { makeQueryWrapper } from '@tests/wrappers';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useBackupCode } from './useBackupCode';

// MSW handler URL 이 `/api/api/...` 로 박힌 이유:
// backupCodeApi (`shared/api/axiosInstance.ts` 의 axiosAuth) 가 baseURL `/api` 위에서 URL `/api/auth/...` 를 다시 prepend 해 실제 XHR 은 `/api/api/...` 로 나감.
// dev 환경은 Vite proxy `path.replace(/^\/api/, '')`, prod 는 nginx `rewrite ^/api/(.*)$ /$1 break;` 가 한 번씩 strip 해 우연히 동작.
// 이 spec 은 actual XHR URL 을 기준으로 mock 한다. backupCodeApi 가 단일 prefix 또는 codegen 으로 정정되면 본 mock URL 도 동기 갱신 필요.

describe('useBackupCode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('마운트 시 count API를 호출하고 응답값을 state에 반영한다', async () => {
    server.use(
      http.get('/api/api/auth/backup-codes/count', () =>
        HttpResponse.json({ count: 7 }),
      ),
    );

    const { result } = renderHook(() => useBackupCode(), { wrapper: makeQueryWrapper() });

    await waitFor(() => expect(result.current.count).toBe(7));
    expect(result.current.generatedCodes).toBeNull();
    expect(result.current.isRegenerating).toBe(false);
  });

  it('confirm 취소 시 regenerate API를 호출하지 않고 state를 유지한다', async () => {
    server.use(
      http.get('/api/api/auth/backup-codes/count', () =>
        HttpResponse.json({ count: 5 }),
      ),
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { result } = renderHook(() => useBackupCode(), { wrapper: makeQueryWrapper() });
    await waitFor(() => expect(result.current.count).toBe(5));
    await act(() => result.current.regenerate());

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(result.current.generatedCodes).toBeNull();
    expect(result.current.isRegenerating).toBe(false);
    expect(result.current.count).toBe(5);
  });

  it('confirm 승인 시 regenerate 응답의 codes로 generatedCodes와 count를 갱신한다', async () => {
    const newCodes = ['A1B2-C3D4', 'E5F6-G7H8', 'I9J0-K1L2'];
    server.use(
      http.get('/api/api/auth/backup-codes/count', () =>
        HttpResponse.json({ count: 5 }),
      ),
      http.post('/api/api/auth/backup-codes/regenerate', () =>
        HttpResponse.json({ codes: newCodes }),
      ),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { result } = renderHook(() => useBackupCode(), { wrapper: makeQueryWrapper() });
    await waitFor(() => expect(result.current.count).toBe(5));
    await act(() => result.current.regenerate());

    expect(result.current.generatedCodes).toEqual(newCodes);
    expect(result.current.count).toBe(newCodes.length);
    expect(result.current.isRegenerating).toBe(false);
  });

  it('clearGeneratedCodes 호출 시 generatedCodes를 null로 리셋한다', async () => {
    const newCodes = ['A1B2-C3D4'];
    server.use(
      http.get('/api/api/auth/backup-codes/count', () =>
        HttpResponse.json({ count: 1 }),
      ),
      http.post('/api/api/auth/backup-codes/regenerate', () =>
        HttpResponse.json({ codes: newCodes }),
      ),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { result } = renderHook(() => useBackupCode(), { wrapper: makeQueryWrapper() });
    await waitFor(() => expect(result.current.count).toBe(1));
    await act(() => result.current.regenerate());
    expect(result.current.generatedCodes).toEqual(newCodes);

    act(() => result.current.clearGeneratedCodes());

    expect(result.current.generatedCodes).toBeNull();
  });
});
