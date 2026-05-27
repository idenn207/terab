import { Button } from '@/shared/ui';
import { useDownloadFile } from '../model/useDownloadFile';

interface DownloadButtonProps {
  fileId: string;
  fileName: string;
}

export function DownloadButton({ fileId, fileName }: DownloadButtonProps) {
  const { trigger, isPending } = useDownloadFile();

  return (
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
  );
}
