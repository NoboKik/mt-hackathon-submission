import { LoginBody } from '@p400/shared'
import { NextResponse } from 'next/server'
import { userByEmail } from '@/db/queries'
import { ru } from '@/i18n/ru'
import { fail } from '@/lib/api'
import { clientIp, loginThrottled, setSessionCookie, verifyPassword } from '@/lib/auth'

export async function POST(req: Request) {
  const body = LoginBody.safeParse(await req.json().catch(() => null))
  if (!body.success) return fail(400, ru.errors.badRequest, body.error.issues)

  if (loginThrottled(clientIp(req), body.data.email)) return fail(429, ru.errors.tooManyLogins)

  const user = await userByEmail(body.data.email)
  // One message for both halves: nobody gets to enumerate emails here.
  if (!user || !verifyPassword(body.data.password, user.passwordHash))
    return fail(401, ru.errors.badCredentials)

  await setSessionCookie(user.id)
  return NextResponse.json({ ok: true })
}
