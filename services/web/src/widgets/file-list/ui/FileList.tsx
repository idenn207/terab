import type { File as DomainFile } from '@/entities/file';
import type { Folder } from '@/entities/folder';
import { DownloadButton, FilePreviewDialog, isImageMimeType, useDownloadFile, useFilePreview } from '@/features';
import { Button } from '@/shared/ui';
import { useFileList } from '../model/useFileList';

const SKELETON_COUNT = 6;

export function FileList() {
  const { folders, files, isLoading, error, refetch } = useFileList();
  const preview = useFilePreview();
  const download = useDownloadFile();

  const handleFileClick = (file: DomainFile) => {
    if (isImageMimeType(file.mimeType)) {
      void preview.open({ id: file.id, name: file.name, mimeType: file.mimeType });
      return;
    }
    void download.trigger(file.id, file.name);
  };

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: SKELETON_COUNT }).map((_, idx) => (
          <div key={idx} className="h-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
        ))}
        <span className="sr-only">목록을 불러오는 중</span>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <p className="text-sm text-red-700 dark:text-red-300">목록을 불러올 수 없습니다: {error.message}</p>
        <Button plain onClick={refetch}>
          다시 시도
        </Button>
      </div>
    );
  }

  const isEmpty = folders.length === 0 && files.length === 0;
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
        <p className="text-base font-medium text-zinc-800 dark:text-zinc-200">아직 파일이 없습니다</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">우측 상단 업로드 버튼으로 첫 파일을 올려보세요.</p>
      </div>
    );
  }

  return (
    <>
      <ul role="list" className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" aria-label="파일 목록">
        {folders.map((folder) => (
          <li key={folder.id} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
            <FolderRow folder={folder} />
          </li>
        ))}
        {files.map((file) => (
          <li
            key={file.id}
            className="rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20"
          >
            <FileRow file={file} onClick={() => handleFileClick(file)} />
          </li>
        ))}
      </ul>
      <FilePreviewDialog
        isOpen={preview.isOpen}
        target={preview.target}
        blobUrl={preview.blobUrl}
        isLoading={preview.isLoading}
        error={preview.error}
        onClose={preview.close}
      />
    </>
  );
}

function FolderRow({ folder }: { folder: Folder }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{folder.name}</span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">폴더</span>
    </div>
  );
}

function FileRow({ file, onClick }: { file: DomainFile; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 items-center gap-3 truncate text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{file.name}</span>
      </button>
      <DownloadButton fileId={file.id} fileName={file.name} />
    </div>
  );
}
