import { useEffect, useState } from 'react';
import { validateInvitation } from '../api/invitationApi';

export function useInvitationValidation(token: string) {
  const [valid, setValid] = useState<boolean | null>(() => (token ? null : false));

  useEffect(() => {
    if (!token) return;
    validateInvitation(token)
      .then(({ valid }) => setValid(valid))
      .catch(() => setValid(false));
  }, [token]);

  return valid;
}
