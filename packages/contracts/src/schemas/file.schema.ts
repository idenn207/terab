import z from 'zod';

const MAX_FILE_SIZE = 100 * 1024 * 1024 * 1024; // 100 GiB

export const FileItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  folderId: z.string().uuid().nullable(),
  size: z.number(),
  mimeType: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const RenameFileBodySchema = z.object({
  name: z.string().min(1).max(255),
});

export const MoveFileBodySchema = z.object({
  folderId: z.string().uuid().nullable(),
});

export const ZipDownloadBodySchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1).max(100),
});

export const FileSearchQuerySchema = z.object({
  q: z.string().min(2).max(255),
  scope: z.enum(['all', 'folder']),
  folderId: z.string().uuid().optional(),
});

export const FileSearchResponseSchema = z.object({
  files: z.array(FileItemSchema),
});

export const UploadInitBodySchema = z.object({
  folderId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_FILE_SIZE),
  mimeType: z.string().min(1).max(127),
});

export const UploadPartSchema = z.object({
  partNumber: z.number().int().min(1).max(10000),
  uploadUrl: z.string().url(),
});

export const UploadInitResponseSchema = z.object({
  sessionId: z.string().uuid(),
  parts: z.array(UploadPartSchema).min(1),
  uploadHeaders: z.record(z.string()),
  expiresAt: z.coerce.date(),
});

export const UploadCompletePartSchema = z.object({
  partNumber: z.number().int().min(1).max(10000),
  etag: z.string().min(1).max(128),
});

export const UploadCompleteBodySchema = z.object({
  parts: z.array(UploadCompletePartSchema).min(1),
});

export type FileItem = z.infer<typeof FileItemSchema>;
export type RenameFileBody = z.infer<typeof RenameFileBodySchema>;
export type MoveFileBody = z.infer<typeof MoveFileBodySchema>;
export type ZipDownloadBody = z.infer<typeof ZipDownloadBodySchema>;
export type FileSearchQuery = z.infer<typeof FileSearchQuerySchema>;
export type FileSearchResponse = z.infer<typeof FileSearchResponseSchema>;
export type UploadInitBody = z.infer<typeof UploadInitBodySchema>;
export type UploadPart = z.infer<typeof UploadPartSchema>;
export type UploadInitResponse = z.infer<typeof UploadInitResponseSchema>;
export type UploadCompletePart = z.infer<typeof UploadCompletePartSchema>;
export type UploadCompleteBody = z.infer<typeof UploadCompleteBodySchema>;
