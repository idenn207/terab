import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useIssueMountCredentialMutation } from './mutation';

vi.mock('@shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/api')>();
  return {
    ...actual,
    mountCredentialControllerIssueMutation: () => ({
      mutationFn: vi.fn().mockResolvedValue({
        id: 'cred-1',
        driveId: 'drive-1',
        protocol: 'iscsi',
        iqn: 'iqn.2026-05.com.terab:drive-1',
        password: 'pw',
        script: '# ps1',
        osUsername: 'u',
        portalHost: 'h',
        portalPort: 3260,
        createdAt: '2026-05-30T00:00:00.000Z',
      }),
    }),
  };
});

describe('useIssueMountCredentialMutation', () => {
  it('성공 시 mountCredentialControllerList 캐시를 무효화한다', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    const { result } = renderHook(() => useIssueMountCredentialMutation(), { wrapper });
    await result.current.mutateAsync({ body: { driveId: 'drive-1' } });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [{ _id: 'mountCredentialControllerList' }],
    });
  });
});
