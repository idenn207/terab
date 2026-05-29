import type { TrashItem } from '@/entities/trash';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseTrashList } = vi.hoisted(() => ({
  mockUseTrashList: vi.fn(),
}));

vi.mock('../model/useTrashList', () => ({
  useTrashList: () => mockUseTrashList(),
}));

vi.mock('@/features', () => ({
  RestoreButton: ({ itemName }: { itemName: string }) => <button type="button">{`${itemName} 복원`}</button>,
  PurgeButton: ({ itemName }: { itemName: string }) => <button type="button">{`${itemName} 영구 삭제`}</button>,
}));

import { TrashList } from './TrashList';

const items: TrashItem[] = [
  { id: 'b', type: 'folder', name: '최근폴더', deletedAt: '2026-05-20T03:00:00.000Z' },
  { id: 'a', type: 'file', name: '오래된파일.pdf', deletedAt: '2026-05-01T03:00:00.000Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TrashList', () => {
  it('isLoading 시 skeleton 영역을 status 로 노출한다', () => {
    mockUseTrashList.mockReturnValue({ items: [], isLoading: true, error: null, isEmpty: false });

    render(<TrashList />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('isEmpty 시 editorial empty state 가 노출된다', () => {
    mockUseTrashList.mockReturnValue({ items: [], isLoading: false, error: null, isEmpty: true });

    render(<TrashList />);

    expect(screen.getByText('휴지통이 비어 있어요')).toBeInTheDocument();
  });

  it('items 가 있을 때 각 항목이 행으로 렌더링되고 복원/영구 삭제 버튼이 노출된다', () => {
    mockUseTrashList.mockReturnValue({ items, isLoading: false, error: null, isEmpty: false });

    render(<TrashList />);

    expect(screen.getByRole('list', { name: '휴지통 항목 목록' })).toBeInTheDocument();
    expect(screen.getByText('최근폴더')).toBeInTheDocument();
    expect(screen.getByText('오래된파일.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '최근폴더 복원' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '오래된파일.pdf 영구 삭제' })).toBeInTheDocument();
  });

  it('에러 발생 시 alert 메시지를 노출한다', () => {
    mockUseTrashList.mockReturnValue({ items: [], isLoading: false, error: new Error('NETWORK_ERROR'), isEmpty: false });

    render(<TrashList />);

    expect(screen.getByRole('alert')).toHaveTextContent('NETWORK_ERROR');
  });
});
