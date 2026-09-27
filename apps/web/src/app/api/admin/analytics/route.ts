import { AnalyticsQuery } from '@p400/shared'
import { NextResponse } from 'next/server'
import { analyticsInput, integrationInput, userProfile } from '@/db/queries'
import { crewAnalytics } from '@/lib/analytics'
import { fail } from '@/lib/api'
import { canViewCrewAnalytics, currentUserId } from '@/lib/auth'
import { integrationProgress } from '@/lib/integration'

// Every colleague's gaps and readiness across the company: crew leads and methodists only.
// The position is re-read on each request, so a demotion takes effect without a new sign-in.
export async function GET(req: Request) {
  const userId = await currentUserId()
  if (!userId) return fail(401, 'unauthorized')
  const user = await userProfile(userId)
  if (!user) return fail(401, 'unauthorized')
  if (!canViewCrewAnalytics(user.position)) return fail(403, 'analyticsForbidden')

  const params = new URL(req.url).searchParams
  const query = AnalyticsQuery.safeParse({
    depot: params.get('depot') || undefined,
    crew: params.get('crew') || undefined,
  })
  if (!query.success) return fail(400, 'badRequest', query.error.issues)

  const [input, hr] = await Promise.all([analyticsInput(), integrationInput()])
  const { employees } = integrationProgress(hr.users, hr.runs, hr.badges, new Date())
  const { depot = null, crew = null } = query.data
  return NextResponse.json(
    crewAnalytics(input.users, input.runs, input.scenarios, depot, crew, employees),
  )
}
