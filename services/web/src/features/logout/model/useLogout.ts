import { useUserStore } from '@/entities';
import { clearPushToken, getPushToken } from '@/shared/lib/capacitor/pushToken';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { useLogoutMutation } from '../api/mutation';

export function useLogout() {
  const navigate = useNavigate();
  const clearAuth = useUserStore((s) => s.clearAuth);
  const mutation = useLogoutMutation();

  const logout = () => {
    // 모바일은 자기 pushToken 을 body 에 첨부해 backend 가 해당 device 만 deactivate 하도록.
    // PC 는 pushToken 미발급이라 body 비움 — 다른 mobile device 의 push 는 정상 유지.
    const body = Capacitor.isNativePlatform() ? { pushToken: getPushToken() ?? undefined } : {};
    mutation.mutate(
      { body },
      {
        onSettled: () => {
          clearPushToken();
          clearAuth();
          navigate('/login');
        },
      },
    );
  };

  return { logout };
}
