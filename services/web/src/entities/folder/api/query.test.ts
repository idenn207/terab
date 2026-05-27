import { makeQueryWrapper } from '@/__tests__/wrappers';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFolderChildrenQuery, useFolderRootQuery } from './query';

vi.mock('@shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/api')>();
  return {
    ...actual,
    folderControllerGetRootOptions: () => ({
      queryKey: [{ _id: 'folderControllerGetRoot' }],
      queryFn: vi.fn().mockResolvedValue({ folders: [{ id: 'f1', parentId: null, name: '폴더A', createdAt: '', updatedAt: '' }], files: [] }),
    }),
    folderControllerGetChildrenOptions: ({ path }: { path: { id: string } }) => ({
      queryKey: [{ _id: 'folderControllerGetChildren', path }],
      queryFn: vi
        .fn()
        .mockResolvedValue({
          folders: [],
          files: [{ id: `child-of-${path.id}`, folderId: path.id, name: 'a.png', size: 1, mimeType: 'image/png', createdAt: '', updatedAt: '' }],
        }),
    }),
  };
});

describe('useFolderRootQuery', () => {
  it('루트 폴더의 자식 목록을 반환한다', async () => {
    const { result } = renderHook(() => useFolderRootQuery(), { wrapper: makeQueryWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.folders[0]?.name).toBe('폴더A');
  });
});

describe('useFolderChildrenQuery', () => {
  it('parentId 가 undefined 면 호출되지 않는다 (enabled=false)', () => {
    const { result } = renderHook(() => useFolderChildrenQuery(undefined), { wrapper: makeQueryWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('parentId 가 주어지면 해당 폴더의 자식 목록을 반환한다', async () => {
    const { result } = renderHook(() => useFolderChildrenQuery('folder-7'), { wrapper: makeQueryWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.files[0]?.id).toBe('child-of-folder-7');
  });
});
