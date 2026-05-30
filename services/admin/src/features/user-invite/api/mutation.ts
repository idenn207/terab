import { invitationAdminControllerCreateMutation } from '@shared/api';
import { useMutation } from '@tanstack/react-query';

export function useCreateInvitationMutation() {
  return useMutation({ ...invitationAdminControllerCreateMutation() });
}
