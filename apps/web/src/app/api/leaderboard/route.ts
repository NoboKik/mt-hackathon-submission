import { LeaderboardQuery, type LeaderboardResponse } from '@p400/shared'
import { NextResponse } from 'next/server'
import { leaderboardTotals } from '@/db/queries'
import { fail } from '@/lib/api'
import { currentUserId } from '@/lib/auth'
import { leaderboardPage } from '@/lib/leaderboard'

export async function GET(req: Request) {
  const userId = await currentUserId()
  if (!userId) return fail(401, 'unauthorized')

  const params = new URL(req.url).searchParams
  const query = LeaderboardQuery.safeParse({
    scope: params.get('scope') ?? undefined,
    period: params.get('period') ?? undefined,
    depot: params.get('depot') ?? undefined,
  })
  if (!query.success) return fail(400, 'badRequest', query.error.issues)

  const { at, rows } = await leaderboardTotals(query.data.period)
  // Every existing user is on the board, at 0 if they have played nothing. Absent entirely means
  // the cookie outlived its user — the same treatment POST /api/sessions gives a stale cookie.
  if (!rows.some((row) => row.userId === userId)) return fail(401, 'unauthorized')

  const { scope } = query.data
  // The depot filter belongs to the company view; the narrower scopes are the viewer's own.
  const depot = scope === 'company' ? (query.data.depot ?? null) : null
  const page = leaderboardPage(rows, userId, scope, depot)
  // Typed, so a change to the response shape breaks the build, not the leaderboard screen.
  const res: LeaderboardResponse = {
    scope,
    period: query.data.period,
    depot,
    updatedAt: new Date(at).toISOString(),
    ...page,
  }
  return NextResponse.json(res)
}
