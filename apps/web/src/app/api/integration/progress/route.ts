import { NextResponse } from 'next/server'
import { integrationInput } from '@/db/queries'
import { fail } from '@/lib/api'
import { bearerOk, integrationProgress } from '@/lib/integration'

/**
 * The HR/LMS export. A server-to-server call: a Bearer token, never the player's cookie. With
 * INTEGRATION_TOKEN unset the route does not exist, so a fresh install exposes nothing.
 */
export async function GET(req: Request) {
  const token = process.env.INTEGRATION_TOKEN
  if (!token) return fail(404, 'integrationOff')
  if (!bearerOk(req.headers.get('authorization'), token)) return fail(401, 'unauthorized')

  const { users, runs, badges } = await integrationInput()
  return NextResponse.json(integrationProgress(users, runs, badges, new Date()))
}
