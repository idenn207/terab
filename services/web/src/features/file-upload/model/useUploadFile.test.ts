import { makeQueryWrapper } from '@/__tests__/wrappers';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUploadFile } from './useUploadFile';

const { mockInitMutate, mockCompleteMutate, mockUploadParts } = vi.hoisted(() => ({
  mockInitMutate: vi.fn(),
  mockCompleteMutate: vi.fn(),
  mockUploadParts: vi.fn(),
}));

vi.mock('../api/mutation', () => ({
  useUploadInitMutation: () => ({ mutateAsync: mockInitMutate }),
  useUploadCompleteMutation: () => ({ mutateAsync: mockCompleteMutate }),
}));

vi.mock('./upload-parts', () => ({
  uploadParts: mockUploadParts,
}));

beforeEach(() => vi.clearAllMocks());

describe('useUploadFile', () => {
  it('init → uploadParts → complete 순서로 호출하고 결과 body를 반환한다', async () => {
    mockInitMutate.mockResolvedValue({
      status: 201,
      body: {
        sessionId: 'sess-1',
        parts: [{ partNumber: 1, uploadUrl: 'https://x' }],
        uploadHeaders: { 'Content-Type': 'application/octet-stream' },
      },
    });
    mockUploadParts.mockResolvedValue([{ partNumber: 1, etag: 'e1' }]);
    mockCompleteMutate.mockResolvedValue({ status: 201, body: { id: 'file-1', name: 'a.bin' } });

    const { result } = renderHook(() => useUploadFile(), { wrapper: makeQueryWrapper() });
    const file = new File([new Uint8Array(10)], 'a.bin');

    const data = await result.current.mutateAsync({ file, folderId: 'folder-1' });

    expect(mockInitMutate).toHaveBeenCalledWith({
      body: { folderId: 'folder-1', name: 'a.bin', size: 10, mimeType: 'application/octet-stream' },
    });
    expect(mockUploadParts).toHaveBeenCalledWith(file, [{ partNumber: 1, uploadUrl: 'https://x' }], {
      'Content-Type': 'application/octet-stream',
    });
    expect(mockCompleteMutate).toHaveBeenCalledWith({
      params: { sessionId: 'sess-1' },
      body: { parts: [{ partNumber: 1, etag: 'e1' }] },
    });
    expect(data).toEqual({ id: 'file-1', name: 'a.bin' });
  });

  it('init이 실패하면 uploadParts/complete을 호출하지 않고 throw한다', async () => {
    mockInitMutate.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useUploadFile(), { wrapper: makeQueryWrapper() });
    const file = new File([new Uint8Array(10)], 'a.bin');

    await expect(result.current.mutateAsync({ file })).rejects.toThrow('boom');
    expect(mockUploadParts).not.toHaveBeenCalled();
    expect(mockCompleteMutate).not.toHaveBeenCalled();
  });

  it('uploadParts가 실패하면 complete을 호출하지 않는다 (서버 cleanup-worker가 회수)', async () => {
    mockInitMutate.mockResolvedValue({
      status: 201,
      body: { sessionId: 's', parts: [{ partNumber: 1, uploadUrl: 'x' }], uploadHeaders: {} },
    });
    mockUploadParts.mockRejectedValue(new Error('PUT failed'));

    const { result } = renderHook(() => useUploadFile(), { wrapper: makeQueryWrapper() });
    const file = new File([new Uint8Array(10)], 'a.bin');

    await expect(result.current.mutateAsync({ file })).rejects.toThrow('PUT failed');
    expect(mockCompleteMutate).not.toHaveBeenCalled();
  });
});
