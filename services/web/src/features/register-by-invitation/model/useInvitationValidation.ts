import { useEffect, useState } from 'react';
import { useValidateInvitationQuery } from '../api/query';

export function useInvitationValidation(token: string) {
  const [valid, setValid] = useState<boolean | null>(() => (token ? null : false));
  const { data } = useValidateInvitationQuery(token);

  useEffect(() => {
    if (!token) return;
    if (!data || data.status !== 200) {
      setValid(false);
      return;
    }

    setValid(data.body.valid);
  }, [token]);

  return { valid };
}
