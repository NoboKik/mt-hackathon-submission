// The API contract: Zod schemas for request bodies, plain types for responses. The player is
// coded against these types, so a route that changes shape breaks the build, not the demo.

import { z } from 'zod'
import type { ClientNode, MeterKey, Meters } from './engine'
import type { ScenarioGraph } from './graph'
import type { Competency, Outcome } from './schema'
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

/** Query string for GET /leaderboard. Both parts are optional; `all` is the default board. */
export const LeaderboardQuery = z.object({
  period: z.enum(['week', 'all']).default('all'),
  depot: z.string().min(1).optional(),
})
export type LeaderboardQuery = z.infer<typeof LeaderboardQuery>

export type LeaderboardRow = {
  userId: string
  displayName: string
  position: string
  depot: string
  avatar: string | null
  /** Sum of the best score per scenario — replays raise it, they don't add to it. */
  total: number
  /** How many distinct scenarios that total covers. */
  scenarios: number
  /** Competition ranking: ties share a rank and the next one is skipped. */
  rank: number
}

export type LeaderboardResponse = {
  period: LeaderboardPeriod
  /** The depot filter in force, or null for every depot. */
  depot: string | null
  /** Every depot on the board, not just the filtered one — this is the filter's own options list. */
  depots: string[]
  /** When the cached totals were computed, ISO 8601. */
  updatedAt: string
  top: LeaderboardRow[]
  /** The viewer's own row, ranked among the rows shown. Null exactly when the depot filter excludes them. */
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
  finished: boolean
}

export type ChooseResponse = {
  steps: ClientNode[]
  node: ClientNode
  meters: Meters
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
