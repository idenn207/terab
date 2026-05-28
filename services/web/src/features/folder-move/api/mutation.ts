import { folderControllerMoveMutation } from '@shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useFolderMoveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...folderControllerMoveMutation(),
    onSuccess: () => {
      // 출발지와 도착지 양쪽 캐시를 무효화해야 화면이 동기화됨
      queryClient.invalidateQueries({ queryKey: [{ _id: 'folderControllerGetRoot' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'folderControllerGetChildren' }] });
    },
  });
}
