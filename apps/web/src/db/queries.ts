// The only place the route handlers touch Postgres: one query per helper, no status codes and
// no game rules. Everything is scoped to a user id — ownership is a WHERE clause, not a check
// the caller can forget.

import type { AchievementCode, FinishedRow } from '@p400/shared'
import { Scenario, type ScenarioListItem } from '@p400/shared'
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { db } from './index'
import { type NewGameSession, scenarios, sessions, userAchievements, users } from './schema'

export async function userByEmail(email: string) {
  const rows = await db()
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  return rows.at(0)
}

/** Parsed, not just cast: `$type<Scenario>()` is only a compile-time claim about a jsonb column. */
export async function scenarioById(id: string): Promise<Scenario | undefined> {
  const rows = await db()
    .select({ json: scenarios.json })
    .from(scenarios)
    .where(eq(scenarios.id, id))
    .limit(1)
  const row = rows.at(0)
  return row && Scenario.parse(row.json)
}

// A signed cookie outlives its user: every `pnpm db:seed` rotates ids.
export async function userExists(id: string) {
  const rows = await db().select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1)
  return rows.length === 1
}

/** The catalogue plus this user's best score and attempt count per scenario, in one query. */
export async function scenarioList(userId: string): Promise<ScenarioListItem[]> {
  // Finished sessions only: an abandoned run is not an attempt and has no score.
  const played = db()
    .select({
      scenarioId: sessions.scenarioId,
      // Cast in SQL: postgres-js returns count() as a string, and drizzle's own mapWith does
      // not survive being read back off a subquery.
      bestScore: sql<number | null>`max(${sessions.score})::int`.as('best_score'),
      attempts: sql<number | null>`count(*)::int`.as('attempts'),
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNotNull(sessions.finishedAt)))
    .groupBy(sessions.scenarioId)
    .as('played')

  const rows = await db()
    .select({
      id: scenarios.id,
      json: scenarios.json,
      bestScore: played.bestScore,
      attempts: played.attempts,
    })
    .from(scenarios)
    .leftJoin(played, eq(played.scenarioId, scenarios.id))
    .orderBy(scenarios.difficulty, scenarios.id)

  // NOTE: the whole scenario jsonb travels back to read four fields off it. The catalogue is
  // 3 scenarios, not 3000; the columns beside it are for sorting.
  return rows.map(({ id, json, bestScore, attempts }) => ({
    id,
    title: json.title,
    category: json.category,
    difficulty: json.difficulty,
    estimatedMinutes: json.estimatedMinutes,
    bestScore: bestScore ?? null,
    attempts: attempts ?? 0,
  }))
}

// Postgres raises 22P02 on a malformed uuid, which would reach the client as a 500. A session
// id the user made up is a 404 like any other.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A session with its scenario. Filtered by owner, so another user's session reads as missing.
 * The scenario is the stored jsonb as is: scenarioById() parsed it when the session started.
 */
export async function sessionFor(id: string, userId: string) {
  if (!UUID.test(id)) return undefined
  const rows = await db()
    .select({ session: sessions, scenario: scenarios.json })
    .from(sessions)
    .innerJoin(scenarios, eq(scenarios.id, sessions.scenarioId))
    .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
    .limit(1)
  return rows.at(0)
}

export async function createSession(values: NewGameSession) {
  const rows = await db().insert(sessions).values(values).returning({ id: sessions.id })
  const row = rows.at(0)
  if (!row) throw new Error('session insert returned no row')
  return row.id
}

/**
 * The optimistic write: the session must still be on `fromNode` and unfinished. `false` means
 * something else moved it first — two tabs, or a replayed request — and the caller answers 409.
 */
export async function advanceSession(
  id: string,
  fromNode: string,
  values: Partial<NewGameSession>,
) {
  const rows = await db()
    .update(sessions)
    .set(values)
    .where(
      and(eq(sessions.id, id), eq(sessions.currentNode, fromNode), isNull(sessions.finishedAt)),
    )
    .returning({ id: sessions.id })
  return rows.length === 1
}

/**
 * Everything the achievement evaluator needs: this user's finished runs with their scenario's
 * category, and how many scenarios exist at all (for `full-route`).
 */
export async function achievementInput(userId: string) {
  const rows = await db()
    .select({
      scenarioId: sessions.scenarioId,
      category: scenarios.category,
      outcome: sessions.outcome,
      score: sessions.score,
      loyalty: sessions.loyalty,
      safety: sessions.safety,
      finishedAt: sessions.finishedAt,
      path: sessions.path,
    })
    .from(sessions)
    .innerJoin(scenarios, eq(scenarios.id, sessions.scenarioId))
    .where(and(eq(sessions.userId, userId), isNotNull(sessions.finishedAt)))

  const counted = await db().select({ total: sql<number>`count(*)::int` }).from(scenarios)

  // The nullable columns are narrowed here, at the boundary: a finished session always has an
  // outcome, a score and a finishedAt, but only the WHERE clause knows that.
  const finished: FinishedRow[] = rows.map((r) => ({
    scenarioId: r.scenarioId,
    category: r.category,
    outcome: r.outcome ?? 'fail',
    score: r.score ?? 0,
    loyalty: r.loyalty,
    safety: r.safety,
    finishedAt: r.finishedAt?.getTime() ?? 0,
    choiceIds: r.path.map((step) => step.choiceId),
  }))
  return { rows: finished, scenarioCount: counted.at(0)?.total ?? 0 }
}

/**
 * Grants the codes the user now qualifies for and returns only the ones that were actually new.
 * The composite primary key plus RETURNING does the diff in one statement: no read-then-write,
 * so two tabs finishing at once cannot both report the same badge as freshly unlocked.
 */
export async function unlockAchievements(userId: string, codes: AchievementCode[]) {
  if (!codes.length) return []
  const rows = await db()
    .insert(userAchievements)
    .values(codes.map((code) => ({ userId, code })))
    .onConflictDoNothing()
    .returning({ code: userAchievements.code })
  return rows.map((r) => r.code)
}
