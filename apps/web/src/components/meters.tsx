import type { Meters } from '@p400/shared'
import { ru } from '@/i18n/ru'
import { cn } from '@/lib/utils'

type Props = {
  meters: Meters
  /** From the scenario, so the player can see how close the run is to ending. */
  thresholds?: Meters
  deltas?: Meters
}

function Meter({
  label,
  value,
  threshold,
  delta,
  hue,
}: {
  label: string
  value: number
  threshold?: number
  delta?: number
  hue: 'loyalty' | 'safety'
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

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {label}
        </span>
        <span className="flex items-baseline gap-1.5">
          {delta !== undefined && delta !== 0 && (
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                delta > 0 ? 'text-safe' : 'text-danger',
              )}
            >
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
          )}
          <span className="text-base font-semibold tabular-nums">{value}</span>
        </span>
      </div>
      {/* A native <meter> is the semantic element, but it cannot carry the threshold marker
          without vendor pseudo-elements, and the role plus aria-value* below give assistive
          tech the same information. */}
      {/* biome-ignore lint/a11y/useSemanticElements: <meter> is not styleable enough here */}
      <div
        className="bg-muted relative h-2 overflow-hidden rounded-full"
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
          // The fail line. Drawn over the fill so it stays readable at every value.
          <div
            className="bg-background/80 absolute inset-y-0 w-0.5"
            style={{ left: `${threshold}%` }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}

export function MeterPair({ meters, thresholds, deltas }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Meter
        label={ru.player.loyalty}
        value={meters.loyalty}
        threshold={thresholds?.loyalty}
        delta={deltas?.loyalty}
        hue="loyalty"
      />
      <Meter
        label={ru.player.safety}
        value={meters.safety}
        threshold={thresholds?.safety}
        delta={deltas?.safety}
        hue="safety"
      />
    </div>
  )
}
