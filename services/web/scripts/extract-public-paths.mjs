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

  const publicPaths = [];
  for (const [path, methods] of Object.entries(openapi.paths ?? {})) {
    for (const op of Object.values(methods)) {
      if (
        Array.isArray(op.security) &&
        op.security.length > 0 &&
        op.security.every((s) => Object.keys(s).length === 0)
      ) {
        publicPaths.push(path);
        break;
      }
    }
  }

  publicPaths.sort();

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `// AUTO-GENERATED — DO NOT EDIT. Run \`npm run openapi:codegen\` to regenerate.\n` +
      `export const PUBLIC_PATHS = new Set<string>(${JSON.stringify(publicPaths, null, 2)});\n`,
  );

  console.log(`Wrote ${publicPaths.length} public path(s) to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
