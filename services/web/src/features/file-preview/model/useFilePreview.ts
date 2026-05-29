import { useCallback, useEffect, useRef, useState } from 'react';
import { useFilePreviewMutation } from '../api/mutation';

export interface PreviewTarget {
  id: string;
  name: string;
  mimeType: string;
}

export interface UseFilePreviewResult {
  open: (target: PreviewTarget) => Promise<void>;
  close: () => void;
  blobUrl: string | null;
  target: PreviewTarget | null;
  isOpen: boolean;
  isLoading: boolean;
  error: Error | null;
}

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function useFilePreview(): UseFilePreviewResult {
  const mutation = useFilePreviewMutation();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setTarget(null);
    setBlobUrl(null);
    revoke();
  }, [revoke]);

  const open = useCallback(
    async (next: PreviewTarget) => {
      if (!isImageMimeType(next.mimeType)) return;
      revoke();
      setTarget(next);
      setIsOpen(true);
      const blob = await mutation.mutateAsync({ id: next.id });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setBlobUrl(url);
    },
    [mutation, revoke],
  );

  useEffect(() => revoke, [revoke]);

  return {
    open,
    close,
    blobUrl,
    target,
    isOpen,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}
