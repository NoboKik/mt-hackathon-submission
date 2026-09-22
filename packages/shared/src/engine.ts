// The pure game engine: no database, no `Date`, no I/O — the route handlers own all of that,
// which is what makes every rule here testable. The server is the only place meters and
// outcomes are computed; the client renders what these functions hand back.

import type { Choice, Effects, Node, Outcome, Scenario } from './schema'

export type Meters = { loyalty: number; safety: number }
export type MeterKey = keyof Meters
export type ClientChoice = { id: string; text: string }

/** What the player may see: never `next`, `onTimeout`, choice effects, competencies or a debrief. */
export type ClientNode =
  | {
      type: 'choice'
      id: string
      speaker: string
      text: string
      image?: string
      timerSec: number
      choices: ClientChoice[]
    }
  | { type: 'consequence'; id: string; text: string; effects: Effects }
  | { type: 'end'; id: string; outcome: Outcome; text: string; failedMeter?: MeterKey }

export type Debrief = Extract<Node, { type: 'end' }>['debrief']

/** A node or choice id the scenario doesn't have — a stale or forged client. Routes answer 400. */
export class EngineError extends Error {}

/** A threshold breach ends a scenario that has no end node for it. */
export const THRESHOLD_END_ID = '__threshold'

// NOTE: 2 s of slack for render and network lag on a real choice. A slow connection can
// still cost an honest player the time bonus; a server-issued node token would fix it properly.
// The countdown starts when the server writes the node, so the client must ask for a node only
// once it is ready to show it: an intro card or a slow toast queue eats into the timer.
export const TIMER_GRACE_MS = 2000

export const clamp = (m: number) => Math.max(0, Math.min(100, m))

function nodeAt(scenario: Scenario, id: string): Node {
  // hasOwn, not a bare lookup: a node id like "constructor" would otherwise hit the prototype.
  const node = Object.hasOwn(scenario.nodes, id) ? scenario.nodes[id] : undefined
  if (!node) throw new EngineError(`unknown node "${id}"`)
  return node
}

const applied = (meters: Meters, effects: Effects): Meters => ({
  loyalty: clamp(meters.loyalty + effects.loyalty),
  safety: clamp(meters.safety + effects.safety),
})

// Safety wins when both meters breach at once: it's the lesson worth teaching.
const breached = (scenario: Scenario, meters: Meters): MeterKey | null =>
  meters.safety < scenario.failThresholds.safety
    ? 'safety'
    : meters.loyalty < scenario.failThresholds.loyalty
      ? 'loyalty'
      : null

// `text` stays empty: the route fills it from ru.engine.thresholdFail[failedMeter].
const thresholdEnd = (failedMeter: MeterKey): ClientNode => ({
  type: 'end',
  id: THRESHOLD_END_ID,
  outcome: 'fail',
  text: '',
  failedMeter,
})

/** Seeded Fisher–Yates over mulberry32, keyed by seed + node id: stable across a session, varies between sessions. */
export function shuffled<T>(items: T[], seed: number, key: string): T[] {
  let a = seed
  for (const ch of key) a = Math.imul(a ^ ch.charCodeAt(0), 0x9e3779b1)
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out
}

/** `seed` shuffles the choice order so "always press 1" stops working; omit it for authored order. */
export function toClientNode(scenario: Scenario, id: string, seed?: number): ClientNode {
  const node = nodeAt(scenario, id)
  switch (node.type) {
    case 'choice':
      return {
        type: 'choice',
        id,
        speaker: node.speaker,
        text: node.text,
        // Spread, not `image: node.image`: an absent image must not become a key at all.
        ...(node.image ? { image: node.image } : {}),
        timerSec: node.timerSec,
        choices: (seed === undefined ? node.choices : shuffled(node.choices, seed, id)).map(
          (c) => ({ id: c.id, text: c.text }),
        ),
      }
    case 'consequence':
      return { type: 'consequence', id, text: node.text, effects: node.effects }
    case 'end':
      return { type: 'end', id, outcome: node.outcome, text: node.text }
  }
}

/** `steps` are the consequence nodes walked through, in order, for the client to show as toasts. */
export type EnterResult = { steps: ClientNode[]; node: ClientNode; meters: Meters }

export function enter(
  scenario: Scenario,
  nodeId: string,
  meters: Meters,
  seed?: number,
): EnterResult {
  const steps: ClientNode[] = []
  let current = nodeId
  let now = meters
  // Unbounded on purpose: the content validator rejects cycles, so every chain reaches a
  // choice or an end.
  for (;;) {
    const node = nodeAt(scenario, current)
    if (node.type !== 'consequence') {
      return { steps, node: toClientNode(scenario, current, seed), meters: now }
    }
    // Push before applying: the player must see the consequence that broke the meter.
    steps.push(toClientNode(scenario, current))
    now = applied(now, node.effects)
    const failed = breached(scenario, now)
    if (failed) return { steps, node: thresholdEnd(failed), meters: now }
    current = node.next
  }
}

/** `choice` is absent on a timeout; routes read `choice.competencies` to bank the deltas. */
export type ChooseResult = EnterResult & { choice?: Choice }

/** `choiceId` is a choice id, or 'timeout'. */
export function choose(
  scenario: Scenario,
  nodeId: string,
  choiceId: string,
  meters: Meters,
  seed?: number,
): ChooseResult {
  const node = nodeAt(scenario, nodeId)
  if (node.type !== 'choice') throw new EngineError(`node "${nodeId}" is not a choice node`)
  // A timeout is a real branch, and it costs nothing by itself: onTimeout carries the damage.
  if (choiceId === 'timeout') return enter(scenario, node.onTimeout, meters, seed)

  const choice = node.choices.find((c) => c.id === choiceId)
  if (!choice) throw new EngineError(`node "${nodeId}" has no choice "${choiceId}"`)
  const next = applied(meters, choice.effects)
  const failed = breached(scenario, next)
  if (failed) return { steps: [], node: thresholdEnd(failed), meters: next, choice }
  return { ...enter(scenario, choice.next, next, seed), choice }
}

export function debriefFor(scenario: Scenario, endId: string): Debrief {
  if (endId === THRESHOLD_END_ID) {
    // The synthetic end has no debrief of its own, and the expert path is the same for every
    // ending anyway, so borrow the success one.
    const success = Object.values(scenario.nodes)
      .filter((n) => n.type === 'end')
      .find((n) => n.outcome === 'success')
    if (!success) throw new EngineError(`scenario "${scenario.id}" has no success ending`)
    return success.debrief
  }
  const node = nodeAt(scenario, endId)
  if (node.type !== 'end') throw new EngineError(`node "${endId}" is not an end node`)
  return node.debrief
}
