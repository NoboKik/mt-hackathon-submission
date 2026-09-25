import { AnalyticsQuery } from '@p400/shared'
import { NextResponse } from 'next/server'
import { analyticsInput, integrationInput } from '@/db/queries'
import { crewAnalytics } from '@/lib/analytics'
import { fail } from '@/lib/api'
import { currentUserId } from '@/lib/auth'
import { integrationProgress } from '@/lib/integration'

// Gated on any signed-in user, like the graph viewer: `users` has no role column yet.
export async function GET(req: Request) {
  const userId = await currentUserId()
  if (!userId) return fail(401, 'unauthorized')

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
