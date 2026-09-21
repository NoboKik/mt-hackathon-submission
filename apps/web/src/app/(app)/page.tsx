'use client'

import type { ScenarioListItem } from '@p400/shared'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ru } from '@/i18n/ru'
import { ApiError, api } from '@/lib/client'

const DIFFICULTY = ['', '•', '••', '•••']

function ScenarioCard({ scenario }: { scenario: ScenarioListItem }) {
  const played = scenario.bestScore !== null
  return (
    <li className="border-border bg-card rounded-card flex flex-col gap-3 border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-brand-text text-xs font-semibold tracking-[0.16em] uppercase">
            {ru.competencies[scenario.category]}
          </span>
          <h2 className="text-lg leading-snug font-semibold text-balance">{scenario.title}</h2>
        </div>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums" aria-hidden="true">
          {DIFFICULTY[scenario.difficulty]}
        </span>
      </div>

      <dl className="text-muted-foreground flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs">
        <div className="flex gap-1.5">
          <dt>{scenario.estimatedMinutes}</dt>
          <dd>{ru.home.minutes}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>{ru.home.best}:</dt>
          <dd className="text-foreground font-semibold tabular-nums">
            {played ? scenario.bestScore : ru.home.notPlayed}
          </dd>
        </div>
        {scenario.attempts > 0 && (
          <div className="flex gap-1.5">
            <dt>{ru.home.attempts}:</dt>
            <dd className="tabular-nums">{scenario.attempts}</dd>
          </div>
        )}
      </dl>

      <Link
        href={`/play/${scenario.id}`}
        className="bg-brand hover:bg-brand-hover focus-visible:ring-ring rounded-card self-start px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        {played ? ru.home.replay : ru.home.start}
      </Link>
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
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <p className="text-brand-text text-xs font-semibold tracking-[0.2em] uppercase">
          {ru.app.tagline}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {ru.home.catalogue}
        </h1>
        <p className="text-muted-foreground max-w-prose text-balance">{ru.home.subtitle}</p>
      </header>

      {scenarios.isPending && <p className="text-muted-foreground text-sm">{ru.common.loading}</p>}

      {scenarios.data?.length === 0 && (
        <p className="text-muted-foreground text-sm">{ru.home.empty}</p>
      )}

      {scenarios.data && scenarios.data.length > 0 && (
        <ul className="flex flex-col gap-4">
          {scenarios.data.map((s) => (
            <ScenarioCard key={s.id} scenario={s} />
          ))}
        </ul>
      )}
    </div>
  )
}
