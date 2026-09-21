'use client'

import { COMPETENCIES, type DebriefResponse, type DebriefStep } from '@p400/shared'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { MeterPair } from '@/components/meters'
import { ru } from '@/i18n/ru'
import { api } from '@/lib/client'
import { cn } from '@/lib/utils'

const OUTCOME_STYLE = {
  success: 'bg-safe/15 text-safe',
  partial: 'bg-warn/15 text-warn',
  fail: 'bg-danger/15 text-danger',
} as const

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Step({ step }: { step: DebriefStep }) {
  const timedOut = step.choiceId === 'timeout'
  return (
    <li
      className={cn(
        'rounded-card border p-4',
        // The expert path is the lesson, so it gets the only colour in the list.
        step.onExpertPath ? 'border-safe/45 bg-safe/5' : 'border-border bg-card',
      )}
    >
      {step.nodeText && (
        <p className="text-muted-foreground mb-2 text-xs leading-relaxed">{step.nodeText}</p>
      )}
      <p className={cn('text-sm leading-snug', timedOut && 'text-warn')}>
        {step.choiceText ?? ru.debrief.timeoutStep}
      </p>
      {step.onExpertPath && (
        <p className="text-safe mt-2 text-xs font-semibold">{ru.debrief.onExpert}</p>
      )}
    </li>
  )
}

export function Debrief({ sessionId }: { sessionId: string }) {
  const q = useQuery({
    queryKey: ['debrief', sessionId],
    queryFn: () => api<DebriefResponse>(`/sessions/${sessionId}/debrief`),
    retry: false,
  })

  if (q.isPending) return <p className="text-muted-foreground text-sm">{ru.common.loading}</p>
  if (q.error) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-danger text-sm">{q.error.message}</p>
        <Link href="/" className="text-brand-text text-sm font-semibold underline">
          {ru.debrief.toCatalogue}
        </Link>
      </div>
    )
  }

  const d = q.data
  const deltas = COMPETENCIES.map((key) => [key, d.competencyDeltas[key] ?? 0] as const).filter(
    ([, v]) => v !== 0,
  )

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase',
              OUTCOME_STYLE[d.outcome],
            )}
          >
            {ru.outcomes[d.outcome]}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{ru.debrief.title}</h1>
        </div>
        <MeterPair meters={d.meters} />
      </header>

      <Section title={ru.debrief.score}>
        <div className="border-border bg-card rounded-card flex flex-wrap items-end gap-x-8 gap-y-3 border p-5">
          <p className="text-4xl font-semibold tabular-nums">{d.score.total}</p>
          <dl className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-xs">
            {(['base', 'timeBonus', 'competencyBonus'] as const).map((key) => (
              <div key={key} className="flex gap-1.5">
                <dt>{ru.debrief.scoreParts[key]}</dt>
                <dd className="text-foreground tabular-nums">{d.score[key]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      {deltas.length > 0 && (
        <Section title={ru.debrief.competencies}>
          <ul className="flex flex-wrap gap-2">
            {deltas.map(([key, value]) => (
              <li
                key={key}
                className="border-border bg-card rounded-full border px-3 py-1.5 text-xs"
              >
                <span className="text-muted-foreground">{ru.competencies[key]}</span>{' '}
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    value > 0 ? 'text-safe' : 'text-danger',
                  )}
                >
                  {value > 0 ? '+' : ''}
                  {value}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={ru.debrief.yourPath}>
        <ul className="flex flex-col gap-2">
          {d.yourPath.map((step) => (
            <Step key={`${step.nodeId}:${step.choiceId}`} step={step} />
          ))}
        </ul>
      </Section>

      <Section title={ru.debrief.expertPath}>
        <ol className="border-border bg-card rounded-card flex flex-col gap-2 border p-5">
          {d.expertPath.map((step) => (
            <li key={step.choiceId} className="text-sm leading-snug">
              {step.text}
            </li>
          ))}
        </ol>
      </Section>

      <Section title={ru.debrief.lesson}>
        <p className="leading-relaxed text-balance">{d.lesson}</p>
        <p className="text-muted-foreground border-border border-l-2 pl-4 text-sm leading-relaxed">
          {d.regulation}
        </p>
      </Section>

      <div className="border-border flex flex-wrap gap-3 border-t pt-6">
        <Link
          href="/"
          className="bg-brand hover:bg-brand-hover focus-visible:ring-ring rounded-card px-5 py-2.5 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {ru.debrief.toCatalogue}
        </Link>
      </div>
    </div>
  )
}
