// The viewer-dependent half of the leaderboard: the depot filter, the top slice and the viewer's
// own row. Pure, so it is testable without Postgres — the ranked totals come from one cached
// query that knows nothing about who is asking.

import type { LeaderboardRow } from '@p400/shared'

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
 * `rows` is the shared 30-second cache, so nothing here may write to it: filtering by depot
 * produces new row objects rather than reassigning `rank` in place.
 */
export function leaderboardPage(
  rows: readonly LeaderboardRow[],
  userId: string,
  depot: string | null,
  topN = TOP_N,
) {
  // Over every row, not the filtered ones: this is the list the depot picker offers.
  const depots = [...new Set(rows.map((row) => row.depot))].sort()
  // Unfiltered, the ranks SQL computed already hold.
  const ranked = depot === null ? [...rows] : reRank(rows.filter((row) => row.depot === depot))
  return {
    depots,
    top: ranked.slice(0, topN),
    // From the ranked array, so the viewer's rank matches the neighbours they are shown beside.
    me: ranked.find((row) => row.userId === userId) ?? null,
  }
}
