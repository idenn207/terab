import type { TrashItem } from '@/entities/trash';
import { useTrashPermanentDeleteMutation } from '../api/mutation';

export interface PurgeTrashItemInput {
  id: string;
  type: TrashItem['type'];
}

export interface UsePurgeTrashItemResult {
  purge: (input: PurgeTrashItemInput) => Promise<void>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

export function usePurgeTrashItem(): UsePurgeTrashItemResult {
  const mutation = useTrashPermanentDeleteMutation();

  return {
    purge: async ({ id, type }) => {
      await mutation.mutateAsync({ path: { id }, body: { type } });
    },
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
