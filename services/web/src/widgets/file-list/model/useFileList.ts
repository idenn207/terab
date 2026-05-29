import type { File as DomainFile } from '@/entities/file';
import { useFolderChildrenQuery, useFolderRootQuery } from '@/entities/folder';
import type { Folder } from '@/entities/folder';

export interface UseFileListProps {
  folderId: string | null;
}

export interface UseFileListResult {
  folders: Folder[];
  files: DomainFile[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useFileList({ folderId }: UseFileListProps): UseFileListResult {
  const root = useFolderRootQuery();
  const children = useFolderChildrenQuery(folderId ?? undefined);
  const active = folderId ? children : root;

  return {
    folders: active.data?.folders ?? [],
    files: active.data?.files ?? [],
    isLoading: active.isLoading,
    error: active.error ?? null,
    refetch: () => {
      void active.refetch();
    },
  };
}
