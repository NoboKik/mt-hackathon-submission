// Server only: this module reads AUTH_SECRET and touches cookies.
// NOTE: `server-only` isn't installed, so this comment is the guard. Install the package
// if a client component ever imports this file by accident.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { cookies } from 'next/headers'

const COOKIE = 'p400_session'
const MAX_AGE_SEC = 30 * 24 * 60 * 60
const KEYLEN = 64

// NOTE: a fixed dev secret so `pnpm dev` works with no .env. Cookies signed with it are
// worthless, and secret() throws in production when AUTH_SECRET is missing or empty — lazily, on
// the first signed request, so a misconfigured container still passes the /api/health check.
const DEV_SECRET = 'provodnik-400-dev-secret'

// Read lazily: module top level also runs during `next build`, which has no env.
// AUTH_SECRET wins; otherwise AUTH_SECRET_FILE, which docker compose's migrate service fills
// with a random key on the first boot (the `secrets` volume), so nobody has to make one up.
// NOTE: re-reads the file on every signed request — a few µs; cache it if that ever shows.
function secret() {
  const s = process.env.AUTH_SECRET || fileSecret()
  if (s) return s
  if (process.env.NODE_ENV === 'production')
    throw new Error('Neither AUTH_SECRET nor a readable AUTH_SECRET_FILE is set.')
  return DEV_SECRET
}

function fileSecret() {
  const path = process.env.AUTH_SECRET_FILE
  if (!path) return ''
  try {
    return readFileSync(path, 'utf8').trim()
  } catch {
    return ''
  }
}

// NOTE: the sync scrypt blocks the event loop for ~100 ms per login; switch to the callback
// `scrypt` under real traffic.
export function hashPassword(pw: string) {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('base64')}$${scryptSync(pw, salt, KEYLEN).toString('base64')}`
}

export function verifyPassword(pw: string, stored: string) {
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  // Length is fixed, so timingSafeEqual never throws on a mismatched-size stored hash.
  if (expected.length !== KEYLEN) return false
  return timingSafeEqual(expected, scryptSync(pw, Buffer.from(salt, 'base64'), KEYLEN))
}

function hmac(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

/** `<userId>.<expiresAtUnix>.<hmac>`. User ids are uuids, so no part contains a dot. */
export function sign(userId: string, expiresAtUnix: number) {
  const payload = `${userId}.${expiresAtUnix}`
  return `${payload}.${hmac(payload)}`
}

export function verify(token: string, nowUnix: number): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, exp, sig] = parts
  const a = Buffer.from(sig, 'base64url')
  const b = Buffer.from(hmac(`${userId}.${exp}`), 'base64url')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (!userId || !/^\d+$/.test(exp) || Number(exp) <= nowUnix) return null
  return userId
}

/** The demo door's invite code. DEMO_INVITE unset or empty keeps it open (dev); read lazily. */
export function inviteOk(given: string | undefined): boolean {
  const want = process.env.DEMO_INVITE
  if (!want) return true
  const a = Buffer.from(given ?? '')
  const b = Buffer.from(want)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function setSessionCookie(userId: string) {
  const store = await cookies()
  store.set(COOKIE, sign(userId, Math.floor(Date.now() / 1000) + MAX_AGE_SEC), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_SEC,
  })
}

export async function clearSessionCookie() {
  ;(await cookies()).delete(COOKIE)
}

/**
 * Crew analytics lists every colleague's competency gaps and promotion readiness, so it belongs to
 * whoever leads or trains crews, not to every conductor. `users.position` is the only role there is.
 */
export const ANALYTICS_POSITIONS: readonly string[] = ['Начальник поезда', 'Методист']

export const canViewCrewAnalytics = (position: string) =>
  ANALYTICS_POSITIONS.includes(position.trim())

export async function currentUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value
  return token ? verify(token, Math.floor(Date.now() / 1000)) : null
}

const LOGIN_LIMIT = 5
const LOGIN_WINDOW_MS = 60_000
const loginAttempts = new Map<string, { n: number; resetAt: number }>()

/**
 * Counts a login attempt for this IP + email; true once it is past 5 in the current minute.
 * NOTE: an in-process map, so each container keeps its own count (N containers allow 5·N a
 * minute) and a restart forgets it. Move it to a Postgres table if the app ever runs scaled out.
 */
export function loginThrottled(ip: string, email: string, now = Date.now()): boolean {
  if (loginAttempts.size > 10_000)
    for (const [k, v] of loginAttempts) if (v.resetAt <= now) loginAttempts.delete(k)
  const key = `${ip}|${email.toLowerCase()}`
  const entry = loginAttempts.get(key)
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { n: 1, resetAt: now + LOGIN_WINDOW_MS })
    return false
  }
  return ++entry.n > LOGIN_LIMIT
}

/** The caller's IP as Caddy saw it: the last X-Forwarded-For hop is the one Caddy appended. */
export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown'
}
