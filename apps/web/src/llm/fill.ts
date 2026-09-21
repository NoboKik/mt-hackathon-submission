// Fills auto mode's pool, or drafts files for a human to edit into curated content. A dev tool,
// not a root command (the root package.json scripts are the app's fixed command set):
//   pnpm --filter web exec tsx --env-file-if-exists=.env src/llm/fill.ts --pool 3
//   pnpm --filter web exec tsx --env-file-if-exists=.env src/llm/fill.ts --out ../../drafts --category service
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { COMPETENCIES, type Competency } from '@p400/shared'
import { generateScenario, incidentKeyOf } from './generate'
import { topUp } from './pool'
import { pickSeed } from './seeds'

const { values } = parseArgs({
  options: { pool: { type: 'string' }, out: { type: 'string' }, category: { type: 'string' } },
})

async function drafts(dir: string, category: Competency) {
  mkdirSync(dir, { recursive: true })
  // What is already in the folder steers the next draft away from it, same as the pool does.
  const existing = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map(
      (f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as { id: string; title: string },
    )
  const seed = pickSeed(
    existing.map((s) => incidentKeyOf(s.id)),
    Math.random,
    category,
  )
  const scenario = await generateScenario(
    seed,
    existing.map((s) => s.title),
  )
  const file = path.join(dir, `${scenario.id}.json`)
  writeFileSync(file, `${JSON.stringify(scenario, null, 2)}\n`)
  console.log(`fill: ${file} — ${scenario.title}`)
}

async function main() {
  if (values.pool) {
    const added = await topUp(Number(values.pool))
    console.log(`fill: ${added} scenarios added to the pool`)
  } else if (values.out && COMPETENCIES.includes(values.category as Competency)) {
    await drafts(values.out, values.category as Competency)
  } else {
    console.error(`usage: fill.ts --pool N | --out DIR --category ${COMPETENCIES.join('|')}`)
    process.exitCode = 1
  }
  // postgres-js keeps its pool open, so the process would otherwise hang here.
  process.exit()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
