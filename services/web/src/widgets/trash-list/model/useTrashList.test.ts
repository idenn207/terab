import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock('@/entities/trash', async () => {
  const actual = await vi.importActual<typeof import('@/entities/trash')>('@/entities/trash');
  return {
    ...actual,
    useTrashListQuery: () => mockQuery(),
  };
});

import { useTrashList } from './useTrashList';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTrashList', () => {
  it('items 가 deletedAt 내림차순(최신 삭제 위)으로 정렬된다', () => {
    mockQuery.mockReturnValue({
      data: {
        items: [
          { id: 'a', type: 'file', name: 'old.pdf', deletedAt: '2026-05-01T00:00:00.000Z' },
          { id: 'b', type: 'folder', name: '최근', deletedAt: '2026-05-20T00:00:00.000Z' },
          { id: 'c', type: 'file', name: '중간.txt', deletedAt: '2026-05-10T00:00:00.000Z' },
        ],
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useTrashList());

    expect(result.current.items.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('items 가 비어 있고 로딩 끝났을 때 isEmpty=true', () => {
    mockQuery.mockReturnValue({ data: { items: [] }, isLoading: false, error: null });

    const { result } = renderHook(() => useTrashList());

    expect(result.current.isEmpty).toBe(true);
    expect(result.current.items).toEqual([]);
  });

  it('로딩 중일 때 isEmpty=false 이고 isLoading=true', () => {
    mockQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });

    const { result } = renderHook(() => useTrashList());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isEmpty).toBe(false);
  });

  it('에러가 그대로 전파된다', () => {
    const err = new Error('NETWORK_ERROR');
    mockQuery.mockReturnValue({ data: undefined, isLoading: false, error: err });

    const { result } = renderHook(() => useTrashList());

    expect(result.current.error).toBe(err);
  });
});
