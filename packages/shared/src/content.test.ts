import { expect, test } from 'vitest'
import { CONTENT_DIR, loadScenarios, requireScenario, requireScenarios } from './content'

// CI validates whatever is in the working tree; this asserts the tracked folder is not empty
// and every file in it parses.
test('the real content folder holds at least one scenario and nothing invalid', () => {
  const loaded = loadScenarios()
  expect(loaded.length).toBeGreaterThan(0)
  expect(loaded.filter((r) => !r.ok)).toEqual([])
  expect(loaded.map((r) => r.file)).toContain('medical-faint-01.json')
})

test('requireScenarios returns every file parsed, requireScenario just one', () => {
  expect(requireScenarios().map((s) => s.id)).toContain('medical-faint-01')
  expect(requireScenario('medical-faint-01').id).toBe('medical-faint-01')
})

test('a missing scenario names the file, not a JSON error', () => {
  expect(() => requireScenario('no-such-scenario')).toThrow(/does not exist/)
  expect(() => requireScenarios('/nonexistent/p400')).toThrow(/no scenarios in/)
  expect(CONTENT_DIR.endsWith('content/scenarios')).toBe(true)
})
