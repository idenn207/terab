import type { Folder } from '@/entities/folder';
import { Alert, AlertActions, AlertDescription, AlertTitle, Button } from '@/shared/ui';
import { parseApiError } from '@shared/api';
import * as Headless from '@headlessui/react';
import { useState } from 'react';
import { useDeleteFolder } from '../model/useDeleteFolder';

interface DeleteFolderMenuItemProps {
  folder: Folder;
  onOpen: () => void;
}

interface DeleteFolderDialogProps {
  folder: Folder;
  open: boolean;
  onClose: () => void;
}

type FolderDeleteErrorCode = 'FOLDER_NOT_FOUND';

export function DeleteFolderMenuItem({ folder, onOpen }: DeleteFolderMenuItemProps) {
  return (
    <Headless.MenuItem>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${folder.name} 삭제`}
        className="block w-full px-3 py-1 text-left text-sm/6 text-red-600 data-focus:bg-red-50 data-focus:outline-hidden dark:text-red-400 dark:data-focus:bg-red-950/50"
      >
        삭제
      </button>
    </Headless.MenuItem>
  );
}

export function DeleteFolderDialog({ folder, open, onClose }: DeleteFolderDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { remove, isPending, reset } = useDeleteFolder();

  const handleClose = () => {
    if (isPending) return;
    setErrorMessage(null);
    reset();
    onClose();
  };

  const handleConfirm = async () => {
    setErrorMessage(null);
    try {
      await remove({ id: folder.id });
      onClose();
    } catch (error) {
      const parsed = parseApiError<FolderDeleteErrorCode>(error, {
        code: 'UNKNOWN',
        message: '폴더를 삭제할 수 없습니다.',
      });
      setErrorMessage(parsed.message);
    }
  };

  return (
    <Alert open={open} onClose={handleClose} size="md">
      <AlertTitle>이 폴더를 휴지통으로 이동</AlertTitle>
      <AlertDescription>"{folder.name}" 폴더와 그 안의 내용이 휴지통으로 이동합니다. 복원은 휴지통에서 가능합니다.</AlertDescription>
      {errorMessage && (
        <p role="alert" className="mt-2 text-sm text-red-500">
          {errorMessage}
        </p>
      )}
      <AlertActions>
        <Button plain type="button" onClick={handleClose} disabled={isPending}>
          취소
        </Button>
        <Button type="button" onClick={handleConfirm} disabled={isPending}>
          {isPending ? '이동 중...' : '휴지통으로 이동'}
        </Button>
      </AlertActions>
    </Alert>
  );
}
