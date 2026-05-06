import z from 'zod';

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

export type FileItem = z.infer<typeof FileItemSchema>;
export type RenameFileBody = z.infer<typeof RenameFileBodySchema>;
export type MoveFileBody = z.infer<typeof MoveFileBodySchema>;
export type ZipDownloadBody = z.infer<typeof ZipDownloadBodySchema>;
export type FileSearchQuery = z.infer<typeof FileSearchQuerySchema>;
export type FileSearchResponse = z.infer<typeof FileSearchResponseSchema>;
