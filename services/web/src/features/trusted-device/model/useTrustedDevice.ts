import { useRegisterTrustedDeviceMutation, useRevokeTrustedDeviceMutation } from '../api/mutation';

export function useTrustedDevice() {
  const registerMutation = useRegisterTrustedDeviceMutation();
  const revokeMutation = useRevokeTrustedDeviceMutation();

  const register = () => {
    registerMutation.mutate({});
  };
  const revoke = (id: string) => {
    revokeMutation.mutate({ path: { id } });
  };

  return { register, revoke, isRegistering: registerMutation.isPending, isRevoking: revokeMutation.isPending };
}
