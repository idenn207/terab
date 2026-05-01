import { api } from '@/shared/api';

export function useLoginWithBackupMutation() {
  return api.auth.loginWithBackup.useMutation();
}

export function useRespondChallengeMutation() {
  return api.twofa.respond.useMutation();
}

export function useResendChallengeMutation() {
  return api.twofa.resend.useMutation();
}

export function useCompleteTwoFaMutation() {
  return api.auth.completeTwoFa.useMutation();
}
