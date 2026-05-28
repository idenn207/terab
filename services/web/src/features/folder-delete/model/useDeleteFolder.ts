import { useFolderRemoveMutation } from '../api/mutation';

export interface DeleteFolderInput {
  id: string;
}

export interface UseDeleteFolderResult {
  remove: (input: DeleteFolderInput) => Promise<void>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

export function useDeleteFolder(): UseDeleteFolderResult {
  const mutation = useFolderRemoveMutation();

  return {
    remove: async ({ id }) => {
      await mutation.mutateAsync({ path: { id } });
    },
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
