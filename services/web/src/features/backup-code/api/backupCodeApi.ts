import { axiosAuth } from '@/shared/api';

export interface BackupCodesResponse {
  codes: string[];
}

export interface BackupCodeCountResponse {
  count: number;
}

export const backupCodeApi = {
  regenerate: (): Promise<BackupCodesResponse> => axiosAuth.post<BackupCodesResponse>('/api/auth/backup-codes/regenerate').then((r) => r.data),

  count: (): Promise<BackupCodeCountResponse> => axiosAuth.get<BackupCodeCountResponse>('/api/auth/backup-codes/count').then((r) => r.data),
};
