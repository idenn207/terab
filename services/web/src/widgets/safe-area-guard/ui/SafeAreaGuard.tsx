import type { PropsWithChildren } from 'react';

/**
 * 전역 safe-area inset 적용 단일 진입점.
 *
 * Android Edge-to-Edge 활성화 후 WebView 가 status / navigation bar 영역까지 그리므로
 * 콘텐츠가 그 영역에 가려지지 않도록 `--spacing-safe-*` 토큰을 padding 으로 흡수한다.
 *
 * 브라우저 / notch 없는 기기에서는 `env(safe-area-inset-*)` 가 0px 이라 noop.
 */
export function SafeAreaGuard({ children }: PropsWithChildren) {
  return <div className="pt-safe-top pb-safe-bottom pl-safe-left pr-safe-right min-h-dvh">{children}</div>;
}
