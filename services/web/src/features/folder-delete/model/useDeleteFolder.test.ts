import { makeQueryWrapper } from '@/__tests__/wrappers';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockMutateAsync, mockReset } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock('../api/mutation', () => ({
  useFolderRemoveMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    error: null,
    reset: mockReset,
  }),
}));

import { useDeleteFolder } from './useDeleteFolder';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDeleteFolder', () => {
  it('remove 호출 시 path.id 로 mutation 을 호출한다', async () => {
    mockMutateAsync.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteFolder(), { wrapper: makeQueryWrapper() });
    await act(async () => {
      await result.current.remove({ id: 'f-1' });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({ path: { id: 'f-1' } });
  });

  it('FOLDER_NOT_FOUND 같은 에러가 그대로 전파된다', async () => {
    mockMutateAsync.mockRejectedValue(new Error('FOLDER_NOT_FOUND'));

    const { result } = renderHook(() => useDeleteFolder(), { wrapper: makeQueryWrapper() });
    await expect(
      act(async () => {
        await result.current.remove({ id: 'ghost' });
      }),
    ).rejects.toThrow('FOLDER_NOT_FOUND');
  });
});
