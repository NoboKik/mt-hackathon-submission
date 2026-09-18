// Validates every content/scenarios/*.json against the frozen schema. Run via `pnpm validate:content`.
// Optional argv[2] points it at another folder (used by the runner test).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { validateScenario } from '../src/validate'

const dir = path.resolve(
  process.argv[2] ?? path.join(import.meta.dirname, '../../../content/scenarios'),
)
const files = existsSync(dir)
  ? readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
  : []

function check(file: string): string[] {
  let data: unknown
  try {
    data = JSON.parse(readFileSync(path.join(dir, file), 'utf8'))
  } catch (e) {
    return [`invalid JSON: ${e instanceof Error ? e.message : String(e)}`]
  }
  const result = validateScenario(data, path.basename(file, '.json'))
  return result.ok ? [] : result.errors
}

let invalid = 0
for (const file of files) {
  const errors = check(file)
  if (errors.length === 0) {
    console.log(`✓ ${file}`)
    continue
  }
  invalid++
  console.log(`✗ ${file}`)
  for (const e of errors) console.log(`    ${e}`)
}

console.log(`validate:content: ${files.length} file(s), ${invalid} invalid`)
process.exit(invalid > 0 ? 1 : 0)
