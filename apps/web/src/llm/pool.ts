// Auto mode's pool of generated scenarios. Generation takes 20–60 s, so players are only ever
// served what is already here; this file refills it in the background.
import { generatedScenarios, insertGenerated, unplayedGenerated } from '@/db/queries'
import { LlmConfigError, llmConfig } from './client'
import { generateScenario, incidentKeyOf } from './generate'
import { pickSeed } from './seeds'

/** Generates `n` scenarios one after another, each steered away from everything already pooled. */
export async function topUp(n: number) {
  for (let i = 0; i < n; i++) {
    const pool = await generatedScenarios()
    const seed = pickSeed(pool.map((s) => incidentKeyOf(s.id)))
    const avoid = pool.filter((s) => s.category === seed.category).map((s) => s.title)
    await insertGenerated(await generateScenario(seed, avoid))
  }
  return n
}

/** How many unplayed scenarios auto mode keeps ready per player. */
export const POOL_TARGET = 3

// NOTE: single-process guard — fine for one container, a DB advisory lock if we ever run two.
let generating = false

/**
 * Fire-and-forget from POST /api/auto: tops this player's queue back up to POOL_TARGET. Needs a
 * long-lived Node process (ours is `node server.js`); a serverless host would kill it mid-way.
 */
export async function topUpPool(userId: string, served?: string) {
  if (generating) return
  generating = true
  try {
    llmConfig()
    // The scenario just handed out has no session yet, but it is not waiting in the queue either.
    const ready = (await unplayedGenerated(userId)).filter((id) => id !== served)
    const missing = POOL_TARGET - ready.length
    if (missing > 0) await topUp(missing)
  } catch (e) {
    // No key: nothing to do, and the route has already told the player.
    if (!(e instanceof LlmConfigError)) console.error('auto: pool top-up failed', e)
  } finally {
    generating = false
  }
}
