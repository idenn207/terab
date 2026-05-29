import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const GENERATED_ROOT = 'src/shared/api/generated';
const BANNER = '/* eslint-disable */\n';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const files = await walk(GENERATED_ROOT);
  let patched = 0;
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (content.startsWith('/* eslint-disable')) continue;
    await writeFile(file, BANNER + content);
    patched += 1;
  }
  console.log(`Prepended eslint-disable banner to ${patched}/${files.length} generated file(s) under ${GENERATED_ROOT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
