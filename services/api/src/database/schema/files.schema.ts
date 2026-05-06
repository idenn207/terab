import * as t from 'drizzle-orm/pg-core';
import { pgTable as table } from 'drizzle-orm/pg-core';
import { folders } from './folders.schema';
import { users } from './users.schema';

export const files = table(
  'files',
  {
    id: t.uuid('id').primaryKey().defaultRandom(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    folderId: t.uuid('folder_id').references(() => folders.id, { onDelete: 'cascade' }),
    name: t.varchar('name', { length: 255 }).notNull(),
    minioKey: t.varchar('minio_key', { length: 512 }).notNull().unique(),
    size: t.bigint('size', { mode: 'number' }).notNull(),
    mimeType: t.varchar('mime_type', { length: 127 }).notNull(),
    softDeletedAt: t.timestamp('soft_deleted_at', { withTimezone: true }),
    createdAt: t.timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: t.timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [t.index().on(table.userId), t.index().on(table.folderId), t.index().on(table.name)],
);

export type Files$Insert = typeof files.$inferInsert;
export type Files$Select = typeof files.$inferSelect;
