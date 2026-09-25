// public/openapi.yaml is written by hand. This keeps it honest: every route handler under app/api
// and every method it exports must be in the spec, the spec must not list a route that is gone, and
// its error codes are exactly the ones `fail()` accepts.

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import { ru } from '@/i18n/ru'

const web = path.resolve(import.meta.dirname, '../..')
const apiDir = path.join(web, 'src/app/api')

/** "sessions/[id]/choose/route.ts" → "/api/sessions/{id}/choose". */
function fromCode(): string[] {
  return readdirSync(apiDir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('route.ts'))
    .flatMap((f) => {
      const route = `/api/${path.dirname(f)}`
        .replace(/\[(\w+)\]/g, '{$1}')
        .replaceAll(path.sep, '/')
      const source = readFileSync(path.join(apiDir, f), 'utf8')
      return [...source.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g)].map(
        (m) => `${m[1]} ${route}`,
      )
    })
    .sort()
}

// NOTE: reads the two indent levels the spec is written in (paths at 2, methods at 4) instead of
// pulling in a YAML parser for one test. A reformatted spec fails loudly here, not silently.
const lines = readFileSync(path.join(web, 'public/openapi.yaml'), 'utf8').split('\n')

function fromSpec(): string[] {
  const out: string[] = []
  let route: string | null = null
  for (const line of lines.slice(lines.indexOf('paths:') + 1)) {
    if (/^\S/.test(line)) break
    const p = line.match(/^ {2}(\/\S+):$/)
    if (p) route = p[1] ?? null
    const m = line.match(/^ {4}(get|post|put|patch|delete):$/)
    if (m?.[1] && route) out.push(`${m[1].toUpperCase()} ${route}`)
  }
  return out.sort()
}

test('openapi.yaml lists exactly the routes and methods app/api implements', () => {
  const code = fromCode()
  expect(code.length).toBeGreaterThan(10)
  expect(fromSpec()).toEqual(code)
})

test('the Error schema enumerates every code in ru.errors', () => {
  const start = lines.indexOf('    Error:')
  const codes = lines
    .slice(start, lines.indexOf('        issues:', start))
    .flatMap((l) => l.match(/^ {12}- (\w+)$/)?.[1] ?? [])
  expect(codes.sort()).toEqual(Object.keys(ru.errors).sort())
})
