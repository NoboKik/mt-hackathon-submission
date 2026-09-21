// The profile: XP, rank, the five-axis competency radar, the badge grid and the run history.
// Everything is recomputed from finished sessions — there is no competency_scores table, because
// an aggregate row is a second source of truth that needs a backfill every time a scoring
// constant is tuned. Tens of rows per user sit behind the existing (user_id, scenario_id) index.
//
// Pure, like the rest of packages/shared: flat rows in, one response object out. The wire types
// live here rather than in api.ts because this module is their only producer and splitting them
// would only buy a type-only import cycle.

import { ACHIEVEMENT_CODES, type AchievementCode } from './achievements'
import { COMPETENCIES, type Competency, type Outcome } from './schema'

/** Стажёр → Проводник → Старший → Наставник. Cosmetic, but they are what the profile screen shows. */
export type LevelKey = 'trainee' | 'conductor' | 'senior' | 'mentor'

export const LEVELS = [
  { key: 'trainee', minXp: 0 },
  { key: 'conductor', minXp: 300 },
  { key: 'senior', minXp: 800 },
  { key: 'mentor', minXp: 1600 },
] as const satisfies readonly { key: LevelKey; minXp: number }[]

/** Per-competency ranks use the same four names against a much smaller scale. */
export const COMPETENCY_LEVELS = [
  { key: 'trainee', minPoints: 0 },
  { key: 'conductor', minPoints: 20 },
  { key: 'senior', minPoints: 50 },
  { key: 'mentor', minPoints: 100 },
] as const satisfies readonly { key: LevelKey; minPoints: number }[]

/** The highest row the xp reaches. `nextLevelXp` is null at mentor — there is nothing after it. */
export function levelForXp(xp: number): {
  key: LevelKey
  minXp: number
  nextLevelXp: number | null
} {
  // LEVELS[0].minXp is 0, so the first row always matches and the loop can only improve on it.
  let level: (typeof LEVELS)[number] = LEVELS[0]
  for (const row of LEVELS) if (xp >= row.minXp) level = row
  const next = LEVELS.find((row) => row.minXp > level.minXp)
  return { key: level.key, minXp: level.minXp, nextLevelXp: next?.minXp ?? null }
}

export function competencyLevel(points: number): LevelKey {
  let level: (typeof COMPETENCY_LEVELS)[number] = COMPETENCY_LEVELS[0]
  for (const row of COMPETENCY_LEVELS) if (points >= row.minPoints) level = row
  return level.key
}

/** One finished run, flattened. No `Scenario`, no drizzle types — the route hands these in. */
export type ProfileSession = {
  id: string
  scenarioId: string
  title: string
  category: string
  difficulty: number
  outcome: Outcome
  score: number
  loyalty: number
  safety: number
  /** ISO 8601. */
  finishedAt: string
  competencyDeltas: Partial<Record<Competency, number>>
  /** Did this run take every choice the expert path names. */
  onExpertPath: boolean
}

export type MeUser = {
  displayName: string
  position: string
  depot: string
  avatar: string | null
}

export type EarnedAchievement = { code: AchievementCode; earnedAt: string }

/** `earnedAt` is null for a badge the user has not unlocked: the grid shows locked ones too. */
export type ProfileAchievement = { code: AchievementCode; earnedAt: string | null }

/**
 * `raw` can be negative — a run that mishandled a medical incident really did cost points — while
 * `points` is what the radar plots. There is no `max`: the chart's domain is the frontend's
 * business, and points can exceed 100 (100 is the mentor threshold, not a cap).
 */
export type ProfileCompetency = {
  key: Competency
  raw: number
  points: number
  level: LevelKey
}

export type MeResponse = {
  user: MeUser
  xp: number
  level: LevelKey
  levelMinXp: number
  nextLevelXp: number | null
  /** Distinct scenarios finished, and how many runs that took. */
  scenariosFinished: number
  attempts: number
  competencies: ProfileCompetency[]
  achievements: ProfileAchievement[]
  recentSessions: ProfileSession[]
}

export function profileFor(
  user: MeUser,
  sessions: readonly ProfileSession[],
  earned: readonly EarnedAchievement[],
): MeResponse {
  // Best score per scenario, the same rule the leaderboard and the seed use: a replay raises your
  // total, it does not add to it.
  const best = new Map<string, number>()
  for (const s of sessions) best.set(s.scenarioId, Math.max(best.get(s.scenarioId) ?? 0, s.score))
  const xp = [...best.values()].reduce((sum, points) => sum + points, 0)
  const level = levelForXp(xp)

  const raw = new Map<Competency, number>()
  for (const s of sessions) {
    for (const key of COMPETENCIES)
      raw.set(key, (raw.get(key) ?? 0) + (s.competencyDeltas[key] ?? 0))
  }
  const earnedAt = new Map(earned.map((a) => [a.code, a.earnedAt]))

  return {
    user,
    xp,
    level: level.key,
    levelMinXp: level.minXp,
    nextLevelXp: level.nextLevelXp,
    scenariosFinished: best.size,
    attempts: sessions.length,
    // All five, in COMPETENCIES order, even at zero: the radar needs five axes on a fresh account.
    competencies: COMPETENCIES.map((key) => {
      const rawPoints = raw.get(key) ?? 0
      const points = Math.max(0, rawPoints)
      return { key, raw: rawPoints, points, level: competencyLevel(points) }
    }),
    achievements: ACHIEVEMENT_CODES.map((code) => ({ code, earnedAt: earnedAt.get(code) ?? null })),
    // Already newest-first from the query; copied so the response never aliases the caller's array.
    recentSessions: [...sessions],
  }
}
