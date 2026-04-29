import { zh } from '@terab/common';
import z from 'zod';

export const EmptySchema = zh.emptyObject();

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  nickname: z.string(),
});

export type User = z.infer<typeof UserSchema>;
