import { expect, test } from 'vitest'
import { DAY_MS, type NotificationInput, notificationsFor, streakFor } from './notifications'

// 25 Sept 2026, 12:00 MSK. MSK midnight is 21:00 UTC the day before.
const NOW = Date.UTC(2026, 8, 25, 9)
const MIDNIGHT = Date.UTC(2026, 8, 24, 21)
const H = 3_600_000

const scenario = (id: string, createdAt = 0) => ({
  id,
  title: `«${id}»`,
  category: 'conflict' as const,
  estimatedMinutes: 5,
  createdAt,
})
const run = (scenarioId: string, finishedAt: number, curated = true) => ({
  scenarioId,
  finishedAt,
  curated,
})

const base: NotificationInput = {
  now: NOW,
  joinedAt: NOW - 30 * DAY_MS,
  seenAt: null,
  scenarios: ['a', 'b', 'c'].map((id) => scenario(id)),
  runs: [],
  badges: [],
}

test('streak counts MSK days back from today, or from yesterday while at risk', () => {
  expect(streakFor([], NOW)).toEqual({ days: 0, atRisk: false })
  // 23:30 MSK yesterday and 00:30 MSK today are two days, though both are the same UTC date.
  expect(streakFor([MIDNIGHT - H / 2, MIDNIGHT + H / 2], NOW)).toEqual({ days: 2, atRisk: false })
  expect(streakFor([MIDNIGHT - H, MIDNIGHT - DAY_MS - H], NOW)).toEqual({ days: 2, atRisk: true })
  // A gap breaks it.
  expect(streakFor([MIDNIGHT - 2 * DAY_MS - H], NOW)).toEqual({ days: 0, atRisk: false })
})

test('the daily stays put once finished today and skips what was finished before', () => {
  const first = notificationsFor(base).daily
  expect(first?.done).toBe(false)
  const id = first?.scenarioId ?? ''
  const afterRun = notificationsFor({ ...base, runs: [run(id, NOW - H)] }).daily
  expect(afterRun).toMatchObject({ scenarioId: id, done: true })
  // Finished yesterday: today's pick avoids it.
  const next = notificationsFor({ ...base, runs: [run(id, MIDNIGHT - H)] }).daily
  expect(next?.scenarioId).not.toBe(id)
  // Everything finished before today: falls back to the whole catalogue.
  const all = base.scenarios.map((s) => run(s.id, MIDNIGHT - H))
  expect(notificationsFor({ ...base, runs: all }).daily).not.toBeNull()
  expect(notificationsFor({ ...base, scenarios: [] }).daily).toBeNull()
})

test('the feed derives every kind and reads them against notifications_seen_at', () => {
  const input: NotificationInput = {
    ...base,
    scenarios: [...base.scenarios, scenario('new', NOW - 2 * H)],
    // Yesterday only: streak at risk. Six and a half days old: weekly points go tomorrow.
    runs: [run('a', MIDNIGHT - H), run('b', NOW - 6.5 * DAY_MS)],
    badges: [
      { code: 'first-run', earnedAt: NOW - H },
      { code: 'flawless', earnedAt: NOW - 8 * DAY_MS }, // too old to be news
    ],
  }
  const res = notificationsFor(input)
  expect(res.items.map((n) => n.kind)).toEqual([
    'badge',
    'new-scenario',
    'streak',
    'daily',
    'weekly',
  ])
  expect(res.items.find((n) => n.kind === 'weekly')).toMatchObject({ scenarioId: 'b', days: 1 })
  expect(res.unread).toBe(5)

  // Opened the bell an hour and a half ago: the badge came later, the rest is read.
  const seen = notificationsFor({ ...input, seenAt: NOW - 1.5 * H })
  expect(seen.unread).toBe(1)
  expect(seen.items.find((n) => !n.read)?.kind).toBe('badge')
})

test('events from before the account existed are not news', () => {
  const res = notificationsFor({
    ...base,
    joinedAt: NOW - H,
    scenarios: [scenario('old', NOW - 2 * H)],
    badges: [{ code: 'first-run', earnedAt: NOW - 2 * H }],
    runs: [run('old', NOW - 30 * 60_000)],
  })
  expect(res.items).toEqual([])
})
