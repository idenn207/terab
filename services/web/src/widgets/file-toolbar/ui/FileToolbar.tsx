import { NewFolderButton, UploadButton } from '@/features';

interface FileToolbarProps {
  folderId: string | null;
}

export function FileToolbar({ folderId }: FileToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3" aria-label="파일 도구 모음">
      <NewFolderButton parentId={folderId} />
      <UploadButton folderId={folderId} />
    </div>
  );
}
