// The API contract: Zod schemas for request bodies, plain types for responses. The player is
// coded against these types, so a route that changes shape breaks the build, not the demo.

import { z } from 'zod'
import type { AchievementCode } from './achievements'
import type { ClientNode, MeterKey, Meters } from './engine'
import type { ScenarioGraph } from './graph'
import type { LevelKey } from './profile'
import type { Competency, Effects, Outcome } from './schema'
import type { score } from './score'

export type ScoreBreakdown = ReturnType<typeof score>

// z.object, not strictObject: an extra field from the client gets stripped instead of 400ing
// mid-demo. Scenario content stays strict — it's authored, not received.
export const StartSessionBody = z.object({ scenarioId: z.string().min(1) })
export type StartSessionBody = z.infer<typeof StartSessionBody>

export const ChooseBody = z.object({
  nodeId: z.string().min(1),
  /** A choice id, or 'timeout'. The engine rejects ids the node doesn't have. */
  choiceId: z.string().min(1),
  elapsedMs: z.number().int().min(0),
})
export type ChooseBody = z.infer<typeof ChooseBody>

export const LoginBody = z.object({ email: z.email(), password: z.string().min(1) })
export type LoginBody = z.infer<typeof LoginBody>

/**
 * GET /admin/scenarios/:id/graph. The whole branch graph with effects and competencies on it —
 * a trainer's view, deliberately not player-safe the way ClientNode is.
 */
export type AdminGraphResponse = ScenarioGraph

export type LeaderboardPeriod = 'week' | 'all'
export const LEADERBOARD_SCOPES = ['crew', 'depot', 'company'] as const
export type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number]

/**
 * Query string for GET /leaderboard. Every part is optional: the default board is the viewer's
 * own crew, all time. `depot` filters the company scope only; crew and depot are always the viewer's.
 */
export const LeaderboardQuery = z.object({
  scope: z.enum(LEADERBOARD_SCOPES).default('crew'),
  period: z.enum(['week', 'all']).default('all'),
  depot: z.string().min(1).optional(),
})
export type LeaderboardQuery = z.infer<typeof LeaderboardQuery>

export type LeaderboardRow = {
  userId: string
  displayName: string
  position: string
  depot: string
  /** Бригада within the depot; '' when not assigned. */
  crew: string
  avatar: string | null
  /** Sum of the best score per scenario — replays raise it, they don't add to it. */
  total: number
  /** How many distinct scenarios that total covers. */
  scenarios: number
  /** Competition ranking: ties share a rank and the next one is skipped. */
  rank: number
}

export type LeaderboardResponse = {
  scope: LeaderboardScope
  period: LeaderboardPeriod
  /** The company scope's depot filter, or null (always null in the crew and depot scopes). */
  depot: string | null
  /** Every depot on the board, not just the filtered one — this is the filter's own options list. */
  depots: string[]
  /** When the cached totals were computed, ISO 8601. */
  updatedAt: string
  top: LeaderboardRow[]
  /** The viewer's own row, ranked among the rows shown. Null exactly when the company depot filter excludes them. */
  me: LeaderboardRow | null
}

/** `bestScore` is null until the user finishes the scenario once. */
export type ScenarioListItem = {
  id: string
  title: string
  category: Competency
  difficulty: number
  estimatedMinutes: number
  bestScore: number | null
  attempts: number
}

export type StartSessionResponse = {
  sessionId: string
  seed: number
  scenario: {
    id: string
    title: string
    intro: string
    /** `generated` + `draft` is auto mode's pool: the player shows the «ИИ-черновик» chip. */
    source: 'curated' | 'generated'
    status: 'approved' | 'draft'
  }
  steps: ClientNode[]
  node: ClientNode
  meters: Meters
  /** The scenario's fail lines, drawn on the HUD meters. */
  failThresholds: Meters
  finished: boolean
}

export type ChooseResponse = {
  steps: ClientNode[]
  node: ClientNode
  meters: Meters
  failThresholds: Meters
  /** Net meter change since the previous node, for the animation. */
  deltas: Meters
  timedOut: boolean
  finished: boolean
  score?: ScoreBreakdown
  // Achievement codes; copy lives in ru.ts.
  achievements: string[]
}

export type DebriefStep = {
  nodeId: string
  nodeText: string
  /** A choice id, or 'timeout'. */
  choiceId: string
  /** null on a timeout: there was no choice. */
  choiceText: string | null
  onExpertPath: boolean
  /** What this step did to the meters, the consequences that followed included. Clamped. */
  effects: Effects
  /** Empty on a timeout. */
  competencies: Partial<Record<Competency, number>>
  /** The consequence text that followed the choice, or null if it led straight on. */
  consequenceText: string | null
  /** The expert's choice at this node, when the expert path passes through it. */
  expertChoice?: { id: string; text: string }
}

export type DebriefResponse = {
  outcome: Outcome
  failedMeter?: MeterKey
  meters: Meters
  score: ScoreBreakdown
  competencyDeltas: Partial<Record<Competency, number>>
  lesson: string
  regulation: string
  yourPath: DebriefStep[]
  expertPath: { choiceId: string; text: string }[]
}

/**
 * Query string for GET /admin/analytics. No filter = the whole company. `crew` needs `depot`:
 * crew names repeat across depots.
 */
export const AnalyticsQuery = z
  .object({ depot: z.string().min(1).optional(), crew: z.string().min(1).optional() })
  .refine((q) => !q.crew || q.depot, { path: ['crew'], message: 'crew needs depot' })
export type AnalyticsQuery = z.infer<typeof AnalyticsQuery>

/** A decision node where runs go wrong. Choice nodes only: nothing else can time out or be chosen. */
export type AnalyticsNode = {
  scenarioId: string
  scenarioTitle: string
  nodeId: string
  text: string
  /** Decisions recorded at this node. */
  visits: number
  timeouts: number
  /** Runs that ended in `fail` with this as their last decision. */
  fails: number
}

/** GET /admin/analytics: finished curated runs across a depot, a crew or the company. */
export type AdminAnalyticsResponse = {
  depot: string | null
  crew: string | null
  /** Every depot and its crews, unfiltered — the pickers' options. */
  units: { depot: string; crews: string[] }[]
  conductors: number
  runs: number
  /** Average points per conductor, in COMPETENCIES order. */
  competencies: { key: Competency; avg: number }[]
  /** Lowest average; null when nobody in the filter has finished a run. */
  weakest: Competency | null
  /** Most timeouts plus fails first. Nodes with neither are left out. */
  nodes: AnalyticsNode[]
}

/**
 * GET /integration/progress: one row per employee for an HR or LMS import. Bearer-token only,
 * no cookie. No email and nothing else that identifies a person outside the company: the id is
 * the internal uuid, and HR matches it against their own records once.
 */
export type IntegrationEmployee = {
  id: string
  name: string
  depot: string
  /** '' when not assigned. */
  crew: string
  /** Sum of the best score per scenario, the same number the profile shows. */
  xp: number
  rank: LevelKey
  /** Radar points per competency, floored at 0 like the profile's. */
  competencies: Record<Competency, number>
  /** Earned badge codes, oldest first. */
  badges: AchievementCode[]
  /** Finished runs, replays included. */
  runs: number
  /** ISO 8601; null until the first finished run. */
  lastRunAt: string | null
}

export type IntegrationProgressResponse = {
  /** ISO 8601. */
  generatedAt: string
  employees: IntegrationEmployee[]
}
