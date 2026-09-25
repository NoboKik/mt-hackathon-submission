import { ACHIEVEMENT_CODES, type Competency, type Scenario } from '@p400/shared'
import { expect, test } from 'vitest'
import { generateSeedData } from './seed'

// generateSeedData only reads id, category, start and estimatedMinutes off a scenario. `category`
// is load-bearing: without it the `diplomat` rule can never fire, in the seed or in this file.
const stub = (id: string, category: Competency) =>
  ({ id, category, start: 'n1', estimatedMinutes: 5 }) as unknown as Scenario
const LIST = [stub('medical-faint-01', 'medical'), stub('conflict-drunk-01', 'conflict')]
const NOW = Date.UTC(2026, 8, 27)
const run = () => generateSeedData(LIST, 'scrypt$c2FsdA==$aGFzaA==', NOW)

// Everything except the uuids, which are random by design.
const stable = (d: ReturnType<typeof run>) => ({
  users: d.users.map(({ id, ...u }) => u),
  sessions: d.sessions.map(({ userId, ...s }) => s),
  unlocks: d.unlocks.map(({ userId, ...u }) => u),
})

test('two runs generate the same crew, sessions and scores', () => {
  expect(stable(run())).toEqual(stable(run()))
})

test('one demo user, 35 colleagues, no duplicate emails', () => {
  const { users } = run()
  expect(users).toHaveLength(36)
  expect(users[0].email).toBe('demo@provodnik400.ru')
  expect(new Set(users.map((u) => u.email)).size).toBe(36)
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
  expect(empty.users).toHaveLength(36)
  expect(empty.sessions).toEqual([])
  expect(empty.unlocks).toEqual([])
})

test('every unlock names a known code and a user that exists', () => {
  const { users, unlocks } = run()
  const ids = new Set(users.map((u) => u.id))
  expect(unlocks.length).toBeGreaterThan(0)
  for (const u of unlocks) {
    expect(ACHIEVEMENT_CODES).toContain(u.code)
    expect(ids.has(u.userId)).toBe(true)
  }
  // One row per (user, code): the composite primary key would reject a duplicate anyway.
  const keys = unlocks.map((u) => `${u.userId}|${u.code}`)
  expect(new Set(keys).size).toBe(keys.length)
})

// A demo needs badges left to win. first-aid and flawless are never seeded, so a clean
// medical run always unlocks at least two fresh ones.
test('the demo user keeps at least two badges locked', () => {
  const { users, unlocks } = run()
  const demo = users[0]
  expect(demo.email).toBe('demo@provodnik400.ru')
  const earned = new Set(unlocks.filter((u) => u.userId === demo.id).map((u) => u.code))
  const locked = ACHIEVEMENT_CODES.filter((code) => !earned.has(code))
  expect(locked.length).toBeGreaterThanOrEqual(2)
  expect(locked).toContain('first-aid')
  expect(locked).toContain('flawless')
})

test('everyone has a crew, and the demo user has crewmates to rank against', () => {
  const { users } = run()
  for (const u of users) expect(u.crew).toMatch(/^Бригада № \d+$/)
  const demo = users[0]
  const mates = users.filter((u) => u.depot === demo.depot && u.crew === demo.crew)
  expect(mates.length).toBeGreaterThanOrEqual(5)
})

test('every crew is one начальник поезда and eight проводников', () => {
  const byCrew = new Map<string, string[]>()
  for (const u of run().users) {
    const key = `${u.depot}|${u.crew}`
    byCrew.set(key, [...(byCrew.get(key) ?? []), u.position ?? ''])
  }
  expect(byCrew.size).toBe(4)
  for (const positions of byCrew.values()) {
    expect(positions.filter((p) => p === 'Начальник поезда')).toHaveLength(1)
    expect(positions.filter((p) => p === 'Проводник')).toHaveLength(8)
  }
})
