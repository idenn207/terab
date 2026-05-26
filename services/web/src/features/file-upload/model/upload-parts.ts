export interface UploadPartInput {
  partNumber: number;
  uploadUrl: string;
}

export interface UploadPartResult {
  partNumber: number;
  etag: string;
}

const MAX_RETRIES = 2;
const PART_CONCURRENCY = 4;

export async function uploadParts(
  file: globalThis.File,
  parts: UploadPartInput[],
  headers: Record<string, string>,
  onProgress?: (percent: number) => void,
): Promise<UploadPartResult[]> {
  const partSize = Math.ceil(file.size / parts.length);
  const queue = [...parts];
  const results: UploadPartResult[] = new Array(parts.length);
  let completed = 0;

  async function putOne(part: UploadPartInput): Promise<void> {
    const start = (part.partNumber - 1) * partSize;
    const end = Math.min(start + partSize, file.size);
    const blob = file.slice(start, end);

    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const res = await fetch(part.uploadUrl, { method: 'PUT', headers, body: blob });
        if (!res.ok) throw new Error(`PUT failed ${res.status}`);
        const raw = res.headers.get('ETag') ?? res.headers.get('etag') ?? '';
        const etag = raw.replace(/^"+|"+$/g, '');
        results[part.partNumber - 1] = { partNumber: part.partNumber, etag };
        completed += 1;
        onProgress?.(Math.round((completed / parts.length) * 100));
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('upload failed');
  }

  // 간단한 동시성 제한
  await Promise.all(
    Array.from({ length: Math.min(PART_CONCURRENCY, parts.length) }, async () => {
      while (queue.length) {
        const next = queue.shift();
        if (next) await putOne(next);
      }
    }),
  );
  return results;
}
