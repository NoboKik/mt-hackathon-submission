import { expect, test } from 'vitest'
import { bearerOk, integrationProgress } from './integration'

const users = [
  { id: 'u1', name: 'Анна Смирнова', depot: 'Депо Москва-Октябрьская', crew: 'Бригада № 3' },
  { id: 'u2', name: 'Олег Ким', depot: 'Депо Москва-Октябрьская', crew: '' },
]
const run = (scenarioId: string, score: number, day: number, medical = 0) => ({
  userId: 'u1',
  scenarioId,
  category: scenarioId === 's2' ? ('service' as const) : ('conflict' as const),
  score,
  competencyDeltas: { conflict: 2, medical },
  finishedAt: new Date(Date.UTC(2026, 8, day)),
})

test('XP is the best score per scenario, competencies floor at 0, idle users still listed', () => {
  const res = integrationProgress(
    users,
    [run('s1', 120, 20, -5), run('s1', 200, 22), run('s2', 150, 21)],
    [{ userId: 'u1', code: 'first-run' }],
    new Date(Date.UTC(2026, 8, 25)),
  )
  const [anna, oleg] = res.employees
  expect(anna).toMatchObject({
    xp: 350,
    rank: 'conductor',
    runs: 3,
    badges: ['first-run'],
    lastRunAt: '2026-09-22T00:00:00.000Z',
    competencies: { conflict: 6, medical: 0, safety: 0 },
  })
  // conflict 6 ≥ 2 and a 150 in the service scenario; service and communication points are 0.
  expect(anna.readiness.criteria.filter((c) => !c.met).map((c) => c.key)).toEqual([
    'service',
    'communication',
  ])
  expect(anna.readiness.ready).toBe(false)
  expect(oleg).toMatchObject({ xp: 0, rank: 'trainee', runs: 0, badges: [], lastRunAt: null })
  expect(JSON.stringify(res)).not.toContain('@')
})

test('bearerOk needs the exact token behind "Bearer "', () => {
  expect(bearerOk('Bearer s3cret', 's3cret')).toBe(true)
  expect(bearerOk('Bearer s3cre', 's3cret')).toBe(false)
  expect(bearerOk('s3cret', 's3cret')).toBe(false)
  expect(bearerOk(null, 's3cret')).toBe(false)
})
