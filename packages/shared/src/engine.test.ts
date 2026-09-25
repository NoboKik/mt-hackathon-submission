import { expect, test } from 'vitest'
import { medicalFaint01 as s } from './__fixtures__/medical-faint-01'
import {
  choose,
  clamp,
  debriefFor,
  debriefSteps,
  EngineError,
  enter,
  nextOf,
  shuffled,
  THRESHOLD_END_ID,
  toClientNode,
} from './engine'
import type { Scenario } from './schema'

test('toClientNode leaks no next, onTimeout, effects, competencies or debrief', () => {
  expect(toClientNode(s, 'n1')).toEqual({
    type: 'choice',
    id: 'n1',
    speaker: 'narrator',
    text: s.nodes.n1.text,
    image: 'cabin-business.jpg',
    timerSec: 15,
    choices: [
      { id: 'c1', text: s.nodes.n1.choices[0]?.text },
      { id: 'c2', text: s.nodes.n1.choices[1]?.text },
      { id: 'c3', text: s.nodes.n1.choices[2]?.text },
    ],
  })
  expect(toClientNode(s, 'n1_timeout')).toEqual({
    type: 'consequence',
    id: 'n1_timeout',
    text: s.nodes.n1_timeout.text,
    effects: { loyalty: -15, safety: -10 },
  })
  expect(toClientNode(s, 'end_good')).toEqual({
    type: 'end',
    id: 'end_good',
    outcome: 'success',
    text: s.nodes.end_good.text,
  })
  // toEqual counts an undefined value as absent, so assert the key set where that matters:
  // n2 has no image.
  expect(Object.keys(toClientNode(s, 'n2'))).toEqual([
    'type',
    'id',
    'speaker',
    'text',
    'timerSec',
    'choices',
  ])
})

test('enter walks a consequence chain and applies every effect in order', () => {
  const chained = structuredClone(s) as Scenario
  chained.nodes.n0 = {
    type: 'consequence',
    text: 'Вагон гудит, пассажиры оборачиваются.',
    effects: { loyalty: -5, safety: -5 },
    next: 'n1_timeout',
  }
  const r = enter(chained, 'n0', { loyalty: 70, safety: 70 })
  expect(r.steps.map((n) => n.id)).toEqual(['n0', 'n1_timeout'])
  expect(r.node).toMatchObject({ type: 'choice', id: 'n2' })
  expect(r.meters).toEqual({ loyalty: 50, safety: 55 })
})

test('meters clamp to 0 and 100', () => {
  // c3 gives +10 loyalty on top of 95, c5 takes 20 safety off 5.
  expect(choose(s, 'n1', 'c3', { loyalty: 95, safety: 70 }).meters).toEqual({
    loyalty: 100,
    safety: 60,
  })
  expect(choose(s, 'n2', 'c5', { loyalty: 70, safety: 5 }).meters).toEqual({
    loyalty: 75,
    safety: 0,
  })
  expect(clamp(-1)).toBe(0)
  expect(clamp(101)).toBe(100)
})

test('a choice that breaches a threshold ends the scenario', () => {
  const r = choose(s, 'n2', 'c5', { loyalty: 70, safety: 35 })
  expect(r.node).toEqual({
    type: 'end',
    id: THRESHOLD_END_ID,
    outcome: 'fail',
    text: '',
    failedMeter: 'safety',
  })
  expect(r.steps).toEqual([])
  expect(r.meters).toEqual({ loyalty: 75, safety: 15 })
  expect(r.choice?.id).toBe('c5')
  // The synthetic end has no debrief of its own: it borrows the success ending's.
  expect(debriefFor(s, r.node.id)).toBe(s.nodes.end_good.debrief)
})

test('a consequence that breaches a threshold stops the chain there', () => {
  // Timing out at n1 costs 15 loyalty, and this run enters with 30.
  const r = choose(s, 'n1', 'timeout', { loyalty: 30, safety: 70 })
  expect(r.steps.map((n) => n.id)).toEqual(['n1_timeout'])
  expect(r.node).toMatchObject({ id: THRESHOLD_END_ID, outcome: 'fail', failedMeter: 'loyalty' })
  expect(r.meters).toEqual({ loyalty: 15, safety: 60 })
})

test('when both meters breach, the failure is reported as safety', () => {
  const r = choose(s, 'n3', 'c9', { loyalty: 22, safety: 30 })
  expect(r.meters).toEqual({ loyalty: 17, safety: 15 })
  expect(r.node).toMatchObject({ id: THRESHOLD_END_ID, failedMeter: 'safety' })
})

test('a timeout takes onTimeout and applies no choice effects', () => {
  const r = choose(s, 'n1', 'timeout', { loyalty: 70, safety: 70 })
  expect(r.choice).toBeUndefined()
  expect(r.steps.map((n) => n.id)).toEqual(['n1_timeout'])
  expect(r.node).toMatchObject({ type: 'choice', id: 'n2' })
  // Only n1_timeout's own effects: -15 / -10.
  expect(r.meters).toEqual({ loyalty: 55, safety: 60 })
})

test('an unknown node or choice id throws EngineError', () => {
  const m = { loyalty: 70, safety: 70 }
  expect(() => choose(s, 'n1', 'c4', m)).toThrow(EngineError) // c4 is n2's choice
  expect(() => choose(s, 'n1', 'нет такого', m)).toThrow(EngineError)
  expect(() => choose(s, 'n1_timeout', 'c1', m)).toThrow(EngineError)
  expect(() => toClientNode(s, 'n404')).toThrow(EngineError)
})

test('the expert path c1 → c4 → c7 reaches the success ending', () => {
  const start = enter(s, s.start, s.initial)
  expect(start).toEqual({
    steps: [],
    node: toClientNode(s, 'n1'),
    meters: { loyalty: 70, safety: 70 },
  })

  const first = choose(s, 'n1', 'c1', start.meters)
  expect(first.node.id).toBe('n2')
  const second = choose(s, 'n2', 'c4', first.meters)
  expect(second.node.id).toBe('n3')
  const third = choose(s, 'n3', 'c7', second.meters)
  expect(third.node).toEqual(toClientNode(s, 'end_good'))
  expect(third.meters).toEqual({ loyalty: 85, safety: 100 })
  expect(third.choice?.competencies).toEqual({ communication: 2, safety: 1 })
  expect(debriefFor(s, third.node.id).expertPath).toEqual(['c1', 'c4', 'c7'])
})

test('shuffled is a stable permutation that varies by seed', () => {
  const xs = [1, 2, 3, 4]
  expect(shuffled(xs, 7, 'n')).toEqual(shuffled(xs, 7, 'n'))
  expect([...shuffled(xs, 7, 'n')].sort()).toEqual(xs)
  const orders = new Set(Array.from({ length: 50 }, (_, s) => shuffled(xs, s, 'n').join()))
  expect(orders.size).toBeGreaterThan(5)
})

test('debriefSteps replays the path: per-step deltas, consequences and the expert alternative', () => {
  const steps = debriefSteps(
    s,
    [
      { nodeId: 'n1', choiceId: 'timeout' },
      { nodeId: 'n2', choiceId: 'c4' },
      { nodeId: 'n3', choiceId: 'c8' },
    ],
    ['c1', 'c4', 'c7'],
  )
  expect(steps.map((x) => x.effects)).toEqual([
    { loyalty: -15, safety: -10 },
    { loyalty: 5, safety: 10 },
    { loyalty: -25, safety: 5 }, // c8 plus the n3_loud consequence
  ])
  const [timeout, expert, off] = steps
  expect(timeout).toMatchObject({
    choiceText: null,
    competencies: {},
    consequenceText: s.nodes.n1_timeout.text,
    onExpertPath: false,
    expertChoice: { id: 'c1' },
  })
  expect(expert).toMatchObject({ onExpertPath: true, consequenceText: null })
  expect(off).toMatchObject({
    onExpertPath: false,
    competencies: { communication: 1 },
    expertChoice: { id: 'c7', text: s.nodes.n3.choices[0]?.text },
  })
  expect(() => debriefSteps(s, [{ nodeId: 'n1', choiceId: 'gone' }], [])).toThrow(EngineError)
})

// v1.1: c1 → n1b, which sends a safe cabin straight to n3; c4 → n2b, which ends early if c3
// was picked at n1.
function branching(): Scenario {
  const b = structuredClone(s) as Scenario
  b.nodes.n1b = {
    type: 'consequence',
    text: 'Пассажир приходит в себя.',
    effects: { loyalty: 0, safety: 0 },
    branches: [{ if: { safety: { gte: 80 } }, next: 'n3' }],
    next: 'n2',
  }
  b.nodes.n2b = {
    type: 'consequence',
    text: 'Начальник поезда уже в курсе.',
    effects: { loyalty: 0, safety: 0 },
    branches: [{ if: { chose: 'c3' }, next: 'end_partial' }],
    next: 'n3',
  }
  Object.assign(b.nodes.n1?.type === 'choice' ? (b.nodes.n1.choices[0] ?? {}) : {}, {
    next: 'n1b',
  })
  Object.assign(b.nodes.n2?.type === 'choice' ? (b.nodes.n2.choices[0] ?? {}) : {}, {
    next: 'n2b',
  })
  return b
}

test('nextOf: first matching branch wins, every key must hold, else next', () => {
  const node = {
    type: 'consequence' as const,
    text: 'т',
    effects: { loyalty: 0, safety: 0 },
    branches: [
      { if: { loyalty: { lt: 40 }, chose: 'c1' }, next: 'a' },
      { if: { loyalty: { gte: 40, lt: 60 } }, next: 'b' },
      { if: { safety: { lt: 50 } }, next: 'c' },
    ],
    next: 'z',
  }
  expect(nextOf(node, { loyalty: 30, safety: 30 }, ['c1'])).toBe('a')
  // Without c1 the first branch fails and loyalty 30 misses the second: the third catches it.
  expect(nextOf(node, { loyalty: 30, safety: 30 }, [])).toBe('c')
  // lt is exclusive, gte inclusive.
  expect(nextOf(node, { loyalty: 40, safety: 90 }, [])).toBe('b')
  expect(nextOf(node, { loyalty: 60, safety: 90 }, [])).toBe('z')
  expect(nextOf({ ...node, branches: undefined }, { loyalty: 0, safety: 0 }, ['c1'])).toBe('z')
})

test('enter routes on the meters after the node’s own effects', () => {
  const b = branching()
  // c1 adds 10 safety: 70 → 80 takes the branch, 65 → 75 falls back.
  expect(choose(b, 'n1', 'c1', { loyalty: 70, safety: 70 }).node).toMatchObject({ id: 'n3' })
  expect(choose(b, 'n1', 'c1', { loyalty: 70, safety: 65 }).node).toMatchObject({ id: 'n2' })
  const own = structuredClone(b)
  Object.assign(own.nodes.n1b ?? {}, { effects: { loyalty: 0, safety: -5 } })
  expect(choose(own, 'n1', 'c1', { loyalty: 70, safety: 70 }).node).toMatchObject({ id: 'n2' })
})

test('chose sees the run’s earlier choices, and the debrief replays the same branch', () => {
  const b = branching()
  const m = { loyalty: 70, safety: 70 }
  expect(choose(b, 'n2', 'c4', m, undefined, ['c3']).node).toMatchObject({ id: 'end_partial' })
  expect(choose(b, 'n2', 'c4', m, undefined, ['timeout']).node).toMatchObject({ id: 'n3' })

  const steps = debriefSteps(
    b,
    [
      { nodeId: 'n1', choiceId: 'c3' },
      { nodeId: 'n2', choiceId: 'c4' },
    ],
    ['c1', 'c4', 'c7'],
  )
  expect(steps.map((st) => st.consequenceText)).toEqual([null, 'Начальник поезда уже в курсе.'])
})
