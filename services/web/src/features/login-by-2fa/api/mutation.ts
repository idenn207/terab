import { api } from '@/shared/api';

export function useLoginWithBackupMutation() {
  return api.auth.loginWithBackup.useMutation();
}
