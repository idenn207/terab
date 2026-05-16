import z from 'zod';

export const TrashItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['file', 'folder']),
  name: z.string(),
  deletedAt: z.coerce.date(),
});

export const TrashListResponseSchema = z.object({
  items: z.array(TrashItemSchema),
});

export const TrashActionBodySchema = z.object({
  type: z.enum(['file', 'folder']),
});

export type TrashItem = z.infer<typeof TrashItemSchema>;
export type TrashListResponse = z.infer<typeof TrashListResponseSchema>;
export type TrashActionBody = z.infer<typeof TrashActionBodySchema>;
