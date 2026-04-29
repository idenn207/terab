import { axiosBasic } from '@/shared/api';

export interface ValidateInvitationResponse {
  valid: boolean;
}

export async function validateInvitation(token: string): Promise<ValidateInvitationResponse> {
  const { data } = await axiosBasic.get<ValidateInvitationResponse>(`/invitations/${token}`);
  return data;
}
