import {
  authControllerCompleteTwoFaMutation,
  authControllerLoginWithBackupMutation,
  twoFaControllerResendMutation,
  twoFaControllerRespondMutation,
} from '@shared/api';
import { useMutation } from '@tanstack/react-query';

export function useLoginWithBackupMutation() {
  return useMutation({ ...authControllerLoginWithBackupMutation() });
}

export function useRespondChallengeMutation() {
  return useMutation({ ...twoFaControllerRespondMutation() });
}

export function useResendChallengeMutation() {
  return useMutation({ ...twoFaControllerResendMutation() });
}

export function useCompleteTwoFaMutation() {
  return useMutation({ ...authControllerCompleteTwoFaMutation() });
}
