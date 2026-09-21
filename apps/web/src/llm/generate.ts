// One LLM-drafted scenario: prompt → reply → the same validator curated content passes → retry
// with the errors. Nothing reaches the pool, or a file, unless validateScenario said ok.
import { randomBytes, randomUUID } from 'node:crypto'
import { type Scenario, validateScenario } from '@p400/shared'
import { type ChatMessage, complete } from './client'
import { extractJson } from './json'
import { promptMessages, REGULATIONS } from './prompt'
import type { IncidentSeed } from './seeds'

const ATTEMPTS = 3

/** `auto-<category>-<incident key>-<8 hex>`: ours, never the model's slug. */
export const generatedId = (seed: IncidentSeed) =>
  `auto-${seed.category}-${seed.key}-${randomBytes(4).toString('hex')}`

/** The incident key back out of a generated id, so pickSeed can count what the pool holds. */
export const incidentKeyOf = (id: string) => id.split('-').slice(2, -1).join('-')

/** validateScenario plus the two rules only a generated scenario needs. */
export function checkDraft(data: unknown, id: string, seed: IncidentSeed) {
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    return { ok: false as const, errors: ['(root): expected one JSON object'] }
  const draft = { ...data, id } as Record<string, unknown>
  // There is no art for a generated node, and the player would request the missing file.
  if (typeof draft.nodes === 'object' && draft.nodes)
    for (const node of Object.values(draft.nodes))
      if (node && typeof node === 'object') delete node.image

  const result = validateScenario(draft, id)
  if (!result.ok) return result
  const errors: string[] = []
  // validateScenario allows an unwinnable scenario; the debrief's expert path needs one success.
  const wins = Object.values(result.scenario.nodes).filter(
    (n) => n.type === 'end' && n.outcome === 'success',
  ).length
  if (wins !== 1) errors.push(`nodes: ${wins} "success" end nodes, expected exactly 1`)
  if (result.scenario.category !== seed.category)
    errors.push(`category: "${result.scenario.category}", expected "${seed.category}"`)
  for (const [nodeId, node] of Object.entries(result.scenario.nodes))
    if (node.type === 'end' && !REGULATIONS.includes(node.debrief.regulation))
      errors.push(`node "${nodeId}": debrief.regulation must be copied verbatim from the list`)
  return errors.length ? { ok: false as const, errors } : result
}

export async function generateScenario(
  seed: IncidentSeed,
  avoid: readonly string[],
  llm: typeof complete = complete,
): Promise<Scenario> {
  const id = generatedId(seed)
  const messages: ChatMessage[] = promptMessages(seed, avoid)
  // One conversation per scenario: opencode go routes and caches by it.
  const session = randomUUID()
  let errors: string[] = []
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const reply = await llm(messages, { session })
    try {
      const result = checkDraft(extractJson(reply), id, seed)
      if (result.ok) return result.scenario
      errors = result.errors
    } catch (e) {
      errors = [e instanceof Error ? e.message : String(e)]
    }
    messages.push(
      { role: 'assistant', content: reply },
      {
        role: 'user',
        content: `The scenario failed validation. Fix every error and return the whole JSON object again:\n${errors.map((e) => `- ${e}`).join('\n')}`,
      },
    )
  }
  throw new Error(`generator: ${ATTEMPTS} attempts failed validation:\n  ${errors.join('\n  ')}`)
}
