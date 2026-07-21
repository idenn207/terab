import { renderWithProviders } from '@/__tests__/wrappers';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RevokeMountCredentialButton } from './RevokeMountCredentialButton';

interface RevokeHookValue {
  revoke: (credentialId: string) => Promise<unknown>;
  isRevoking: boolean;
  error: Error | null;
}

const { mockRevoke, mockUseRevoke } = vi.hoisted(() => {
  const revoke = vi.fn();
  return {
    mockRevoke: revoke,
    mockUseRevoke: vi.fn(),
  };
});

vi.mock('../model/useRevokeMountCredential', () => ({
  useRevokeMountCredential: mockUseRevoke,
}));

function buildHookValue(overrides: Partial<RevokeHookValue> = {}): RevokeHookValue {
  return {
    revoke: mockRevoke as RevokeHookValue['revoke'],
    isRevoking: false,
    error: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRevoke.mockReturnValue(buildHookValue());
});

describe('RevokeMountCredentialButton', () => {
  it('confirm 취소 시 revoke 가 호출되지 않는다', () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    renderWithProviders(<RevokeMountCredentialButton credentialId="cred-1" />);

    fireEvent.click(screen.getByRole('button', { name: '마운트 자격증명 회수' }));

    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it('confirm 승인 시 revoke(credentialId) 호출 + onRevoked 콜백 실행', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    mockRevoke.mockResolvedValueOnce(undefined);
    const onRevoked = vi.fn();

    renderWithProviders(<RevokeMountCredentialButton credentialId="cred-1" onRevoked={onRevoked} />);

    fireEvent.click(screen.getByRole('button', { name: '마운트 자격증명 회수' }));

    await waitFor(() => expect(mockRevoke).toHaveBeenCalledWith('cred-1'));
    await waitFor(() => expect(onRevoked).toHaveBeenCalled());
  });

  it('isRevoking 동안 버튼은 aria-busy 상태가 된다', () => {
    mockUseRevoke.mockReturnValueOnce(buildHookValue({ isRevoking: true }));
    renderWithProviders(<RevokeMountCredentialButton credentialId="cred-1" />);

    expect(screen.getByRole('button', { name: '마운트 자격증명 회수' })).toHaveAttribute('aria-busy', 'true');
  });

  it('error 가 있으면 role="alert" 노출', () => {
    mockUseRevoke.mockReturnValueOnce(buildHookValue({ error: new Error('MOUNT_CREDENTIAL_NOT_FOUND') }));
    renderWithProviders(<RevokeMountCredentialButton credentialId="cred-1" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
