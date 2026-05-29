interface PushPayload {
  type?: string;
  challengeId?: string;
  deeplink?: string;
}

/**
 * FCM 페이로드를 신뢰 가능한 in-app 라우트로 좁힌다.
 *
 * - `deeplink` 가 슬래시로 시작하는 path 면 그대로 반환 (FCM 페이로드는 신뢰 경계 — open redirect 방지 위해 절대 URL 금지)
 * - 누락 시 `type === '2FA_CHALLENGE'` + `challengeId` 가 있으면 fallback 경로 합성
 */
export function resolveDeepLink(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as PushPayload;

  if (typeof payload.deeplink === 'string' && payload.deeplink.startsWith('/')) {
    return payload.deeplink;
  }

  if (payload.type === '2FA_CHALLENGE' && typeof payload.challengeId === 'string' && payload.challengeId.length > 0) {
    return `/2fa/${payload.challengeId}`;
  }

  return null;
}
