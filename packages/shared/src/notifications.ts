// The daily scenario, the streak and the notification feed. Derived at read time from rows that
// already exist — finished runs, curated scenarios, earned badges — so there is no queue to fill
// and nothing to backfill. The only stored state is when the player last opened the bell.
//
// Pure: epoch ms in, one response out. The route does the reading; the words live in ru.ts.

import type { AchievementCode } from './achievements'
import type { Competency } from './schema'

export const DAY_MS = 86_400_000
/** The weekly leaderboard is a rolling 7 days (leaderboardTotals), not a calendar week. */
export const WEEK_MS = 7 * DAY_MS
/** Warn this many days (or fewer) before a scenario's weekly points drop off the board. */
export const WEEKLY_WARN_DAYS = 2

// NOTE: a fixed UTC+3. Moscow has had no DST since 2014, and «сгорит сегодня в 23:59» has to
// mean the conductor's midnight, not UTC's 03:00. A per-user zone is a column away if ВСМ leaves MSK.
const MSK_MS = 3 * 3_600_000
const dayOf = (t: number) => Math.floor((t + MSK_MS) / DAY_MS)
const startOfDay = (day: number) => day * DAY_MS - MSK_MS

export type NotificationInput = {
  now: number
  /** users.created_at: events from before the account existed are not news to it. */
  joinedAt: number
  /** users.notifications_seen_at, or null if the bell was never opened. */
  seenAt: number | null
  /** Curated scenarios only. */
  scenarios: {
    id: string
    title: string
    category: Competency
    estimatedMinutes: number
    createdAt: number
  }[]
  /** Every finished run, auto mode included. */
  runs: { scenarioId: string; finishedAt: number; curated: boolean }[]
  badges: { code: AchievementCode; earnedAt: number }[]
}

type Base = { at: string; read: boolean }
export type AppNotification = Base &
  (
    | { kind: 'streak'; days: number }
    | { kind: 'daily'; scenarioId: string; title: string }
    | { kind: 'weekly'; scenarioId: string; title: string; days: number }
    | { kind: 'badge'; code: AchievementCode }
    | { kind: 'new-scenario'; scenarioId: string; title: string }
  )

export type DailyScenario = {
  scenarioId: string
  title: string
  category: Competency
  estimatedMinutes: number
  /** Finished at least once today, any outcome. */
  done: boolean
}

export type NotificationsResponse = {
  daily: DailyScenario | null
  /** Consecutive days with a finished run. `atRisk`: it counts yesterday, but not yet today. */
  streak: { days: number; atRisk: boolean }
  unread: number
  /** Newest first. */
  items: AppNotification[]
}

/** Consecutive MSK days with at least one finished run, ending today or, if not yet today, yesterday. */
export function streakFor(finishedAt: readonly number[], now: number) {
  const days = new Set(finishedAt.map(dayOf))
  const today = dayOf(now)
  let day = days.has(today) ? today : today - 1
  let count = 0
  while (days.has(day)) {
    count++
    day--
  }
  return { days: count, atRisk: count > 0 && !days.has(today) }
}

/**
 * Rotates by date over the scenarios this player had not finished before today, falling back to
 * all of them. "Before today", so finishing the daily marks it done instead of swapping it out.
 */
export function dailyFor(
  scenarios: NotificationInput['scenarios'],
  runs: NotificationInput['runs'],
  now: number,
): DailyScenario | null {
  const today = dayOf(now)
  const since = startOfDay(today)
  const sorted = [...scenarios].sort((a, b) => a.id.localeCompare(b.id))
  const earlier = new Set(runs.filter((r) => r.finishedAt < since).map((r) => r.scenarioId))
  const fresh = sorted.filter((s) => !earlier.has(s.id))
  const pool = fresh.length ? fresh : sorted
  const pick = pool[today % pool.length]
  if (!pick) return null
  return {
    scenarioId: pick.id,
    title: pick.title,
    category: pick.category,
    estimatedMinutes: pick.estimatedMinutes,
    done: runs.some((r) => r.scenarioId === pick.id && r.finishedAt >= since),
  }
}

export function notificationsFor(input: NotificationInput): NotificationsResponse {
  const { now, joinedAt, seenAt, scenarios, runs, badges } = input
  const today = startOfDay(dayOf(now))
  const title = new Map(scenarios.map((s) => [s.id, s.title]))
  const daily = dailyFor(scenarios, runs, now)
  const streak = streakFor(
    runs.map((r) => r.finishedAt),
    now,
  )

  // Standing conditions are stamped with the start of today, so opening the bell reads them
  // until midnight and they come back tomorrow if still true. Events carry their own time.
  const items: AppNotification[] = []
  const stamp = (t: number): Base => ({
    at: new Date(t).toISOString(),
    read: seenAt !== null && t <= seenAt,
  })

  if (streak.atRisk) items.push({ kind: 'streak', days: streak.days, ...stamp(today) })
  if (daily && !daily.done)
    items.push({ kind: 'daily', scenarioId: daily.scenarioId, title: daily.title, ...stamp(today) })

  // A scenario's weekly points go when its last run in the window turns 7 days old.
  // NOTE: warns when the scenario drops out entirely, not when an older best run is replaced
  // by a lower one still in the window. Walk the runs by score if that partial drop matters.
  const last = new Map<string, number>()
  for (const r of runs)
    if (r.curated && r.finishedAt > now - WEEK_MS)
      last.set(r.scenarioId, Math.max(last.get(r.scenarioId) ?? 0, r.finishedAt))
  const soonest = [...last].sort((a, b) => a[1] - b[1]).at(0)
  if (soonest) {
    const days = Math.ceil((soonest[1] + WEEK_MS - now) / DAY_MS)
    if (days <= WEEKLY_WARN_DAYS)
      items.push({
        kind: 'weekly',
        scenarioId: soonest[0],
        title: title.get(soonest[0]) ?? soonest[0],
        days,
        ...stamp(today),
      })
  }

  // Events: the last week's worth, and only those after the account existed — a fresh install
  // must not greet the demo user with the whole catalogue as "new".
  const recent = (t: number) => t > joinedAt && t > now - WEEK_MS
  for (const b of badges)
    if (recent(b.earnedAt)) items.push({ kind: 'badge', code: b.code, ...stamp(b.earnedAt) })
  for (const s of scenarios)
    if (recent(s.createdAt))
      items.push({ kind: 'new-scenario', scenarioId: s.id, title: s.title, ...stamp(s.createdAt) })

  // ISO strings in one format sort as time. Stable: same-time standing items keep their order.
  items.sort((a, b) => b.at.localeCompare(a.at))
  return { daily, streak, unread: items.filter((n) => !n.read).length, items }
}
