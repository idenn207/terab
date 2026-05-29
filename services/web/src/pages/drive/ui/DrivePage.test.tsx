import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseBreadcrumb, mockOpenFolder } = vi.hoisted(() => ({
  mockUseBreadcrumb: vi.fn(),
  mockOpenFolder: vi.fn(),
}));

vi.mock('@/widgets', () => ({
  DriveBreadcrumb: () => <div data-testid="drive-breadcrumb" />,
  FileToolbar: ({ folderId }: { folderId: string | null }) => <div data-testid="file-toolbar" data-folder-id={folderId ?? 'root'} />,
  FileList: ({ folderId, onFolderOpen }: { folderId: string | null; onFolderOpen: (folder: { id: string; name: string }) => void }) => (
    <div data-testid="file-list" data-folder-id={folderId ?? 'root'}>
      <button type="button" onClick={() => onFolderOpen({ id: 'd1', name: '사진' })}>
        폴더 열기
      </button>
    </div>
  ),
  useBreadcrumbTrail: () => mockUseBreadcrumb(),
}));

import { DrivePage } from './DrivePage';

function renderPage(initialEntries: string[] = ['/drive']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="*" element={<DrivePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseBreadcrumb.mockReturnValue({
    trail: [],
    currentFolderId: null,
    openFolder: mockOpenFolder,
    navigateRoot: vi.fn(),
    navigateToAncestor: vi.fn(),
  });
});

describe('DrivePage', () => {
  it('DriveBreadcrumb / FileToolbar / FileList 가 main 영역에 렌더된다', () => {
    renderPage();

    const main = document.querySelector('[data-region="main"]');
    expect(main).toBeInTheDocument();
    expect(main).toContainElement(screen.getByTestId('drive-breadcrumb'));
    expect(main).toContainElement(screen.getByTestId('file-toolbar'));
    expect(main).toContainElement(screen.getByTestId('file-list'));
  });

  it('루트 상태에서는 FileToolbar/FileList 의 folderId 가 root 표기', () => {
    renderPage();
    expect(screen.getByTestId('file-toolbar')).toHaveAttribute('data-folder-id', 'root');
    expect(screen.getByTestId('file-list')).toHaveAttribute('data-folder-id', 'root');
  });

  it('useBreadcrumbTrail.currentFolderId 가 설정되면 FileToolbar/FileList 에 전달된다', () => {
    mockUseBreadcrumb.mockReturnValue({
      trail: [{ id: 'p-1', name: '사진' }],
      currentFolderId: 'p-1',
      openFolder: mockOpenFolder,
      navigateRoot: vi.fn(),
      navigateToAncestor: vi.fn(),
    });

    renderPage();
    expect(screen.getByTestId('file-toolbar')).toHaveAttribute('data-folder-id', 'p-1');
    expect(screen.getByTestId('file-list')).toHaveAttribute('data-folder-id', 'p-1');
  });

  it('FileList 의 onFolderOpen 호출 시 useBreadcrumbTrail.openFolder 가 호출된다', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: '폴더 열기' }));
    expect(mockOpenFolder).toHaveBeenCalledWith({ id: 'd1', name: '사진' });
  });

  it('data-region="secondary" 자리는 비어 있다', () => {
    renderPage();
    const secondary = document.querySelector('[data-region="secondary"]');
    expect(secondary).toBeInTheDocument();
    expect(secondary?.children.length).toBe(0);
  });
});
