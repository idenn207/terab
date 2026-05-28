import type { Folder } from '@/entities/folder';
import { Button, Dialog, DialogActions, DialogBody, DialogTitle } from '@/shared/ui';
import { parseApiError } from '@shared/api';
import * as Headless from '@headlessui/react';
import { useState } from 'react';
import { useMoveFolder } from '../model/useMoveFolder';
import { FolderTreePicker } from './FolderTreePicker';

interface MoveFolderMenuItemProps {
  folder: Folder;
  onOpen: () => void;
}

interface MoveFolderDialogProps {
  folder: Folder;
  open: boolean;
  onClose: () => void;
}

type FolderMoveErrorCode = 'FOLDER_NOT_FOUND' | 'INVALID_MOVE_TARGET';

export function MoveFolderMenuItem({ folder, onOpen }: MoveFolderMenuItemProps) {
  return (
    <Headless.MenuItem>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${folder.name} 이동`}
        className="block w-full px-3 py-1 text-left text-sm/6 text-gray-900 data-focus:bg-gray-50 data-focus:outline-hidden dark:text-white dark:data-focus:bg-white/5"
      >
        이동
      </button>
    </Headless.MenuItem>
  );
}

export function MoveFolderDialog({ folder, open, onClose }: MoveFolderDialogProps) {
  const [selectedParentId, setSelectedParentId] = useState<string | null>(folder.parentId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { move, isPending, reset } = useMoveFolder();

  const handleClose = () => {
    if (isPending) return;
    setErrorMessage(null);
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (selectedParentId === folder.parentId) {
      setErrorMessage('현재 위치와 동일합니다. 다른 폴더를 선택해주세요.');
      return;
    }
    setErrorMessage(null);
    try {
      await move({ id: folder.id, targetParentId: selectedParentId });
      onClose();
    } catch (error) {
      const parsed = parseApiError<FolderMoveErrorCode>(error, {
        code: 'UNKNOWN',
        message: '폴더를 이동할 수 없습니다.',
      });
      setErrorMessage(parsed.message);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} size="lg">
      <DialogTitle>"{folder.name}" 폴더 이동</DialogTitle>
      <DialogBody className="flex flex-col gap-3">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">이동할 위치를 선택해주세요.</p>
        <FolderTreePicker excludedFolderId={folder.id} selectedParentId={selectedParentId} onSelect={setSelectedParentId} />
        {errorMessage && (
          <p role="alert" className="text-sm text-red-500">
            {errorMessage}
          </p>
        )}
      </DialogBody>
      <DialogActions>
        <Button plain type="button" onClick={handleClose} disabled={isPending}>
          취소
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isPending}>
          {isPending ? '이동 중...' : '이동'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
