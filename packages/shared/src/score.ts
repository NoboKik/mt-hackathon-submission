import type { Competency, Outcome } from './schema'

// NOTE: tune after playtests
export const OUTCOME_MULTIPLIER = { success: 1.0, partial: 0.6, fail: 0.2 } as const
export const TIME_BONUS_PER_FAST_DECISION = 5

export type Decision = { timerSec: number; elapsedMs: number; timedOut: boolean }

export function score({
  outcome,
  decisions,
  competencyDeltas,
}: {
  outcome: Outcome
  decisions: Decision[]
  competencyDeltas: Partial<Record<Competency, number>>
}) {
  // Rounded so tuned multipliers stay integers: 100 * 0.55 is 55.00000000000001.
  const base = Math.round(100 * OUTCOME_MULTIPLIER[outcome])
  // Fast = answered within the first half of the timer. elapsedMs is client-reported, so
  // negative or NaN timings earn nothing.
  const fast = decisions.filter(
    (d) =>
      !d.timedOut &&
      Number.isFinite(d.elapsedMs) &&
      d.elapsedMs >= 0 &&
      d.elapsedMs <= d.timerSec * 500,
  ).length
  const timeBonus = fast * TIME_BONUS_PER_FAST_DECISION
  const competencyBonus = Object.values(competencyDeltas).reduce<number>((s, v) => s + (v ?? 0), 0)
  return {
    base,
    timeBonus,
    competencyBonus,
    total: Math.max(0, base + timeBonus + competencyBonus),
  }
}
