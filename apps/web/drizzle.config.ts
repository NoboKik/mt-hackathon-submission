import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ quiet: true }) // apps/web/.env — the same file Next loads

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  // biome-ignore lint/style/noNonNullAssertion: drizzle-kit reports a missing url itself
  dbCredentials: { url: process.env.DATABASE_URL! },
})
