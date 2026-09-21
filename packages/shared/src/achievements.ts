// Who has earned which badge. Pure: no database, no `Date`, no Russian — the titles live in
// apps/web/src/i18n/ru.ts, keyed by these codes, and the route handler does the reading and
// writing. Conditions are functions rather than JSON predicates: we author them.

import type { Outcome } from './schema'

// Kebab-case, like scenario ids. Order is the display order and the order unlockedCodes returns.
export const ACHIEVEMENT_CODES = [
  'first-run',
  'cool-head',
  'first-aid',
  'diplomat',
  'night-shift',
  'flawless',
  'balance',
  'steady',
  'full-route',
  'honour-student',
] as const
export type AchievementCode = (typeof ACHIEVEMENT_CODES)[number]

/**
 * One finished run, flattened off the `sessions` row and its scenario's category. Deliberately
 * not a drizzle type: this module never learns what a database is.
 */
export type FinishedRow = {
  scenarioId: string
  /** The scenario's category — one of COMPETENCIES, but the column is plain text. */
  category: string
  outcome: Outcome
  score: number
  loyalty: number
  safety: number
  /** Epoch ms. */
  finishedAt: number
  /** The path's choice ids in order, `'timeout'` included. Empty for seeded history. */
  choiceIds: string[]
}

/** The run just finished, plus the one fact the row can't carry: did it match the expert path. */
export type LastRun = FinishedRow & { expertPath: boolean }

const DAY_MS = 86_400_000

export const COOL_HEAD_RUNS = 5
export const NIGHT_SHIFT_RUNS = 3
export const NIGHT_SHIFT_WINDOW_MS = 60 * 60_000
export const STEADY_DAYS = 3
/** Both meters at or above this, for `diplomat` and `balance`. */
export const HIGH_METER = 80
// Load-bearing: the theoretical maximum on medical-faint-01 is 100 (success) + 15 (three fast
// decisions) + 9 (competencies) = 124. A threshold above that ships a badge nobody can earn.
export const HONOUR_STUDENT_SCORE = 115

// Not `timeouts === 0`: every seeded session has an empty path, which the naive form calls
// flawless and then silently takes back on the user's first real run.
const timeoutFree = (r: FinishedRow) => r.choiceIds.length > 0 && !r.choiceIds.includes('timeout')

export type AchievementStats = {
  /** Finished runs, the one in hand included. */
  finished: number
  timeoutFree: number
  /** Distinct scenarios finished, out of how many exist. */
  scenarios: number
  scenarioCount: number
  /** Distinct UTC days with a finish. */
  days: number
  /** The most finishes inside any 60-minute window. */
  inHour: number
  best: number
  /** Any non-fail run that ended with both meters at HIGH_METER or above. */
  balanced: boolean
  last: LastRun | null
}

export function statsFor(
  rows: readonly FinishedRow[],
  scenarioCount: number,
  last?: LastRun,
): AchievementStats {
  const times = rows.map((r) => r.finishedAt)
  // NOTE: O(n²) over the tens of runs one conductor has. A sliding window would only be
  // cleverer; revisit if a user ever has thousands.
  const inHour = times.reduce(
    (max, from) =>
      Math.max(max, times.filter((t) => t >= from && t - from <= NIGHT_SHIFT_WINDOW_MS).length),
    0,
  )
  return {
    finished: rows.length,
    timeoutFree: rows.filter(timeoutFree).length,
    scenarios: new Set(rows.map((r) => r.scenarioId)).size,
    scenarioCount,
    days: new Set(times.map((t) => Math.floor(t / DAY_MS))).size,
    inHour,
    best: rows.reduce((max, r) => Math.max(max, r.score), 0),
    balanced: rows.some(
      (r) => r.outcome !== 'fail' && r.loyalty >= HIGH_METER && r.safety >= HIGH_METER,
    ),
    last: last ?? null,
  }
}

// One entry per code, so a new code without a rule is a typecheck error, not a badge that never
// fires. `first-aid` and `diplomat` deliberately carry no meter thresholds beyond their own descriptions:
// the one medical badge has to be reachable in a five-minute demo run.
const CONDITIONS: Record<AchievementCode, (s: AchievementStats) => boolean> = {
  'first-run': (s) => s.finished >= 1,
  'cool-head': (s) => s.timeoutFree >= COOL_HEAD_RUNS,
  'first-aid': (s) =>
    s.last?.category === 'medical' &&
    s.last.outcome === 'success' &&
    !s.last.choiceIds.includes('timeout'),
  diplomat: (s) =>
    s.last?.category === 'conflict' &&
    s.last.outcome === 'success' &&
    s.last.loyalty >= HIGH_METER &&
    s.last.safety >= HIGH_METER,
  // "Three scenarios in one sitting" would be the natural rule, but auth is a stateless signed
  // cookie, so there is no server-side login session to measure. An hour is the closest thing
  // that actually exists.
  'night-shift': (s) => s.inHour >= NIGHT_SHIFT_RUNS,
  flawless: (s) => s.last?.expertPath === true,
  balance: (s) => s.balanced,
  steady: (s) => s.days >= STEADY_DAYS,
  // The guard matters on an empty catalogue: 0 of 0 scenarios is not a full route.
  'full-route': (s) => s.scenarioCount > 0 && s.scenarios >= s.scenarioCount,
  'honour-student': (s) => s.best >= HONOUR_STUDENT_SCORE,
}

/** Everything the user qualifies for — not what is new. The insert's RETURNING decides that. */
export const unlockedCodes = (stats: AchievementStats): AchievementCode[] =>
  ACHIEVEMENT_CODES.filter((code) => CONDITIONS[code](stats))
