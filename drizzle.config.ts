import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './app/lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    databaseId: process.env.CLOUDFLARE_D1_ID ?? '5a4ee3a4-1f04-4ed9-b22d-7b067e87d3e5',
    token: process.env.CLOUDFLARE_API_TOKEN ?? '',
  },
});
