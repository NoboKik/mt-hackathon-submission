import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { medicalFaint01 } from '../src/__fixtures__/medical-faint-01'

const script = path.join(import.meta.dirname, 'validate-content.ts')
const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function run(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'p400-scenarios-'))
  dirs.push(dir)
  for (const [name, body] of Object.entries(files)) writeFileSync(path.join(dir, name), body)
  const r = spawnSync(process.execPath, ['--import', 'tsx', script, dir], {
    cwd: import.meta.dirname,
    encoding: 'utf8',
  })
  return { status: r.status, out: r.stdout + r.stderr }
}

test('passes valid files and reports broken JSON per file', () => {
  const { status, out } = run({
    'medical-faint-01.json': JSON.stringify(medicalFaint01),
    'broken.json': '{ "id": ',
    'notes.txt': 'ignored',
  })
  expect(out).toContain('✓ medical-faint-01.json')
  expect(out).toMatch(/✗ broken\.json\n {4}invalid JSON: /)
  expect(out).toContain('validate:content: 2 file(s), 1 invalid')
  expect(status).toBe(1)
})

test('checks the id against the file name', () => {
  const { status, out } = run({ 'renamed.json': JSON.stringify(medicalFaint01) })
  expect(out).toContain('id: "medical-faint-01" does not match file name "renamed"')
  expect(status).toBe(1)
})

test('an empty or missing folder is 0 files and exits 0', () => {
  const { status, out } = run({})
  expect(out).toContain('validate:content: 0 file(s), 0 invalid')
  expect(status).toBe(0)

  const missing = spawnSync(process.execPath, ['--import', 'tsx', script, '/nonexistent/p400'], {
    cwd: import.meta.dirname,
    encoding: 'utf8',
  })
  expect(missing.stdout).toContain('validate:content: 0 file(s), 0 invalid')
  expect(missing.status).toBe(0)
})
