import { useRevokeTrustedDeviceMutation } from '../api/mutation';

export interface RevokeTrustedDeviceInput {
  id: string;
}

export interface UseRevokeTrustedDeviceResult {
  revoke: (input: RevokeTrustedDeviceInput) => Promise<void>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

export function useRevokeTrustedDevice(): UseRevokeTrustedDeviceResult {
  const mutation = useRevokeTrustedDeviceMutation();

  return {
    revoke: async ({ id }) => {
      await mutation.mutateAsync({ path: { id } });
    },
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
