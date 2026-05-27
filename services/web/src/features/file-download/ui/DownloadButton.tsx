import { Alert, AlertActions, AlertDescription, AlertTitle, Button } from '@/shared/ui';
import { useEffect, useState } from 'react';
import { useDownloadFile } from '../model/useDownloadFile';

interface DownloadButtonProps {
  fileId: string;
  fileName: string;
}

export function DownloadButton({ fileId, fileName }: DownloadButtonProps) {
  const { trigger, isPending, lastSavedUri } = useDownloadFile();
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  useEffect(() => {
    if (lastSavedUri) setIsAlertOpen(true);
  }, [lastSavedUri]);

  return (
    <>
      <Button
        plain
        type="button"
        disabled={isPending}
        onClick={(event) => {
          event.stopPropagation();
          void trigger(fileId, fileName);
        }}
      >
        {isPending ? '다운로드 중...' : '다운로드'}
      </Button>
      <Alert open={isAlertOpen} onClose={setIsAlertOpen}>
        <AlertTitle>다운로드 완료</AlertTitle>
        <AlertDescription>Documents 폴더에 저장되었습니다.</AlertDescription>
        <AlertActions>
          <Button onClick={() => setIsAlertOpen(false)}>확인</Button>
        </AlertActions>
      </Alert>
    </>
  );
}
