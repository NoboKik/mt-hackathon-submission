// Creates an account, or gives an existing one a new password. There is no registration and no
// admin panel: accounts are an operator's job, over ssh.
//   pnpm user:add --email i.petrov@vsm400.ru --name "Иван Петров" --depot "Депо Москва-Октябрьская" --crew "Бригада № 3"
//   pnpm user:add --email i.petrov@vsm400.ru --reset
// On the server: docker compose -f infra/docker-compose.yml run --rm migrate pnpm user:add …
// The password is generated and printed once — never passed in, so it stays out of shell history.

import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { hashPassword } from '@/lib/auth'
import { db } from './index'
import { users } from './schema'

const USAGE = `usage:
  pnpm user:add --email <email> --name "<Имя Фамилия>" --depot "<депо>" [--crew "<бригада>"] [--position "<должность>"]
  pnpm user:add --email <email> --reset`

function die(msg: string): never {
  console.error(`${msg}\n\n${USAGE}`)
  process.exit(1)
}

async function main() {
  const { values: v } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      depot: { type: 'string' },
      crew: { type: 'string', default: '' },
      position: { type: 'string', default: 'Проводник' },
      reset: { type: 'boolean', default: false },
    },
  })
  // Stored exactly as given: login matches the email verbatim.
  const email = v.email?.trim() ?? ''
  if (!z.email().safeParse(email).success) die(`not an email: "${email}"`)

  const password = randomBytes(9).toString('base64url') // 12 chars
  const passwordHash = hashPassword(password)

  if (v.reset) {
    const rows = await db()
      .update(users)
      .set({ passwordHash })
      .where(eq(users.email, email))
      .returning({ id: users.id })
    if (!rows.length) die(`no user with email ${email}`)
  } else {
    const displayName = v.name?.trim()
    const depot = v.depot?.trim()
    if (!displayName || !depot) die('--name and --depot are required')
    const rows = await db()
      .insert(users)
      .values({
        email,
        passwordHash,
        displayName,
        depot,
        crew: v.crew.trim(),
        position: v.position.trim(),
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id })
    if (!rows.length) die(`${email} already exists — use --reset for a new password`)
  }

  console.log(`${v.reset ? 'password reset' : 'created'}: ${email}\npassword: ${password}`)
  process.exit(0) // postgres-js keeps its pool open
}

main()
