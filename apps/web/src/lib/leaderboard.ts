// The viewer-dependent half of the leaderboard: the scope and depot filters, the top slice and the viewer's
// own row. Pure, so it is testable without Postgres — the ranked totals come from one cached
// query that knows nothing about who is asking.

import type { LeaderboardRow, LeaderboardScope } from '@p400/shared'

export const TOP_N = 20

/**
 * Competition ranking over rows already sorted by total, descending: equal totals share a rank
 * and the next one is skipped (1, 2, 2, 4). New objects every time — see leaderboardPage.
 */
function reRank(rows: readonly LeaderboardRow[]): LeaderboardRow[] {
  let rank = 0
  let previous: number | null = null
  return rows.map((row, i) => {
    if (previous === null || row.total < previous) rank = i + 1
    previous = row.total
    return { ...row, rank }
  })
}

/**
 * `rows` is the shared 30-second cache, so nothing here may write to it: filtering produces new
 * row objects rather than reassigning `rank` in place.
 *
 * crew = the viewer's depot and crew, depot = the viewer's depot, company = everyone, narrowed by
 * `depot` when given. Crew names repeat across depots, hence both keys for a crew.
 */
export function leaderboardPage(
  rows: readonly LeaderboardRow[],
  userId: string,
  scope: LeaderboardScope,
  depot: string | null,
  topN = TOP_N,
) {
  // Over every row, not the filtered ones: this is the list the depot picker offers.
  const depots = [...new Set(rows.map((row) => row.depot))].sort()
  const viewer = rows.find((row) => row.userId === userId)
  const keep =
    scope === 'crew'
      ? (row: LeaderboardRow) => row.depot === viewer?.depot && row.crew === viewer.crew
      : scope === 'depot'
        ? (row: LeaderboardRow) => row.depot === viewer?.depot
        : depot === null
          ? null
          : (row: LeaderboardRow) => row.depot === depot
  // Unfiltered, the ranks SQL computed already hold.
  const ranked = keep === null ? [...rows] : reRank(rows.filter(keep))
  return {
    depots,
    top: ranked.slice(0, topN),
    // From the ranked array, so the viewer's rank matches the neighbours they are shown beside.
    me: ranked.find((row) => row.userId === userId) ?? null,
  }
}
