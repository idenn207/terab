/* eslint-disable */
// AUTO-GENERATED — DO NOT EDIT. Run `npm run openapi:codegen` to regenerate.
// hey-api 생성 SDK는 axios instance의 baseURL을 url에 합쳐 인터셉터로 넘기므로,
// 인터셉터에서 보이는 url은 `/api` prefix가 붙은 형태다. 따라서 매칭 시 prefix를 떼고 비교한다.
// path 단위 분기로는 GET=public + DELETE=admin 같은 mixed-security 를 안전하게 처리할 수 없으므로
// (method, regex) 쌍으로 매칭한다.
export interface PublicOperation {
  method: string;
  regex: RegExp;
}

export const PUBLIC_OPERATIONS: ReadonlyArray<PublicOperation> = [
  { method: 'get', regex: /^\/api\/health$/ },
  { method: 'post', regex: /^\/auth\/2fa\/challenge\/[^/]+\/complete$/ },
  { method: 'post', regex: /^\/auth\/2fa\/challenge\/[^/]+\/resend$/ },
  { method: 'get', regex: /^\/auth\/2fa\/challenge\/[^/]+\/status$/ },
  { method: 'post', regex: /^\/auth\/login$/ },
  { method: 'post', regex: /^\/auth\/login\/backup$/ },
  { method: 'post', regex: /^\/auth\/logout$/ },
  { method: 'post', regex: /^\/auth\/refresh$/ },
  { method: 'post', regex: /^\/auth\/register$/ },
  { method: 'get', regex: /^\/invitations\/[^/]+$/ },
];

export function isPublicPath(method: string | undefined, url: string): boolean {
  if (!method) return false;
  const m = method.toLowerCase();
  const pathOnly = url.split('?')[0];
  const candidates = pathOnly.startsWith('/api/') ? [pathOnly, pathOnly.slice(4)] : [pathOnly];
  return PUBLIC_OPERATIONS.some((op) => op.method === m && candidates.some((p) => op.regex.test(p)));
}
