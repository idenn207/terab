import { makeQueryWrapper } from '@/__tests__/wrappers';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockMutateAsync, mockReset } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock('../api/mutation', () => ({
  useFolderMoveMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    error: null,
    reset: mockReset,
  }),
}));

import { useMoveFolder } from './useMoveFolder';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMoveFolder', () => {
  it('루트로 이동 시 body.parentId=null 로 mutation 호출', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'f-1', name: 'x', parentId: null });

    const { result } = renderHook(() => useMoveFolder(), { wrapper: makeQueryWrapper() });
    await act(async () => {
      await result.current.move({ id: 'f-1', targetParentId: null });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({ path: { id: 'f-1' }, body: { parentId: null } });
  });

  it('하위 폴더로 이동 시 targetParentId 가 body 에 들어간다', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'f-1', name: 'x', parentId: 'p-2' });

    const { result } = renderHook(() => useMoveFolder(), { wrapper: makeQueryWrapper() });
    await act(async () => {
      await result.current.move({ id: 'f-1', targetParentId: 'p-2' });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({ path: { id: 'f-1' }, body: { parentId: 'p-2' } });
  });

  it('INVALID_MOVE_TARGET 에러가 그대로 전파된다', async () => {
    mockMutateAsync.mockRejectedValue(new Error('INVALID_MOVE_TARGET'));

    const { result } = renderHook(() => useMoveFolder(), { wrapper: makeQueryWrapper() });
    await expect(
      act(async () => {
        await result.current.move({ id: 'f-1', targetParentId: 'descendant-id' });
      }),
    ).rejects.toThrow('INVALID_MOVE_TARGET');
  });
});
