import { Button, Dialog, DialogActions, DialogBody, DialogTitle } from '@/shared/ui';
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
    <Dialog open={isOpen} onClose={onClose} size="3xl">
      <DialogTitle>{target?.name ?? '미리보기'}</DialogTitle>
      <DialogBody>
        {isLoading && (
          <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
            이미지를 불러오는 중...
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error.message}
          </p>
        )}
        {blobUrl && target && <img src={blobUrl} alt={target.name} className="mx-auto max-h-[70vh] w-auto rounded-md object-contain" />}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose}>
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
}
