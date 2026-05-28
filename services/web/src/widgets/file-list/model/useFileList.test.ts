import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileList } from './useFileList';

interface MockQueryState {
  data: { folders: unknown[]; files: unknown[] } | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: ReturnType<typeof vi.fn>;
}

const { mockRoot, mockChildren, mockChildrenFor } = vi.hoisted(() => ({
  mockRoot: {
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as MockQueryState,
  mockChildren: {
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as MockQueryState,
  mockChildrenFor: vi.fn(),
}));

vi.mock('@/entities/folder', () => ({
  useFolderRootQuery: () => mockRoot,
  useFolderChildrenQuery: (parentId: string | undefined) => {
    mockChildrenFor(parentId);
    return mockChildren;
  },
}));

beforeEach(() => {
  mockRoot.data = undefined;
  mockRoot.isLoading = false;
  mockRoot.error = null;
  mockRoot.refetch = vi.fn();
  mockChildren.data = undefined;
  mockChildren.isLoading = false;
  mockChildren.error = null;
  mockChildren.refetch = vi.fn();
  mockChildrenFor.mockClear();
});

describe('useFileList', () => {
  describe('루트 컨텍스트 (folderId=null)', () => {
    it('데이터가 없으면 folders/files 가 빈 배열이다', () => {
      const { result } = renderHook(() => useFileList({ folderId: null }));

      expect(result.current.folders).toEqual([]);
      expect(result.current.files).toEqual([]);
    });

    it('루트 쿼리 응답을 folders/files 로 노출한다', () => {
      mockRoot.data = {
        folders: [{ id: 'd-1', parentId: null, name: '사진' }],
        files: [{ id: 'f-1', folderId: null, name: 'a.png', size: 1, mimeType: 'image/png' }],
      };

      const { result } = renderHook(() => useFileList({ folderId: null }));

      expect(result.current.folders).toHaveLength(1);
      expect(result.current.files[0]).toMatchObject({ id: 'f-1', name: 'a.png' });
    });

    it('isLoading/error 를 루트 쿼리에서 가져온다', () => {
      mockRoot.isLoading = true;
      mockRoot.error = new Error('500');

      const { result } = renderHook(() => useFileList({ folderId: null }));
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error?.message).toBe('500');
    });

    it('refetch 호출 시 루트 쿼리 refetch 가 일어난다', () => {
      const { result } = renderHook(() => useFileList({ folderId: null }));
      result.current.refetch();
      expect(mockRoot.refetch).toHaveBeenCalled();
      expect(mockChildren.refetch).not.toHaveBeenCalled();
    });
  });

  describe('하위 폴더 컨텍스트 (folderId 설정)', () => {
    it('folderId 가 그대로 children 쿼리에 전달된다', () => {
      renderHook(() => useFileList({ folderId: 'p-1' }));
      expect(mockChildrenFor).toHaveBeenCalledWith('p-1');
    });

    it('children 쿼리 응답을 folders/files 로 노출한다', () => {
      mockChildren.data = {
        folders: [{ id: 'd-2', parentId: 'p-1', name: '2026' }],
        files: [{ id: 'f-2', folderId: 'p-1', name: 'b.png', size: 1, mimeType: 'image/png' }],
      };

      const { result } = renderHook(() => useFileList({ folderId: 'p-1' }));
      expect(result.current.folders[0]).toMatchObject({ id: 'd-2' });
      expect(result.current.files[0]).toMatchObject({ id: 'f-2' });
    });

    it('refetch 호출 시 children 쿼리 refetch 가 일어난다', () => {
      const { result } = renderHook(() => useFileList({ folderId: 'p-1' }));
      result.current.refetch();
      expect(mockChildren.refetch).toHaveBeenCalled();
      expect(mockRoot.refetch).not.toHaveBeenCalled();
    });
  });
});
