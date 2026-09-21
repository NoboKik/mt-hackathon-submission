import { LeaderboardQuery, type LeaderboardResponse } from '@p400/shared'
import { NextResponse } from 'next/server'
import { leaderboardTotals } from '@/db/queries'
import { ru } from '@/i18n/ru'
import { fail } from '@/lib/api'
import { currentUserId } from '@/lib/auth'
import { leaderboardPage } from '@/lib/leaderboard'

export async function GET(req: Request) {
  const userId = await currentUserId()
  if (!userId) return fail(401, ru.errors.unauthorized)

  const params = new URL(req.url).searchParams
  const query = LeaderboardQuery.safeParse({
    period: params.get('period') ?? undefined,
    depot: params.get('depot') ?? undefined,
  })
  if (!query.success) return fail(400, ru.errors.badRequest, query.error.issues)

  const { at, rows } = await leaderboardTotals(query.data.period)
  // Every existing user is on the board, at 0 if they have played nothing. Absent entirely means
  // the cookie outlived its user — the same treatment POST /api/sessions gives a stale cookie.
  if (!rows.some((row) => row.userId === userId)) return fail(401, ru.errors.unauthorized)

  const depot = query.data.depot ?? null
  const page = leaderboardPage(rows, userId, depot)
  // Typed, so a change to the response shape breaks the build, not the leaderboard screen.
  const res: LeaderboardResponse = {
    period: query.data.period,
    depot,
    updatedAt: new Date(at).toISOString(),
    ...page,
  }
  return NextResponse.json(res)
}
