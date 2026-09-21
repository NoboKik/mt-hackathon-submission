// Auto mode's pool of generated scenarios. Generation takes 20–60 s, so players are only ever
// served what is already here; this file refills it in the background.
import { generatedScenarios, insertGenerated } from '@/db/queries'
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
