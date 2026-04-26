import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },

  migrations: {
    prefix: 'index',
    table: '__drizzle_migrations__',
    schema: 'public',
  },

  breakpoints: true,
  strict: true,
  verbose: true,
});
