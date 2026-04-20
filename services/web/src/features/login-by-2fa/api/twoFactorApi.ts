import type { User } from '@/entities';
import { axiosInstance } from '@/shared/api';
import axios from 'axios';

// PC 폴링 응답 타입
interface ChallengeStatusPending {
  status: 'PENDING';
  options: string[];
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
    axios.get<ChallengeStatus>(`/api/auth/2fa/challenge/${challengeId}/status`, { withCredentials: true }).then((r) => r.data),

  resend: (challengeId: string): Promise<ResendResponse> =>
    axios.post<ResendResponse>(`/api/auth/2fa/challenge/${challengeId}/resend`, null, { withCredentials: true }).then((r) => r.data),

  respond: (challengeId: string, selectedNumber: string): Promise<void> =>
    axiosInstance.post(`/api/auth/2fa/challenge/${challengeId}/respond`, { selectedNumber }).then(() => {}),

  backupLogin: (data: BackupLoginRequest): Promise<BackupLoginResponse> =>
    axios.post<BackupLoginResponse>('/api/auth/login/backup', data, { withCredentials: true }).then((r) => r.data),
};

export { twoFactorApi };
