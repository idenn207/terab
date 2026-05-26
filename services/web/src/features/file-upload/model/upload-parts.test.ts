import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadParts } from './upload-parts';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = originalFetch;
});

describe('uploadParts', () => {
  it('단일 part는 한 번의 PUT을 실행하고 etag를 반환한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ ETag: '"etag-1"' }),
    });
    globalThis.fetch = fetchMock as any;

    const file = new File([new Uint8Array(1024)], 'a.bin', { type: 'application/octet-stream' });
    const result = await uploadParts(file, [{ partNumber: 1, uploadUrl: 'https://storage.example/put' }], { 'Content-Type': 'application/octet-stream' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ partNumber: 1, etag: 'etag-1' }]);
  });

  it('etag 따옴표를 제거한다', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ ETag: '"abc"' }),
    }) as any;
    const file = new File([new Uint8Array(10)], 'a.bin');
    const result = await uploadParts(file, [{ partNumber: 1, uploadUrl: 'https://x' }], { 'Content-Type': 'application/octet-stream' });
    expect(result[0].etag).toBe('abc');
  });

  it('PUT이 4xx로 실패하면 재시도하고 끝까지 실패하면 throw한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, headers: new Headers() });
    globalThis.fetch = fetchMock as any;
    const file = new File([new Uint8Array(10)], 'a.bin');
    await expect(uploadParts(file, [{ partNumber: 1, uploadUrl: 'https://x' }], { 'Content-Type': 'application/octet-stream' })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it('onProgress 는 part 완료마다 호출되고 마지막 호출은 100 이다', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ ETag: '"e"' }),
    }) as any;
    const file = new File([new Uint8Array(3 * 1024)], 'a.bin');
    const onProgress = vi.fn();
    const parts = [
      { partNumber: 1, uploadUrl: 'https://x/1' },
      { partNumber: 2, uploadUrl: 'https://x/2' },
      { partNumber: 3, uploadUrl: 'https://x/3' },
    ];

    await uploadParts(file, parts, { 'Content-Type': 'application/octet-stream' }, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenLastCalledWith(100);
  });

  it('onProgress 미지정이어도 정상 동작한다', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ ETag: '"e"' }),
    }) as any;
    const file = new File([new Uint8Array(10)], 'a.bin');
    const result = await uploadParts(file, [{ partNumber: 1, uploadUrl: 'https://x' }], { 'Content-Type': 'application/octet-stream' });
    expect(result).toHaveLength(1);
  });
});
