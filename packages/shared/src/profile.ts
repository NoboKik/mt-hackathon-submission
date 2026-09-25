// The profile: XP, rank, the five-axis competency radar, the badge grid and the run history.
// Everything is recomputed from finished sessions — there is no competency_scores table, because
// an aggregate row is a second source of truth that needs a backfill every time a scoring
// constant is tuned. Tens of rows per user sit behind the existing (user_id, scenario_id) index.
//
// Pure, like the rest of packages/shared: flat rows in, one response object out. The wire types
// live here rather than in api.ts because this module is their only producer and splitting them
// would only buy a type-only import cycle.

import { ACHIEVEMENT_CODES, type AchievementCode } from './achievements'
import type { ScenarioListItem } from './api'
import { COMPETENCIES, type Competency, type Outcome, type Scenario } from './schema'

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
  category: Competency
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
  /** Server-side input for the growth zones; profileFor strips it from the wire. */
  decisions: ProfileDecision[]
}

/**
 * One step of a stored path. `expertId` is the expert choice at that node, null once the run
 * has left the expert route — a node the expert never reaches has no "right" answer to miss.
 * `text` is null for a timeout (choiceId 'timeout') or a choice the content no longer has.
 */
export type ProfileDecision = { choiceId: string; text: string | null; expertId: string | null }

export function decisionsOf(
  scenario: Scenario,
  path: readonly { nodeId: string; choiceId: string }[],
): ProfileDecision[] {
  // Not debriefFor: that throws on content drift, and a stale path must not 500 the profile.
  const success = Object.values(scenario.nodes).find(
    (n) => n.type === 'end' && n.outcome === 'success',
  )
  const expert = new Set(success?.type === 'end' ? success.debrief.expertPath : [])
  return path.map(({ nodeId, choiceId }) => {
    const node = Object.hasOwn(scenario.nodes, nodeId) ? scenario.nodes[nodeId] : undefined
    const choices = node?.type === 'choice' ? node.choices : []
    return {
      choiceId,
      text: choices.find((c) => c.id === choiceId)?.text ?? null,
      expertId: choices.find((c) => expert.has(c.id))?.id ?? null,
    }
  })
}

/**
 * «Зоны роста»: the conclusions the profile states in words. Percentages are integers. Null on
 * an account with no finished runs — there is nothing to conclude from.
 */
export type GrowthZones = {
  weakest: { key: Competency; points: number; othersAverage: number }
  decisions: number
  timeoutPercent: number
  /** Off-expert share per scenario category, worst first. Only decisions at expert nodes count. */
  offExpert: { category: Competency; percent: number; decisions: number }[]
  /** The off-expert choice picked most often, across every run. */
  topMistake: { scenarioTitle: string; text: string; count: number } | null
  /** A curated scenario in the weakest category: unplayed first, then the lowest best score. */
  recommended: { id: string; title: string } | null
}

const percent = (part: number, whole: number) => Math.round((100 * part) / whole)

export function growthZones(
  sessions: readonly ProfileSession[],
  competencies: readonly ProfileCompetency[],
  catalogue: readonly ScenarioListItem[],
): GrowthZones | null {
  if (sessions.length === 0) return null

  // Ties go to the earlier axis in COMPETENCIES order: stable, and the radar reads the same way.
  const weakest = competencies.reduce((min, c) => (c.points < min.points ? c : min))
  const others = competencies.filter((c) => c !== weakest)
  const othersAverage = Math.round(others.reduce((sum, c) => sum + c.points, 0) / others.length)

  const all = sessions.flatMap((s) => s.decisions.map((d) => ({ ...d, s })))
  const judged = all.filter((d) => d.expertId !== null)

  const byCategory = new Map<Competency, { off: number; total: number }>()
  const mistakes = new Map<string, { scenarioTitle: string; text: string; count: number }>()
  for (const d of judged) {
    const row = byCategory.get(d.s.category) ?? { off: 0, total: 0 }
    row.total++
    if (d.choiceId !== d.expertId) {
      row.off++
      // Choice ids are only unique inside a scenario (every file has a c1), hence the pair key.
      const key = `${d.s.scenarioId}/${d.choiceId}`
      if (d.text !== null) {
        const m = mistakes.get(key) ?? { scenarioTitle: d.s.title, text: d.text, count: 0 }
        m.count++
        mistakes.set(key, m)
      }
    }
    byCategory.set(d.s.category, row)
  }

  const recommended = catalogue
    .filter((s) => s.category === weakest.key)
    // Stable sort, so equal scores keep the catalogue's difficulty order.
    .sort((a, b) => (a.bestScore ?? -1) - (b.bestScore ?? -1))[0]

  return {
    weakest: { key: weakest.key, points: weakest.points, othersAverage },
    decisions: all.length,
    timeoutPercent: all.length
      ? percent(all.filter((d) => d.choiceId === 'timeout').length, all.length)
      : 0,
    offExpert: [...byCategory]
      .map(([category, r]) => ({ category, percent: percent(r.off, r.total), decisions: r.total }))
      .sort((a, b) => b.percent - a.percent),
    topMistake: [...mistakes.values()].reduce<GrowthZones['topMistake']>(
      (top, m) => (m.count > (top?.count ?? 0) ? m : top),
      null,
    ),
    recommended: recommended ? { id: recommended.id, title: recommended.title } : null,
  }
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
  recentSessions: Omit<ProfileSession, 'decisions'>[]
  growth: GrowthZones | null
}

export function profileFor(
  user: MeUser,
  sessions: readonly ProfileSession[],
  earned: readonly EarnedAchievement[],
  catalogue: readonly ScenarioListItem[] = [],
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
  // All five, in COMPETENCIES order, even at zero: the radar needs five axes on a fresh account.
  const competencies = COMPETENCIES.map((key) => {
    const rawPoints = raw.get(key) ?? 0
    const points = Math.max(0, rawPoints)
    return { key, raw: rawPoints, points, level: competencyLevel(points) }
  })

  return {
    user,
    xp,
    level: level.key,
    levelMinXp: level.minXp,
    nextLevelXp: level.nextLevelXp,
    scenariosFinished: best.size,
    attempts: sessions.length,
    competencies,
    achievements: ACHIEVEMENT_CODES.map((code) => ({ code, earnedAt: earnedAt.get(code) ?? null })),
    // Already newest-first from the query. The decisions stay server-side: nothing renders them.
    recentSessions: sessions.map(({ decisions: _, ...s }) => s),
    growth: growthZones(sessions, competencies, catalogue),
  }
}
