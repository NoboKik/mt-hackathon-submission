// The only place the route handlers touch Postgres: one query per helper, no status codes and
// no game rules. Everything is scoped to a user id — ownership is a WHERE clause, not a check
// the caller can forget.

import type {
  AchievementCode,
  Competency,
  EarnedAchievement,
  FinishedRow,
  LeaderboardPeriod,
  LeaderboardRow,
  MeUser,
  ProfileSession,
} from '@p400/shared'
import { decisionsOf, Scenario, type ScenarioListItem, THRESHOLD_END_ID } from '@p400/shared'
import { and, desc, eq, isNotNull, isNull, notExists, or, sql } from 'drizzle-orm'
import { expertPathTaken } from '@/lib/api'
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
export async function scenarioById(id: string) {
  // Not a valid id is simply not found; a NUL byte would otherwise reach Postgres and answer 500.
  if (!Scenario.shape.id.safeParse(id).success) return undefined
  const rows = await db()
    .select({ json: scenarios.json, source: scenarios.source, status: scenarios.status })
    .from(scenarios)
    .where(eq(scenarios.id, id))
    .limit(1)
  const row = rows.at(0)
  return row && { scenario: Scenario.parse(row.json), source: row.source, status: row.status }
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
    .where(eq(scenarios.source, 'curated'))
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
 * category, and how many curated scenarios exist (for `full-route`).
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
      source: scenarios.source,
    })
    .from(sessions)
    .innerJoin(scenarios, eq(scenarios.id, sessions.scenarioId))
    .where(and(eq(sessions.userId, userId), isNotNull(sessions.finishedAt)))

  const counted = await db()
    .select({ total: sql<number>`count(*)::int` })
    .from(scenarios)
    .where(eq(scenarios.source, 'curated'))

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
    generated: r.source === 'generated',
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

/** The four fields the profile header shows. No id: the caller already has it. */
export async function userProfile(userId: string): Promise<MeUser | undefined> {
  const rows = await db()
    .select({
      displayName: users.displayName,
      position: users.position,
      depot: users.depot,
      avatar: users.avatar,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return rows.at(0)
}

/** Finished runs, newest first, flattened to the shape the pure aggregator takes. */
export async function profileSessions(userId: string): Promise<ProfileSession[]> {
  const rows = await db()
    .select({
      id: sessions.id,
      scenarioId: sessions.scenarioId,
      title: scenarios.title,
      difficulty: scenarios.difficulty,
      // NOTE: the whole scenario jsonb rides back per row to label one path. The history is
      // tens of rows; group by scenario first if it ever stops being.
      json: scenarios.json,
      outcome: sessions.outcome,
      score: sessions.score,
      loyalty: sessions.loyalty,
      safety: sessions.safety,
      finishedAt: sessions.finishedAt,
      competencyDeltas: sessions.competencyDeltas,
      path: sessions.path,
    })
    .from(sessions)
    .innerJoin(scenarios, eq(scenarios.id, sessions.scenarioId))
    .where(and(eq(sessions.userId, userId), isNotNull(sessions.finishedAt)))
    .orderBy(desc(sessions.finishedAt))

  // flatMap, not map: outcome, score and finished_at are nullable columns the WHERE clause has
  // already ruled out, and a `?? 0` here would invent a run that never happened.
  return rows.flatMap((r) =>
    r.outcome && r.score !== null && r.finishedAt
      ? [
          {
            id: r.id,
            scenarioId: r.scenarioId,
            title: r.title,
            // Off the json, not the text column: the json one is typed as a Competency.
            category: r.json.category,
            difficulty: r.difficulty,
            outcome: r.outcome,
            score: r.score,
            loyalty: r.loyalty,
            safety: r.safety,
            // drizzle hands back a Date for a timestamptz; the contract says ISO string.
            finishedAt: r.finishedAt.toISOString(),
            competencyDeltas: r.competencyDeltas,
            // Always the success ending's expert path, never the end node this run reached:
            // debriefFor throws on anything that is not an end node, and every seeded session is
            // parked on scenario.start. engine.ts documents the two as equivalent anyway.
            onExpertPath: expertPathTaken(r.json, THRESHOLD_END_ID, r.path),
            decisions: decisionsOf(r.json, r.path),
          },
        ]
      : [],
  )
}

/** The badges this user has actually earned, oldest first. Locked ones are filled in by profileFor. */
export async function earnedAchievements(userId: string): Promise<EarnedAchievement[]> {
  const rows = await db()
    .select({ code: userAchievements.code, earnedAt: userAchievements.earnedAt })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId))
    .orderBy(userAchievements.earnedAt)
  return rows.map((r) => ({ code: r.code, earnedAt: r.earnedAt.toISOString() }))
}

/** Viewer-independent, so one cached copy per period serves everybody. */
export const LEADERBOARD_CACHE_MS = 30_000

type CachedBoard = { at: number; rows: LeaderboardRow[] }
const boards = new Map<LeaderboardPeriod, CachedBoard>()

/** Called when a session finishes: without it the demo user climbs up to 30 s after her run. */
export const clearLeaderboardCache = () => boards.clear()

/**
 * Every user ranked by the sum of their best score per scenario, in one query. LEFT JOIN, so a
 * conductor who has played nothing is still on the board at 0 — and a viewer who is in no row at
 * all is a stale cookie, not an empty history.
 *
 * ::int everywhere: postgres-js hands back sum(), count() and rank() as strings.
 */
export async function leaderboardTotals(period: LeaderboardPeriod): Promise<CachedBoard> {
  const hit = boards.get(period)
  if (hit && Date.now() - hit.at < LEADERBOARD_CACHE_MS) return hit

  // A conditional fragment, not a hand-numbered placeholder: drizzle renumbers the parameters.
  const since =
    period === 'week' ? sql`and ${sessions.finishedAt} >= now() - interval '7 days'` : sql``

  // db().execute() on postgres-js resolves to the row list itself — there is no .rows here.
  const rows = (await db().execute(sql`
    with best as (
      select ${sessions.userId} as user_id,
             ${sessions.scenarioId} as scenario_id,
             max(${sessions.score}) as score
      from ${sessions}
      join ${scenarios} on ${scenarios.id} = ${sessions.scenarioId}
      -- Curated only: an endless generated pool would let volume beat skill.
      where ${sessions.finishedAt} is not null and ${scenarios.source} = 'curated' ${since}
      group by ${sessions.userId}, ${sessions.scenarioId}
    )
    select ${users.id} as "userId",
           ${users.displayName} as "displayName",
           ${users.position} as "position",
           ${users.depot} as "depot",
           ${users.crew} as "crew",
           ${users.avatar} as "avatar",
           coalesce(sum(best.score), 0)::int as "total",
           count(best.scenario_id)::int as "scenarios",
           rank() over (order by coalesce(sum(best.score), 0) desc)::int as "rank"
    from ${users}
    left join best on best.user_id = ${users.id}
    group by ${users.id}, ${users.displayName}, ${users.position}, ${users.depot}, ${users.crew},
             ${users.avatar}
    order by "rank", "displayName"
  `)) as unknown as LeaderboardRow[]

  const board = { at: Date.now(), rows }
  boards.set(period, board)
  return board
}

/** Auto mode's pool, oldest first: what pickSeed counts and what the prompt tells the model to avoid. */
export async function generatedScenarios() {
  return db()
    .select({ id: scenarios.id, title: scenarios.title, category: scenarios.category })
    .from(scenarios)
    .where(eq(scenarios.source, 'generated'))
    .orderBy(scenarios.createdAt)
}

/** Generated scenarios created in the last `hours`: what the daily LLM cap counts. */
export async function generatedSince(hours: number) {
  const [{ n }] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(scenarios)
    .where(
      and(
        eq(scenarios.source, 'generated'),
        sql`${scenarios.createdAt} >= now() - make_interval(hours => ${hours})`,
      ),
    )
  return n
}

/** Generated scenarios this user has never even started, oldest first: auto mode's queue. */
export async function unplayedGenerated(userId: string) {
  const started = db()
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.scenarioId, scenarios.id), eq(sessions.userId, userId)))
  const rows = await db()
    .select({ id: scenarios.id })
    .from(scenarios)
    .where(and(eq(scenarios.source, 'generated'), notExists(started)))
    .orderBy(scenarios.createdAt)
  return rows.map((r) => r.id)
}

/** A validated LLM draft joins the pool. Never the catalogue: that is `source = 'curated'`. */
export async function insertGenerated(s: Scenario) {
  await db().insert(scenarios).values({
    id: s.id,
    title: s.title,
    category: s.category,
    difficulty: s.difficulty,
    json: s,
    source: 'generated',
    status: 'draft',
  })
}

/**
 * Everything notificationsFor needs, as epoch ms. Undefined for a stale cookie. Every finished run
 * rides back: the streak needs all of them, and a conductor's history is tens of rows.
 */
export async function notificationInput(userId: string) {
  const [user] = await db()
    .select({ createdAt: users.createdAt, seenAt: users.notificationsSeenAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user) return undefined

  const [curated, runs, badges] = await Promise.all([
    db()
      .select({ id: scenarios.id, json: scenarios.json, createdAt: scenarios.createdAt })
      .from(scenarios)
      .where(eq(scenarios.source, 'curated')),
    db()
      .select({
        scenarioId: sessions.scenarioId,
        finishedAt: sessions.finishedAt,
        source: scenarios.source,
      })
      .from(sessions)
      .innerJoin(scenarios, eq(scenarios.id, sessions.scenarioId))
      .where(and(eq(sessions.userId, userId), isNotNull(sessions.finishedAt))),
    earnedAchievements(userId),
  ])

  return {
    joinedAt: user.createdAt.getTime(),
    seenAt: user.seenAt?.getTime() ?? null,
    scenarios: curated.map((s) => ({
      id: s.id,
      title: s.json.title,
      category: s.json.category,
      estimatedMinutes: s.json.estimatedMinutes,
      createdAt: s.createdAt.getTime(),
    })),
    runs: runs.map((r) => ({
      scenarioId: r.scenarioId,
      finishedAt: r.finishedAt?.getTime() ?? 0,
      curated: r.source === 'curated',
    })),
    badges: badges.map((b) => ({ code: b.code, earnedAt: Date.parse(b.earnedAt) })),
  }
}

/** The bell was opened: everything derived up to now reads as read. */
export async function markNotificationsSeen(userId: string) {
  await db().update(users).set({ notificationsSeenAt: new Date() }).where(eq(users.id, userId))
}

/**
 * Everything crewAnalytics needs, company-wide: users, finished curated runs, and the curated
 * scenarios whose node texts label the chart. Generated scenarios are one conductor's draft each,
 * so their nodes say nothing about a crew.
 */
export async function analyticsInput() {
  const [people, runs, curated] = await Promise.all([
    db().select({ id: users.id, depot: users.depot, crew: users.crew }).from(users),
    db()
      .select({
        userId: sessions.userId,
        scenarioId: sessions.scenarioId,
        outcome: sessions.outcome,
        competencyDeltas: sessions.competencyDeltas,
        path: sessions.path,
      })
      .from(sessions)
      .innerJoin(scenarios, eq(scenarios.id, sessions.scenarioId))
      .where(and(isNotNull(sessions.finishedAt), eq(scenarios.source, 'curated'))),
    db()
      .select({ id: scenarios.id, title: scenarios.title, json: scenarios.json })
      .from(scenarios)
      .where(eq(scenarios.source, 'curated')),
  ])
  return {
    users: people,
    // A finished run always has an outcome; the flatMap only convinces the type of it.
    runs: runs.flatMap((r) => (r.outcome ? [{ ...r, outcome: r.outcome }] : [])),
    scenarios: new Map(
      curated.map((s) => [s.id, { title: s.title, json: Scenario.parse(s.json) }]),
    ),
  }
}

/** Everyone, their finished runs and their badges: the HR/LMS export's raw rows. No emails. */
export async function integrationInput() {
  const [people, runs, badges] = await Promise.all([
    db()
      .select({ id: users.id, name: users.displayName, depot: users.depot, crew: users.crew })
      .from(users)
      .orderBy(users.depot, users.crew, users.displayName),
    db()
      .select({
        userId: sessions.userId,
        scenarioId: sessions.scenarioId,
        // Off the json, like profileSessions: the text column is not typed as a Competency.
        category: sql<Competency>`${scenarios.json}->>'category'`,
        score: sessions.score,
        competencyDeltas: sessions.competencyDeltas,
        finishedAt: sessions.finishedAt,
      })
      .from(sessions)
      .innerJoin(scenarios, eq(scenarios.id, sessions.scenarioId))
      .where(isNotNull(sessions.finishedAt)),
    db()
      .select({ userId: userAchievements.userId, code: userAchievements.code })
      .from(userAchievements)
      .orderBy(userAchievements.earnedAt),
  ])
  return {
    users: people,
    // Finished runs always carry a score and a date; the flatMap only convinces the type of it.
    runs: runs.flatMap((r) =>
      r.score !== null && r.finishedAt ? [{ ...r, score: r.score, finishedAt: r.finishedAt }] : [],
    ),
    badges,
  }
}

type IntegrationUserFields = {
  email: string
  displayName: string
  depot: string
  crew: string
  position: string
}

/**
 * PUT /integration/users/:employeeId. Matches on the табельный номер first, then adopts an account
 * with the same email that pnpm user:add made before HR knew about it. `passwordHash` undefined
 * keeps the current password on update and refuses to create.
 */
export async function putIntegrationUser(
  employeeId: string,
  fields: IntegrationUserFields,
  passwordHash: string | undefined,
): Promise<{ id: string; created: boolean } | 'passwordRequired' | 'emailTaken'> {
  const values = { ...fields, employeeId, ...(passwordHash && { passwordHash }) }
  try {
    const found = await db()
      .select({ id: users.id })
      .from(users)
      .where(
        or(
          eq(users.employeeId, employeeId),
          and(eq(users.email, fields.email), isNull(users.employeeId)),
        ),
      )
      .orderBy(sql`${users.employeeId} is null`) // the employeeId match wins
      .limit(1)
    const id = found.at(0)?.id
    if (id) {
      await db().update(users).set(values).where(eq(users.id, id))
      return { id, created: false }
    }
    if (!passwordHash) return 'passwordRequired'
    const [row] = await db()
      .insert(users)
      .values({ ...values, passwordHash })
      .returning({ id: users.id })
    // biome-ignore lint/style/noNonNullAssertion: an insert without a conflict returns its row
    return { id: row!.id, created: true }
  } catch (e) {
    // NOTE: any unique violation reads as the email; two concurrent PUTs for one new
    // employeeId would say emailTaken too. The retry succeeds, so no lock.
    if ((e as { cause?: { code?: string } }).cause?.code === '23505') return 'emailTaken'
    throw e
  }
}
