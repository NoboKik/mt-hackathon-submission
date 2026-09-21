import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge has to be told about the custom font sizes in tokens.css, or it silently
 * deletes them.
 *
 * Its `font-size` group only recognises t-shirt sizes and bracket values, so `text-eyebrow`
 * falls through to the catch-all colour validator and lands in `text-color` — where the next
 * `text-*` class in the same cn() call wins and the size is dropped:
 *
 *   twMerge('text-eyebrow tracking-eyebrow text-brand-text uppercase')
 *     -> 'tracking-eyebrow text-brand-text uppercase'
 *
 * Reordering does not help — then the colour is the class that gets dropped instead.
 * Registering the keys makes literal matching win.
 *
 * Keep this list in sync with the --text-* tokens in app/tokens.css.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': ['text-eyebrow', 'text-lead', 'text-lead-lg', 'text-display', 'text-display-lg'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
