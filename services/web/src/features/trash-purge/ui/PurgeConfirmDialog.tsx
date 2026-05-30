import type { TrashItem } from '@/entities/trash';
import { Alert, AlertActions, AlertDescription, AlertTitle, Button } from '@/shared/ui';
import { parseApiError } from '@shared/api';
import { useState } from 'react';
import { usePurgeTrashItem } from '../model/usePurgeTrashItem';

interface PurgeConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemType: TrashItem['type'];
  itemName: string;
}

type PurgeErrorCode = 'FILE_NOT_FOUND' | 'FOLDER_NOT_FOUND' | 'PARENT_IN_TRASH';

export function PurgeConfirmDialog({ open, onClose, itemId, itemType, itemName }: PurgeConfirmDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { purge, isPending, reset } = usePurgeTrashItem();

  const handleClose = () => {
    if (isPending) return;
    setErrorMessage(null);
    reset();
    onClose();
  };

  const handleConfirm = async () => {
    setErrorMessage(null);
    try {
      await purge({ id: itemId, type: itemType });
      onClose();
    } catch (error) {
      const parsed = parseApiError<PurgeErrorCode>(error, {
        code: 'UNKNOWN',
        message: '항목을 영구 삭제할 수 없습니다.',
      });
      setErrorMessage(parsed.message);
    }
  };

  return (
    <Alert open={open} onClose={handleClose} size="md">
      <AlertTitle>이 항목을 영구 삭제</AlertTitle>
      <AlertDescription>"{itemName}" 항목이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</AlertDescription>
      {errorMessage && (
        <p role="alert" className="mt-2 text-sm text-red-500">
          {errorMessage}
        </p>
      )}
      <AlertActions>
        <Button variant="text" tone="neutral" type="button" onClick={handleClose} disabled={isPending}>
          취소
        </Button>
        <Button variant="filled" tone="danger" type="button" onClick={handleConfirm} disabled={isPending}>
          {isPending ? '삭제 중...' : '영구 삭제'}
        </Button>
      </AlertActions>
    </Alert>
  );
}
