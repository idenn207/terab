import { describe, expect, it } from 'vitest';
import { blobToBase64 } from './blob-to-base64';

describe('blobToBase64', () => {
  it('빈 Blob 을 빈 문자열로 변환한다', async () => {
    const result = await blobToBase64(new Blob([]));

    expect(result).toBe('');
  });

  it('ASCII 텍스트 Blob 을 base64 로 인코딩하고 data: prefix 를 포함하지 않는다', async () => {
    const result = await blobToBase64(new Blob(['hello']));

    expect(result).toBe('aGVsbG8=');
    expect(result).not.toContain('data:');
    expect(result).not.toContain(';base64,');
  });

  it('바이너리 바이트(0x00, 0xFF)를 base64 로 인코딩한다', async () => {
    const blob = new Blob([new Uint8Array([0x00, 0xff])]);

    const result = await blobToBase64(blob);

    expect(result).toBe('AP8=');
  });
});
