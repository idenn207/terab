import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const SOURCE_URL = 'http://localhost:3000/json';
const OUTPUT_PATH = 'src/shared/api/generated/public-paths.gen.ts';

async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    console.error(`Failed to fetch OpenAPI spec from ${SOURCE_URL}: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const openapi = await res.json();

  // 한 path 안에 public method 와 auth-required method 가 공존하면 인터셉터의 path 단위 분기로는
  // 안전하게 처리할 수 없다 (예: GET=public 목록 노출 + DELETE=admin-only 가 한 path 에 묶이면
  // DELETE 요청도 Authorization 헤더가 빠진다). 빌드를 실패시켜 향후 함정을 차단한다.
  const isPublicOp = (op) =>
    Array.isArray(op.security) &&
    op.security.length > 0 &&
    op.security.every((s) => Object.keys(s).length === 0);

  const publicPaths = [];
  const mixedSecurityPaths = [];
  for (const [path, methods] of Object.entries(openapi.paths ?? {})) {
    const ops = Object.values(methods);
    const publicCount = ops.filter(isPublicOp).length;
    if (publicCount === 0) continue;
    if (publicCount !== ops.length) {
      mixedSecurityPaths.push(path);
      continue;
    }
    publicPaths.push(path);
  }

  if (mixedSecurityPaths.length > 0) {
    console.error(
      `Mixed security in OpenAPI paths — path 단위 분기로는 처리 불가:\n  ${mixedSecurityPaths.join('\n  ')}\n` +
        `각 method 별 security 가 다른 path 가 생기면 extract-public-paths 를 method-aware 로 재설계해야 한다.`,
    );
    process.exit(1);
  }

  publicPaths.sort();

  // 경로 파라미터 `{id}` 를 [^/]+ 로 치환, 정규식 메타문자는 이스케이프.
  // `/` 까지 함께 이스케이프해야 정규식 리터럴(`/.../`) 안에서 안전하다.
  const regexSources = publicPaths.map((p) => {
    const escaped = p.replace(/[/.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^/]+?\\\}/g, '[^/]+');
    return `^${escaped}$`;
  });

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  const body =
    `// AUTO-GENERATED — DO NOT EDIT. Run \`npm run openapi:codegen\` to regenerate.\n` +
    `// hey-api 생성 SDK는 axios instance의 baseURL을 url에 합쳐 인터셉터로 넘기므로,\n` +
    `// 인터셉터에서 보이는 url은 \`/api\` prefix가 붙은 형태다. 따라서 매칭 시 prefix를 떼고 비교한다.\n` +
    `export const PUBLIC_PATH_REGEXES: ReadonlyArray<RegExp> = [\n` +
    regexSources.map((r) => `  /${r}/`).join(',\n') +
    `,\n];\n\n` +
    `export function isPublicPath(url: string): boolean {\n` +
    `  // 쿼리스트링 제거 후 매칭. baseURL prefix가 붙은 경우와 아닌 경우 모두 허용.\n` +
    `  const pathOnly = url.split('?')[0];\n` +
    `  const candidates = pathOnly.startsWith('/api/') ? [pathOnly, pathOnly.slice(4)] : [pathOnly];\n` +
    `  return candidates.some((p) => PUBLIC_PATH_REGEXES.some((re) => re.test(p)));\n` +
    `}\n`;
  await writeFile(OUTPUT_PATH, body);

  console.log(`Wrote ${publicPaths.length} public path(s) to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
