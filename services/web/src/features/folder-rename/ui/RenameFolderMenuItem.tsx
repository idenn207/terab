import type { Folder } from '@/entities/folder';
import { Button, Dialog, DialogActions, DialogBody, DialogTitle, Input } from '@/shared/ui';
import { parseApiError } from '@shared/api';
import * as Headless from '@headlessui/react';
import { type FormEvent, useState } from 'react';
import { useRenameFolder } from '../model/useRenameFolder';

interface RenameFolderMenuItemProps {
  folder: Folder;
  onOpen: () => void;
}

interface RenameFolderDialogProps {
  folder: Folder;
  open: boolean;
  onClose: () => void;
}

type FolderRenameErrorCode = 'FOLDER_NOT_FOUND';

export function RenameFolderMenuItem({ folder, onOpen }: RenameFolderMenuItemProps) {
  return (
    <Headless.MenuItem>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${folder.name} 이름 변경`}
        className="block w-full px-3 py-1 text-left text-sm/6 text-gray-900 data-focus:bg-gray-50 data-focus:outline-hidden dark:text-white dark:data-focus:bg-white/5"
      >
        이름 변경
      </button>
    </Headless.MenuItem>
  );
}

export function RenameFolderDialog({ folder, open, onClose }: RenameFolderDialogProps) {
  const [name, setName] = useState(folder.name);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { rename, isPending, reset } = useRenameFolder();

  const handleClose = () => {
    if (isPending) return;
    setName(folder.name);
    setErrorMessage(null);
    reset();
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setErrorMessage('폴더 이름을 입력해주세요.');
      return;
    }
    if (trimmed === folder.name) {
      onClose();
      return;
    }

    setErrorMessage(null);
    try {
      await rename({ id: folder.id, newName: trimmed });
      onClose();
    } catch (error) {
      const parsed = parseApiError<FolderRenameErrorCode>(error, {
        code: 'UNKNOWN',
        message: '폴더 이름을 변경할 수 없습니다.',
      });
      setErrorMessage(parsed.message);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} size="md">
      <form onSubmit={handleSubmit} aria-label="폴더 이름 변경">
        <DialogTitle>폴더 이름 변경</DialogTitle>
        <DialogBody className="flex flex-col gap-3">
          <label htmlFor={`rename-folder-${folder.id}`} className="text-sm text-zinc-700 dark:text-zinc-300">
            새 이름
          </label>
          <Input
            id={`rename-folder-${folder.id}`}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={255}
            disabled={isPending}
          />
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
          <Button type="submit" disabled={isPending}>
            {isPending ? '변경 중...' : '변경'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
