import { trashControllerListOptions } from '@shared/api';
import { useQuery } from '@tanstack/react-query';

export function useTrashListQuery() {
  return useQuery({ ...trashControllerListOptions() });
}
