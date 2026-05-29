import type { TrashItem } from '@/entities/trash';
import { useTrashRestoreMutation } from '../api/mutation';

export interface RestoreTrashItemInput {
  id: string;
  type: TrashItem['type'];
}

export interface UseRestoreTrashItemResult {
  restore: (input: RestoreTrashItemInput) => Promise<void>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

export function useRestoreTrashItem(): UseRestoreTrashItemResult {
  const mutation = useTrashRestoreMutation();

  return {
    restore: async ({ id, type }) => {
      await mutation.mutateAsync({ path: { id }, body: { type } });
    },
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
