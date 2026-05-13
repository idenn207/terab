import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { folders } from './folders.schema';
import { users } from './users.schema';

export const uploadSessions = table(
  'upload_sessions',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    folderId: t.uuid('folder_id').references(() => folders.id, { onDelete: 'cascade' }),

    name: t.varchar('name', { length: 255 }).notNull(),
    size: t.bigint('size', { mode: 'number' }).notNull(),
    mimeType: t.varchar('mime_type', { length: 127 }).notNull(),
    minioKey: t.varchar('minio_key', { length: 512 }).notNull().unique(),

    uploadKind: t.varchar('upload_kind', { length: 16 }).notNull(),
    multipartUploadId: t.varchar('multipart_upload_id', { length: 128 }),

    expiresAt: t.timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [t.index().on(table.userId), t.index().on(table.expiresAt)],
);

export type UploadSessions$Insert = typeof uploadSessions.$inferInsert;
export type UploadSessions$Select = typeof uploadSessions.$inferSelect;
