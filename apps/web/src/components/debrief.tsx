'use client'

import { COMPETENCIES, type DebriefResponse, type DebriefStep } from '@p400/shared'
import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { MeterPair } from '@/components/meters'
import {
  buttonClass,
  Card,
  Chip,
  Eyebrow,
  OUTCOME_TONE,
  SectionTitle,
  surface,
} from '@/components/ui'
import { ru } from '@/i18n/ru'
import { api } from '@/lib/client'
import { cn } from '@/lib/utils'

const SCORE_PARTS = ['base', 'timeBonus', 'competencyBonus'] as const

/** The Stat label tone, written out because <dt> and <h1>'s unit are not <Stat>s. */
const labelClass = 'text-eyebrow tracking-eyebrow text-muted-foreground uppercase'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  )
}

const signed = (v: number) => `${v > 0 ? '+' : ''}${v}`

/** A signed delta chip: green up, red down. Zeros are filtered out by the caller. */
function Delta({ label, value }: { label: string; value: number }) {
  return (
    <li>
      <Chip tone={value > 0 ? 'safe' : 'danger'}>
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">{signed(value)}</span>
      </Chip>
    </li>
  )
}

/**
 * One stop on the timeline. The dot hangs outside the card, over the rail drawn by the
 * parent: expert steps are the only colour on the screen, a timeout is amber, everything
 * else stays neutral so the two that matter are findable at a glance. Each step says what it
 * moved and, off the expert path, what the expert did at the same point.
 */
function Step({ step }: { step: DebriefStep }) {
  const timedOut = step.choiceId === 'timeout'
  const expert = step.onExpertPath
  const all: [string, number][] = [
    [ru.player.loyaltyShort, step.effects.loyalty],
    [ru.player.safetyShort, step.effects.safety],
    ...COMPETENCIES.map((key): [string, number] => [
      ru.competencies[key],
      step.competencies[key] ?? 0,
    ]),
  ]
  const deltas = all.filter(([, v]) => v !== 0)
  return (
    <li
      className={cn(
        'relative flex flex-col gap-2.5',
        surface({ pad: 'sm' }),
        expert && 'border-safe/40 bg-safe/8',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          // -left-6 puts the 12px dot's centre on the rail at x=6px; ring-background
          // punches the rail out behind it.
          'absolute top-5 -left-6 size-3 rounded-full ring-2 ring-background',
          expert ? 'bg-safe' : timedOut ? 'bg-warn' : 'bg-muted-foreground/50',
        )}
      />
      {step.nodeText && (
        <p className="text-xs leading-relaxed text-muted-foreground">{step.nodeText}</p>
      )}
      <p className={cn('text-sm leading-snug', timedOut && 'font-medium text-warn-text')}>
        {step.choiceText ?? ru.debrief.timeoutStep}
      </p>
      {step.consequenceText && (
        <p className="rounded-card bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
          {step.consequenceText}
        </p>
      )}
      {deltas.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={ru.debrief.stepEffects}>
          {deltas.map(([label, value]) => (
            <Delta key={label} label={label} value={value} />
          ))}
        </ul>
      )}
      {expert ? (
        <Chip tone="safe" className="self-start">
          <Check className="size-3.5" aria-hidden="true" />
          {ru.debrief.onExpert}
        </Chip>
      ) : (
        step.expertChoice && (
          <p className="rounded-card border-l-2 border-safe bg-safe/8 p-3 text-sm leading-snug">
            <span className="font-semibold text-safe-text">{ru.debrief.better}: </span>
            {step.expertChoice.text}
          </p>
        )
      )}
    </li>
  )
}

export function Debrief({ sessionId, auto = false }: { sessionId: string; auto?: boolean }) {
  const q = useQuery({
    queryKey: ['debrief', sessionId],
    queryFn: () => api<DebriefResponse>(`/sessions/${sessionId}/debrief`),
    retry: false,
  })

  if (q.isPending) return <p className="text-muted-foreground text-sm">{ru.common.loading}</p>
  if (q.error) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-danger-text text-sm">{q.error.message}</p>
        <Link href="/" className={buttonClass({ variant: 'quiet' })}>
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
      {/* The hero is the score. Everything below it explains how that number happened. */}
      <Card pad="lg" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-col gap-2">
            <Eyebrow>{ru.debrief.title}</Eyebrow>
            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-display-lg tabular-nums">{d.score.total}</span>
              <span className={labelClass}>{ru.debrief.score}</span>
            </h1>
          </div>
          <Chip tone={OUTCOME_TONE[d.outcome]}>{ru.outcomes[d.outcome]}</Chip>
        </div>

        {/* Subgrid so the three figures share one baseline. «За компетенции» wraps to two
            lines at 375px, and without this its value drops a row below the other two. */}
        <dl className="grid grid-cols-3 grid-rows-[auto_auto] gap-x-3 gap-y-1 border-t border-border pt-4">
          {SCORE_PARTS.map((key) => (
            <div key={key} className="row-span-2 grid grid-rows-subgrid gap-1">
              <dt className={labelClass}>{ru.debrief.scoreParts[key]}</dt>
              <dd className="text-base font-semibold tabular-nums">{d.score[key]}</dd>
            </div>
          ))}
        </dl>

        <div className="border-t border-border pt-4">
          <MeterPair meters={d.meters} />
        </div>
      </Card>

      {deltas.length > 0 && (
        <Section title={ru.debrief.competencies}>
          <ul className="flex flex-wrap gap-2">
            {deltas.map(([key, value]) => (
              <Delta key={key} label={ru.competencies[key]} value={value} />
            ))}
          </ul>
        </Section>
      )}

      <Section title={ru.debrief.yourPath}>
        {/* The rail is a sibling of the <ol>, not a child: <ol> may only contain <li>. */}
        <div className="relative">
          <span
            aria-hidden="true"
            className="absolute top-6 bottom-6 left-[5px] w-0.5 rounded-full bg-border"
          />
          <ol className="flex flex-col gap-3 pl-6">
            {d.yourPath.map((step) => (
              <Step key={`${step.nodeId}:${step.choiceId}`} step={step} />
            ))}
          </ol>
        </div>
      </Section>

      <Section title={ru.debrief.expertPath}>
        <Card pad="none">
          <ol className="divide-y divide-border">
            {d.expertPath.map((step, i) => (
              <li key={step.choiceId} className="flex items-start gap-3 p-4">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground tabular-nums">
                  {i + 1}
                </span>
                <p className="pt-0.5 text-sm leading-snug">{step.text}</p>
              </li>
            ))}
          </ol>
        </Card>
      </Section>

      <Section title={ru.debrief.lesson}>
        <p className="max-w-prose text-lead text-pretty">{d.lesson}</p>
      </Section>

      <Section title={ru.debrief.regulation}>
        <blockquote className="rounded-card border-l-2 border-brand bg-muted p-4 text-sm leading-relaxed text-muted-foreground">
          {d.regulation}
        </blockquote>
      </Section>

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        {/* In auto mode the next scenario is the primary action; the catalogue steps down. */}
        {auto && (
          <Link href="/auto" className={cn(buttonClass({ size: 'lg' }), 'w-full sm:w-auto')}>
            {ru.auto.next}
          </Link>
        )}
        <Link
          href="/"
          className={cn(
            buttonClass({ variant: auto ? 'outline' : 'primary', size: 'lg' }),
            'w-full sm:w-auto',
          )}
        >
          {ru.debrief.toCatalogue}
        </Link>
      </div>
    </div>
  )
}
