import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useUploadCompleteMutation } from './mutation';

vi.mock('@shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/api')>();
  return {
    ...actual,
    fileUploadControllerCompleteMutation: () => ({
      mutationFn: vi.fn().mockResolvedValue({ id: 'file-1', name: 'a.bin' }),
    }),
  };
});

describe('useUploadCompleteMutation', () => {
  it('성공 시 folderControllerGetChildren 캐시를 partial match 로 무효화한다', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    const { result } = renderHook(() => useUploadCompleteMutation(), { wrapper });
    await result.current.mutateAsync({ path: { sessionId: 'sess-1' }, body: { parts: [] } });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [{ _id: 'folderControllerGetChildren' }],
    });
  });
});
