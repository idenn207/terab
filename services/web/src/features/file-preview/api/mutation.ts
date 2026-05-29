import { fileDownloadControllerDownloadFileOptions } from '@shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useFilePreviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const data = await queryClient.fetchQuery({
        ...fileDownloadControllerDownloadFileOptions({ path: { id } }),
        // Blob 캐시 보관 의도 없음 — preview/download 트리거 즉시 해제
        gcTime: 0,
        staleTime: 0,
      });
      return data as unknown as Blob;
    },
  });
}
