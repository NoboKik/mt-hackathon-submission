'use client'

import type { ScenarioListItem } from '@p400/shared'
import { useQuery } from '@tanstack/react-query'
import { Clock3, Workflow } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { buttonClass, Card, Chip, Eyebrow, Stat, surface } from '@/components/ui'
import { ru } from '@/i18n/ru'
import { ApiError, api } from '@/lib/client'
import { cn } from '@/lib/utils'

/**
 * The catalogue: the front door, and the first screen after sign-in. One column at every
 * width. The skeleton shares the class so nothing jumps when the data lands.
 */
const GRID = 'flex flex-col gap-4'

function ScenarioCard({ scenario }: { scenario: ScenarioListItem }) {
  const played = scenario.bestScore !== null
  // ru.home.difficultyLevels[0] is '' on purpose, so an out-of-range level renders no chip
  // rather than an empty one.
  const difficulty = ru.home.difficultyLevels[scenario.difficulty]

  return (
    <li
      className={cn(
        surface({ interactive: true, pad: 'lg' }),
        // `interactive` handles hover; focus-within repeats it for keyboard users,
        // while the ring itself stays on the control that actually has focus.
        'flex flex-col gap-5 focus-within:border-brand/50',
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <Eyebrow className="min-w-0 pt-1">{ru.competencies[scenario.category]}</Eyebrow>
          {difficulty && (
            <Chip tone="neutral" className="shrink-0">
              {difficulty}
            </Chip>
          )}
        </div>
        <h2 className="text-lead text-balance">{scenario.title}</h2>
      </div>

      {/* mt-auto pins the score row and the CTA to the bottom of the card. */}
      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-t border-border pt-4">
        <Stat
          label={ru.home.best}
          value={played ? scenario.bestScore : '—'}
          hint={played ? undefined : ru.home.notPlayed}
        />
        <div className="flex flex-col items-end gap-1.5 pb-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-3.5" aria-hidden="true" />
            <span className="tabular-nums">
              {scenario.estimatedMinutes} {ru.home.minutes}
            </span>
          </span>
          {scenario.attempts > 0 && (
            <span className="tabular-nums">
              {ru.home.attempts}: {scenario.attempts}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <Link
          href={`/play/${scenario.id}`}
          className={cn(buttonClass({ variant: 'primary' }), 'w-full sm:w-auto')}
        >
          {played ? ru.home.replay : ru.home.start}
        </Link>
        {/* The methodologist's view. Reachable from the catalogue so a trainer goes straight
            from a scenario to how it branches — quiet, but a
            full-height touch target, and px-0 so its underline starts on the card's text edge. */}
        <Link
          href={`/admin/${scenario.id}`}
          className={cn(buttonClass({ variant: 'quiet' }), 'self-start px-0 text-xs sm:self-auto')}
        >
          <Workflow className="size-4" aria-hidden="true" />
          {ru.home.graph}
        </Link>
      </div>
    </li>
  )
}

/** Placeholder of the same shape as a real card, so the first paint has the page's layout. */
function SkeletonCard() {
  return (
    <li className={cn(surface({ pad: 'lg' }), 'flex flex-col gap-5')}>
      <div className="flex flex-col gap-3">
        <div className="h-3 w-2/5 rounded-chip bg-muted" />
        <div className="h-6 w-4/5 rounded-chip bg-muted" />
      </div>
      <div className="h-10 w-1/3 rounded-chip bg-muted" />
      <div className="h-11 w-full rounded-card bg-muted" />
    </li>
  )
}

export default function HomePage() {
  const router = useRouter()
  const scenarios = useQuery({
    queryKey: ['scenarios'],
    queryFn: () => api<ScenarioListItem[]>('/scenarios'),
    retry: false,
  })

  // The catalogue is the app's entry point, so an expired or absent cookie lands here first.
  useEffect(() => {
    if (scenarios.error instanceof ApiError && scenarios.error.status === 401) router.push('/login')
  }, [scenarios.error, router])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Eyebrow>{ru.app.tagline}</Eyebrow>
        <h1 className="text-display sm:text-display-lg text-balance">{ru.home.catalogue}</h1>
        <p className="max-w-prose text-balance text-muted-foreground sm:text-lead">
          {ru.home.subtitle}
        </p>
      </header>

      {scenarios.isPending && (
        <>
          <p className="sr-only" aria-live="polite">
            {ru.common.loading}
          </p>
          <ul className={cn(GRID, 'animate-pulse')} aria-hidden="true">
            {[1, 2].map((n) => (
              <SkeletonCard key={n} />
            ))}
          </ul>
        </>
      )}

      {scenarios.data?.length === 0 && (
        <Card pad="lg" className="text-center text-sm text-balance text-muted-foreground">
          {ru.home.empty}
        </Card>
      )}

      {scenarios.data && scenarios.data.length > 0 && (
        <ul className={GRID}>
          {scenarios.data.map((s) => (
            <ScenarioCard key={s.id} scenario={s} />
          ))}
        </ul>
      )}
    </div>
  )
}
