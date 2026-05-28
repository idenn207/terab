import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockNavigateRoot, mockNavigateToAncestor, mockUseBreadcrumb } = vi.hoisted(() => ({
  mockNavigateRoot: vi.fn(),
  mockNavigateToAncestor: vi.fn(),
  mockUseBreadcrumb: vi.fn(),
}));

vi.mock('../model/useBreadcrumbTrail', () => ({
  useBreadcrumbTrail: () => mockUseBreadcrumb(),
}));

import { DriveBreadcrumb } from './DriveBreadcrumb';

function renderBreadcrumb() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="*" element={<DriveBreadcrumb />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DriveBreadcrumb', () => {
  it('루트 상태 (folderId=null, trail=[]): 루트만 current 로 표시', () => {
    mockUseBreadcrumb.mockReturnValue({
      trail: [],
      currentFolderId: null,
      navigateRoot: mockNavigateRoot,
      navigateToAncestor: mockNavigateToAncestor,
      openFolder: vi.fn(),
    });

    renderBreadcrumb();
    const root = screen.getByRole('button', { name: /루트/ });
    expect(root).toHaveAttribute('aria-current', 'page');
  });

  it('1단계 진입 시 루트 > <폴더> 표시되고 현재 폴더는 button 이 아닌 텍스트', () => {
    mockUseBreadcrumb.mockReturnValue({
      trail: [{ id: 'f-1', name: '사진' }],
      currentFolderId: 'f-1',
      navigateRoot: mockNavigateRoot,
      navigateToAncestor: mockNavigateToAncestor,
      openFolder: vi.fn(),
    });

    renderBreadcrumb();
    expect(screen.getByRole('button', { name: /루트/ })).not.toHaveAttribute('aria-current', 'page');
    const current = screen.getByText('사진');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('중간 항목 클릭 시 navigateToAncestor 가 해당 인덱스로 호출된다 (3단계 진입에서 ellipsis dropdown 통해)', async () => {
    mockUseBreadcrumb.mockReturnValue({
      trail: [
        { id: 'f-1', name: '사진' },
        { id: 'f-2', name: '2026' },
        { id: 'f-3', name: '05' },
      ],
      currentFolderId: 'f-3',
      navigateRoot: mockNavigateRoot,
      navigateToAncestor: mockNavigateToAncestor,
      openFolder: vi.fn(),
    });

    renderBreadcrumb();
    await userEvent.click(screen.getByRole('button', { name: '상위 경로 펼치기' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: '사진' }));
    expect(mockNavigateToAncestor).toHaveBeenCalledWith(0);
  });

  it('루트 버튼 클릭 시 navigateRoot 호출 (collapse 미발동 케이스)', async () => {
    mockUseBreadcrumb.mockReturnValue({
      trail: [{ id: 'f-1', name: '사진' }],
      currentFolderId: 'f-1',
      navigateRoot: mockNavigateRoot,
      navigateToAncestor: mockNavigateToAncestor,
      openFolder: vi.fn(),
    });

    renderBreadcrumb();
    await userEvent.click(screen.getByRole('button', { name: /루트/ }));
    expect(mockNavigateRoot).toHaveBeenCalled();
  });

  it('새로고침으로 trail 만 사라진 경우 (folderId 존재 + trail 빈배열) 안내 자리표시 노출', () => {
    mockUseBreadcrumb.mockReturnValue({
      trail: [],
      currentFolderId: 'f-1',
      navigateRoot: mockNavigateRoot,
      navigateToAncestor: mockNavigateToAncestor,
      openFolder: vi.fn(),
    });

    renderBreadcrumb();
    expect(screen.getByText('현재 폴더')).toBeInTheDocument();
  });

  it('2단계 진입 (trail=2): "..." dropdown 표시 + visible 은 마지막 2개 (Issue 4 회귀)', () => {
    mockUseBreadcrumb.mockReturnValue({
      trail: [
        { id: 'f-1', name: '사진' },
        { id: 'f-2', name: '2026' },
      ],
      currentFolderId: 'f-2',
      navigateRoot: mockNavigateRoot,
      navigateToAncestor: mockNavigateToAncestor,
      openFolder: vi.fn(),
    });

    renderBreadcrumb();
    // 메뉴 열기 전 — visible 영역만 검증 (collapse 적용으로 루트는 dropdown 안으로 들어감)
    expect(screen.getByRole('button', { name: '상위 경로 펼치기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /루트/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사진' })).toBeInTheDocument();
    expect(screen.getByText('2026')).toHaveAttribute('aria-current', 'page');
  });

  it('2단계 진입 dropdown 안에 루트 항목이 들어 있고 클릭 시 navigateRoot 호출 (Issue 4 회귀)', async () => {
    mockUseBreadcrumb.mockReturnValue({
      trail: [
        { id: 'f-1', name: '사진' },
        { id: 'f-2', name: '2026' },
      ],
      currentFolderId: 'f-2',
      navigateRoot: mockNavigateRoot,
      navigateToAncestor: mockNavigateToAncestor,
      openFolder: vi.fn(),
    });

    renderBreadcrumb();
    await userEvent.click(screen.getByRole('button', { name: '상위 경로 펼치기' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /루트/ }));

    expect(mockNavigateRoot).toHaveBeenCalled();
  });

  it('3단계 진입 (trail=3): visible 은 [2026, 05] + dropdown 안에 [루트, 사진] (Issue 4 회귀)', async () => {
    mockUseBreadcrumb.mockReturnValue({
      trail: [
        { id: 'f-1', name: '사진' },
        { id: 'f-2', name: '2026' },
        { id: 'f-3', name: '05' },
      ],
      currentFolderId: 'f-3',
      navigateRoot: mockNavigateRoot,
      navigateToAncestor: mockNavigateToAncestor,
      openFolder: vi.fn(),
    });

    renderBreadcrumb();
    // 메뉴 열기 전 — visible 영역 검증
    expect(screen.getByRole('button', { name: '2026' })).toBeInTheDocument();
    expect(screen.getByText('05')).toHaveAttribute('aria-current', 'page');

    // 메뉴 열어서 dropdown 항목 검증
    await userEvent.click(screen.getByRole('button', { name: '상위 경로 펼치기' }));
    const menuItems = await screen.findAllByRole('menuitem');
    expect(menuItems).toHaveLength(2);
    expect(menuItems[0]).toHaveTextContent('루트');
    expect(menuItems[1]).toHaveTextContent('사진');
  });
});
