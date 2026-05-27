import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileList } from './useFileList';

const { mockRoot } = vi.hoisted(() => ({
  mockRoot: {
    data: undefined as { folders: unknown[]; files: unknown[] } | undefined,
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
}));

vi.mock('@/entities/folder', () => ({
  useFolderRootQuery: () => mockRoot,
}));

beforeEach(() => {
  mockRoot.data = undefined;
  mockRoot.isLoading = false;
  mockRoot.error = null;
  mockRoot.refetch = vi.fn();
});

describe('useFileList', () => {
  it('데이터가 없으면 folders/files 가 빈 배열이다', () => {
    const { result } = renderHook(() => useFileList());

    expect(result.current.folders).toEqual([]);
    expect(result.current.files).toEqual([]);
  });

  it('루트 쿼리 응답을 folders/files 로 노출한다', () => {
    mockRoot.data = {
      folders: [{ id: 'd-1', parentId: null, name: '사진' }],
      files: [{ id: 'f-1', folderId: null, name: 'a.png', size: 1, mimeType: 'image/png' }],
    };

    const { result } = renderHook(() => useFileList());

    expect(result.current.folders).toHaveLength(1);
    expect(result.current.files[0]).toMatchObject({ id: 'f-1', name: 'a.png' });
  });

  it('isLoading 상태를 그대로 노출한다', () => {
    mockRoot.isLoading = true;

    const { result } = renderHook(() => useFileList());
    expect(result.current.isLoading).toBe(true);
  });

  it('error 상태를 그대로 노출한다', () => {
    mockRoot.error = new Error('500');

    const { result } = renderHook(() => useFileList());
    expect(result.current.error?.message).toBe('500');
  });

  it('refetch 호출 시 루트 쿼리 refetch 가 일어난다', () => {
    const { result } = renderHook(() => useFileList());
    result.current.refetch();
    expect(mockRoot.refetch).toHaveBeenCalled();
  });
});
