import type { IntegrationEmployee, Scenario } from '@p400/shared'
import { expect, test } from 'vitest'
import { type AnalyticsRun, crewAnalytics } from './analytics'

const MSK = 'Депо Москва-Октябрьская'
const SPB = 'Депо Санкт-Петербург-Московский'

// u3 shares u1's crew name in another depot: the crew filter must not pick them up.
const users = [
  { id: 'u1', depot: MSK, crew: 'Бригада № 3' },
  { id: 'u2', depot: MSK, crew: 'Бригада № 7' },
  { id: 'u3', depot: SPB, crew: 'Бригада № 3' },
]

const scenario = {
  nodes: {
    n1: { type: 'choice', text: 'Пассажир жалуется на соседа' },
    n2: { type: 'choice', text: 'Сосед повышает голос' },
  },
} as unknown as Scenario
const scenarios = new Map([['s1', { title: 'Конфликт из-за места', json: scenario }]])

const run = (userId: string, outcome: AnalyticsRun['outcome'], path: string[][], medical = 0) => ({
  userId,
  scenarioId: 's1',
  outcome,
  competencyDeltas: { conflict: 2, medical },
  path: path.map(([nodeId, choiceId]) => ({ nodeId, choiceId })),
})

const runs: AnalyticsRun[] = [
  run('u1', 'fail', [
    ['n1', 'a'],
    ['n2', 'timeout'],
  ]),
  run('u1', 'success', [
    ['n1', 'a'],
    ['n2', 'b'],
  ]),
  run('u2', 'fail', [['n1', 'timeout']], 2),
  run('u3', 'fail', [['n2', 'timeout']], 2),
]

test('company-wide: per-conductor averages, the weakest axis, problem nodes ranked', () => {
  const r = crewAnalytics(users, runs, scenarios, null, null)
  expect(r.conductors).toBe(3)
  expect(r.runs).toBe(4)
  expect(r.competencies.find((c) => c.key === 'conflict')?.avg).toBe(2.7)
  // Everything at 0 but conflict and medical; the first zero in COMPETENCIES order wins.
  expect(r.weakest).toBe('safety')
  expect(r.units).toEqual([
    { depot: MSK, crews: ['Бригада № 3', 'Бригада № 7'] },
    { depot: SPB, crews: ['Бригада № 3'] },
  ])
  // n2: 2 timeouts + 2 fails over 3 visits; n1: 1 timeout + 1 fail over 3.
  expect(r.nodes.map((n) => [n.nodeId, n.timeouts, n.fails, n.visits])).toEqual([
    ['n2', 2, 2, 3],
    ['n1', 1, 1, 3],
  ])
  expect(r.nodes[0].text).toBe('Сосед повышает голос')
})

test('crew filter needs the depot too: same crew name elsewhere stays out', () => {
  const hr = (id: string, percent: number) =>
    ({
      id,
      name: id,
      crew: '',
      readiness: { ready: false, percent, criteria: [] },
    }) as unknown as IntegrationEmployee
  const r = crewAnalytics(users, runs, scenarios, MSK, 'Бригада № 3', [hr('u1', 40), hr('u3', 90)])
  expect(r.readiness).toEqual([{ id: 'u1', name: 'u1', crew: '', ready: false, percent: 40 }])
  expect(r.conductors).toBe(1)
  expect(r.runs).toBe(2)
  expect(r.nodes.map((n) => n.nodeId)).toEqual(['n2'])
  // The pickers always offer everything.
  expect(r.units).toHaveLength(2)
})

test('nobody played: no weakest axis, no nodes', () => {
  const r = crewAnalytics(users, [], scenarios, SPB, null)
  expect(r.weakest).toBeNull()
  expect(r.nodes).toEqual([])
  expect(r.competencies.every((c) => c.avg === 0)).toBe(true)
})
