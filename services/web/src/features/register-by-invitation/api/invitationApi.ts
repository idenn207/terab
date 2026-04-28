import axios from 'axios';

export interface ValidateInvitationResponse {
  valid: boolean;
}

export async function validateInvitation(token: string): Promise<ValidateInvitationResponse> {
  const { data } = await axios.get<ValidateInvitationResponse>(`/api/invitation/${token}`);
  return data;
}
