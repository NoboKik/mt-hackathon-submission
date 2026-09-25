import type { Meters } from '@p400/shared'
import { ru } from '@/i18n/ru'
import { cn } from '@/lib/utils'

type Props = {
  meters: Meters
  /** From the scenario, so the player can see how close the run is to ending. */
  thresholds?: Meters
  deltas?: Meters
  /**
   * `hud` is the in-play variant: tighter, two rows on a phone, no wasted vertical space
   * because it lives in the floating bar. `panel` is the debrief/summary variant.
   */
  variant?: 'panel' | 'hud'
}

function Meter({
  label,
  shortLabel,
  value,
  threshold,
  delta,
  hue,
  variant,
}: {
  label: string
  /** Shown in the HUD, where the full label does not fit. aria-label keeps the full one. */
  shortLabel: string
  value: number
  threshold?: number
  delta?: number
  hue: 'loyalty' | 'safety'
  variant: 'panel' | 'hud'
}) {
  // Colour is state, not decoration: below the threshold the run is over, just above it the
  // next bad choice ends it. Shape alone can't say that at a glance.
  const critical = threshold !== undefined && value < threshold
  const atRisk = threshold !== undefined && !critical && value < threshold + 15
  const fill = critical
    ? 'bg-danger'
    : atRisk
      ? 'bg-warn'
      : hue === 'loyalty'
        ? 'bg-loyalty'
        : 'bg-safety'
  const hud = variant === 'hud'

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            'text-eyebrow tracking-eyebrow truncate text-muted-foreground uppercase',
            critical && 'text-danger-text',
          )}
        >
          {hud ? shortLabel : label}
        </span>
        <span className="flex shrink-0 items-baseline gap-1.5">
          {delta !== undefined && delta !== 0 && (
            <span
              className={cn(
                'rounded-chip px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums',
                delta > 0 ? 'bg-safe/12 text-safe-text' : 'bg-danger/12 text-danger-text',
              )}
            >
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
          )}
          <span className={cn('font-semibold tabular-nums', hud ? 'text-sm' : 'text-base')}>
            {value}
          </span>
          {/* Says what the notch on the track means: the run ends below this number. */}
          {threshold !== undefined && (
            <span className="text-xs text-muted-foreground tabular-nums">
              / {ru.player.failAt} {threshold}
            </span>
          )}
        </span>
      </div>
      {/* A native <meter> is the semantic element, but it cannot carry the threshold marker
          without vendor pseudo-elements, and the role plus aria-value* below give assistive
          tech the same information. */}
      {/* biome-ignore lint/a11y/useSemanticElements: <meter> is not styleable enough here */}
      <div
        className={cn('relative overflow-hidden rounded-full bg-muted', hud ? 'h-1.5' : 'h-2.5')}
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width,background-color] duration-500',
            fill,
          )}
          style={{ width: `${value}%` }}
        />
        {threshold !== undefined && (
          // The fail line, punched through the whole track: a light bar drawn over the fill
          // would vanish on the empty part of the track in light theme.
          <div
            className="absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-full bg-card ring-1 ring-danger/70"
            style={{ left: `${threshold}%` }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}

export function MeterPair({ meters, thresholds, deltas, variant = 'panel' }: Props) {
  return (
    <div
      className={cn(
        'grid gap-x-5',
        variant === 'hud' ? 'grid-cols-1 gap-y-1.5 sm:grid-cols-2' : 'gap-y-4 sm:grid-cols-2',
      )}
    >
      <Meter
        label={ru.player.loyalty}
        shortLabel={ru.player.loyaltyShort}
        value={meters.loyalty}
        threshold={thresholds?.loyalty}
        delta={deltas?.loyalty}
        hue="loyalty"
        variant={variant}
      />
      <Meter
        label={ru.player.safety}
        shortLabel={ru.player.safetyShort}
        value={meters.safety}
        threshold={thresholds?.safety}
        delta={deltas?.safety}
        hue="safety"
        variant={variant}
      />
    </div>
  )
}
