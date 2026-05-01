import { useQueryClient } from '@tanstack/react-query';
import { contract } from '@terab/contract';
import { useRegisterTrustedDeviceMutation, useRevokeTrustedDeviceMutation } from '../api/mutation';

export function useTrustedDevice() {
  const queryClient = useQueryClient();
  const registerMutation = useRegisterTrustedDeviceMutation();
  const revokeMutation = useRevokeTrustedDeviceMutation();

  const register = () => {
    registerMutation.mutate(
      { body: {} },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [contract.trustedDevice.list] });
        },
      },
    );
  };
  const revoke = (id: string) => {
    revokeMutation.mutate(
      { params: { id }, body: {} },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [contract.trustedDevice.list] });
        },
      },
    );
  };

  return { register, revoke, isRegistering: registerMutation.isPending, isRevoking: revokeMutation.isPending };
}
