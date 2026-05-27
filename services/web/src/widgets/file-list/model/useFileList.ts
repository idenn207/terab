import type { File as DomainFile } from '@/entities/file';
import { useFolderRootQuery } from '@/entities/folder';
import type { Folder } from '@/entities/folder';

export interface UseFileListResult {
  folders: Folder[];
  files: DomainFile[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useFileList(): UseFileListResult {
  const root = useFolderRootQuery();

  return {
    folders: root.data?.folders ?? [],
    files: root.data?.files ?? [],
    isLoading: root.isLoading,
    error: root.error ?? null,
    refetch: () => {
      void root.refetch();
    },
  };
}
