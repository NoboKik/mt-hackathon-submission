'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { Moon, Sun } from 'lucide-react'
import { ru } from '@/i18n/ru'
import { cn } from '@/lib/utils'

/**
 * The shared surface, control and text recipes.
 *
 * NOTE: this is deliberately not shadcn/ui. `npx shadcn add button card` would pull
 * Radix in to re-implement <button> and <div>; the only primitive here that needs real
 * behaviour is the nav drawer, and a native <dialog> already has it.
 */

/* ————————————————————————————— surfaces ————————————————————————————— */

const cardClass = cva('rounded-card border border-border bg-card', {
  variants: {
    elevation: {
      // flat is for surfaces nested inside another card, where a second shadow reads as noise.
      flat: '',
      rest: 'shadow-card',
      float: 'shadow-float backdrop-blur-xl',
    },
    interactive: {
      true: 'transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lift',
      false: '',
    },
    pad: { none: '', sm: 'p-4', md: 'p-5', lg: 'p-5 sm:p-6' },
  },
  defaultVariants: { elevation: 'rest', interactive: false, pad: 'md' },
})

type CardProps = React.ComponentProps<'div'> & VariantProps<typeof cardClass>

export function Card({ elevation, interactive, pad, className, ...props }: CardProps) {
  return <div className={cn(cardClass({ elevation, interactive, pad }), className)} {...props} />
}

/** The same recipe as a class string, for when the surface must be an <li>, <a> or <form>. */
export const surface = (opts?: VariantProps<typeof cardClass>) => cardClass(opts)

/* ————————————————————————————— controls ————————————————————————————— */

export const buttonClass = cva(
  'inline-flex items-center justify-center gap-2 rounded-card font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-primary-foreground shadow-card hover:bg-brand-hover active:translate-y-px',
        outline:
          'border border-brand/50 bg-card text-brand-text hover:border-brand hover:bg-accent',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        quiet:
          'text-brand-text underline decoration-brand/40 underline-offset-4 hover:decoration-brand',
      },
      size: {
        // md/lg are 44px and 48px tall: the iOS/Android minimum touch target.
        sm: 'h-9 px-3 text-xs',
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-11 shrink-0 px-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonClass>

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonClass({ variant, size }), className)} {...props} />
}

export const fieldClass =
  'w-full rounded-card border border-input bg-card px-3 py-2.5 text-base text-foreground transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

type FieldProps = React.ComponentProps<'input'> & { label: string }

export function Field({ label, id, className, ...props }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      <input id={id} className={cn(fieldClass, className)} {...props} />
    </div>
  )
}

/* ————————————————————————————— chips ————————————————————————————— */

/** 4px corners, not a pill — transport.mos.ru's tag chips are rounded rectangles. */
const chipClass = cva(
  'inline-flex items-center gap-1.5 rounded-chip px-2 py-1 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground',
        brand: 'bg-accent text-accent-foreground',
        safe: 'bg-safe/12 text-safe-text',
        warn: 'bg-warn/12 text-warn-text',
        danger: 'bg-danger/12 text-danger-text',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

type ChipProps = React.ComponentProps<'span'> & VariantProps<typeof chipClass>

export function Chip({ tone, className, ...props }: ChipProps) {
  return <span className={cn(chipClass({ tone }), className)} {...props} />
}

/** The outcome → colour mapping, in one place. */
export const OUTCOME_TONE = {
  success: 'safe',
  partial: 'warn',
  fail: 'danger',
} as const satisfies Record<'success' | 'partial' | 'fail', VariantProps<typeof chipClass>['tone']>

export const OUTCOME_TEXT = {
  success: 'text-safe-text',
  partial: 'text-warn-text',
  fail: 'text-danger-text',
} as const

/* ————————————————————————————— text ————————————————————————————— */

/**
 * The uppercase blue eyebrow is mt-hackathon.ru's signature device — sixteen instances on
 * their landing page, always blue, always over a larger light value. Borrowed on purpose.
 */
export function Eyebrow({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      className={cn('text-eyebrow tracking-eyebrow text-brand-text uppercase', className)}
      {...props}
    />
  )
}

export function SectionTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      className={cn('text-eyebrow tracking-eyebrow text-muted-foreground uppercase', className)}
      {...props}
    />
  )
}

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-eyebrow tracking-eyebrow text-muted-foreground uppercase">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

/* ————————————————————————————— progress ————————————————————————————— */

/** Generic determinate bar. The meters do not use this — they carry a threshold marker and
 *  state colour that this deliberately has no opinion about. See components/meters.tsx. */
export function Progress({
  value,
  max = 100,
  label,
  className,
}: {
  value: number
  max?: number
  label: string
  className?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      className={cn('h-2 overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className="h-full rounded-full bg-brand transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* ————————————————————————————— theme ————————————————————————————— */

/**
 * No React state, on purpose. Both icons are always rendered and CSS shows the right one,
 * so there is nothing for the server to render differently from the client and no
 * `mounted` flag guarding a hydration mismatch. The label stays fixed — the icon says
 * which direction the button goes.
 */
export function ThemeToggle({ className }: { className?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={ru.nav.theme}
      title={ru.nav.theme}
      className={className}
      onClick={() => {
        const dark = document.documentElement.classList.toggle('dark')
        try {
          localStorage.theme = dark ? 'dark' : 'light'
        } catch {
          // Private mode or blocked storage: the toggle still works for this page view.
        }
      }}
    >
      <Sun className="size-5 dark:hidden" aria-hidden="true" />
      <Moon className="hidden size-5 dark:block" aria-hidden="true" />
    </Button>
  )
}
