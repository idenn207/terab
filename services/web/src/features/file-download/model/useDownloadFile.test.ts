import { makeQueryWrapper } from '@/__tests__/wrappers';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockMutate, mockIsNativePlatform, mockWriteFile } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockIsNativePlatform: vi.fn().mockReturnValue(false),
  mockWriteFile: vi.fn(),
}));

vi.mock('../api/mutation', () => ({
  useFileDownloadMutation: () => ({ mutateAsync: mockMutate, isPending: false, error: null }),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mockIsNativePlatform },
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: mockWriteFile },
  Directory: { Documents: 'DOCUMENTS' },
}));

import { useDownloadFile } from './useDownloadFile';

beforeEach(() => {
  vi.clearAllMocks();
  mockIsNativePlatform.mockReturnValue(false);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useDownloadFile', () => {
  it('웹 환경: trigger 호출 시 anchor click + download 속성 + revoke 가 일어난다', async () => {
    const blob = new Blob(['x'], { type: 'application/pdf' });
    mockMutate.mockResolvedValue(blob);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    const clickSpy = vi.fn();
    const anchorOriginal = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = anchorOriginal(tag) as HTMLAnchorElement;
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    const { result } = renderHook(() => useDownloadFile(), { wrapper: makeQueryWrapper() });
    await act(async () => {
      await result.current.trigger('file-1', 'photo.png');
    });

    expect(mockMutate).toHaveBeenCalledWith({ id: 'file-1' });
    expect(createSpy).toHaveBeenCalledWith('a');
    expect(clickSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.runAllTimers();
    });
    expect(revokeSpy).toHaveBeenCalledWith('blob:fake-url');
    expect(result.current.lastSavedUri).toBeNull();
  });

  it('웹 환경: anchor 의 download 속성과 href 가 fileName/blobUrl 로 설정된다', async () => {
    const blob = new Blob(['x'], { type: 'application/pdf' });
    mockMutate.mockResolvedValue(blob);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:abc');
    let downloadAttr: string | undefined;
    let hrefAttr: string | undefined;
    const anchorOriginal = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = anchorOriginal(tag) as HTMLAnchorElement;
      if (tag === 'a') {
        el.click = () => {
          downloadAttr = el.download;
          hrefAttr = el.href;
        };
      }
      return el;
    });

    const { result } = renderHook(() => useDownloadFile(), { wrapper: makeQueryWrapper() });
    await act(async () => {
      await result.current.trigger('file-7', 'doc.pdf');
    });

    expect(downloadAttr).toBe('doc.pdf');
    expect(hrefAttr).toContain('blob:abc');
  });

  it('네이티브 환경: Filesystem.writeFile 만 호출되고 anchor / blob URL 은 사용되지 않는다', async () => {
    // FileReader 의 onload 콜백은 fake timers 환경에서 진행되지 않아 blob → base64 변환이 hang — 실제 타이머로 전환
    vi.useRealTimers();
    mockIsNativePlatform.mockReturnValue(true);
    mockWriteFile.mockResolvedValue({ uri: 'file:///documents/photo.png' });
    const blob = new Blob(['hello'], { type: 'image/png' });
    mockMutate.mockResolvedValue(blob);
    const createElementSpy = vi.spyOn(document, 'createElement');
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL');

    const { result } = renderHook(() => useDownloadFile(), { wrapper: makeQueryWrapper() });
    await act(async () => {
      await result.current.trigger('file-9', 'photo.png');
    });

    expect(mockWriteFile).toHaveBeenCalledWith({
      path: 'photo.png',
      data: 'aGVsbG8=',
      directory: 'DOCUMENTS',
      recursive: true,
    });
    expect(createElementSpy).not.toHaveBeenCalledWith('a');
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
    expect(result.current.lastSavedUri).toBe('file:///documents/photo.png');
  });

  it('네이티브 환경: writeFile 실패 시 에러가 전파되고 lastSavedUri 는 null 로 유지된다', async () => {
    vi.useRealTimers();
    mockIsNativePlatform.mockReturnValue(true);
    mockWriteFile.mockRejectedValue(new Error('disk full'));
    mockMutate.mockResolvedValue(new Blob(['x']));

    const { result } = renderHook(() => useDownloadFile(), { wrapper: makeQueryWrapper() });

    await expect(
      act(async () => {
        await result.current.trigger('file-x', 'oops.bin');
      }),
    ).rejects.toThrow('disk full');
    expect(result.current.lastSavedUri).toBeNull();
  });
});
