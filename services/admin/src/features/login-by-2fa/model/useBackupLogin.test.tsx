import { useUserStore } from '@/entities';
import { server } from '@tests/mocks';
import { makeRouterWrapper } from '@tests/wrappers';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useBackupLogin } from './useBackupLogin';

const form = { username: 'testuser', password: 'pass123', backupCode: 'A1B2-C3D4' };

describe('useBackupLogin', () => {
  afterEach(() => {
    useUserStore.getState().clearAuth();
  });

  it('AUTHENTICATED 응답 시 accessToken과 user를 store에 저장한다', async () => {
    server.use(
      http.post('/api/auth/login/backup', () =>
        HttpResponse.json({
          status: 'AUTHENTICATED',
          accessToken: 'mock-access-token',
          user: { id: 'uuid-1', username: 'testuser', nickname: '테스트유저' },
        }),
      ),
    );

    const { result } = renderHook(() => useBackupLogin(), { wrapper: makeRouterWrapper({ initialEntries: ['/login/2fa'] }) });
    await act(() => result.current.loginWithBackup(form));

    await waitFor(() => expect(useUserStore.getState().accessToken).toBe('mock-access-token'));
    expect(useUserStore.getState().user?.username).toBe('testuser');
    expect(result.current.apiError).toBeNull();
  });

  it('BACKUP_CODE_INVALID 응답 시 apiError 가 parseApiError 결과로 채워지고 store 는 변경되지 않는다', async () => {
    server.use(
      http.post('/api/auth/login/backup', () =>
        HttpResponse.json(
          { code: 'BACKUP_CODE_INVALID', message: '유효하지 않은 백업 코드입니다' },
          { status: 400 },
        ),
      ),
    );

    const { result } = renderHook(() => useBackupLogin(), { wrapper: makeRouterWrapper({ initialEntries: ['/login/2fa'] }) });
    await act(() => result.current.loginWithBackup(form));

    await waitFor(() => expect(result.current.apiError).not.toBeNull());
    expect(result.current.apiError?.code).toBe('BACKUP_CODE_INVALID');
    expect(result.current.apiError?.message).toBe('유효하지 않은 백업 코드입니다');
    expect(useUserStore.getState().accessToken).toBeNull();
  });

  it('mutation 완료 후 isLoading 이 false 로 복귀한다', async () => {
    server.use(
      http.post('/api/auth/login/backup', () =>
        HttpResponse.json({
          status: 'AUTHENTICATED',
          accessToken: 'tok',
          user: { id: 'u', username: 'testuser', nickname: 'n' },
        }),
      ),
    );

    const { result } = renderHook(() => useBackupLogin(), { wrapper: makeRouterWrapper({ initialEntries: ['/login/2fa'] }) });
    expect(result.current.isLoading).toBe(false);

    await act(() => result.current.loginWithBackup(form));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(useUserStore.getState().accessToken).toBe('tok');
  });

  it('AUTHENTICATED 외 status 응답 시 store 와 apiError 모두 변경되지 않는다', async () => {
    server.use(
      http.post('/api/auth/login/backup', () =>
        HttpResponse.json({ status: '2FA_REQUIRED', challengeId: 'ch-1' }),
      ),
    );

    const { result } = renderHook(() => useBackupLogin(), { wrapper: makeRouterWrapper({ initialEntries: ['/login/2fa'] }) });
    await act(() => result.current.loginWithBackup(form));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(useUserStore.getState().accessToken).toBeNull();
    expect(result.current.apiError).toBeNull();
  });
});
