import { Button } from '@/shared/ui';
import { type ChangeEvent, useRef, useState } from 'react';
import { useUploadFile } from '../model/useUploadFile';

interface UploadButtonProps {
  folderId: string | null;
}

export function UploadButton({ folderId }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mutate, isPending } = useUploadFile();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setProgress(0);
    mutate(
      { file, folderId: folderId ?? undefined, onProgress: setProgress },
      {
        onSuccess: () => {
          setProgress(null);
          setError(null);
        },
        onError: (err: Error) => {
          setError(err.message);
          setProgress(null);
        },
      },
    );
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleChange} />
      <Button onClick={() => inputRef.current?.click()} disabled={isPending}>
        {isPending ? '업로드 중...' : '업로드'}
      </Button>
      {progress !== null && <progress value={progress} max={100} aria-label="업로드 진행률" />}
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
