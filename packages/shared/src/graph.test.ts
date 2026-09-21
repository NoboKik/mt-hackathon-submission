import { expect, test } from 'vitest'
import { medicalFaint01 } from './__fixtures__/medical-faint-01'
import { THRESHOLD_END_ID } from './engine'
import { GRAPH_LABEL_MAX, scenarioGraph } from './graph'
import type { Scenario } from './schema'

// Small on purpose: one of each node type, so the whole-array assertions below stay readable.
const tiny = {
  id: 'tiny-01',
  title: 'Проверка',
  category: 'safety',
  difficulty: 1,
  estimatedMinutes: 3,
  intro: 'Вступление',
  start: 'n1',
  initial: { loyalty: 70, safety: 70 },
  failThresholds: { loyalty: 20, safety: 20 },
  nodes: {
    n1: {
      type: 'choice',
      speaker: 'narrator',
      text: 'Вопрос',
      timerSec: 12,
      onTimeout: 'n2',
      choices: [
        {
          id: 'c1',
          text: 'Ответ',
          effects: { loyalty: 5, safety: -5 },
          competencies: { safety: 1 },
          next: 'end_good',
        },
        {
          id: 'c2',
          text: 'Другой ответ',
          effects: { loyalty: -5, safety: 5 },
          competencies: {},
          next: 'n2',
        },
      ],
    },
    n2: {
      type: 'consequence',
      text: 'Последствие',
      effects: { loyalty: -10, safety: -5 },
      next: 'end_good',
    },
    end_good: {
      type: 'end',
      outcome: 'success',
      text: 'Финал',
      debrief: { expertPath: ['c1'], lesson: 'Урок', regulation: 'Регламент' },
    },
  },
} satisfies Scenario

test('nodes keep their file order, flag the start, and carry only their own type’s fields', () => {
  expect(scenarioGraph(tiny).nodes).toEqual([
    { id: 'n1', type: 'choice', isStart: true, text: 'Вопрос', speaker: 'narrator', timerSec: 12 },
    {
      id: 'n2',
      type: 'consequence',
      isStart: false,
      text: 'Последствие',
      effects: { loyalty: -10, safety: -5 },
    },
    { id: 'end_good', type: 'end', isStart: false, text: 'Финал', outcome: 'success' },
  ])
})

test('every branch is an edge, kind-prefixed, with the timeout one flagged', () => {
  expect(scenarioGraph(tiny).edges).toEqual([
    {
      id: 'n1:c:c1',
      source: 'n1',
      target: 'end_good',
      label: 'Ответ',
      isTimeout: false,
      effects: { loyalty: 5, safety: -5 },
      competencies: { safety: 1 },
    },
    {
      id: 'n1:c:c2',
      source: 'n1',
      target: 'n2',
      label: 'Другой ответ',
      isTimeout: false,
      effects: { loyalty: -5, safety: 5 },
      competencies: {},
    },
    {
      id: 'n1:timeout',
      source: 'n1',
      target: 'n2',
      label: null,
      isTimeout: true,
      effects: { loyalty: 0, safety: 0 },
      competencies: {},
    },
    // A consequence auto-advances: nothing to label, and its meter change is on the node.
    {
      id: 'n2:next',
      source: 'n2',
      target: 'end_good',
      label: null,
      isTimeout: false,
      effects: { loyalty: 0, safety: 0 },
      competencies: {},
    },
  ])
})

// n1's first choice, by reference, so a test can edit it in a clone.
function firstChoice(scenario: Scenario) {
  const n1 = scenario.nodes.n1
  const choice = n1?.type === 'choice' ? n1.choices[0] : undefined
  if (!choice) throw new Error('fixture changed')
  return choice
}

test('the prefix is what keeps a choice literally named "timeout" from colliding', () => {
  const clash = structuredClone(tiny) as Scenario
  firstChoice(clash).id = 'timeout'
  const ids = scenarioGraph(clash).edges.map((e) => e.id)
  expect(ids).toContain('n1:c:timeout')
  expect(ids).toContain('n1:timeout')
  expect(new Set(ids).size).toBe(ids.length)
})

test('the real scenario maps cleanly and never invents the synthetic threshold end', () => {
  const g = scenarioGraph(medicalFaint01)
  expect(g.id).toBe('medical-faint-01')
  expect(g.intro).toBe(medicalFaint01.intro)
  expect(g.nodes).toHaveLength(Object.keys(medicalFaint01.nodes).length)
  expect(g.nodes.filter((n) => n.isStart).map((n) => n.id)).toEqual(['n1'])
  expect(g.nodes.map((n) => n.id)).not.toContain(THRESHOLD_END_ID)
  // Every edge points at a node that exists — the validator's promise, restated in graph terms.
  const ids = new Set(g.nodes.map((n) => n.id))
  for (const edge of g.edges) expect(ids.has(edge.target)).toBe(true)
})

test('long labels break on a word boundary, space-less ones just get cut', () => {
  const long = 'слово '.repeat(40).trim()
  const label = (text: string) => {
    const s = structuredClone(tiny) as Scenario
    firstChoice(s).text = text
    return scenarioGraph(s).edges[0]?.label ?? ''
  }

  const wrapped = label(long)
  expect(wrapped.endsWith('…')).toBe(true)
  expect(wrapped.length).toBeLessThanOrEqual(GRAPH_LABEL_MAX + 1)
  expect(wrapped).toBe(`${'слово '.repeat(13).trim()}…`)

  const solid = label('я'.repeat(200))
  expect(solid).toBe(`${'я'.repeat(GRAPH_LABEL_MAX)}…`)

  // Short enough to fit is left exactly as written.
  expect(label('Коротко')).toBe('Коротко')
})
