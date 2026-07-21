import type { InvitationResponseDto } from '@shared/api';
import { useState } from 'react';
import { useCreateInvitationMutation } from '../api/mutation';

interface UseInviteResult {
  invitation: InvitationResponseDto | null;
  isLoading: boolean;
  errorMessage: string | null;
  invite: (expiresInDays?: number) => void;
  reset: () => void;
}

export function useInvite(): UseInviteResult {
  const [invitation, setInvitation] = useState<InvitationResponseDto | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { mutate, isPending } = useCreateInvitationMutation();

  const invite = (expiresInDays?: number) => {
    setErrorMessage(null);
    mutate(
      { body: { expiresInDays } },
      {
        onSuccess: (data) => {
          if (data) setInvitation(data);
        },
        onError: () => setErrorMessage('초대 링크 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
      },
    );
  };

  const reset = () => {
    setInvitation(null);
    setErrorMessage(null);
  };

  return { invitation, isLoading: isPending, errorMessage, invite, reset };
}
