import { makeQueryWrapper } from '@/__tests__/wrappers';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRevokeMountCredential } from './useRevokeMountCredential';

const { mockRevokeMutate } = vi.hoisted(() => ({
  mockRevokeMutate: vi.fn(),
}));

vi.mock('../api/mutation', () => ({
  useRevokeMountCredentialMutation: () => ({
    mutateAsync: mockRevokeMutate,
    isPending: false,
    error: null,
  }),
}));

beforeEach(() => vi.clearAllMocks());

describe('useRevokeMountCredential', () => {
  it('revoke(id) 호출 시 mutation 을 path.id 로 실행한다', async () => {
    mockRevokeMutate.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRevokeMountCredential(), { wrapper: makeQueryWrapper() });

    await result.current.revoke('cred-1');

    expect(mockRevokeMutate).toHaveBeenCalledWith({ path: { id: 'cred-1' } });
  });

  it('실패 시 throw 한다', async () => {
    mockRevokeMutate.mockRejectedValue(new Error('MOUNT_CREDENTIAL_NOT_FOUND'));

    const { result } = renderHook(() => useRevokeMountCredential(), { wrapper: makeQueryWrapper() });

    await expect(result.current.revoke('cred-1')).rejects.toThrow('MOUNT_CREDENTIAL_NOT_FOUND');
  });
});
