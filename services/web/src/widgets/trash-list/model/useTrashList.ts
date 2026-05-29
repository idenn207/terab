import { useTrashListQuery, type TrashItem } from '@/entities/trash';

export interface UseTrashListResult {
  items: TrashItem[];
  isLoading: boolean;
  error: Error | null;
  isEmpty: boolean;
}

export function useTrashList(): UseTrashListResult {
  const { data, isLoading, error } = useTrashListQuery();
  const items = [...(data?.items ?? [])].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  return {
    items,
    isLoading,
    error: error ?? null,
    isEmpty: !isLoading && items.length === 0,
  };
}
