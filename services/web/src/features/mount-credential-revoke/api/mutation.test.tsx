import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useRevokeMountCredentialMutation } from './mutation';

vi.mock('@shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/api')>();
  return {
    ...actual,
    mountCredentialControllerRevokeMutation: () => ({
      mutationFn: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

describe('useRevokeMountCredentialMutation', () => {
  it('성공 시 mountCredentialControllerList 캐시를 무효화한다', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    const { result } = renderHook(() => useRevokeMountCredentialMutation(), { wrapper });
    await result.current.mutateAsync({ path: { id: 'cred-1' } });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [{ _id: 'mountCredentialControllerList' }],
    });
  });
});
