import { type MeResponse, profileFor } from '@p400/shared'
import { NextResponse } from 'next/server'
import { earnedAchievements, profileSessions, scenarioList, userProfile } from '@/db/queries'
import { fail } from '@/lib/api'
import { currentUserId } from '@/lib/auth'

export async function GET() {
  const userId = await currentUserId()
  if (!userId) return fail(401, 'unauthorized')

  // A signed cookie outlives its user: every `pnpm db:seed` rotates ids. Same treatment
  // POST /api/sessions gives a stale cookie.
  const user = await userProfile(userId)
  if (!user) return fail(401, 'unauthorized')

  // The catalogue is what the growth zones pick a recommended scenario from.
  const [sessions, earned, catalogue] = await Promise.all([
    profileSessions(userId),
    earnedAchievements(userId),
    scenarioList(userId),
  ])
  // Typed, so a change to the aggregator's shape breaks the build rather than the profile screen.
  const res: MeResponse = profileFor(user, sessions, earned, catalogue)
  return NextResponse.json(res)
}
