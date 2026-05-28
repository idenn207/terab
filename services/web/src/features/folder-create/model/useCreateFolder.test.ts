import { makeQueryWrapper } from '@/__tests__/wrappers';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockMutateAsync, mockReset } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock('../api/mutation', () => ({
  useFolderCreateMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    error: null,
    reset: mockReset,
  }),
}));

import { useCreateFolder } from './useCreateFolder';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCreateFolder', () => {
  it('루트 폴더 생성 시 parentId=null 로 mutation 을 호출한다', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'f-1', name: '이미지', parentId: null });

    const { result } = renderHook(() => useCreateFolder(), { wrapper: makeQueryWrapper() });
    await act(async () => {
      await result.current.create({ name: '이미지', parentId: null });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({ body: { name: '이미지', parentId: null } });
  });

  it('하위 폴더 생성 시 parentId 가 전달된다', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'f-2', name: '2026', parentId: 'p-1' });

    const { result } = renderHook(() => useCreateFolder(), { wrapper: makeQueryWrapper() });
    await act(async () => {
      await result.current.create({ name: '2026', parentId: 'p-1' });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({ body: { name: '2026', parentId: 'p-1' } });
  });

  it('FOLDER_DEPTH_EXCEEDED 같은 mutation error 가 그대로 전파된다', async () => {
    mockMutateAsync.mockRejectedValue(new Error('FOLDER_DEPTH_EXCEEDED'));

    const { result } = renderHook(() => useCreateFolder(), { wrapper: makeQueryWrapper() });
    await expect(
      act(async () => {
        await result.current.create({ name: '깊은폴더', parentId: 'p-deep' });
      }),
    ).rejects.toThrow('FOLDER_DEPTH_EXCEEDED');
  });
});
