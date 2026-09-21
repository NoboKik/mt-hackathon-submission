import { expect, test } from 'vitest'
import { extractJson } from './json'

test('bare JSON', () => {
  expect(extractJson('{"a":1}')).toEqual({ a: 1 })
})

test('fenced JSON', () => {
  expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
})

test('JSON with prose before and after', () => {
  expect(extractJson('Вот сценарий:\n{"a":{"b":[1]}}\nГотово.')).toEqual({ a: { b: [1] } })
})

test('garbage throws', () => {
  expect(() => extractJson('не могу')).toThrow()
  expect(() => extractJson('{"a":')).toThrow()
})
