import type { TrashItem } from '@/entities/trash';
import type { TrashControllerPermanentDeleteData } from '@shared/api';
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
      // codegen 이 enum 을 Object 로 fallback — runtime 은 'file'|'folder' 문자열을 그대로 전송. 두 단계 cast 로 TS 경계만 우회
      const body = { type } as unknown as TrashControllerPermanentDeleteData['body'];
      await mutation.mutateAsync({ path: { id }, body });
    },
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
