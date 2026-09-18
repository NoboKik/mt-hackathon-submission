// NOTE: stub. Real validation lands with the frozen Zod schema: move this into packages/shared
// (plain node here can't import its TS source or zod) and point the root script at it via pnpm --filter.
import { readdirSync } from 'node:fs'

const dir = new URL('../content/scenarios/', import.meta.url)
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))

console.log(`validate:content — ${files.length} scenario file(s), no schema wired up yet`)
process.exit(0)
