import { useRevokeMountCredentialMutation } from '../api/mutation';

export function useRevokeMountCredential() {
  const mutation = useRevokeMountCredentialMutation();

  const revoke = (credentialId: string) => mutation.mutateAsync({ path: { id: credentialId } });

  return {
    revoke,
    isRevoking: mutation.isPending,
    error: mutation.error,
  };
}
