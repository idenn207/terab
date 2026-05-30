import { NewFolderButton, SearchInput, UploadButton } from '@/features';

interface FileToolbarProps {
  folderId: string | null;
}

export function FileToolbar({ folderId }: FileToolbarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between" aria-label="파일 도구 모음">
      <div className="md:flex-1">
        <SearchInput folderId={folderId} />
      </div>
      <div className="flex flex-wrap items-center gap-3 md:justify-end">
        <NewFolderButton parentId={folderId} />
        <UploadButton folderId={folderId} />
      </div>
    </div>
  );
}
