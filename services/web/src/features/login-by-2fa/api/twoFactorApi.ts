import type { User } from '@/entities';
import { axiosAuth, axiosBasic } from '@/shared/api';

// PC 폴링 응답 타입
interface ChallengeStatusPending {
  status: 'PENDING';
  options: string[];
  correctNum: string;
  remainingSeconds: number;
}

interface ChallengeStatusApproved {
  status: 'APPROVED';
  accessToken: string;
  user: User;
}

interface ChallengeStatusDenied {
  status: 'DENIED';
}

interface CompleteTwoFaResponse {
  accessToken: string;
  user: User;
}

interface BackupLoginRequest {
  username: string;
  password: string;
  backupCode: string;
}

interface BackupLoginResponse {
  accessToken: string;
  user: User;
}

export type ChallengeStatus = ChallengeStatusPending | ChallengeStatusApproved | ChallengeStatusDenied;

export interface ResendResponse {
  challengeId: string;
  options: string[];
  expiresAt: string;
}

const twoFactorApi = {
  getStatus: (challengeId: string): Promise<ChallengeStatus> =>
    axiosBasic.get<ChallengeStatus>(`/auth/2fa/challenge/${challengeId}/status`, { withCredentials: true }).then((r) => r.data),

  resend: (challengeId: string): Promise<ResendResponse> =>
    axiosBasic.post<ResendResponse>(`/auth/2fa/challenge/${challengeId}/resend`, null, { withCredentials: true }).then((r) => r.data),

  respond: (challengeId: string, selectedNumber: string): Promise<void> =>
    axiosAuth.post(`/auth/2fa/challenge/${challengeId}/respond`, { selectedNumber }).then(() => {}),

  complete: (challengeId: string): Promise<CompleteTwoFaResponse> =>
    axiosBasic.post<CompleteTwoFaResponse>(`/auth/2fa/challenge/${challengeId}/complete`, null, { withCredentials: true }).then((r) => r.data),

  backupLogin: (data: BackupLoginRequest): Promise<BackupLoginResponse> =>
    axiosBasic.post<BackupLoginResponse>('/auth/login/backup', data, { withCredentials: true }).then((r) => r.data),
};

export { twoFactorApi };
