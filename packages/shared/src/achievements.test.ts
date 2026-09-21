import { expect, test } from 'vitest'
import { medicalFaint01 } from './__fixtures__/medical-faint-01'
import {
  ACHIEVEMENT_CODES,
  type FinishedRow,
  HONOUR_STUDENT_SCORE,
  type LastRun,
  statsFor,
  unlockedCodes,
} from './achievements'
import type { Competency } from './schema'
import { score } from './score'

const AT = Date.UTC(2026, 8, 27, 12)
const HOUR = 60 * 60_000
// 8 scenarios, so `full-route` stays out of the way of every other case.
const CATALOGUE = 8

const row = (over: Partial<FinishedRow> = {}): FinishedRow => ({
  scenarioId: 'medical-faint-01',
  category: 'medical',
  outcome: 'partial',
  score: 60,
  loyalty: 60,
  safety: 60,
  finishedAt: AT,
  choiceIds: ['c1', 'c4', 'c7'],
  ...over,
})

const codes = (rows: FinishedRow[], last?: LastRun) =>
  unlockedCodes(statsFor(rows, CATALOGUE, last))

test('a fresh account unlocks nothing, and 0 of 0 scenarios is not a full route', () => {
  expect(codes([])).toEqual([])
  expect(unlockedCodes(statsFor([], 0))).toEqual([])
})

test('one finished run unlocks exactly first-run', () => {
  expect(codes([row()])).toEqual(['first-run'])
})

test('cool-head needs five timeout-free runs', () => {
  const five = Array.from({ length: 5 }, (_, i) => row({ finishedAt: AT + i * 3 * HOUR }))
  expect(codes(five)).toContain('cool-head')

  const withTimeout = [...five.slice(1), row({ choiceIds: ['c1', 'timeout'] })]
  expect(codes(withTimeout)).not.toContain('cool-head')
})

test('seeded rows have no path, so they are not timeout-free', () => {
  const seeded = Array.from({ length: 6 }, (_, i) =>
    row({ choiceIds: [], finishedAt: AT + i * 3 * HOUR }),
  )
  expect(codes(seeded)).not.toContain('cool-head')
  expect(codes(seeded)).toContain('first-run')
})

test('night-shift is three finishes inside one hour', () => {
  const at = (mins: number) => row({ finishedAt: AT + mins * 60_000 })
  expect(codes([at(0), at(25), at(59)])).toContain('night-shift')
  expect(codes([at(0), at(25), at(61)])).not.toContain('night-shift')
})

test('steady is three distinct days', () => {
  const day = (n: number) => row({ finishedAt: AT + n * 86_400_000 })
  expect(codes([day(0), day(1), day(2)])).toContain('steady')
  expect(codes([day(0), day(0), day(1)])).not.toContain('steady')
})

test('the last run decides first-aid, diplomat and flawless', () => {
  const last = (over: Partial<LastRun>): LastRun => ({ ...row(), expertPath: false, ...over })

  const medic = last({ outcome: 'success' })
  expect(codes([medic], medic)).toContain('first-aid')
  const timedOut = last({ outcome: 'success', choiceIds: ['c1', 'timeout'] })
  expect(codes([timedOut], timedOut)).not.toContain('first-aid')

  const conflict = last({ category: 'conflict', outcome: 'success', loyalty: 80, safety: 80 })
  expect(codes([conflict], conflict)).toContain('diplomat')
  expect(codes([{ ...conflict, safety: 79 }], { ...conflict, safety: 79 })).not.toContain(
    'diplomat',
  )

  expect(codes([medic], { ...medic, expertPath: true })).toContain('flawless')
  expect(codes([medic], medic)).not.toContain('flawless')
})

test('balance needs a non-fail run with both meters at 80', () => {
  expect(codes([row({ loyalty: 80, safety: 95 })])).toContain('balance')
  expect(codes([row({ loyalty: 80, safety: 79 })])).not.toContain('balance')
  expect(codes([row({ outcome: 'fail', loyalty: 90, safety: 90 })])).not.toContain('balance')
})

test('full-route needs every scenario in the catalogue finished', () => {
  const all = Array.from({ length: CATALOGUE }, (_, i) => row({ scenarioId: `s-${i}` }))
  expect(codes(all)).toContain('full-route')
  expect(codes(all.slice(1))).not.toContain('full-route')
})

test('auto-mode runs never stand in for a missing curated scenario', () => {
  const all = Array.from({ length: CATALOGUE }, (_, i) => row({ scenarioId: `s-${i}` }))
  const auto = row({ scenarioId: 'auto-medical-0a1b2c3d', generated: true })
  expect(codes([...all.slice(1), auto])).not.toContain('full-route')
  expect(codes([auto])).toContain('first-run')
})

// The threshold is load-bearing: above the real maximum it would ship a dead badge, and this is
// the one badge a perfect demo run visibly unlocks.
test('the expert run on the reference scenario scores 124 and clears honour-student', () => {
  const expert =
    medicalFaint01.nodes.end_good?.type === 'end'
      ? medicalFaint01.nodes.end_good.debrief.expertPath
      : []
  const competencyDeltas: Partial<Record<Competency, number>> = {}
  for (const node of Object.values(medicalFaint01.nodes)) {
    if (node.type !== 'choice') continue
    for (const c of node.choices) {
      if (!expert.includes(c.id)) continue
      for (const [key, delta] of Object.entries(c.competencies)) {
        const k = key as Competency
        competencyDeltas[k] = (competencyDeltas[k] ?? 0) + (delta ?? 0)
      }
    }
  }
  const total = score({
    outcome: 'success',
    // Every decision inside the first half of its timer: the best a player can do.
    decisions: expert.map(() => ({ timerSec: 10, elapsedMs: 0, timedOut: false })),
    competencyDeltas,
  }).total

  expect(expert).toEqual(['c1', 'c4', 'c7'])
  expect(total).toBe(124)
  expect(HONOUR_STUDENT_SCORE).toBeLessThanOrEqual(total)
  expect(codes([row({ score: total })])).toContain('honour-student')
  expect(codes([row({ score: HONOUR_STUDENT_SCORE - 1 })])).not.toContain('honour-student')
})

test('codes are unique, kebab-case, and there are at least eight', () => {
  expect(new Set(ACHIEVEMENT_CODES).size).toBe(ACHIEVEMENT_CODES.length)
  expect(ACHIEVEMENT_CODES.length).toBeGreaterThanOrEqual(8)
  for (const code of ACHIEVEMENT_CODES) expect(code).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
})
