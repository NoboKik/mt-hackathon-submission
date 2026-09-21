// Loads and validates content/scenarios/*.json. The one place `node:fs` lives, which is why
// index.ts does not re-export it: the barrel is bundled into the client, and `node:fs` is not.
// Import it as `@p400/shared/content` from Node-only code (the seed, the validate script).

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Scenario } from './schema'
import { type ValidationResult, validateScenario } from './validate'

/** Resolved off this file, not the cwd: the seed and the validate script run from two places. */
export const CONTENT_DIR = path.join(import.meta.dirname, '../../../content/scenarios')

export type LoadedScenario = ValidationResult & { file: string }

export function loadScenarioFile(file: string, dir = CONTENT_DIR): LoadedScenario {
  let data: unknown
  try {
    data = JSON.parse(readFileSync(path.join(dir, file), 'utf8'))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { file, ok: false, errors: [`invalid JSON: ${message}`] }
  }
  // The file name is the id: a renamed file is a broken import elsewhere waiting to happen.
  return { file, ...validateScenario(data, path.basename(file, '.json')) }
}

/** Every *.json in `dir`, sorted, each with its own verdict. A missing folder is zero files. */
export function loadScenarios(dir = CONTENT_DIR): LoadedScenario[] {
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .sort()
    : []
  return files.map((file) => loadScenarioFile(file, dir))
}

function requireOk(loaded: LoadedScenario): Scenario {
  if (loaded.ok) return loaded.scenario
  throw new Error(`content: ${loaded.file} is invalid\n  ${loaded.errors.join('\n  ')}`)
}

export function requireScenario(id: string, dir = CONTENT_DIR): Scenario {
  const file = `${id}.json`
  // Without this the ENOENT arrives dressed up as "invalid JSON", which sends you to the wrong file.
  if (!existsSync(path.join(dir, file))) throw new Error(`content: ${dir}/${file} does not exist`)
  return requireOk(loadScenarioFile(file, dir))
}

/** Throws on an empty folder: seeding zero scenarios is the bug, not a valid state. */
export function requireScenarios(dir = CONTENT_DIR): Scenario[] {
  const loaded = loadScenarios(dir)
  if (!loaded.length) throw new Error(`content: no scenarios in ${dir}`)
  return loaded.map(requireOk)
}
