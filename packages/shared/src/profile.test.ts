import { expect, test } from 'vitest'
import {
  competencyLevel,
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
