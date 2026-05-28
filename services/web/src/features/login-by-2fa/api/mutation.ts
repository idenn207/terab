import {
  challengeControllerCompleteMutation,
  challengeControllerResendMutation,
  challengeControllerRespondMutation,
  loginControllerLoginWithBackupMutation,
} from '@shared/api';
import { useMutation } from '@tanstack/react-query';

export function useLoginWithBackupMutation() {
  return useMutation({ ...loginControllerLoginWithBackupMutation() });
}

export function useRespondChallengeMutation() {
  return useMutation({ ...challengeControllerRespondMutation() });
}

export function useResendChallengeMutation() {
  return useMutation({ ...challengeControllerResendMutation() });
}

export function useCompleteTwoFaMutation() {
  return useMutation({ ...challengeControllerCompleteMutation() });
}
