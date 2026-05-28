import { makeQueryWrapper } from '@/__tests__/wrappers';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockMutateAsync, mockReset } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock('../api/mutation', () => ({
  useFolderRenameMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    error: null,
    reset: mockReset,
  }),
}));

import { useRenameFolder } from './useRenameFolder';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRenameFolder', () => {
  it('rename 호출 시 path.id 와 body.name 으로 mutation 을 호출한다', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'f-1', name: '새이름', parentId: null });

    const { result } = renderHook(() => useRenameFolder(), { wrapper: makeQueryWrapper() });
    await act(async () => {
      await result.current.rename({ id: 'f-1', newName: '새이름' });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({ path: { id: 'f-1' }, body: { name: '새이름' } });
  });

  it('FOLDER_NOT_FOUND 같은 에러가 그대로 전파된다', async () => {
    mockMutateAsync.mockRejectedValue(new Error('FOLDER_NOT_FOUND'));

    const { result } = renderHook(() => useRenameFolder(), { wrapper: makeQueryWrapper() });
    await expect(
      act(async () => {
        await result.current.rename({ id: 'ghost', newName: 'x' });
      }),
    ).rejects.toThrow('FOLDER_NOT_FOUND');
  });
});
