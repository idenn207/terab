import { useUserStore } from '@/entities';
import { DoubleBackToast, useBackButton, useDeepLink, usePushNotification } from '@/features';
import { axiosInstance } from '@/shared/api/axiosInstance';
import type { AxiosResponse } from 'axios';
import { SafeAreaGuard } from '@/widgets';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

const AUTH_ENTRY_PATHS = ['/login', '/register'];

export function AppShell() {
  usePushNotification();
  useDeepLink();
  const { pendingExit } = useBackButton();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    SplashScreen.hide();
    StatusBar.setStyle({ style: Style.Light });
  }, []);

  // 모바일 cold start 시 cookie 의 refreshToken 으로 silent re-auth — accessToken 부재 + auth 진입 path 가 아닐 때만.
  useEffect(() => {
    if (useUserStore.getState().accessToken) return;
    const path = window.location.pathname;
    if (AUTH_ENTRY_PATHS.some((p) => path.startsWith(p))) return;
    axiosInstance
      .post('/auth/refresh')
      .then((response: AxiosResponse<{ status?: string; accessToken?: string; user?: { id: string; username: string; nickname: string } }>) => {
        const body = response.data;
        if (body?.status === 'AUTHENTICATED' && body.accessToken && body.user) {
          useUserStore.getState().setAuth(body.accessToken, body.user);
        }
      })
      .catch(() => {
        // cookie 부재 / 만료는 axios interceptor 가 /login redirect 로 처리 — 본 catch 는 보호용
      });
  }, []);

  return (
    <SafeAreaGuard>
      <Outlet />
      <DoubleBackToast visible={pendingExit} />
    </SafeAreaGuard>
  );
}
