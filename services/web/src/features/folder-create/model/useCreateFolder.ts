import type { FolderItemDto } from '@shared/api';
import { useFolderCreateMutation } from '../api/mutation';

export interface CreateFolderInput {
  name: string;
  parentId: string | null;
}

export interface UseCreateFolderResult {
  create: (input: CreateFolderInput) => Promise<FolderItemDto>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

export function useCreateFolder(): UseCreateFolderResult {
  const mutation = useFolderCreateMutation();

  return {
    create: ({ name, parentId }) => mutation.mutateAsync({ body: { name, parentId } }),
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
