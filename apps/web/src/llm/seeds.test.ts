import { COMPETENCIES } from '@p400/shared'
import { expect, test } from 'vitest'
import { INCIDENTS, pickSeed } from './seeds'

test('keys are unique kebab-case and every category has at least 3 incidents', () => {
  const keys = INCIDENTS.map((i) => i.key)
  expect(new Set(keys).size).toBe(keys.length)
  for (const k of keys) expect(k).toMatch(/^[a-z0-9-]+$/)
  for (const c of COMPETENCIES) {
    expect(INCIDENTS.filter((i) => i.category === c).length).toBeGreaterThanOrEqual(3)
  }
})

test('picks the least-used incident', () => {
  const used = INCIDENTS.filter((i) => i.key !== 'faint').flatMap((i) => [i.key, i.key])
  expect(pickSeed([...used, 'faint']).key).toBe('faint')
})

test('honours the category restriction', () => {
  for (let n = 0; n < 20; n++) expect(pickSeed([], Math.random, 'medical').category).toBe('medical')
  expect(pickSeed(['faint', 'allergy'], Math.random, 'medical').key).toBe('heart-attack')
})

test('a fixed rnd is deterministic', () => {
  const rnd = () => 0
  expect(pickSeed([], rnd)).toEqual(pickSeed([], rnd))
  expect(pickSeed([], rnd).key).toBe(INCIDENTS[0].key)
})
