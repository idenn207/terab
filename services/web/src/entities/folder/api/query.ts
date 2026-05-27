import { folderControllerGetChildrenOptions, folderControllerGetRootOptions } from '@shared/api';
import { useQuery } from '@tanstack/react-query';

export function useFolderRootQuery() {
  return useQuery({ ...folderControllerGetRootOptions() });
}

export function useFolderChildrenQuery(parentId: string | undefined) {
  return useQuery({
    ...folderControllerGetChildrenOptions({ path: { id: parentId ?? '' } }),
    enabled: Boolean(parentId),
  });
}
