import { medicalFaint01 } from '@p400/shared/fixtures'
import { expect, test, vi } from 'vitest'
import type { ChatMessage } from './client'
import { generateScenario, incidentKeyOf } from './generate'
import { promptMessages, REGULATIONS } from './prompt'
import type { IncidentSeed } from './seeds'

const SEED: IncidentSeed = {
  key: 'faint',
  category: 'medical',
  incident: 'пассажир потерял сознание в проходе',
  passenger: 'пенсионерка, едущая к внукам',
  circumstance: 'ночной рейс',
}

// A reply the validator accepts: the reference scenario under the model's own slug, citing the list.
const valid = JSON.stringify({
  ...medicalFaint01,
  id: 'model-picked-slug',
  nodes: Object.fromEntries(
    Object.entries(medicalFaint01.nodes).map(([id, n]) => [
      id,
      n.type === 'end' ? { ...n, debrief: { ...n.debrief, regulation: REGULATIONS[0] } } : n,
    ]),
  ),
})
const invalid = JSON.stringify({ title: 'Без узлов' })

/** A fake complete() that plays the replies in order and keeps what it was sent. */
function fake(...replies: string[]) {
  const sent: ChatMessage[][] = []
  const llm = vi.fn(async (messages: ChatMessage[]) => {
    sent.push(structuredClone(messages))
    return replies[sent.length - 1] ?? invalid
  })
  return { llm, sent }
}

test('invalid then valid succeeds on attempt 2, and attempt 2 carries the errors', async () => {
  const { llm, sent } = fake(invalid, valid)
  const scenario = await generateScenario(SEED, [], llm)
  expect(llm).toHaveBeenCalledTimes(2)
  expect(scenario.title).toBe(medicalFaint01.title)
  const retry = sent[1].at(-1)
  expect(retry?.role).toBe('user')
  expect(retry?.content).toContain('nodes:')
})

test('three invalid replies throw', async () => {
  const { llm } = fake(invalid, invalid, invalid)
  await expect(generateScenario(SEED, [], llm)).rejects.toThrow(/3 attempts/)
  expect(llm).toHaveBeenCalledTimes(3)
})

test('the id is always ours, never the model slug', async () => {
  const scenario = await generateScenario(SEED, [], fake(valid).llm)
  expect(scenario.id).toMatch(/^auto-medical-faint-[0-9a-f]{8}$/)
  expect(incidentKeyOf(scenario.id)).toBe('faint')
  expect(incidentKeyOf('auto-safety-unattended-bag-0a1b2c3d')).toBe('unattended-bag')
})

test('an unwinnable draft is a retry', async () => {
  const noWin = valid.replace('"outcome":"success"', '"outcome":"partial"')
  const { llm, sent } = fake(noWin, valid)
  await generateScenario(SEED, [], llm)
  expect(sent[1].at(-1)?.content).toContain('"success" end nodes')
})

test('a regulation off the list or a wrong category is a retry', async () => {
  const offList = valid.replaceAll(REGULATIONS[0], 'Инструкция, п. 9.99')
  const { llm, sent } = fake(offList, valid)
  await generateScenario(SEED, [], llm)
  expect(sent[1].at(-1)?.content).toContain('verbatim')
  await expect(
    generateScenario({ ...SEED, category: 'service' }, [], fake(valid, valid, valid).llm),
  ).rejects.toThrow(/category/)
})

test('the prompt asks for json and lists what to avoid', () => {
  const [system, user] = promptMessages(SEED, ['Обморок в тамбуре'])
  expect(system.content).toContain('JSON')
  for (const r of REGULATIONS) expect(system.content).toContain(r)
  expect(user.content).toContain('Обморок в тамбуре')
  expect(user.content).toContain('"medical"')
})
