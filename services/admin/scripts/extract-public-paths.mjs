import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const SOURCE_URL = 'http://localhost:3000/json';
const OUTPUT_PATH = 'src/shared/api/generated/public-paths.gen.ts';

// path 안의 method 키만 추출. summary / description / parameters 같은 path-level 메타데이터는 제외.
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    console.error(`Failed to fetch OpenAPI spec from ${SOURCE_URL}: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const openapi = await res.json();

  // path 단위 분기로는 GET=public + DELETE=admin 같은 mixed-security 를 안전하게 처리할 수 없다
  // (DELETE 요청에서도 Authorization 헤더가 누락될 위험). 그래서 (method, path) 쌍으로 추출한다.
  const isPublicOp = (op) =>
    Array.isArray(op.security) &&
    op.security.length > 0 &&
    op.security.every((s) => Object.keys(s).length === 0);

  const publicOps = [];
  for (const [path, methods] of Object.entries(openapi.paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!HTTP_METHODS.has(method)) continue;
      if (isPublicOp(op)) publicOps.push({ method, path });
    }
  }

  // diff 안정성을 위해 (path, method) 정렬
  publicOps.sort((a, b) =>
    a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path),
  );

  // 경로 파라미터 `{id}` 를 [^/]+ 로 치환, 정규식 메타문자는 이스케이프.
  // `/` 까지 함께 이스케이프해야 정규식 리터럴(`/.../`) 안에서 안전하다.
  const escapeForRegex = (p) =>
    p.replace(/[/.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^/]+?\\\}/g, '[^/]+');

  const entries = publicOps
    .map(({ method, path }) => `  { method: '${method}', regex: /^${escapeForRegex(path)}$/ }`)
    .join(',\n');

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  const body =
    `// AUTO-GENERATED — DO NOT EDIT. Run \`npm run openapi:codegen\` to regenerate.\n` +
    `// hey-api 생성 SDK는 axios instance의 baseURL을 url에 합쳐 인터셉터로 넘기므로,\n` +
    `// 인터셉터에서 보이는 url은 \`/api\` prefix가 붙은 형태다. 따라서 매칭 시 prefix를 떼고 비교한다.\n` +
    `// path 단위 분기로는 GET=public + DELETE=admin 같은 mixed-security 를 안전하게 처리할 수 없으므로\n` +
    `// (method, regex) 쌍으로 매칭한다.\n` +
    `export interface PublicOperation {\n` +
    `  method: string;\n` +
    `  regex: RegExp;\n` +
    `}\n\n` +
    `export const PUBLIC_OPERATIONS: ReadonlyArray<PublicOperation> = [\n` +
    entries +
    `,\n];\n\n` +
    `export function isPublicPath(method: string | undefined, url: string): boolean {\n` +
    `  if (!method) return false;\n` +
    `  const m = method.toLowerCase();\n` +
    `  const pathOnly = url.split('?')[0];\n` +
    `  const candidates = pathOnly.startsWith('/api/') ? [pathOnly, pathOnly.slice(4)] : [pathOnly];\n` +
    `  return PUBLIC_OPERATIONS.some((op) => op.method === m && candidates.some((p) => op.regex.test(p)));\n` +
    `}\n`;
  await writeFile(OUTPUT_PATH, body);

  console.log(`Wrote ${publicOps.length} public operation(s) to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
