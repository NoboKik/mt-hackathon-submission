import type { Scenario } from '@p400/shared'
import { expect, test } from 'vitest'
import { generateSeedData } from './seed'

// generateSeedData only reads id, start and estimatedMinutes off a scenario.
const stub = (id: string) => ({ id, start: 'n1', estimatedMinutes: 5 }) as unknown as Scenario
const LIST = [stub('medical-faint-01'), stub('conflict-drunk-01')]
const NOW = Date.UTC(2026, 8, 27)
const run = () => generateSeedData(LIST, 'scrypt$c2FsdA==$aGFzaA==', NOW)

// Everything except the uuids, which are random by design.
const stable = (d: ReturnType<typeof run>) => ({
  users: d.users.map(({ id, ...u }) => u),
  sessions: d.sessions.map(({ userId, ...s }) => s),
})

test('two runs generate the same crew, sessions and scores', () => {
  expect(stable(run())).toEqual(stable(run()))
})

test('one demo user, 30 conductors, no duplicate emails', () => {
  const { users } = run()
  expect(users).toHaveLength(31)
  expect(users[0].email).toBe('demo@provodnik400.ru')
  expect(new Set(users.map((u) => u.email)).size).toBe(31)
})

test('every session is finished, scored and inside the last 21 days', () => {
  const { sessions } = run()
  expect(sessions.length).toBeGreaterThan(0)
  for (const s of sessions) {
    expect(LIST.map((x) => x.id)).toContain(s.scenarioId)
    expect(Number(s.finishedAt)).toBeGreaterThan(Number(s.startedAt))
    expect(NOW - Number(s.startedAt)).toBeLessThanOrEqual(21 * 86_400_000)
    expect(s.score).toBe(s.scoreBreakdown?.total)
    expect(Math.min(s.loyalty, s.safety)).toBeGreaterThanOrEqual(0)
    expect(Math.max(s.loyalty, s.safety)).toBeLessThanOrEqual(100)
  }
})

test('the demo user sits mid-table, so a live run visibly moves her up', () => {
  const { users, sessions } = run()
  const best = new Map<string, number>()
  for (const s of sessions) {
    const key = `${s.userId}|${s.scenarioId}`
    best.set(key, Math.max(best.get(key) ?? 0, s.score ?? 0))
  }
  const totals = new Map<string, number>()
  for (const [key, points] of best) {
    const userId = key.split('|')[0]
    totals.set(userId, (totals.get(userId) ?? 0) + points)
  }
  const ranked = [...users].sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0))
  const rank = ranked.findIndex((u) => u.email === 'demo@provodnik400.ru') + 1
  expect(rank).toBeGreaterThan(8)
  expect(rank).toBeLessThan(24)
})

test('no scenario files still seeds the crew', () => {
  const empty = generateSeedData([], 'scrypt$c2FsdA==$aGFzaA==', NOW)
  expect(empty.users).toHaveLength(31)
  expect(empty.sessions).toEqual([])
})
