import { useUserStore } from '@/entities';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePushNotification } from '../model/usePushNotification';

const { mockRequestPermissions, mockRegister, mockRemove, mockRegisterPushToken } = vi.hoisted(() => ({
  mockRequestPermissions: vi.fn(),
  mockRegister: vi.fn(),
  mockRemove: vi.fn(),
  mockRegisterPushToken: vi.fn().mockResolvedValue({ deviceId: 'test-device-id' }),
}));

let capturedRegistrationCallback: ((token: { value: string }) => Promise<void>) | null = null;

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn().mockReturnValue(true) },
}));

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    requestPermissions: mockRequestPermissions,
    register: mockRegister,
    addListener: vi.fn().mockImplementation((event, cb) => {
      if (event === 'registration') capturedRegistrationCallback = cb;
      return Promise.resolve({ remove: mockRemove });
    }),
  },
}));

vi.mock('../api/deviceApi', () => ({
  deviceApi: { registerPushToken: mockRegisterPushToken },
}));

describe('usePushNotification', () => {
  afterEach(() => {
    act(() => {
      useUserStore.getState().clearAuth();
    });
    capturedRegistrationCallback = null;
    vi.clearAllMocks();
  });

  it('권한이 거부되면 register를 호출하지 않는다', async () => {
    mockRequestPermissions.mockResolvedValue({ receive: 'denied' });

    renderHook(() => usePushNotification());

    await waitFor(() => {
      expect(mockRequestPermissions).toHaveBeenCalled();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('권한이 허용되면 register를 호출한다', async () => {
    mockRequestPermissions.mockResolvedValue({ receive: 'granted' });

    renderHook(() => usePushNotification());

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });
  });

  it('registration 이벤트 발생 시 인증 상태면 registerPushToken API를 호출한다', async () => {
    mockRequestPermissions.mockResolvedValue({ receive: 'granted' });
    useUserStore.getState().setAuth('test-access-token', {
      id: 'user-1',
      username: 'testuser',
      nickname: '테스트',
    });

    renderHook(() => usePushNotification());

    await waitFor(() => capturedRegistrationCallback !== null);
    await act(async () => {
      await capturedRegistrationCallback!({ value: 'fcm-token-abc123' });
    });

    await waitFor(() => {
      expect(mockRegisterPushToken).toHaveBeenCalledWith({
        pushToken: 'fcm-token-abc123',
      });
    });
  });

  it('registration 이벤트 발생 시 미인증 상태면 API를 호출하지 않는다', async () => {
    mockRequestPermissions.mockResolvedValue({ receive: 'granted' });
    // useUserStore는 clearAuth 상태 — accessToken === null
    useUserStore.getState().clearAuth();

    renderHook(() => usePushNotification());

    await waitFor(() => capturedRegistrationCallback !== null);
    await capturedRegistrationCallback!({ value: 'fcm-token-abc123' });

    expect(mockRegisterPushToken).not.toHaveBeenCalled();
  });

  it('FCM 토큰 수신 후 로그인하면 보관된 토큰으로 API를 호출한다', async () => {
    mockRequestPermissions.mockResolvedValue({ receive: 'granted' });
    // 미인증 상태에서 시작
    useUserStore.getState().clearAuth();

    const { rerender } = renderHook(() => usePushNotification());

    await waitFor(() => capturedRegistrationCallback !== null);
    await capturedRegistrationCallback!({ value: 'fcm-token-pending' });

    // 아직 미인증 — API 호출 없어야 함
    expect(mockRegisterPushToken).not.toHaveBeenCalled();

    // 로그인 → accessToken 변경 → pendingToken useEffect 트리거
    act(() => {
      useUserStore.getState().setAuth('test-access-token', {
        id: 'user-1',
        username: 'testuser',
        nickname: '테스트',
      });
    });
    rerender();

    await waitFor(() => {
      expect(mockRegisterPushToken).toHaveBeenCalledWith({
        pushToken: 'fcm-token-pending',
      });
    });
  });

  it('비네이티브 플랫폼에서는 권한 요청을 하지 않는다', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    renderHook(() => usePushNotification());

    await Promise.resolve();

    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });
});
