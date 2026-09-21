import { describe, expect, it } from 'vitest'
import { cn } from './utils'

/**
 * These guard a silent failure mode, not a behaviour anyone would think to check by hand:
 * tailwind-merge DELETES an unrecognised `text-*` size when a `text-*` colour follows it in
 * the same call, because the size falls through to its catch-all colour validator, with no
 * error anywhere.
 *
 * If a new --text-* token is added to tokens.css without registering it in utils.ts, this fails.
 */
describe('cn', () => {
  const CUSTOM_SIZES = [
    'text-eyebrow',
    'text-lead',
    'text-lead-lg',
    'text-display',
    'text-display-lg',
  ]

  it.each(CUSTOM_SIZES)('keeps %s when a colour utility follows it', (size) => {
    expect(cn(`${size} text-brand-text uppercase`)).toContain(size)
    expect(cn(`${size} text-muted-foreground`)).toContain('text-muted-foreground')
  })

  it('keeps the size and the colour together, in either order', () => {
    expect(cn('text-eyebrow text-danger-text')).toBe('text-eyebrow text-danger-text')
    expect(cn('text-danger-text text-eyebrow')).toBe('text-danger-text text-eyebrow')
  })

  it('still lets a later custom size override an earlier one', () => {
    expect(cn('text-sm text-lead')).toBe('text-lead')
    expect(cn('text-lead text-display')).toBe('text-display')
  })

  it('still lets a later colour override an earlier one', () => {
    expect(cn('text-muted-foreground text-danger-text')).toBe('text-danger-text')
  })
})
