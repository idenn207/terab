import { useEffect, useState } from 'react';
import { useValidateInvitationQuery } from '../api/query';

export function useInvitationValidation(token: string) {
  const [valid, setValid] = useState<boolean | null>(() => (token ? null : false));
  const { data, error } = useValidateInvitationQuery(token);

  useEffect(() => {
    if (!token) return;
    if (error || !data) {
      setValid(false);
      return;
    }

    setValid(data.valid);
  }, [token, data, error]);

  return { valid };
}
