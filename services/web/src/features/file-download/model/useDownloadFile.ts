import { useCallback } from 'react';
import { useFileDownloadMutation } from '../api/mutation';

export interface UseDownloadFileResult {
  trigger: (fileId: string, fileName: string) => Promise<void>;
  isPending: boolean;
  error: Error | null;
}

const REVOKE_DELAY_MS = 0;

export function useDownloadFile(): UseDownloadFileResult {
  const mutation = useFileDownloadMutation();

  const trigger = useCallback(
    async (fileId: string, fileName: string) => {
      const blob = await mutation.mutateAsync({ id: fileId });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      // anchor click 이 비동기 download 트리거 — 즉시 revoke 시 Chrome 등에서 취소될 수 있음
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
    },
    [mutation],
  );

  return {
    trigger,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
