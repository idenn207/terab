import { makeQueryWrapper } from '@/__tests__/wrappers';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDownloadFile } from './useDownloadFile';

const { mockMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
}));

vi.mock('../api/mutation', () => ({
  useFileDownloadMutation: () => ({ mutateAsync: mockMutate, isPending: false, error: null }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useDownloadFile', () => {
  it('trigger 호출 시 anchor click + download 속성 + revoke 가 일어난다', async () => {
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
  });

  it('anchor 의 download 속성과 href 가 fileName/blobUrl 로 설정된다', async () => {
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
});
