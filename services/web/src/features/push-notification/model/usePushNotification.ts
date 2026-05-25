import { useUserStore } from '@/entities';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useEffect, useRef } from 'react';
import { useRegisterDeviceMutation } from '../api/mutation';

export function usePushNotification() {
  // registration 이벤트와 로그인 완료 시점이 다를 수 있으므로 토큰을 ref에 보관
  const pendingTokenRef = useRef<string | null>(null);
  const accessToken = useUserStore((s) => s.accessToken);
  const registerMutation = useRegisterDeviceMutation();

  // 로그인 완료 후 보류 중인 FCM 토큰이 있으면 API 호출
  useEffect(() => {
    if (!accessToken || !pendingTokenRef.current) return;
    const token = pendingTokenRef.current;
    pendingTokenRef.current = null;
    registerMutation.mutate({ body: { pushToken: token } });
  }, [accessToken]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handles: PluginListenerHandle[] = [];
    let cancelled = false;

    const setup = async () => {
      const { receive } = await PushNotifications.requestPermissions();
      if (receive !== 'granted' || cancelled) return;

      await PushNotifications.register();

      const h1 = await PushNotifications.addListener('registration', (token) => {
        const accessToken = useUserStore.getState().accessToken;
        // 아직 로그인 전이면 토큰을 보관해두고 로그인 후 위의 useEffect에서 호출
        if (accessToken) registerMutation.mutate({ body: { pushToken: token.value } });
        else pendingTokenRef.current = token.value;
      });

      const h2 = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        // TODO: 포그라운드 수신 - 인앱 토스트 UI 추가
        console.log('Push received (foreground):', notification.title);
      });

      const h3 = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data as { type?: string; challengeId?: string } | undefined;
        if (data?.type === '2FA_CHALLENGE' && data.challengeId) {
          // TODO: /2fa/:challengeId 라우팅 추가
        }
      });

      if (cancelled) {
        h1.remove();
        h2.remove();
        h3.remove();
      } else {
        handles.push(h1, h2, h3);
      }
    };

    setup();

    return () => {
      cancelled = true;
      handles.forEach((h) => h.remove());
    };
  }, []);
}
