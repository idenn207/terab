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
  useFileList: () => mockUseFileList(),
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
  it('isLoading 일 때 스켈레톤이 노출된다', () => {
    mockUseFileList.mockReturnValue({ ...baseState, isLoading: true });
    render(<FileList />);
    expect(screen.getByRole('status')).toHaveTextContent('목록을 불러오는 중');
  });

  it('error 가 있으면 role="alert" + 재시도 버튼이 노출된다', async () => {
    const refetch = vi.fn();
    mockUseFileList.mockReturnValue({ ...baseState, error: new Error('500'), refetch });

    render(<FileList />);
    expect(screen.getByRole('alert')).toHaveTextContent('500');

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('빈 상태에서는 안내 메시지가 노출된다', () => {
    render(<FileList />);
    expect(screen.getByText('아직 파일이 없습니다')).toBeInTheDocument();
  });

  it('파일 데이터가 있으면 list 와 DownloadButton 이 렌더된다', () => {
    mockUseFileList.mockReturnValue({
      ...baseState,
      folders: [{ id: 'd1', parentId: null, name: '사진폴더', createdAt: '', updatedAt: '' }],
      files: [{ id: 'f1', folderId: null, name: 'a.png', size: 1, mimeType: 'image/png', createdAt: '', updatedAt: '' }],
    });

    render(<FileList />);
    expect(screen.getByRole('list', { name: '파일 목록' })).toBeInTheDocument();
    expect(screen.getByText('사진폴더')).toBeInTheDocument();
    expect(screen.getByText('a.png')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다운로드' })).toHaveAttribute('data-fileid', 'f1');
  });

  it('이미지 파일 클릭 시 preview.open 호출', async () => {
    mockUseFileList.mockReturnValue({
      ...baseState,
      files: [{ id: 'f1', folderId: null, name: 'a.png', size: 1, mimeType: 'image/png', createdAt: '', updatedAt: '' }],
    });

    render(<FileList />);
    await userEvent.click(screen.getByRole('button', { name: 'a.png' }));

    expect(mockPreview.open).toHaveBeenCalledWith({ id: 'f1', name: 'a.png', mimeType: 'image/png' });
    expect(mockDownload.trigger).not.toHaveBeenCalled();
  });

  it('비이미지 파일 클릭 시 download.trigger 호출', async () => {
    mockUseFileList.mockReturnValue({
      ...baseState,
      files: [{ id: 'f2', folderId: null, name: 'doc.pdf', size: 1, mimeType: 'application/pdf', createdAt: '', updatedAt: '' }],
    });

    render(<FileList />);
    await userEvent.click(screen.getByRole('button', { name: 'doc.pdf' }));

    expect(mockDownload.trigger).toHaveBeenCalledWith('f2', 'doc.pdf');
    expect(mockPreview.open).not.toHaveBeenCalled();
  });
});
