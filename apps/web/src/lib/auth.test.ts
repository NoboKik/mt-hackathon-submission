import { describe, expect, it } from 'vitest'
import { hashPassword, sign, verify, verifyPassword } from './auth'

// auth.ts reads AUTH_SECRET lazily, so setting it here — after the import, before any test —
// is enough to keep these assertions off the dev fallback secret.
process.env.AUTH_SECRET = 'test-secret-2b9f'

const USER = '3f1b0c7a-8b4e-4a1d-9c2e-0d5f6a7b8c9d'
// A correctly-sized hash, so these cases reach the scheme and salt guards instead of stopping
// at the length check like the short ones do.
const SIZED = Buffer.alloc(64).toString('base64')
const NOW = 1_800_000_000

describe('password hashing', () => {
  it('round-trips a password', () => {
    const stored = hashPassword('гроза-400')
    expect(stored.startsWith('scrypt$')).toBe(true)
    expect(verifyPassword('гроза-400', stored)).toBe(true)
  })

  it('salts, so the same password hashes differently every time', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'))
  })

  it('rejects a wrong password', () => {
    expect(verifyPassword('wrong', hashPassword('right'))).toBe(false)
  })

  it.each([
    ['empty', ''],
    ['no separators', 'plaintext'],
    ['missing hash', 'scrypt$c2FsdA=='],
    ['unknown scheme', `bcrypt$c2FsdA==$${SIZED}`],
    ['short hash', 'scrypt$c2FsdA==$aGFzaA=='],
    ['empty salt', `scrypt$$${SIZED}`],
  ])('rejects a malformed stored hash (%s) without throwing', (_name, stored) => {
    expect(verifyPassword('right', stored)).toBe(false)
  })
})

describe('session token', () => {
  it('round-trips a user id', () => {
    expect(verify(sign(USER, NOW + 60), NOW)).toBe(USER)
  })

  it('rejects a tampered hmac', () => {
    const [id, exp, sig] = sign(USER, NOW + 60).split('.')
    expect(verify(`${id}.${exp}.${sig.slice(0, -1)}x`, NOW)).toBeNull()
    expect(verify(`${id}.${exp}.`, NOW)).toBeNull()
  })

  it('rejects a tampered user id', () => {
    const [, exp, sig] = sign(USER, NOW + 60).split('.')
    expect(verify(`00000000-0000-4000-8000-000000000000.${exp}.${sig}`, NOW)).toBeNull()
  })

  it('rejects a tampered expiry', () => {
    const [id, exp, sig] = sign(USER, NOW - 60).split('.')
    expect(verify(`${id}.${Number(exp) + 3600}.${sig}`, NOW)).toBeNull()
  })

  it('rejects an expired token', () => {
    expect(verify(sign(USER, NOW - 1), NOW)).toBeNull()
    expect(verify(sign(USER, NOW), NOW)).toBeNull()
  })

  it('rejects a malformed token', () => {
    expect(verify('', NOW)).toBeNull()
    expect(verify(`${USER}.${NOW + 60}`, NOW)).toBeNull()
  })
})
