import { makeQueryWrapper } from '@/__tests__/wrappers';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilePreview } from './useFilePreview';

const { mockMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
}));

vi.mock('../api/mutation', () => ({
  useFilePreviewMutation: () => ({ mutateAsync: mockMutate, isPending: false, error: null }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('useFilePreview', () => {
  it('이미지 mime 이면 mutate 호출 후 blob URL 을 생성한다', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    mockMutate.mockResolvedValue(blob);
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');

    const { result } = renderHook(() => useFilePreview(), { wrapper: makeQueryWrapper() });

    await act(async () => {
      await result.current.open({ id: 'f1', name: 'a.png', mimeType: 'image/png' });
    });

    expect(mockMutate).toHaveBeenCalledWith({ id: 'f1' });
    expect(createSpy).toHaveBeenCalledWith(blob);
    await waitFor(() => expect(result.current.blobUrl).toBe('blob:fake-url'));
    expect(result.current.isOpen).toBe(true);
    expect(result.current.target?.id).toBe('f1');
  });

  it('비이미지 mime 은 mutate 를 호출하지 않고 isOpen 도 false 유지', async () => {
    const { result } = renderHook(() => useFilePreview(), { wrapper: makeQueryWrapper() });

    await act(async () => {
      await result.current.open({ id: 'f2', name: 'doc.pdf', mimeType: 'application/pdf' });
    });

    expect(mockMutate).not.toHaveBeenCalled();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.blobUrl).toBeNull();
  });

  it('close 시 blob URL 을 revoke 한다', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    mockMutate.mockResolvedValue(blob);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);

    const { result } = renderHook(() => useFilePreview(), { wrapper: makeQueryWrapper() });

    await act(async () => {
      await result.current.open({ id: 'f3', name: 'b.png', mimeType: 'image/png' });
    });
    act(() => result.current.close());

    expect(revokeSpy).toHaveBeenCalledWith('blob:fake-url');
    expect(result.current.isOpen).toBe(false);
    expect(result.current.blobUrl).toBeNull();
  });

  it('unmount 시에도 잔여 blob URL 을 revoke 한다', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    mockMutate.mockResolvedValue(blob);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);

    const { result, unmount } = renderHook(() => useFilePreview(), { wrapper: makeQueryWrapper() });
    await act(async () => {
      await result.current.open({ id: 'f4', name: 'c.png', mimeType: 'image/png' });
    });
    unmount();

    expect(revokeSpy).toHaveBeenCalledWith('blob:fake-url');
  });
});
