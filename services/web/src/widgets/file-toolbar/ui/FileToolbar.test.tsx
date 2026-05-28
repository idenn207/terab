import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileToolbar } from './FileToolbar';

vi.mock('@/features', () => ({
  UploadButton: ({ folderId }: { folderId: string | null }) => (
    <button type="button" data-testid="upload-button" data-folder-id={folderId ?? 'root'}>
      업로드
    </button>
  ),
  NewFolderButton: ({ parentId }: { parentId: string | null }) => (
    <button type="button" data-testid="new-folder-button" data-parent-id={parentId ?? 'root'}>
      새 폴더
    </button>
  ),
}));

describe('FileToolbar', () => {
  it('UploadButton 과 NewFolderButton 을 함께 노출한다', () => {
    render(<FileToolbar folderId={null} />);

    expect(screen.getByRole('button', { name: '업로드' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새 폴더' })).toBeInTheDocument();
  });

  it('folderId 가 null 이면 NewFolderButton 에 parentId=null (root) 가 전달된다', () => {
    render(<FileToolbar folderId={null} />);

    const newFolderBtn = screen.getByTestId('new-folder-button');
    expect(newFolderBtn).toHaveAttribute('data-parent-id', 'root');
  });

  it('folderId 가 설정되면 그 값이 NewFolderButton 의 parentId 로 전달된다', () => {
    render(<FileToolbar folderId="p-1" />);

    const newFolderBtn = screen.getByTestId('new-folder-button');
    expect(newFolderBtn).toHaveAttribute('data-parent-id', 'p-1');
  });

  it('folderId 가 null 이면 UploadButton 에도 folderId=null 이 전달된다 (Issue 3 회귀)', () => {
    render(<FileToolbar folderId={null} />);

    const uploadBtn = screen.getByTestId('upload-button');
    expect(uploadBtn).toHaveAttribute('data-folder-id', 'root');
  });

  it('folderId 가 설정되면 그 값이 UploadButton 의 folderId 로 전달된다 (Issue 3 회귀)', () => {
    render(<FileToolbar folderId="p-1" />);

    const uploadBtn = screen.getByTestId('upload-button');
    expect(uploadBtn).toHaveAttribute('data-folder-id', 'p-1');
  });
});
