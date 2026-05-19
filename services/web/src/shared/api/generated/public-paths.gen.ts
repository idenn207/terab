// AUTO-GENERATED — DO NOT EDIT. Run `npm run openapi:codegen` to regenerate.
// hey-api 생성 SDK는 axios instance의 baseURL을 url에 합쳐 인터셉터로 넘기므로,
// 인터셉터에서 보이는 url은 `/api` prefix가 붙은 형태다. 따라서 매칭 시 prefix를 떼고 비교한다.
export const PUBLIC_PATH_REGEXES: ReadonlyArray<RegExp> = [
  /^\/api\/health$/,
  /^\/auth\/2fa\/challenge\/[^/]+\/complete$/,
  /^\/auth\/2fa\/challenge\/[^/]+\/resend$/,
  /^\/auth\/2fa\/challenge\/[^/]+\/status$/,
  /^\/auth\/login$/,
  /^\/auth\/login\/backup$/,
  /^\/auth\/logout$/,
  /^\/auth\/refresh$/,
  /^\/auth\/register$/,
  /^\/invitations\/[^/]+$/,
];

export function isPublicPath(url: string): boolean {
  // 쿼리스트링 제거 후 매칭. baseURL prefix가 붙은 경우와 아닌 경우 모두 허용.
  const pathOnly = url.split('?')[0];
  const candidates = pathOnly.startsWith('/api/') ? [pathOnly, pathOnly.slice(4)] : [pathOnly];
  return candidates.some((p) => PUBLIC_PATH_REGEXES.some((re) => re.test(p)));
}
