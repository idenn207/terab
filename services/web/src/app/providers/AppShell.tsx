import { DoubleBackToast, useBackButton, useDeepLink, usePushNotification } from '@/features';
import { SafeAreaGuard } from '@/widgets';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

export function AppShell() {
  usePushNotification();
  useDeepLink();
  const { pendingExit } = useBackButton();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    SplashScreen.hide();
    StatusBar.setStyle({ style: Style.Light });
  }, []);

  return (
    <SafeAreaGuard>
      <Outlet />
      <DoubleBackToast visible={pendingExit} />
    </SafeAreaGuard>
  );
}
