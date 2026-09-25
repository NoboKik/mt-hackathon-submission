// The glue every route handler in app/api shares: the error body, the Russian text the engine
// deliberately leaves blank, and the columns written when a session ends. Server only.

import {
  type ClientNode,
  type Competency,
  debriefFor,
  EngineError,
  type Outcome,
  type Scenario,
  score,
  THRESHOLD_END_ID,
  TIMER_GRACE_MS,
} from '@p400/shared'
import { NextResponse } from 'next/server'
import type { ZodError } from 'zod'
import type { PathStep } from '@/db/schema'
import { ru } from '@/i18n/ru'

/** A machine-readable error code; the browser turns it into Russian text (lib/client.ts). */
export type ErrorCode = keyof typeof ru.errors

/** Error bodies are `{ error: code }`; a 400 adds the Zod issues, which are for the developer. */
export const fail = (status: number, error: ErrorCode, issues?: ZodError['issues']) =>
  NextResponse.json(issues ? { error, issues } : { error }, { status })

/** The engine has no copy, so it returns the threshold end with an empty text. Fill it here. */
export function endText(node: ClientNode): ClientNode {
  if (node.type !== 'end' || node.id !== THRESHOLD_END_ID || !node.failedMeter) return node
  return { ...node, text: ru.engine.thresholdFail[node.failedMeter] }
}

// max(), so a client can't claim 0 ms; minus the grace, so the round trip isn't charged to the
// player. NOTE: a slow connection still costs an honest player the time bonus.
const effectiveElapsedMs = (step: PathStep) =>
  Math.max(step.clientElapsedMs, step.serverElapsedMs - TIMER_GRACE_MS)

const timerSecOf = (scenario: Scenario, nodeId: string) => {
  const node = scenario.nodes[nodeId]
  return node?.type === 'choice' ? node.timerSec : 0
}

/**
 * The columns to set when a session ends. The score is recomputed from the stored path, never
 * from the request in hand: the client's timings only ever enter through the grace window.
 */
export function finishValues(
  scenario: Scenario,
  outcome: Outcome,
  path: PathStep[],
  competencyDeltas: Partial<Record<Competency, number>>,
) {
  const breakdown = score({
    outcome,
    decisions: path.map((step) => ({
      timerSec: timerSecOf(scenario, step.nodeId),
      elapsedMs: effectiveElapsedMs(step),
      timedOut: step.choiceId === 'timeout',
    })),
    competencyDeltas,
  })
  return { finishedAt: new Date(), outcome, score: breakdown.total, scoreBreakdown: breakdown }
}

/**
 * Did this run take every choice the expert path names — the `flawless` badge's condition.
 *
 * debriefFor throws for the synthetic threshold end when the scenario has no success ending, and
 * this is called after the session has already been advanced, so a bare call would 500 on a run
 * the player has in fact finished. No expert path to compare against is simply not flawless.
 */
export function expertPathTaken(scenario: Scenario, endId: string, path: PathStep[]) {
  try {
    const taken = new Set(path.map((step) => step.choiceId))
    return debriefFor(scenario, endId).expertPath.every((id) => taken.has(id))
  } catch (e) {
    if (e instanceof EngineError) return false
    throw e
  }
}
