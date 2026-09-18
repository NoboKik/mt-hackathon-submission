import { medicalFaint01 } from '@p400/shared/fixtures'
import { expect, test } from 'vitest'
import type { PathStep } from '@/db/schema'
import { finishValues } from './api'

// n1's timer is 15 s, so score() calls a decision fast up to 7500 ms.
const step = (over: Partial<PathStep> = {}): PathStep => ({
  nodeId: 'n1',
  choiceId: 'c1',
  clientElapsedMs: 3000,
  serverElapsedMs: 3200,
  ...over,
})

const timeBonus = (path: PathStep[]) =>
  finishValues(medicalFaint01, 'success', path, {}).scoreBreakdown.timeBonus

test('an honest fast answer earns the time bonus', () => {
  expect(timeBonus([step()])).toBe(5)
})

test('a client claiming 0 ms is judged on the server clock, less the grace window', () => {
  expect(timeBonus([step({ clientElapsedMs: 0, serverElapsedMs: 14_000 })])).toBe(0)
  // The grace window is the only thing a late report gets for free: 9400 - 2000 is still fast.
  expect(timeBonus([step({ clientElapsedMs: 0, serverElapsedMs: 9_400 })])).toBe(5)
})

test('a timeout earns nothing, however fast the report claims to be', () => {
  expect(timeBonus([step({ choiceId: 'timeout', clientElapsedMs: 0, serverElapsedMs: 0 })])).toBe(0)
})
