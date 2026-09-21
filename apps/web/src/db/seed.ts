// Seed for the demo: one mid-table demo user, 30 colleagues and the sessions they played.
// Idempotent — two runs give the same row counts and the same generated users, sessions and
// scores. Only row uuids, password hashes and session timestamps differ: those hang off
// randomness or "now".
// Run with `pnpm db:seed`.

import { randomBytes, randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import {
  type AchievementCode,
  COMPETENCIES,
  COOL_HEAD_RUNS,
  type Competency,
  HIGH_METER,
  HONOUR_STUDENT_SCORE,
  NIGHT_SHIFT_RUNS,
  NIGHT_SHIFT_WINDOW_MS,
  type Outcome,
  type Scenario,
  STEADY_DAYS,
  score,
} from '@p400/shared'
import { requireScenarios } from '@p400/shared/content'
import { sql } from 'drizzle-orm'
import { hashPassword } from '@/lib/auth'
import { db } from './index'
import {
  type NewGameSession,
  type NewUser,
  type NewUserAchievement,
  scenarios,
  sessions,
  userAchievements,
  users,
} from './schema'

// A fixed seed, so every machine generates the same demo data.
const SEED = 20260927

// NOTE: six lines of mulberry32 instead of a PRNG dependency. Never Math.random in here.
function mulberry32(initial: number) {
  let state = initial
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rnd = () => number
const int = (rnd: Rnd, lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))
const pick = <T>(rnd: Rnd, xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)] as T

function weighted<T>(rnd: Rnd, table: readonly (readonly [T, number])[]): T {
  let r = rnd() * table.reduce((sum, [, w]) => sum + w, 0)
  for (const [value, w] of table) {
    r -= w
    if (r < 0) return value
  }
  return table[0][0]
}

// NOTE: word lists as one string each — as arrays the formatter gives every name its own
// line, which is 80 lines of nothing.
// biome-ignore format: keep each list on one line
const MALE_FIRST = 'Александр Дмитрий Максим Сергей Андрей Алексей Артём Илья Кирилл Михаил Никита Роман Егор Иван Денис Евгений Даниил Павел Антон Виктор'.split(' ')
// biome-ignore format: keep each list on one line
const FEMALE_FIRST = 'Анна Мария Елена Дарья Алина Ирина Екатерина Ольга Наталья Татьяна Юлия Ксения Полина Виктория Софья Анастасия Валерия Марина Светлана Кристина'.split(' ')
// Masculine forms; the feminine one adds -а (Соколов → Соколова), so the list stays -ов/-ев/-ин.
// biome-ignore format: keep each list on one line
const SURNAMES = 'Соколов Иванов Кузнецов Петров Смирнов Волков Морозов Новиков Фёдоров Лебедев Зайцев Медведев Орлов Никитин Васильев Павлов Семёнов Виноградов Богданов Беляев Тарасов Комаров Макаров Андреев Гусев Титов Кузьмин Баранов Куликов Алексеев Степанов Яковлев Сорокин Сергеев Романов Захаров Борисов Герасимов Григорьев Лазарев'.split(' ')

// NOTE: a positional table beats 33 key/value pairs. Emails only have to be unique and
// readable — this is not an official transliteration standard.
const CYR = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'
const LAT = 'a|b|v|g|d|e|e|zh|z|i|y|k|l|m|n|o|p|r|s|t|u|f|kh|ts|ch|sh|shch||y||e|yu|ya'.split('|')
const translit = (s: string) => [...s.toLowerCase()].map((c) => LAT[CYR.indexOf(c)] ?? '').join('')
const emailFor = (first: string, last: string) =>
  `${translit(first)}.${translit(last)}@provodnik400.ru`

const POSITIONS = [
  ['Проводник', 70],
  ['Старший проводник', 20],
  ['Начальник поезда', 10],
] as const

const DEPOTS = [
  ['Депо Москва-Октябрьская', 45],
  ['Депо Санкт-Петербург-Московский', 45],
  ['Депо Тверь', 10],
] as const

const OUTCOMES = [
  ['success', 55],
  ['partial', 30],
  ['fail', 15],
] as const satisfies readonly (readonly [Outcome, number])[]

// Plausible final meters per outcome: a failed run ends under somebody's threshold.
const FINAL_METERS = {
  success: [72, 98],
  partial: [48, 74],
  fail: [12, 44],
} as const satisfies Record<Outcome, readonly [number, number]>

const DEMO = {
  email: 'demo@provodnik400.ru',
  displayName: 'Анна Соколова',
  position: 'Проводник',
  depot: 'Депо Москва-Октябрьская',
}

// NOTE: seeded history predates real timers, so every decision gets the middle of the
// schema's 10–20 s range. Real sessions read timerSec off the node they are on.
const SEEDED_TIMER_SEC = 15
const DAY_MS = 86_400_000

/** The timeout count is not a column, but `cool-head` is the one badge that needs it. */
type Played = { row: NewGameSession; timeouts: number }

function playedSession(rnd: Rnd, userId: string, scenario: Scenario, now: number): Played {
  const outcome = weighted(rnd, OUTCOMES)
  const decisions = Array.from({ length: int(rnd, 3, 5) }, () => {
    const full = SEEDED_TIMER_SEC * 1000
    const timedOut = rnd() < 0.1
    const elapsedMs = Math.round(full * (0.4 + rnd() * 0.5))
    return { timerSec: SEEDED_TIMER_SEC, elapsedMs: timedOut ? full : elapsedMs, timedOut }
  })
  const competencyDeltas: Partial<Record<Competency, number>> = {}
  for (let i = int(rnd, 1, 2); i > 0; i--)
    competencyDeltas[pick(rnd, COMPETENCIES)] = int(rnd, 1, 2)

  const breakdown = score({ outcome, decisions, competencyDeltas })
  const startedAt = new Date(now - Math.round(rnd() * 21 * DAY_MS))
  const played = scenario.estimatedMinutes * 60_000 + int(rnd, 5, 120) * 1000
  const [lo, hi] = FINAL_METERS[outcome]
  const row: NewGameSession = {
    userId,
    scenarioId: scenario.id,
    // NOTE: reserved for reproducible demo replays; nothing reads it yet.
    seed: int(rnd, 0, 2_147_483_647),
    startedAt,
    finishedAt: new Date(startedAt.getTime() + played),
    currentNode: scenario.start,
    nodeStartedAt: startedAt,
    loyalty: int(rnd, lo, hi),
    safety: int(rnd, lo, hi),
    outcome,
    score: breakdown.total,
    scoreBreakdown: breakdown,
    competencyDeltas,
    // Seeded history has no replayable path: a debrief needs a real playthrough.
    path: [],
  }
  return { row, timeouts: decisions.filter((d) => d.timedOut).length }
}

/** What the leaderboard will show: the best score per scenario, summed. */
const leaderboardTotal = (rows: NewGameSession[]) => {
  const best = new Map<string, number>()
  for (const r of rows) best.set(r.scenarioId, Math.max(best.get(r.scenarioId) ?? 0, r.score ?? 0))
  return [...best.values()].reduce((a, b) => a + b, 0)
}

/**
 * The badges seeded history honestly supports, per user. The thresholds come from
 * packages/shared/src/achievements.ts so the numbers stay in one place; only the evidence
 * differs, because a seeded session has `path: []` and the real evaluator reads choice ids.
 *
 * `first-aid` and `flawless` are deliberately never granted here. Both need a real path — the
 * seed cannot tell a clean medical run from a lucky one — and both are exactly what the demo
 * user unlocks in one five-minute medical playthrough. `night-shift` is evaluated
 * but effectively never fires: seeded runs are spread over 21 days.
 *
 * Derived from already-generated rows with zero new rnd() draws. Anything that consumes the
 * PRNG must be appended at the end of generateSeedData, or every downstream user, session and
 * score reshuffles and both the determinism test and the demo ranking break.
 */
function seededUnlocks(
  played: Played[],
  categoryOf: Map<string, string>,
  scenarioCount: number,
): NewUserAchievement[] {
  const byUser = new Map<string, Played[]>()
  for (const p of played) {
    const runs = byUser.get(p.row.userId) ?? []
    runs.push(p)
    byUser.set(p.row.userId, runs)
  }

  const unlocks: NewUserAchievement[] = []
  for (const [userId, runs] of byUser) {
    const rows = runs.map((p) => p.row)
    const times = rows.map((r) => Number(r.finishedAt ?? 0))
    const scenariosPlayed = new Set(rows.map((r) => r.scenarioId))
    const conditions: [AchievementCode, boolean][] = [
      ['first-run', rows.length >= 1],
      ['cool-head', runs.filter((p) => p.timeouts === 0).length >= COOL_HEAD_RUNS],
      [
        'diplomat',
        rows.some(
          (r) =>
            categoryOf.get(r.scenarioId) === 'conflict' &&
            r.outcome === 'success' &&
            r.loyalty >= HIGH_METER &&
            r.safety >= HIGH_METER,
        ),
      ],
      [
        'night-shift',
        times.some(
          (from) =>
            times.filter((t) => t >= from && t - from <= NIGHT_SHIFT_WINDOW_MS).length >=
            NIGHT_SHIFT_RUNS,
        ),
      ],
      [
        'balance',
        rows.some((r) => r.outcome !== 'fail' && r.loyalty >= HIGH_METER && r.safety >= HIGH_METER),
      ],
      ['steady', new Set(times.map((t) => Math.floor(t / DAY_MS))).size >= STEADY_DAYS],
      ['full-route', scenarioCount > 0 && scenariosPlayed.size >= scenarioCount],
      ['honour-student', rows.some((r) => (r.score ?? 0) >= HONOUR_STUDENT_SCORE)],
    ]
    for (const [code, earned] of conditions) if (earned) unlocks.push({ userId, code })
  }
  return unlocks
}

/** Everything that isn't a DB write, so seed.test.ts can check it without Postgres. */
export function generateSeedData(list: Scenario[], passwordHash: string, now = Date.now()) {
  const rnd = mulberry32(SEED)
  const demo: NewUser & { id: string } = { id: randomUUID(), ...DEMO, passwordHash }
  const crew: (NewUser & { id: string })[] = []
  // Block the demo user's own name as well, so the leaderboard has exactly one Анна Соколова.
  const taken = new Set([DEMO.email, emailFor('Анна', 'Соколова')])
  while (crew.length < 30) {
    const female = rnd() < 0.5
    const first = pick(rnd, female ? FEMALE_FIRST : MALE_FIRST)
    const last = `${pick(rnd, SURNAMES)}${female ? 'а' : ''}`
    const email = emailFor(first, last)
    if (taken.has(email)) continue
    taken.add(email)
    crew.push({
      id: randomUUID(),
      email,
      passwordHash,
      displayName: `${first} ${last}`,
      position: weighted(rnd, POSITIONS),
      depot: weighted(rnd, DEPOTS),
    })
  }

  const played: Played[] = []
  for (const user of crew) {
    for (let n = int(rnd, 0, 8); n > 0 && list.length; n--) {
      played.push(playedSession(rnd, user.id, pick(rnd, list), now))
    }
  }
  const rows = played.map((p) => p.row)

  // The demo user sits mid-table, so Анна visibly climbs after a live run.
  // NOTE: generate a handful of deterministic histories and keep the one closest to the
  // median total. Shorter than solving score() backwards, and "mid-table" is all the demo needs.
  const totals = crew.map((u) => leaderboardTotal(rows.filter((r) => r.userId === u.id)))
  const median = totals.sort((a, b) => a - b)[Math.floor(totals.length / 2)]
  let demoPlayed: Played[] = []
  for (let i = 0; i < 16 && list.length; i++) {
    const candidate = Array.from({ length: int(rnd, 2, 3) }, () =>
      playedSession(rnd, demo.id, pick(rnd, list), now),
    )
    const total = (c: Played[]) => leaderboardTotal(c.map((p) => p.row))
    const off = Math.abs(total(candidate) - median)
    if (!demoPlayed.length || off < Math.abs(total(demoPlayed) - median)) demoPlayed = candidate
  }

  const everyone = [...played, ...demoPlayed]
  const categoryOf = new Map(list.map((s) => [s.id, s.category as string]))
  return {
    users: [demo, ...crew],
    sessions: everyone.map((p) => p.row),
    unlocks: seededUnlocks(everyone, categoryOf, list.length),
  }
}

async function main() {
  // Throws on an empty folder or an invalid file: seeding zero scenarios is the bug, not a state.
  const list = requireScenarios()
  // One throwaway password for every seeded account: nobody signs in with a password. The demo
  // user gets in through POST /api/auth/demo, the other 30 are leaderboard colleagues.
  const hash = hashPassword(randomBytes(24).toString('base64url'))
  const data = generateSeedData(list, hash)

  await db().transaction(async (tx) => {
    await tx.delete(sessions)
    await tx.delete(users)
    for (const s of list) {
      const row = {
        title: s.title,
        category: s.category,
        difficulty: s.difficulty,
        json: s,
        source: 'curated' as const,
      }
      await tx
        .insert(scenarios)
        .values({ id: s.id, ...row })
        .onConflictDoUpdate({
          target: scenarios.id,
          set: { ...row, version: sql`${scenarios.version} + 1`, updatedAt: new Date() },
          // Re-seeding unchanged content must not bump `version` or `updated_at`.
          setWhere: sql`${scenarios.json} is distinct from excluded."json"`,
        })
    }
    await tx.insert(users).values(data.users)
    if (data.sessions.length) await tx.insert(sessions).values(data.sessions)
    // user_achievements has no delete above: it cascades with users, which are deleted here.
    if (data.unlocks.length)
      await tx.insert(userAchievements).values(data.unlocks).onConflictDoNothing()
  })

  const { users: u, sessions: s, unlocks } = data
  console.log(
    `seed: ${list.length} scenarios, ${u.length} users, ${s.length} sessions, ${unlocks.length} badges`,
  )
  // postgres-js keeps its pool open, so the process would otherwise hang here.
  process.exit(0)
}

// Only when run as `pnpm db:seed`: importing this file for its generator must not open a pool.
if (basename(process.argv[1] ?? '') === 'seed.ts') main()
