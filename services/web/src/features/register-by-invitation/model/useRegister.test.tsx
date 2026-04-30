import { useUserStore } from '@/entities';
import { act, renderHook } from '@testing-library/react';
import { server } from '@tests/mocks';
import { http, HttpResponse } from 'msw';
import { useRegister } from './useRegister';

describe('useRegister', () => {
  afterEach(() => {
    useUserStore.getState().clearAuth();
  });

  it('가입 성공 시 accessToken과 user를 스토어에 저장하고 onSuccess를 호출한다', async () => {
    const mockBackupCodes = Array.from({ length: 8 }, (_, i) => `ABCD-${i}00${i}`);
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          {
            accessToken: 'mock-access-token',
            user: { id: 'uuid-1', username: 'newuser', nickname: '새유저' },
            backupCodes: mockBackupCodes,
          },
          { status: 201 },
        ),
      ),
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRegister('test-token', onSuccess));
    await act(() =>
      result.current.submit({
        username: 'newuser',
        nickname: '새유저',
        password: 'password123',
        passwordConfirm: 'password123',
      }),
    );

    expect(useUserStore.getState().accessToken).toBe('mock-access-token');
    expect(useUserStore.getState().user?.username).toBe('newuser');
    expect(onSuccess).toHaveBeenCalledWith(mockBackupCodes);
  });

  it('USERNAME_TAKEN 응답 시 apiError.code를 설정한다', async () => {
    server.use(http.post('/api/auth/register', () => HttpResponse.json({ code: 'USERNAME_TAKEN', message: '이미 사용 중인 아이디입니다.' }, { status: 409 })));

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRegister('test-token', onSuccess));
    await act(() =>
      result.current.submit({
        username: 'taken',
        nickname: '테스트',
        password: 'password123',
        passwordConfirm: 'password123',
      }),
    );

    expect(result.current.apiError?.code).toBe('USERNAME_TAKEN');
    expect(useUserStore.getState().accessToken).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
