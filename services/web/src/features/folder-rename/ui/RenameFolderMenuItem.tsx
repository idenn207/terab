import type { Folder } from '@/entities/folder';
import { Button, Input, Modal } from '@/shared/ui';
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
    <Modal open={open} onClose={handleClose} size="md">
      <form onSubmit={handleSubmit} aria-label="폴더 이름 변경">
        <Modal.Header>폴더 이름 변경</Modal.Header>
        <Modal.Body className="flex flex-col gap-3">
          <label htmlFor={`rename-folder-${folder.id}`} className="text-sm text-text-muted">
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
            <p role="alert" className="text-sm text-danger">
              {errorMessage}
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="text" tone="neutral" type="button" onClick={handleClose} disabled={isPending}>
            취소
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? '변경 중...' : '변경'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
