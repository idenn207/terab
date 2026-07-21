import { useState } from 'react';
import type { IssuedMountCredential } from '@/entities';
import { useIssueMountCredentialMutation } from '../api/mutation';

export function useIssueMountCredential() {
  const [issued, setIssued] = useState<IssuedMountCredential | null>(null);
  const mutation = useIssueMountCredentialMutation();

  const issue = async (driveId?: string) => {
    const data = await mutation.mutateAsync({ body: driveId ? { driveId } : {} });
    setIssued(data);
    return data;
  };

  const clearIssued = () => setIssued(null);

  return {
    issue,
    issued,
    clearIssued,
    isIssuing: mutation.isPending,
    error: mutation.error,
  };
}
