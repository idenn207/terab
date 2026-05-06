import z from 'zod';
import { FileItemSchema } from './file.schema';

export const FolderItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  parentId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const FolderChildrenResponseSchema = z.object({
  folders: z.array(FolderItemSchema),
  files: z.array(FileItemSchema),
});

export const CreateFolderBodySchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().optional(),
});

export const RenameFolderBodySchema = z.object({
  name: z.string().min(1).max(255),
});

export const MoveFolderBodySchema = z.object({
  parentId: z.string().uuid().nullable(),
});

export type FolderItem = z.infer<typeof FolderItemSchema>;
export type FolderChildrenResponse = z.infer<typeof FolderChildrenResponseSchema>;
export type CreateFolderBody = z.infer<typeof CreateFolderBodySchema>;
export type RenameFolderBody = z.infer<typeof RenameFolderBodySchema>;
export type MoveFolderBody = z.infer<typeof MoveFolderBodySchema>;
