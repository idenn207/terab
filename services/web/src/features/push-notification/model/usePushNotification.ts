import { useUserStore } from '@/entities';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useEffect } from 'react';
import { deviceApi } from '../api/deviceApi';

export function usePushNotification() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handles: PluginListenerHandle[] = [];
    let cancelled = false;

    const setup = async () => {
      const { receive } = await PushNotifications.requestPermissions();
      if (receive !== 'granted' || cancelled) return;

      await PushNotifications.register();

      const h1 = await PushNotifications.addListener('registration', async (token) => {
        const accessToken = useUserStore.getState().accessToken;
        if (!accessToken) return;
        await deviceApi.registerPushToken({ pushToken: token.value, platform: 'android' });
      });

      const h2 = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        // TODO: 포그라운드 수신 - Phase 3에서 인앱 토스트 UI 추가
        console.log('Push received (foreground):', notification.title);
      });

      const h3 = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data as { type?: string; challengeId?: string } | undefined;
        if (data?.type === '2FA_CHALLENGE' && data.challengeId) {
          // TODO: Phase 3에서 /auth/2fa/:challengeId 라우팅 추가
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
      handles.forEach((h) => h.remove);
    };
  }, []);
}
