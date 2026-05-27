import { UploadButton } from '@/features';

export function FileToolbar() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3" aria-label="파일 도구 모음">
      <UploadButton />
    </div>
  );
}
