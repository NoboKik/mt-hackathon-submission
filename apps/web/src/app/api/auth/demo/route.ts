import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { userByEmail } from '@/db/queries'
import { fail } from '@/lib/api'
import { inviteOk, setSessionCookie } from '@/lib/auth'

// The account db/seed.ts creates. Its password is a random value nobody knows: this route is
// the only way in, so a trainer can show the app without handing out credentials.
const DEMO_EMAIL = 'demo@provodnik400.ru'

// Remembers an accepted invite. Every 401 redirects to a bare /login — after `deploy.sh
// reset-demo` the demo user has a new id, so an old demo session is one — and without this
// the demo button would answer 403.
const INVITE_COOKIE = 'p400_invite'
const INVITE_MAX_AGE_SEC = 30 * 24 * 60 * 60

export async function POST(req: Request) {
  // A missing or broken body is just "no invite": with DEMO_INVITE empty that still gets in.
  const body = (await req.json().catch(() => null)) as { invite?: unknown } | null
  const given = typeof body?.invite === 'string' ? body.invite : undefined
  const store = await cookies()
  if (!inviteOk(given) && !inviteOk(store.get(INVITE_COOKIE)?.value))
    return fail(403, 'demoInviteRequired')

  const user = await userByEmail(DEMO_EMAIL)
  // SEED_DEMO=0, or a dev database that was migrated but never seeded.
  if (!user) return fail(404, 'demoUserMissing')

  await setSessionCookie(user.id)
  if (given && inviteOk(given))
    store.set(INVITE_COOKIE, given, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/auth/demo',
      secure: process.env.NODE_ENV === 'production',
      maxAge: INVITE_MAX_AGE_SEC,
    })
  return NextResponse.json({ ok: true })
}
