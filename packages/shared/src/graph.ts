// The methodologist's branch view: a scenario turned into a node/edge list. Everything comes off
// the scenario JSON already in the database, so there is no table and no migration behind this.
//
// Unlike toClientNode this payload deliberately exposes effects, competencies and every branch —
// that is the whole point of a trainer's view, and it is why the endpoint is not player-safe.

import type { Meters } from './engine'
import type { Competency, Condition, Effects, Node, Outcome, Scenario } from './schema'

/** Characters a label keeps before it is cut. Graph boxes are small; the file holds the script. */
export const GRAPH_LABEL_MAX = 80

// Break on a word boundary, but only when there is one worth breaking on: past 60 % of the budget.
// Otherwise a long unbroken string would collapse to almost nothing.
function truncate(text: string, max = GRAPH_LABEL_MAX): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  const kept = space > max * 0.6 ? cut.slice(0, space) : cut
  return `${kept.trimEnd()}…`
}

export type GraphNode = {
  id: string
  type: Node['type']
  /** The entry point. Colour it differently; there is exactly one. */
  isStart: boolean
  text: string
  /** choice nodes only. */
  speaker?: string
  timerSec?: number
  /** consequence nodes only: the meter change walking through applies. */
  effects?: Effects
  /** end nodes only. */
  outcome?: Outcome
}

/**
 * Edge ids are kind-prefixed. Without the prefix `n1:timeout` would collide with a choice whose
 * id is literally `timeout`, and the schema permits that — choice ids are only checked for
 * uniqueness, not for a reserved-word list.
 */
export type GraphEdge = {
  id: string
  source: string
  target: string
  /** The choice's text, truncated. Null on timeout and consequence edges — nothing to quote. */
  label: string | null
  /** Render it dashed: this is what happens when the player runs out of time. */
  isTimeout: boolean
  /** The choice's own meter deltas; zero on timeout and consequence edges, whose node carries them. */
  effects: Effects
  competencies: Partial<Record<Competency, number>>
  /** v1.1 branch edges only: the condition to label it with. */
  condition?: Condition
  /** The `next` of a consequence node that has branches: taken when none of them holds. */
  isFallback?: true
}

export type ScenarioGraph = {
  id: string
  title: string
  category: Competency
  difficulty: number
  intro: string
  start: string
  initial: Meters
  failThresholds: Meters
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const NO_EFFECTS: Effects = { loyalty: 0, safety: 0 }

export function scenarioGraph(scenario: Scenario): ScenarioGraph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  // Whatever order the object hands over — the file's for a scenario read off disk, jsonb's own
  // key order for one read out of Postgres. `isStart` and the edges carry the structure, so a
  // layout engine does not care. THRESHOLD_END_ID never appears: it is a runtime-only synthetic
  // ending with no node behind it.
  for (const [id, node] of Object.entries(scenario.nodes)) {
    const common = {
      id,
      type: node.type,
      isStart: id === scenario.start,
      text: truncate(node.text),
    }
    switch (node.type) {
      case 'choice':
        nodes.push({ ...common, speaker: node.speaker, timerSec: node.timerSec })
        for (const choice of node.choices) {
          edges.push({
            id: `${id}:c:${choice.id}`,
            source: id,
            target: choice.next,
            label: truncate(choice.text),
            isTimeout: false,
            effects: choice.effects,
            competencies: choice.competencies,
          })
        }
        edges.push({
          id: `${id}:timeout`,
          source: id,
          target: node.onTimeout,
          label: null,
          isTimeout: true,
          effects: NO_EFFECTS,
          competencies: {},
        })
        break
      case 'consequence':
        nodes.push({ ...common, effects: node.effects })
        node.branches?.forEach((b, i) => {
          edges.push({
            id: `${id}:b:${i}`,
            source: id,
            target: b.next,
            label: null,
            isTimeout: false,
            effects: NO_EFFECTS,
            competencies: {},
            condition: b.if,
          })
        })
        edges.push({
          id: `${id}:next`,
          source: id,
          target: node.next,
          label: null,
          isTimeout: false,
          effects: NO_EFFECTS,
          competencies: {},
          ...(node.branches ? { isFallback: true as const } : {}),
        })
        break
      case 'end':
        nodes.push({ ...common, outcome: node.outcome })
        break
    }
  }

  return {
    id: scenario.id,
    title: scenario.title,
    category: scenario.category,
    difficulty: scenario.difficulty,
    intro: scenario.intro,
    start: scenario.start,
    initial: scenario.initial,
    failThresholds: scenario.failThresholds,
    nodes,
    edges,
  }
}
