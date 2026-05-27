import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockWriteFile } = vi.hoisted(() => ({
  mockWriteFile: vi.fn(),
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: mockWriteFile },
  Directory: { Documents: 'DOCUMENTS' },
}));

import { saveViaFilesystem } from './save-via-filesystem';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('saveViaFilesystem', () => {
  it('Documents 디렉토리에 base64 변환된 데이터로 writeFile 을 호출하고 uri 를 반환한다', async () => {
    mockWriteFile.mockResolvedValue({ uri: 'file:///documents/photo.png' });
    const blob = new Blob(['hello']);

    const result = await saveViaFilesystem('photo.png', blob);

    expect(mockWriteFile).toHaveBeenCalledWith({
      path: 'photo.png',
      data: 'aGVsbG8=',
      directory: 'DOCUMENTS',
      recursive: true,
    });
    expect(result).toEqual({ uri: 'file:///documents/photo.png' });
  });

  it('writeFile 이 실패하면 호출처로 에러를 전파한다', async () => {
    mockWriteFile.mockRejectedValue(new Error('disk full'));

    await expect(saveViaFilesystem('x.txt', new Blob(['x']))).rejects.toThrow('disk full');
  });
});
