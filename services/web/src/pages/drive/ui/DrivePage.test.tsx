import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseBreadcrumb, mockOpenFolder, mockUseFileSearch } = vi.hoisted(() => ({
  mockUseBreadcrumb: vi.fn(),
  mockOpenFolder: vi.fn(),
  mockUseFileSearch: vi.fn(),
}));

vi.mock('@/widgets', () => ({
  DriveBreadcrumb: () => <div data-testid="drive-breadcrumb" />,
  DriveMountPanel: () => <div data-testid="drive-mount-panel" />,
  FileToolbar: ({ folderId }: { folderId: string | null }) => <div data-testid="file-toolbar" data-folder-id={folderId ?? 'root'} />,
  FileList: ({
    folderId,
    onFolderOpen,
    mode,
    files,
    isLoading,
  }: {
    folderId?: string | null;
    onFolderOpen?: (folder: { id: string; name: string }) => void;
    mode?: 'browse' | 'search';
    files?: Array<{ id: string; name: string }>;
    isLoading?: boolean;
  }) => (
    <div
      data-testid="file-list"
      data-folder-id={folderId ?? 'root'}
      data-mode={mode ?? 'browse'}
      data-files={(files ?? []).map((f) => f.name).join(',')}
      data-loading={String(Boolean(isLoading))}
    >
      <button type="button" onClick={() => onFolderOpen?.({ id: 'd1', name: '사진' })}>
        폴더 열기
      </button>
    </div>
  ),
  useBreadcrumbTrail: () => mockUseBreadcrumb(),
}));

vi.mock('@/features', () => ({
  useFileSearch: (...args: unknown[]) => mockUseFileSearch(...args),
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

const baseSearchState = {
  isSearching: false,
  files: [],
  isLoading: false,
  debouncedQ: '',
  value: '',
  setValue: vi.fn(),
  scope: 'all' as 'all' | 'folder',
  setScope: vi.fn(),
  clear: vi.fn(),
  flush: vi.fn(),
  isFetching: false,
  onCompositionStart: vi.fn(),
  onCompositionEnd: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseBreadcrumb.mockReturnValue({
    trail: [],
    currentFolderId: null,
    openFolder: mockOpenFolder,
    navigateRoot: vi.fn(),
    navigateToAncestor: vi.fn(),
  });
  mockUseFileSearch.mockReturnValue({ ...baseSearchState });
});

describe('DrivePage', () => {
  describe('browse mode (isSearching=false)', () => {
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
      expect(screen.getByTestId('file-list')).toHaveAttribute('data-mode', 'browse');
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

  describe('search mode (isSearching=true)', () => {
    it('isSearching 이 true 면 DriveBreadcrumb 대신 검색 결과 배너가 노출된다', () => {
      mockUseFileSearch.mockReturnValue({
        ...baseSearchState,
        isSearching: true,
        debouncedQ: 'foo',
      });

      renderPage(['/drive?q=foo&scope=all']);
      expect(screen.queryByTestId('drive-breadcrumb')).not.toBeInTheDocument();
      expect(screen.getByTestId('search-result-banner')).toHaveTextContent("'foo' 검색 결과");
    });

    it('isSearching 이 true 면 FileList 에 mode="search" + 검색 결과 files 가 전달된다', () => {
      mockUseFileSearch.mockReturnValue({
        ...baseSearchState,
        isSearching: true,
        debouncedQ: 'foo',
        files: [{ id: 'f1', folderId: null, name: 'matched.png', size: 1, mimeType: 'image/png', createdAt: '', updatedAt: '' }],
      });

      renderPage(['/drive?q=foo&scope=all']);
      const fileList = screen.getByTestId('file-list');
      expect(fileList).toHaveAttribute('data-mode', 'search');
      expect(fileList).toHaveAttribute('data-files', 'matched.png');
    });

    it('search 모드 진입 시에도 FileToolbar 는 그대로 렌더된다 (검색 입력 유지)', () => {
      mockUseFileSearch.mockReturnValue({ ...baseSearchState, isSearching: true, debouncedQ: 'foo' });

      renderPage(['/drive?q=foo&scope=all']);
      expect(screen.getByTestId('file-toolbar')).toBeInTheDocument();
    });

    it('isSearching + isLoading 이면 FileList 에 data-loading=true 가 전달된다', () => {
      mockUseFileSearch.mockReturnValue({
        ...baseSearchState,
        isSearching: true,
        isLoading: true,
        debouncedQ: 'foo',
      });

      renderPage(['/drive?q=foo&scope=all']);
      expect(screen.getByTestId('file-list')).toHaveAttribute('data-loading', 'true');
    });
  });
});
