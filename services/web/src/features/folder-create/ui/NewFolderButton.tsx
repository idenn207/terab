import { parseApiError } from '@shared/api';
import { Button, Dialog, DialogActions, DialogBody, DialogTitle, Input } from '@/shared/ui';
import { type FormEvent, useState } from 'react';
import { useCreateFolder } from '../model/useCreateFolder';

interface NewFolderButtonProps {
  parentId: string | null;
}

type FolderCreateErrorCode = 'FOLDER_NOT_FOUND' | 'FOLDER_DEPTH_EXCEEDED';

export function NewFolderButton({ parentId }: NewFolderButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { create, isPending, reset } = useCreateFolder();

  const close = () => {
    if (isPending) return;
    setIsOpen(false);
    setName('');
    setErrorMessage(null);
    reset();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setErrorMessage('폴더 이름을 입력해주세요.');
      return;
    }

    setErrorMessage(null);
    try {
      await create({ name: trimmed, parentId });
      setIsOpen(false);
      setName('');
    } catch (error) {
      const parsed = parseApiError<FolderCreateErrorCode>(error, {
        code: 'UNKNOWN',
        message: '폴더를 생성할 수 없습니다.',
      });
      setErrorMessage(parsed.message);
    }
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>새 폴더</Button>
      <Dialog open={isOpen} onClose={close} size="md">
        <form onSubmit={handleSubmit} aria-label="새 폴더 만들기">
          <DialogTitle>새 폴더 만들기</DialogTitle>
          <DialogBody className="flex flex-col gap-3">
            <label htmlFor="new-folder-name" className="text-sm text-zinc-700 dark:text-zinc-300">
              폴더 이름
            </label>
            <Input id="new-folder-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={255} disabled={isPending} />
            {errorMessage && (
              <p role="alert" className="text-sm text-red-500">
                {errorMessage}
              </p>
            )}
          </DialogBody>
          <DialogActions>
            <Button plain type="button" onClick={close} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '생성 중...' : '만들기'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
