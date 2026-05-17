import { api } from '@/shared/api';
import { twoFaControllerResendMutation, twoFaControllerRespondMutation } from '@shared/api';
import { useMutation } from '@tanstack/react-query';

export function useLoginWithBackupMutation() {
  return api.auth.loginWithBackup.useMutation();
}

export function useRespondChallengeMutation() {
  return useMutation({ ...twoFaControllerRespondMutation() });
}

export function useResendChallengeMutation() {
  return useMutation({ ...twoFaControllerResendMutation() });
}

export function useCompleteTwoFaMutation() {
  return api.auth.completeTwoFa.useMutation();
}
