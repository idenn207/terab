import type { TrashItem } from '@/entities/trash';
import { Button } from '@/shared/ui';
import { parseApiError } from '@shared/api';
import { useState } from 'react';
import { useRestoreTrashItem } from '../model/useRestoreTrashItem';

interface RestoreButtonProps {
  itemId: string;
  itemType: TrashItem['type'];
  itemName: string;
}

type RestoreErrorCode = 'FILE_NOT_FOUND' | 'FOLDER_NOT_FOUND' | 'PARENT_IN_TRASH';

export function RestoreButton({ itemId, itemType, itemName }: RestoreButtonProps) {
  const { restore, isPending } = useRestoreTrashItem();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClick = async () => {
    setErrorMessage(null);
    try {
      await restore({ id: itemId, type: itemType });
    } catch (error) {
      const parsed = parseApiError<RestoreErrorCode>(error, {
        code: 'UNKNOWN',
        message: '복원할 수 없습니다.',
      });
      setErrorMessage(parsed.message);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button outline type="button" onClick={handleClick} disabled={isPending} aria-label={`${itemName} 복원`}>
        {isPending ? '복원 중...' : '복원'}
      </Button>
      {errorMessage && (
        <p role="alert" className="text-xs text-red-500">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
