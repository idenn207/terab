import type { FolderItemDto } from '@shared/api';
import { useFolderRenameMutation } from '../api/mutation';

export interface RenameFolderInput {
  id: string;
  newName: string;
}

export interface UseRenameFolderResult {
  rename: (input: RenameFolderInput) => Promise<FolderItemDto>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

export function useRenameFolder(): UseRenameFolderResult {
  const mutation = useFolderRenameMutation();

  return {
    rename: ({ id, newName }) => mutation.mutateAsync({ path: { id }, body: { name: newName } }),
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
