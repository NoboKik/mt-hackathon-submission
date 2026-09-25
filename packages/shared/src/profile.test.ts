import { expect, test } from 'vitest'
import { medicalFaint01 } from './__fixtures__/medical-faint-01'
import type { ScenarioListItem } from './api'
import {
  competencyLevel,
  decisionsOf,
  levelForXp,
  type MeUser,
  type ProfileSession,
  profileFor,
} from './profile'
import { COMPETENCIES } from './schema'

const USER: MeUser = {
  displayName: 'Анна Соколова',
  position: 'Проводник',
  depot: 'Депо Москва-Октябрьская',
  avatar: null,
}

// A flat literal, not the scenario fixture: ProfileSession is exactly the row the route hands in.
const run = (over: Partial<ProfileSession> = {}): ProfileSession => ({
  id: '00000000-0000-4000-8000-000000000001',
  scenarioId: 'medical-faint-01',
  title: 'Пассажиру плохо в вагоне бизнес-класса',
  category: 'medical',
  difficulty: 2,
  outcome: 'success',
  score: 100,
  loyalty: 85,
  safety: 90,
  finishedAt: '2026-09-27T12:00:00.000Z',
  competencyDeltas: { medical: 4, communication: 2 },
  onExpertPath: true,
  decisions: [],
  ...over,
})

test.each([
  [0, 'trainee', 300],
  [299, 'trainee', 300],
  [300, 'conductor', 800],
  [799, 'conductor', 800],
  [800, 'senior', 1600],
  [1599, 'senior', 1600],
  [1600, 'mentor', null],
  [99_999, 'mentor', null],
] as const)('%i xp is %s, next at %s', (xp, key, nextLevelXp) => {
  expect(levelForXp(xp)).toMatchObject({ key, nextLevelXp })
})

test.each([
  [0, 'trainee'],
  [19, 'trainee'],
  [20, 'conductor'],
  [49, 'conductor'],
  [50, 'senior'],
  [99, 'senior'],
  [100, 'mentor'],
  [4000, 'mentor'],
] as const)('%i competency points is %s', (points, key) => {
  expect(competencyLevel(points)).toBe(key)
})

test('xp counts the best score per scenario once, however many replays there were', () => {
  const p = profileFor(
    USER,
    [
      run({ scenarioId: 'medical-faint-01', score: 60 }),
      run({ scenarioId: 'medical-faint-01', score: 124 }),
      run({ scenarioId: 'medical-faint-01', score: 20 }),
      run({ scenarioId: 'conflict-seat-01', score: 90 }),
    ],
    [],
  )
  expect(p.xp).toBe(214)
  expect(p.scenariosFinished).toBe(2)
  expect(p.attempts).toBe(4)
  expect(p.level).toBe('trainee')
  expect(p.nextLevelXp).toBe(300)
})

test('a fresh account still has five axes and every badge listed as locked', () => {
  const p = profileFor(USER, [], [])
  expect(p.competencies.map((c) => c.key)).toEqual([...COMPETENCIES])
  expect(p.competencies.every((c) => c.points === 0 && c.level === 'trainee')).toBe(true)
  expect(p.xp).toBe(0)
  expect(p.achievements.length).toBeGreaterThanOrEqual(8)
  expect(p.achievements.every((a) => a.earnedAt === null)).toBe(true)
})

test('competency points floor at 0 but the raw sum keeps the negatives', () => {
  const p = profileFor(
    USER,
    [
      run({ competencyDeltas: { medical: -4, service: 3 } }),
      run({ competencyDeltas: { medical: 1 } }),
    ],
    [],
  )
  const medical = p.competencies.find((c) => c.key === 'medical')
  expect(medical).toEqual({ key: 'medical', raw: -3, points: 0, level: 'trainee' })
  expect(p.competencies.find((c) => c.key === 'service')?.points).toBe(3)
})

test('recentSessions keeps the order it was given, newest first', () => {
  const newest = run({ id: 'a', finishedAt: '2026-09-27T12:00:00.000Z' })
  const oldest = run({ id: 'b', finishedAt: '2026-09-20T12:00:00.000Z' })
  const p = profileFor(USER, [newest, oldest], [])
  expect(p.recentSessions.map((s) => s.id)).toEqual(['a', 'b'])
})

test('earned badges carry their date, the rest stay null', () => {
  const p = profileFor(USER, [run()], [{ code: 'first-run', earnedAt: '2026-09-27T12:00:01.000Z' }])
  const byCode = new Map(p.achievements.map((a) => [a.code, a.earnedAt]))
  expect(byCode.get('first-run')).toBe('2026-09-27T12:00:01.000Z')
  expect(byCode.get('flawless')).toBeNull()
})

test('decisionsOf labels each step with its text and the expert choice at that node', () => {
  const d = decisionsOf(medicalFaint01, [
    { nodeId: 'n1', choiceId: 'c1' },
    { nodeId: 'n2', choiceId: 'timeout' },
    { nodeId: 'n_panic', choiceId: 'c11' },
    { nodeId: 'gone', choiceId: 'c99' },
  ])
  expect(d.map((x) => x.expertId)).toEqual(['c1', 'c4', null, null])
  expect(d[0]?.text).toEqual(expect.any(String))
  expect(d[1]?.text).toBeNull()
})

const item = (over: Partial<ScenarioListItem>): ScenarioListItem => ({
  id: 'x',
  title: 'X',
  category: 'medical',
  difficulty: 1,
  estimatedMinutes: 5,
  bestScore: null,
  attempts: 0,
  ...over,
})

test('growth zones: weakest axis, timeouts, off-expert share, top mistake, recommendation', () => {
  const wrong = { choiceId: 'c5', text: 'Поднять пассажира', expertId: 'c4' }
  const p = profileFor(
    USER,
    [
      run({ category: 'medical', decisions: [wrong, wrong, { ...wrong, choiceId: 'c4' }] }),
      run({
        scenarioId: 'safety-bag-01',
        title: 'Бесхозная сумка',
        category: 'safety',
        competencyDeltas: { safety: 5, conflict: 6, service: 3, communication: 3 },
        decisions: [
          { choiceId: 'timeout', text: null, expertId: 'c1' },
          { choiceId: 'c9', text: 'После ухода', expertId: null },
        ],
      }),
    ],
    [],
    [
      item({ id: 'played-medical', bestScore: 40 }),
      item({ id: 'fresh-medical', title: 'Аллергия' }),
      item({ id: 'safety', category: 'safety' }),
    ],
  )
  // medical 4, communication 2+3, safety 5, conflict 6, service 3; no service scenario to offer.
  expect(p.growth).toMatchObject({
    weakest: { key: 'service', points: 3, othersAverage: 5 },
    decisions: 5,
    timeoutPercent: 20,
    offExpert: [
      { category: 'safety', percent: 100, decisions: 1 },
      { category: 'medical', percent: 67, decisions: 3 },
    ],
    topMistake: {
      scenarioTitle: 'Пассажиру плохо в вагоне бизнес-класса',
      text: 'Поднять пассажира',
      count: 2,
    },
    recommended: null,
  })
})

test('the recommendation is an unplayed scenario in the weakest category first', () => {
  const p = profileFor(
    USER,
    [run({ competencyDeltas: { conflict: 9, safety: 9, service: 9, communication: 9 } })],
    [],
    [
      item({ id: 'played-medical', bestScore: 40 }),
      item({ id: 'fresh-medical', title: 'Аллергия' }),
      item({ id: 'safety', category: 'safety' }),
    ],
  )
  expect(p.growth?.weakest.key).toBe('medical')
  expect(p.growth?.recommended).toEqual({ id: 'fresh-medical', title: 'Аллергия' })
  expect(p.growth?.topMistake).toBeNull()
})

test('no runs, no growth zones; decisions never reach the wire', () => {
  expect(profileFor(USER, [], []).growth).toBeNull()
  expect(profileFor(USER, [run()], []).recentSessions[0]).not.toHaveProperty('decisions')
})
