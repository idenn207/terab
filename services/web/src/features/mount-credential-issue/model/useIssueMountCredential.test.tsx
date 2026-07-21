import { makeQueryWrapper } from '@/__tests__/wrappers';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIssueMountCredential } from './useIssueMountCredential';

const { mockIssueMutate, mockReset } = vi.hoisted(() => ({
  mockIssueMutate: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock('../api/mutation', () => ({
  useIssueMountCredentialMutation: () => ({
    mutateAsync: mockIssueMutate,
    reset: mockReset,
    isPending: false,
    error: null,
  }),
}));

beforeEach(() => vi.clearAllMocks());

describe('useIssueMountCredential', () => {
  const issuedResponse = {
    id: 'cred-1',
    driveId: 'drive-1',
    protocol: 'iscsi' as const,
    iqn: 'iqn.2026-05.com.terab:drive-1',
    password: 'abc-XYZ_pwd-123',
    script: '# powershell script body',
    osUsername: 'terab-cred-1',
    portalHost: '192.168.0.5',
    portalPort: 3260,
    createdAt: '2026-05-30T00:00:00.000Z',
  };

  it('issue() 호출 시 mutation 을 실행하고 응답을 issued state 에 저장한다', async () => {
    mockIssueMutate.mockResolvedValue(issuedResponse);

    const { result } = renderHook(() => useIssueMountCredential(), { wrapper: makeQueryWrapper() });

    await act(async () => {
      await result.current.issue('drive-1');
    });

    expect(mockIssueMutate).toHaveBeenCalledWith({ body: { driveId: 'drive-1' } });
    await waitFor(() => expect(result.current.issued).toEqual(issuedResponse));
  });

  it('driveId 미지정 시 빈 body 로 호출한다 (server lazy 생성)', async () => {
    mockIssueMutate.mockResolvedValue(issuedResponse);

    const { result } = renderHook(() => useIssueMountCredential(), { wrapper: makeQueryWrapper() });

    await act(async () => {
      await result.current.issue();
    });

    expect(mockIssueMutate).toHaveBeenCalledWith({ body: {} });
  });

  it('clearIssued() 호출 시 issued 가 null 로 리셋된다', async () => {
    mockIssueMutate.mockResolvedValue(issuedResponse);

    const { result } = renderHook(() => useIssueMountCredential(), { wrapper: makeQueryWrapper() });

    await act(async () => {
      await result.current.issue();
    });
    expect(result.current.issued).toEqual(issuedResponse);

    act(() => result.current.clearIssued());

    expect(result.current.issued).toBeNull();
  });

  it('mutation 실패 시 throw + issued 는 변하지 않는다', async () => {
    mockIssueMutate.mockRejectedValue(new Error('STORAGE_AGENT_UNAVAILABLE'));

    const { result } = renderHook(() => useIssueMountCredential(), { wrapper: makeQueryWrapper() });

    await expect(result.current.issue('drive-1')).rejects.toThrow('STORAGE_AGENT_UNAVAILABLE');
    expect(result.current.issued).toBeNull();
  });
});
