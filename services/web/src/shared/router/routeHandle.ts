/**
 * `RouteObject.handle` 에 부여하는 앱 전용 메타데이터.
 *
 * 하드웨어 back 버튼 동작 분기의 single source of truth — `useMatches()` 결과의 마지막 매치에서 읽는다.
 * Capacitor 의 `BackButtonEvent.canGoBack` 은 webview navigation 기반이라 SPA history 와 어긋날 수 있어 사용하지 않는다.
 */
export interface AppRouteHandle {
  /**
   * true 면 하드웨어 back 시 router 뒤로가기 대신 더블탭 종료 토스트 → exitApp 분기.
   * 로그인 후 진입하는 최상위 destination (`/login`, `/drive`, `/2fa/:id`) 에 부여한다.
   */
  isRootDestination?: boolean;
}
