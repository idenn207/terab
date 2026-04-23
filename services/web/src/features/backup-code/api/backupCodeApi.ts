import { axiosUser } from '@/shared/api';

export interface BackupCodesResponse {
  codes: string[];
}

export interface BackupCodeCountResponse {
  count: number;
}

export const backupCodeApi = {
  regenerate: (): Promise<BackupCodesResponse> => axiosUser.post<BackupCodesResponse>('/api/auth/backup-codes/regenerate').then((r) => r.data),

  count: (): Promise<BackupCodeCountResponse> => axiosUser.get<BackupCodeCountResponse>('/api/auth/backup-codes/count').then((r) => r.data),
};
