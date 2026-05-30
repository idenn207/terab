import type { File as DomainFile } from '@/entities/file';
import type { Folder } from '@/entities/folder';
import {
  DeleteFolderDialog,
  DeleteFolderMenuItem,
  DownloadButton,
  FilePreviewDialog,
  MoveFolderDialog,
  MoveFolderMenuItem,
  RenameFolderDialog,
  RenameFolderMenuItem,
  isImageMimeType,
  useDownloadFile,
  useFilePreview,
} from '@/features';
import { Button } from '@/shared/ui';
import * as Headless from '@headlessui/react';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useFileList } from '../model/useFileList';

const SKELETON_COUNT = 6;

type FolderModalKind = 'rename' | 'move' | 'delete';

interface BrowseProps {
  mode?: 'browse';
  folderId: string | null;
  onFolderOpen: (folder: Pick<Folder, 'id' | 'name'>) => void;
}

interface SearchProps {
  mode: 'search';
  files: DomainFile[];
  isLoading: boolean;
}

type FileListProps = BrowseProps | SearchProps;

export function FileList(props: FileListProps) {
  if (props.mode === 'search') {
    return <SearchModeList files={props.files} isLoading={props.isLoading} />;
  }
  return <BrowseModeList folderId={props.folderId} onFolderOpen={props.onFolderOpen} />;
}

function BrowseModeList({ folderId, onFolderOpen }: Required<Pick<BrowseProps, 'folderId' | 'onFolderOpen'>>) {
  const { folders, files, isLoading, error, refetch } = useFileList({ folderId });
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
    return <SkeletonGrid />;
  }

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <p className="text-sm text-red-700 dark:text-red-300">목록을 불러올 수 없습니다: {error.message}</p>
        <Button variant="text" tone="neutral" onClick={refetch}>
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
            <FolderRow folder={folder} onOpen={() => onFolderOpen({ id: folder.id, name: folder.name })} />
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

function SearchModeList({ files, isLoading }: { files: DomainFile[]; isLoading: boolean }) {
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
    return <SkeletonGrid />;
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
        <p className="text-base font-medium text-zinc-800 dark:text-zinc-200">일치하는 파일이 없습니다</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">다른 키워드로 다시 시도해 보세요.</p>
      </div>
    );
  }

  return (
    <>
      <ul role="list" className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" aria-label="검색 결과">
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

function SkeletonGrid() {
  return (
    <div role="status" aria-live="polite" className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: SKELETON_COUNT }).map((_, idx) => (
        <div key={idx} className="h-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
      ))}
      <span className="sr-only">목록을 불러오는 중</span>
    </div>
  );
}

function FolderRow({ folder, onOpen }: { folder: Folder; onOpen: () => void }) {
  const [modalKind, setModalKind] = useState<FolderModalKind | null>(null);
  const closeModal = () => setModalKind(null);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-1 items-center gap-3 truncate text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{folder.name}</span>
        </button>
        <Headless.Menu as="div" className="relative">
          <Headless.MenuButton
            aria-label={`${folder.name} 동작`}
            className="-m-1 rounded p-1 text-zinc-500 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <EllipsisHorizontalIcon aria-hidden="true" className="size-5" />
          </Headless.MenuButton>
          <Headless.MenuItems
            transition
            anchor="bottom end"
            className="z-10 mt-2 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg outline outline-gray-900/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
          >
            <RenameFolderMenuItem folder={folder} onOpen={() => setModalKind('rename')} />
            <MoveFolderMenuItem folder={folder} onOpen={() => setModalKind('move')} />
            <DeleteFolderMenuItem folder={folder} onOpen={() => setModalKind('delete')} />
          </Headless.MenuItems>
        </Headless.Menu>
      </div>
      <RenameFolderDialog folder={folder} open={modalKind === 'rename'} onClose={closeModal} />
      <MoveFolderDialog folder={folder} open={modalKind === 'move'} onClose={closeModal} />
      <DeleteFolderDialog folder={folder} open={modalKind === 'delete'} onClose={closeModal} />
    </>
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
