'use client'

import type {
  AchievementCode,
  ChooseResponse,
  ClientNode,
  Meters,
  StartSessionResponse,
} from '@p400/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Award } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { post } from '@/lib/client'
import { cn } from '@/lib/utils'

type Run = {
  sessionId: string
  scenario: StartSessionResponse['scenario']
  node: ClientNode
  meters: Meters
  failThresholds: Meters
  deltas?: Meters
  steps: ClientNode[]
  finished: boolean
  timedOut?: boolean
  /** Codes unlocked by the choice that just landed; the server decides, we only show them. */
  achievements?: string[]
}

/**
 * The (play) route group renders no header, so this component owns its own container. The
 * top padding clears the floating HUD, which is ~102px tall at 375px (two stacked meters)
 * and ~100px from `sm` up (one meter row, but the countdown ring sets the height).
 */
const page = 'w-full'

/**
 * Whole seconds left, floored at 0. Derived at render from the deadline rather than held in
 * state: state would still carry the previous node's value on the render where a new deadline
 * appears, and the timeout effect below would read 0 and fire the moment a node opens. The interval only forces re-renders.
 * A deadline also survives a backgrounded tab that stops firing timers.
 */
function useCountdown(deadline: number | null) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (deadline === null) return
    const id = setInterval(() => tick((t) => t + 1), 200)
    return () => clearInterval(id)
  }, [deadline])
  return remaining(deadline)
}

const remaining = (deadline: number | null) =>
  deadline === null ? 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1000))

function Countdown({ left, total }: { left: number; total: number }) {
  const r = 26
  const circumference = 2 * Math.PI * r
  const progress = total > 0 ? left / total : 0
  const urgent = left <= 5
  return (
    <>
      <svg
        viewBox="0 0 64 64"
        className="size-14 shrink-0 sm:size-16"
        role="timer"
        aria-label={ru.player.timerLabel}
      >
        {/* The track is the theme's muted surface. Tailwind classes are the only way to get a
            colour that flips with the theme into an SVG paint — a `stroke=` attribute cannot. */}
        <circle cx="32" cy="32" r={r} className="fill-none stroke-[var(--muted)]" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          className={cn(
            'fill-none transition-[stroke-dashoffset,stroke] duration-200 ease-linear',
            urgent ? 'stroke-danger' : 'stroke-brand',
          )}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          transform="rotate(-90 32 32)"
        />
        <text
          x="32"
          y="32"
          textAnchor="middle"
          dominantBaseline="central"
          className={cn('fill-foreground text-xl font-bold tabular-nums', urgent && 'fill-danger')}
        >
          {left}
        </text>
      </svg>
      <span className="sr-only">
        {ru.player.timeLeft}, {ru.player.seconds}
      </span>
    </>
  )
}

function Consequence({ node }: { node: Extract<ClientNode, { type: 'consequence' }> }) {
  return (
    <div className="rounded-card bg-muted p-4">
      <p className="text-sm leading-relaxed text-muted-foreground">{node.text}</p>
    </div>
  )
}

export function Player({
  scenarioId,
  title,
  intro,
  auto = false,
}: {
  scenarioId: string
  title: string
  intro: string
  auto?: boolean
}) {
  const [run, setRun] = useState<Run | null>(null)
  const [error, setError] = useState<string | null>(null)
  // When the current node was put on screen; the server charges elapsed time from its own
  // clock and only uses ours inside the grace window (see TIMER_GRACE_MS).
  const shownAt = useRef(Date.now())
  // isPending only flips on the next render, so a double-click would send the step twice and
  // the second answer comes back 409. This ref closes that gap synchronously.
  const inFlight = useRef(false)
  const queryClient = useQueryClient()

  const start = useMutation({
    mutationFn: () => post<StartSessionResponse>('/sessions', { scenarioId }),
    onSuccess: (r) => {
      shownAt.current = Date.now()
      setRun({ ...r, steps: r.steps })
    },
    onError: (e: Error) => setError(e.message),
  })

  const choose = useMutation({
    mutationFn: ({ nodeId, choiceId }: { nodeId: string; choiceId: string }) =>
      post<ChooseResponse>(`/sessions/${run?.sessionId}/choose`, {
        nodeId,
        choiceId,
        elapsedMs: Date.now() - shownAt.current,
      }),
    onSuccess: (r) => {
      shownAt.current = Date.now()
      setRun((prev) => (prev ? { ...prev, ...r } : prev))
      // The header's bell and the daily card: a finished run can mark the daily done, keep the
      // streak and unlock a badge.
      if (r.finished) queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (e: Error) => setError(e.message),
    onSettled: () => {
      inFlight.current = false
    },
  })

  // Leaving mid-run abandons it (a reload lands back on the intro), so the browser asks first.
  const inProgress = run !== null && !run.finished
  useEffect(() => {
    if (!inProgress) return
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [inProgress])

  const node = run?.node
  const isChoice = node?.type === 'choice'
  const pending = choose.isPending
  // Null whenever there is nothing to count: the timer must not run during the round trip,
  // or a slow answer is punished twice.
  const deadline = isChoice && !pending ? shownAt.current + node.timerSec * 1000 : null
  const left = useCountdown(deadline)

  const submit = useCallback(
    (choiceId: string) => {
      if (run?.node.type !== 'choice' || inFlight.current) return
      inFlight.current = true
      choose.mutate({ nodeId: run.node.id, choiceId })
    },
    [run, choose],
  )

  useEffect(() => {
    if (deadline !== null && left === 0 && !error) submit('timeout')
  }, [deadline, left, submit, error])

  // Keys 1–4 pick the choice with that number on screen. submit() already ignores a key
  // pressed mid-request or off a choice node.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const node = run?.node
      if (node?.type !== 'choice') return
      const choice = node.choices[Number(e.key) - 1]
      if (choice) submit(choice.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run, submit])

  if (error) {
    return (
      <div className={cn(page, 'flex flex-col items-center gap-5 pt-24 text-center')}>
        <Card elevation="flat" pad="lg" className="w-full border-danger/40 bg-danger/12">
          <p className="text-sm text-danger-text">{error}</p>
        </Card>
        {/* There is no header in this route group, so the error state has to carry the way out. */}
        <Link href="/" className={buttonClass({ variant: 'outline' })}>
          {ru.nav.exitPlay}
        </Link>
      </div>
    )
  }
  // The session, and with it the first node's timer, starts only once the briefing is read.
  if (!run && !start.isPending) {
    return (
      <div className={cn(page, 'flex flex-col gap-5 pt-6')}>
        <Card pad="lg" className="flex flex-col gap-4">
          <SectionTitle>{title}</SectionTitle>
          <p className="text-lead text-balance sm:text-lead-lg">{intro}</p>
        </Card>
        <button
          type="button"
          onClick={() => start.mutate()}
          className={buttonClass({ variant: 'primary', size: 'lg' })}
        >
          {ru.player.begin}
        </button>
      </div>
    )
  }
  if (!run || !node) {
    return (
      <p className={cn(page, 'pt-24 text-center text-sm text-muted-foreground')}>
        {ru.player.loading}
      </p>
    )
  }

  return (
    <div className={cn(page, 'flex flex-col gap-5')}>
      {/* Auto mode's pool is LLM-drafted and unreviewed; the player is told so up front. */}
      {run.scenario.source === 'generated' && (
        <Chip tone="warn" className="self-start">
          {ru.auto.draftChip}
        </Chip>
      )}
      {/* The meters sit in the page and stick under the header. top-14 is the header's height;
          the extra 4 keeps a gap so the card does not butt against the red bar. */}
      <div className="border-border bg-card rounded-card shadow-card sticky top-18 z-10 border p-4">
        <MeterPair meters={run.meters} thresholds={run.failThresholds} deltas={run.deltas} />
      </div>

      <div key={node.id} className="flex flex-col gap-5">
        {run.steps
          .filter(
            (s): s is Extract<ClientNode, { type: 'consequence' }> => s.type === 'consequence',
          )
          .map((s) => (
            <Consequence key={s.id} node={s} />
          ))}

        {run.timedOut && (
          <p
            className="rounded-card bg-warn/12 px-4 py-3 text-sm font-medium text-warn-text"
            role="status"
          >
            {ru.player.timedOut}
          </p>
        )}

        {node.type === 'choice' && (
          <section className="flex flex-col gap-5">
            <Card pad="lg" className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-2">
                {/* The narrator is the default voice and goes unlabelled; other speakers get a
                    Russian label, falling back to the raw key rather than hiding it. */}
                {node.speaker !== 'narrator' && (
                  <Eyebrow>
                    {ru.speakers[node.speaker as keyof typeof ru.speakers] ?? node.speaker}
                  </Eyebrow>
                )}
                <p className="text-lead text-balance sm:text-lead-lg">{node.text}</p>
              </div>
              {/* The slot is held open for the whole node so the text beside it does not
                  re-flow mid-answer. The ring itself is dropped while a choice is in flight:
                  with no deadline the derived value is 0, and a ring that snapped to a red
                  zero on every answer read as a failure the player had not made. */}
              <div className="flex size-14 shrink-0 items-center justify-center sm:size-16">
                {!pending && <Countdown left={left} total={node.timerSec} />}
              </div>
            </Card>
            <ol className="flex flex-col gap-3">
              {node.choices.map((choice, i) => (
                <li key={choice.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => submit(choice.id)}
                    aria-keyshortcuts={String(i + 1)}
                    className={cn(
                      surface({ interactive: true, pad: 'sm' }),
                      'group flex min-h-16 w-full items-center gap-4 text-left text-base leading-snug',
                      'transition-[background-color,box-shadow,border-color] hover:border-brand/50',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
                      'disabled:pointer-events-none disabled:opacity-50',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="rounded-chip bg-muted text-muted-foreground group-hover:bg-brand group-hover:text-primary-foreground group-focus-visible:bg-brand group-focus-visible:text-primary-foreground flex size-9 shrink-0 items-center justify-center text-sm font-bold tabular-nums transition-colors"
                    >
                      {i + 1}
                    </span>
                    {choice.text}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        {node.type === 'end' && (
          <Card pad="lg" className="flex flex-col items-center gap-5 text-center">
            <Chip tone={OUTCOME_TONE[node.outcome]} className="tracking-eyebrow uppercase">
              {ru.outcomes[node.outcome]}
            </Chip>
            <p className="text-lead text-balance sm:text-lead-lg">{node.text}</p>
            {run.achievements && run.achievements.length > 0 && (
              <section className="flex flex-col items-center gap-2">
                <SectionTitle>{ru.debrief.unlocked}</SectionTitle>
                <ul className="flex flex-wrap justify-center gap-2">
                  {run.achievements.map((code) => (
                    <li key={code}>
                      <Chip tone="safe">
                        <Award className="size-3.5" aria-hidden="true" />
                        {ru.achievements[code as AchievementCode]?.title ?? code}
                      </Chip>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href={`/debrief/${run.sessionId}${auto ? '?auto=1' : ''}`}
                className={buttonClass({ variant: 'primary', size: 'lg' })}
              >
                {ru.player.toDebrief}
              </Link>
              <Link href="/" className={buttonClass({ variant: 'outline', size: 'lg' })}>
                {ru.debrief.toCatalogue}
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
