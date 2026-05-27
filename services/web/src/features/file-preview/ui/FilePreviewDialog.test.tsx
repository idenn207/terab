import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilePreviewDialog } from './FilePreviewDialog';

describe('FilePreviewDialog', () => {
  it('isOpen=false 면 dialog 콘텐츠가 노출되지 않는다', () => {
    render(<FilePreviewDialog isOpen={false} target={null} blobUrl={null} isLoading={false} error={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('isOpen=true 이고 blobUrl 이 있으면 이미지가 표시된다', () => {
    render(
      <FilePreviewDialog
        isOpen
        target={{ id: 'f1', name: 'photo.png', mimeType: 'image/png' }}
        blobUrl="blob:fake-url"
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />,
    );
    const img = screen.getByRole('img', { name: 'photo.png' });
    expect(img).toHaveAttribute('src', 'blob:fake-url');
  });

  it('닫기 버튼 클릭 시 onClose 콜백을 호출한다', async () => {
    const onClose = vi.fn();
    render(
      <FilePreviewDialog
        isOpen
        target={{ id: 'f1', name: 'p.png', mimeType: 'image/png' }}
        blobUrl="blob:fake-url"
        isLoading={false}
        error={null}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('isLoading=true 면 로딩 메시지가 노출된다', () => {
    render(<FilePreviewDialog isOpen target={{ id: 'f1', name: 'p.png', mimeType: 'image/png' }} blobUrl={null} isLoading error={null} onClose={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('이미지를 불러오는 중');
  });

  it('error 가 있으면 role="alert" 로 노출된다', () => {
    render(
      <FilePreviewDialog
        isOpen
        target={{ id: 'f1', name: 'p.png', mimeType: 'image/png' }}
        blobUrl={null}
        isLoading={false}
        error={new Error('네트워크 오류')}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('네트워크 오류');
  });
});
