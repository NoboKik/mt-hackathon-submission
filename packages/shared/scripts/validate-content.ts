// Validates every content/scenarios/*.json against the frozen schema. Run via `pnpm validate:content`.
// Optional argv[2] points it at another folder (used by the runner test).
import path from 'node:path'
import { CONTENT_DIR, loadScenarios } from '../src/content'

const dir = process.argv[2] ? path.resolve(process.argv[2]) : CONTENT_DIR
const loaded = loadScenarios(dir)

let invalid = 0
for (const result of loaded) {
  if (result.ok) {
    console.log(`✓ ${result.file}`)
    continue
  }
  invalid++
  console.log(`✗ ${result.file}`)
  for (const e of result.errors) console.log(`    ${e}`)
}

console.log(`validate:content: ${loaded.length} file(s), ${invalid} invalid`)
// An empty or missing folder is an unstaged scenario or a broken checkout, not a pass.
if (!loaded.length) console.error(`validate:content: no scenarios in ${dir}`)
process.exit(invalid > 0 || loaded.length === 0 ? 1 : 0)
