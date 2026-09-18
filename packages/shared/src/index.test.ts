import { expect, test } from 'vitest'
import { SHARED_PACKAGE } from './index'

test('shared package is wired up', () => {
  expect(SHARED_PACKAGE).toBe('@p400/shared')
})
