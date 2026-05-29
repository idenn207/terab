import { Button, Modal } from '@/shared/ui';
import type { PreviewTarget } from '../model/useFilePreview';

interface FilePreviewDialogProps {
  isOpen: boolean;
  target: PreviewTarget | null;
  blobUrl: string | null;
  isLoading: boolean;
  error: Error | null;
  onClose: () => void;
}

export function FilePreviewDialog({ isOpen, target, blobUrl, isLoading, error, onClose }: FilePreviewDialogProps) {
  return (
    <Modal open={isOpen} onClose={onClose} size="xl">
      <Modal.Header>{target?.name ?? '미리보기'}</Modal.Header>
      <Modal.Body>
        {isLoading && (
          <p role="status" className="text-sm text-text-muted">
            이미지를 불러오는 중...
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error.message}
          </p>
        )}
        {blobUrl && target && <img src={blobUrl} alt={target.name} className="mx-auto max-h-[70vh] w-auto rounded-md object-contain" />}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="text" tone="neutral" onClick={onClose}>
          닫기
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
