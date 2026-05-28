import type { FolderItemDto } from '@shared/api';
import { useFolderMoveMutation } from '../api/mutation';

export interface MoveFolderInput {
  id: string;
  targetParentId: string | null;
}

export interface UseMoveFolderResult {
  move: (input: MoveFolderInput) => Promise<FolderItemDto>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

export function useMoveFolder(): UseMoveFolderResult {
  const mutation = useFolderMoveMutation();

  return {
    move: ({ id, targetParentId }) => mutation.mutateAsync({ path: { id }, body: { parentId: targetParentId } }),
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
