import { NextResponse } from 'next/server'
import { userByEmail } from '@/db/queries'
import { ru } from '@/i18n/ru'
import { fail } from '@/lib/api'
import { inviteOk, setSessionCookie } from '@/lib/auth'

// The account db/seed.ts creates. Its password is a random value nobody knows: this route is
// the only way in, so a trainer can show the app without handing out credentials.
const DEMO_EMAIL = 'demo@provodnik400.ru'

export async function POST(req: Request) {
  // A missing or broken body is just "no invite": with DEMO_INVITE empty that still gets in.
  const body = (await req.json().catch(() => null)) as { invite?: unknown } | null
  const invite = typeof body?.invite === 'string' ? body.invite : undefined
  if (!inviteOk(invite)) return fail(403, ru.errors.demoInviteRequired)

  const user = await userByEmail(DEMO_EMAIL)
  if (!user) return fail(500, ru.errors.demoUserMissing)

  await setSessionCookie(user.id)
  return NextResponse.json({ ok: true })
}
