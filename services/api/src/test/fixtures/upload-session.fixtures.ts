import type { UploadSessions$Select } from '@terab/db';

export const UPLOAD_SESSION_ID = '00000000-0000-0000-0000-000000000010';
export const UPLOAD_MINIO_KEY = 'uuid-1/00000000-0000-0000-0000-00000000aaaa';

export const mockUploadSessionSingle: UploadSessions$Select = {
  id: UPLOAD_SESSION_ID,
  userId: 'uuid-1',
  folderId: null,
  name: 'test.png',
  size: 1024,
  mimeType: 'image/png',
  minioKey: UPLOAD_MINIO_KEY,
  uploadKind: 'single',
  multipartUploadId: null,
  expiresAt: new Date('2999-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-05-13T00:00:00.000Z'),
};

export const mockUploadSessionMultipart: UploadSessions$Select = {
  ...mockUploadSessionSingle,
  id: '00000000-0000-0000-0000-000000000011',
  uploadKind: 'multipart',
  multipartUploadId: 'multipart-upload-id-1',
  size: 150 * 1024 * 1024,
};

export const mockUploadSessionExpired: UploadSessions$Select = {
  ...mockUploadSessionSingle,
  id: '00000000-0000-0000-0000-000000000012',
  expiresAt: new Date('2020-01-01T00:00:00.000Z'),
};
