import { expect, test } from 'vitest'
import { score } from './score'

const none = { decisions: [], competencyDeltas: {} }

test.each([
  ['success', 100],
  ['partial', 60],
  ['fail', 20],
] as const)('%s base is %i', (outcome, base) => {
  expect(score({ outcome, ...none })).toEqual({
    base,
    timeBonus: 0,
    competencyBonus: 0,
    total: base,
  })
})

test('fast means within the first half of the timer, inclusive', () => {
  const at = (elapsedMs: number) =>
    score({
      outcome: 'success',
      decisions: [{ timerSec: 15, elapsedMs, timedOut: false }],
      competencyDeltas: {},
    }).timeBonus
  expect(at(7500)).toBe(5)
  expect(at(7501)).toBe(0)
  expect(at(0)).toBe(5)
})

test('a timed-out decision earns no bonus, however fast', () => {
  const r = score({
    outcome: 'success',
    decisions: [{ timerSec: 15, elapsedMs: 100, timedOut: true }],
    competencyDeltas: {},
  })
  expect(r.timeBonus).toBe(0)
})

test('negative or NaN client timings earn no bonus', () => {
  const r = score({
    outcome: 'success',
    decisions: [
      { timerSec: 15, elapsedMs: -1, timedOut: false },
      { timerSec: 15, elapsedMs: Number.NaN, timedOut: false },
      { timerSec: 15, elapsedMs: Number.NEGATIVE_INFINITY, timedOut: false },
    ],
    competencyDeltas: {},
  })
  expect(r.timeBonus).toBe(0)
})

test('bonus counts every fast decision', () => {
  const fast = { timerSec: 10, elapsedMs: 1000, timedOut: false }
  const r = score({ outcome: 'partial', decisions: [fast, fast, fast], competencyDeltas: {} })
  expect(r).toEqual({ base: 60, timeBonus: 15, competencyBonus: 0, total: 75 })
})

test('competency deltas sum, including negatives', () => {
  const r = score({
    outcome: 'success',
    decisions: [],
    competencyDeltas: { medical: 3, conflict: -5 },
  })
  expect(r.competencyBonus).toBe(-2)
  expect(r.total).toBe(98)
})

test('undefined competency deltas count as 0', () => {
  const r = score({
    outcome: 'success',
    decisions: [],
    competencyDeltas: { medical: undefined, service: 2 },
  })
  expect(r.competencyBonus).toBe(2)
})

test('total floors at 0', () => {
  const r = score({ outcome: 'fail', decisions: [], competencyDeltas: { medical: -30 } })
  expect(r).toEqual({ base: 20, timeBonus: 0, competencyBonus: -30, total: 0 })
})
