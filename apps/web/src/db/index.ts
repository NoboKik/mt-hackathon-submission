// Server-only (the `server-only` package isn't installed): never import this from a client
// component — it opens a Postgres pool.
// Lazy: `next build` runs in CI without a database, so nothing connects at import time.
// Cached on globalThis so dev hot reload reuses one pool instead of leaking one per reload.

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const cache = globalThis as { __p400db?: ReturnType<typeof connect> }

function connect() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set — copy apps/web/.env.example to apps/web/.env')
  return drizzle(postgres(url), { schema })
}

export function db() {
  cache.__p400db ??= connect()
  return cache.__p400db
}
