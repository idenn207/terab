import { makeQueryWrapper } from '@/__tests__/wrappers';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockMutateAsync, mockReset } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock('../api/mutation', () => ({
  useTrashPermanentDeleteMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    error: null,
    reset: mockReset,
  }),
}));

import { usePurgeTrashItem } from './usePurgeTrashItem';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePurgeTrashItem', () => {
  it('파일 영구 삭제 시 path.id 와 body.type=file 로 mutation 을 호출한다', async () => {
    mockMutateAsync.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePurgeTrashItem(), { wrapper: makeQueryWrapper() });
    await act(async () => {
      await result.current.purge({ id: 't-1', type: 'file' });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({ path: { id: 't-1' }, body: { type: 'file' } });
  });

  it('폴더 영구 삭제 시 body.type=folder 를 전달한다', async () => {
    mockMutateAsync.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePurgeTrashItem(), { wrapper: makeQueryWrapper() });
    await act(async () => {
      await result.current.purge({ id: 't-2', type: 'folder' });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({ path: { id: 't-2' }, body: { type: 'folder' } });
  });

  it('FOLDER_NOT_FOUND 같은 mutation error 가 그대로 전파된다', async () => {
    mockMutateAsync.mockRejectedValue(new Error('FOLDER_NOT_FOUND'));

    const { result } = renderHook(() => usePurgeTrashItem(), { wrapper: makeQueryWrapper() });
    await expect(
      act(async () => {
        await result.current.purge({ id: 'ghost', type: 'folder' });
      }),
    ).rejects.toThrow('FOLDER_NOT_FOUND');
  });
});
