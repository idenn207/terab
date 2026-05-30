import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileList } from './FileList';

const { mockUseFileList, mockPreview, mockDownload } = vi.hoisted(() => ({
  mockUseFileList: vi.fn(),
  mockPreview: {
    open: vi.fn(),
    close: vi.fn(),
    blobUrl: null as string | null,
    target: null as { id: string; name: string; mimeType: string } | null,
    isOpen: false,
    isLoading: false,
    error: null as Error | null,
  },
  mockDownload: {
    trigger: vi.fn(),
    isPending: false,
    error: null as Error | null,
  },
}));

vi.mock('../model/useFileList', () => ({
  useFileList: (...args: unknown[]) => mockUseFileList(...args),
}));

vi.mock('@/features', () => ({
  isImageMimeType: (mime: string) => mime.startsWith('image/'),
  useFilePreview: () => mockPreview,
  useDownloadFile: () => mockDownload,
  FilePreviewDialog: ({ isOpen, target }: { isOpen: boolean; target: { name: string } | null }) =>
    isOpen ? <div role="dialog" aria-label={target?.name ?? ''} /> : null,
  DownloadButton: ({ fileId, fileName }: { fileId: string; fileName: string }) => (
    <button type="button" data-fileid={fileId} data-filename={fileName}>
      다운로드
    </button>
  ),
  RenameFolderMenuItem: ({ folder, onOpen }: { folder: { id: string; name: string }; onOpen: () => void }) => (
    <button type="button" data-testid={`rename-trigger-${folder.id}`} data-folder-name={folder.name} onClick={onOpen}>
      이름 변경
    </button>
  ),
  MoveFolderMenuItem: ({ folder, onOpen }: { folder: { id: string; name: string }; onOpen: () => void }) => (
    <button type="button" data-testid={`move-trigger-${folder.id}`} data-folder-name={folder.name} onClick={onOpen}>
      이동
    </button>
  ),
  DeleteFolderMenuItem: ({ folder, onOpen }: { folder: { id: string; name: string }; onOpen: () => void }) => (
    <button type="button" data-testid={`delete-trigger-${folder.id}`} data-folder-name={folder.name} onClick={onOpen}>
      삭제
    </button>
  ),
  RenameFolderDialog: ({ folder, open }: { folder: { id: string; name: string }; open: boolean; onClose: () => void }) =>
    open ? <div role="dialog" aria-label={`rename-${folder.id}`} /> : null,
  MoveFolderDialog: ({ folder, open }: { folder: { id: string; name: string }; open: boolean; onClose: () => void }) =>
    open ? <div role="dialog" aria-label={`move-${folder.id}`} /> : null,
  DeleteFolderDialog: ({ folder, open }: { folder: { id: string; name: string }; open: boolean; onClose: () => void }) =>
    open ? <div role="dialog" aria-label={`delete-${folder.id}`} /> : null,
}));

const baseState = {
  folders: [],
  files: [],
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseFileList.mockReturnValue({ ...baseState });
  mockPreview.isOpen = false;
  mockPreview.blobUrl = null;
  mockPreview.target = null;
  mockPreview.open = vi.fn();
  mockPreview.close = vi.fn();
  mockDownload.trigger = vi.fn();
});

describe('FileList', () => {
  it('useFileList 에 folderId prop 을 그대로 전달한다', () => {
    render(<FileList folderId="p-1" onFolderOpen={vi.fn()} />);
    expect(mockUseFileList).toHaveBeenCalledWith({ folderId: 'p-1' });
  });

  it('folderId 가 null 이면 루트 컨텍스트로 호출된다', () => {
    render(<FileList folderId={null} onFolderOpen={vi.fn()} />);
    expect(mockUseFileList).toHaveBeenCalledWith({ folderId: null });
  });

  it('isLoading 일 때 스켈레톤이 노출된다', () => {
    mockUseFileList.mockReturnValue({ ...baseState, isLoading: true });
    render(<FileList folderId={null} onFolderOpen={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('목록을 불러오는 중');
  });

  it('error 가 있으면 role="alert" + 재시도 버튼이 노출된다', async () => {
    const refetch = vi.fn();
    mockUseFileList.mockReturnValue({ ...baseState, error: new Error('500'), refetch });

    render(<FileList folderId={null} onFolderOpen={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('500');

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('빈 상태에서는 안내 메시지가 노출된다', () => {
    render(<FileList folderId={null} onFolderOpen={vi.fn()} />);
    expect(screen.getByText('아직 파일이 없습니다')).toBeInTheDocument();
  });

  it('폴더가 파일보다 먼저 렌더된다', () => {
    mockUseFileList.mockReturnValue({
      ...baseState,
      folders: [{ id: 'd1', parentId: null, name: '사진폴더', createdAt: '', updatedAt: '' }],
      files: [{ id: 'f1', folderId: null, name: 'a.png', size: 1, mimeType: 'image/png', createdAt: '', updatedAt: '' }],
    });

    render(<FileList folderId={null} onFolderOpen={vi.fn()} />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('사진폴더');
    expect(items[1]).toHaveTextContent('a.png');
  });

  it('파일 데이터가 있으면 list 와 DownloadButton 이 렌더된다', () => {
    mockUseFileList.mockReturnValue({
      ...baseState,
      folders: [{ id: 'd1', parentId: null, name: '사진폴더', createdAt: '', updatedAt: '' }],
      files: [{ id: 'f1', folderId: null, name: 'a.png', size: 1, mimeType: 'image/png', createdAt: '', updatedAt: '' }],
    });

    render(<FileList folderId={null} onFolderOpen={vi.fn()} />);
    expect(screen.getByRole('list', { name: '파일 목록' })).toBeInTheDocument();
    expect(screen.getByText('사진폴더')).toBeInTheDocument();
    expect(screen.getByText('a.png')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다운로드' })).toHaveAttribute('data-fileid', 'f1');
  });

  it('폴더 행 클릭 시 onFolderOpen({ id, name }) 가 호출된다', async () => {
    const onFolderOpen = vi.fn();
    mockUseFileList.mockReturnValue({
      ...baseState,
      folders: [{ id: 'd1', parentId: null, name: '사진폴더', createdAt: '', updatedAt: '' }],
    });

    render(<FileList folderId={null} onFolderOpen={onFolderOpen} />);
    await userEvent.click(screen.getByRole('button', { name: '사진폴더' }));

    expect(onFolderOpen).toHaveBeenCalledWith({ id: 'd1', name: '사진폴더' });
  });

  it('이미지 파일 클릭 시 preview.open 호출', async () => {
    mockUseFileList.mockReturnValue({
      ...baseState,
      files: [{ id: 'f1', folderId: null, name: 'a.png', size: 1, mimeType: 'image/png', createdAt: '', updatedAt: '' }],
    });

    render(<FileList folderId={null} onFolderOpen={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'a.png' }));

    expect(mockPreview.open).toHaveBeenCalledWith({ id: 'f1', name: 'a.png', mimeType: 'image/png' });
    expect(mockDownload.trigger).not.toHaveBeenCalled();
  });

  it('비이미지 파일 클릭 시 download.trigger 호출', async () => {
    mockUseFileList.mockReturnValue({
      ...baseState,
      files: [{ id: 'f2', folderId: null, name: 'doc.pdf', size: 1, mimeType: 'application/pdf', createdAt: '', updatedAt: '' }],
    });

    render(<FileList folderId={null} onFolderOpen={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'doc.pdf' }));

    expect(mockDownload.trigger).toHaveBeenCalledWith('f2', 'doc.pdf');
    expect(mockPreview.open).not.toHaveBeenCalled();
  });

  it('폴더 메뉴 → 이름 변경 클릭 시 RenameFolderDialog 가 open 상태로 렌더된다 (Issue 1 회귀)', async () => {
    mockUseFileList.mockReturnValue({
      ...baseState,
      folders: [{ id: 'd1', parentId: null, name: '사진폴더', createdAt: '', updatedAt: '' }],
    });

    render(<FileList folderId={null} onFolderOpen={vi.fn()} />);
    expect(screen.queryByRole('dialog', { name: 'rename-d1' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '사진폴더 동작' }));
    await userEvent.click(screen.getByTestId('rename-trigger-d1'));

    expect(screen.getByRole('dialog', { name: 'rename-d1' })).toBeInTheDocument();
  });

  it('폴더 메뉴 → 이동 클릭 시 MoveFolderDialog 가 open 상태로 렌더된다 (Issue 1 회귀)', async () => {
    mockUseFileList.mockReturnValue({
      ...baseState,
      folders: [{ id: 'd1', parentId: null, name: '사진폴더', createdAt: '', updatedAt: '' }],
    });

    render(<FileList folderId={null} onFolderOpen={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: '사진폴더 동작' }));
    await userEvent.click(screen.getByTestId('move-trigger-d1'));

    expect(screen.getByRole('dialog', { name: 'move-d1' })).toBeInTheDocument();
  });

  it('폴더 메뉴 → 삭제 클릭 시 DeleteFolderDialog 가 open 상태로 렌더된다 (Issue 1 회귀)', async () => {
    mockUseFileList.mockReturnValue({
      ...baseState,
      folders: [{ id: 'd1', parentId: null, name: '사진폴더', createdAt: '', updatedAt: '' }],
    });

    render(<FileList folderId={null} onFolderOpen={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: '사진폴더 동작' }));
    await userEvent.click(screen.getByTestId('delete-trigger-d1'));

    expect(screen.getByRole('dialog', { name: 'delete-d1' })).toBeInTheDocument();
  });

  describe('mode="search"', () => {
    it('search 모드에서는 useFileList 를 호출하지 않는다', () => {
      render(<FileList mode="search" files={[]} isLoading={false} />);
      expect(mockUseFileList).not.toHaveBeenCalled();
    });

    it('search 모드 + 빈 결과 + !isLoading 면 "일치하는 파일이 없습니다" 메시지가 노출된다', () => {
      render(<FileList mode="search" files={[]} isLoading={false} />);
      expect(screen.getByText('일치하는 파일이 없습니다')).toBeInTheDocument();
    });

    it('search 모드 + isLoading 이면 스켈레톤이 노출된다', () => {
      render(<FileList mode="search" files={[]} isLoading={true} />);
      expect(screen.getByRole('status')).toHaveTextContent('목록을 불러오는 중');
    });

    it('search 모드의 결과 목록은 aria-label="검색 결과" 로 노출되고 폴더는 표시되지 않는다', () => {
      render(
        <FileList
          mode="search"
          isLoading={false}
          files={[{ id: 'f1', folderId: null, name: 'matched.png', size: 1, mimeType: 'image/png', createdAt: '', updatedAt: '' }]}
        />,
      );

      expect(screen.getByRole('list', { name: '검색 결과' })).toBeInTheDocument();
      expect(screen.getByText('matched.png')).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: '파일 목록' })).not.toBeInTheDocument();
    });

    it('search 모드의 이미지 파일 클릭 시 preview.open 이 호출된다', async () => {
      render(
        <FileList
          mode="search"
          isLoading={false}
          files={[{ id: 'f1', folderId: null, name: 'matched.png', size: 1, mimeType: 'image/png', createdAt: '', updatedAt: '' }]}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'matched.png' }));
      expect(mockPreview.open).toHaveBeenCalledWith({ id: 'f1', name: 'matched.png', mimeType: 'image/png' });
    });
  });
});
