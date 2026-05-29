import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { type AppRouteHandle } from '@shared/router';
import { useEffect, useRef, useState } from 'react';
import { useMatches, useNavigate } from 'react-router-dom';

const DOUBLE_TAP_EXIT_TIMEOUT_MS = 2000;

interface BackButtonState {
  /** 첫 번째 back 누른 후 두 번째 back 대기 중 — 토스트 노출용 */
  pendingExit: boolean;
}

/**
 * Android 하드웨어 back 버튼 동작.
 *
 * - root destination ([AppRouteHandle.isRootDestination](../../../shared/router/routeHandle.ts)) — 첫 back 은 토스트, 2초 안 두 번째 back 은 `App.exitApp()`
 * - non-root — `navigate(-1)` 위임
 * - 비네이티브 — noop
 *
 * Capacitor `BackButtonEvent.canGoBack` 은 webview navigation 기반이라 SPA history 와 어긋날 수 있어
 * 라우트 메타데이터를 single source of truth 로 사용한다.
 */
export function useBackButton(): BackButtonState {
  const [pendingExit, setPendingExit] = useState(false);
  const matches = useMatches();
  const navigate = useNavigate();

  // listener 콜백은 effect 생애 동안 고정이므로 최신 matches/navigate 는 ref 로 읽는다
  const matchesRef = useRef(matches);
  matchesRef.current = matches;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let handle: { remove: () => void } | null = null;

    App.addListener('backButton', () => {
      const current = matchesRef.current;
      const last = current[current.length - 1];
      const isRoot = (last?.handle as AppRouteHandle | undefined)?.isRootDestination ?? false;

      if (!isRoot) {
        navigateRef.current(-1);
        return;
      }

      if (pendingTimeoutRef.current !== null) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
        setPendingExit(false);
        void App.exitApp();
        return;
      }

      setPendingExit(true);
      pendingTimeoutRef.current = setTimeout(() => {
        setPendingExit(false);
        pendingTimeoutRef.current = null;
      }, DOUBLE_TAP_EXIT_TIMEOUT_MS);
    }).then((h) => {
      if (cancelled) h.remove();
      else handle = h;
    });

    return () => {
      cancelled = true;
      handle?.remove();
      if (pendingTimeoutRef.current !== null) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
    };
  }, []);

  return { pendingExit };
}
