'use client'

import type {
  AchievementCode,
  ChooseResponse,
  ClientNode,
  Meters,
  StartSessionResponse,
} from '@p400/shared'
import { useMutation } from '@tanstack/react-query'
import { Award, X } from 'lucide-react'
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
  node: ClientNode
  meters: Meters
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
const page = 'mx-auto w-full max-w-3xl px-4 pt-32 pb-16'

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

export function Player({ scenarioId }: { scenarioId: string }) {
  const [run, setRun] = useState<Run | null>(null)
  const [error, setError] = useState<string | null>(null)
  // When the current node was put on screen; the server charges elapsed time from its own
  // clock and only uses ours inside the grace window (see TIMER_GRACE_MS).
  const shownAt = useRef(Date.now())

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
    },
    onError: (e: Error) => setError(e.message),
  })

  const startOnce = useRef(false)
  useEffect(() => {
    if (startOnce.current) return
    startOnce.current = true
    start.mutate()
  }, [start.mutate])

  const node = run?.node
  const isChoice = node?.type === 'choice'
  const pending = choose.isPending
  // Null whenever there is nothing to count: the timer must not run during the round trip,
  // or a slow answer is punished twice.
  const deadline = isChoice && !pending ? shownAt.current + node.timerSec * 1000 : null
  const left = useCountdown(deadline)

  const submit = useCallback(
    (choiceId: string) => {
      if (run?.node.type !== 'choice' || choose.isPending) return
      choose.mutate({ nodeId: run.node.id, choiceId })
    },
    [run, choose],
  )

  useEffect(() => {
    if (deadline !== null && left === 0) submit('timeout')
  }, [deadline, left, submit])

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
  if (!run || !node) {
    return (
      <p className={cn(page, 'pt-24 text-center text-sm text-muted-foreground')}>
        {ru.player.loading}
      </p>
    )
  }

  return (
    <>
      {/* The floating HUD. It is the only chrome during a run: two meters, the countdown and
          the way out, parked above a situation that may scroll. */}
      <div className="fixed inset-x-3 top-3 z-30 mx-auto flex max-w-3xl items-center gap-3 rounded-slab border border-border bg-card/85 px-4 py-3 shadow-float backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <MeterPair meters={run.meters} deltas={run.deltas} variant="hud" />
        </div>
        {/* The slot is held open for the whole choice node so the meters beside it do not
            re-flow mid-answer. The ring itself is dropped while a choice is in flight: with
            no deadline the derived value is 0, and a ring that snapped to a red zero on every
            answer read as a failure the player had not made. */}
        {node.type === 'choice' && (
          <div className="flex size-14 shrink-0 items-center justify-center sm:size-16">
            {!pending && <Countdown left={left} total={node.timerSec} />}
          </div>
        )}
        <Link
          href="/"
          aria-label={ru.nav.exitPlay}
          title={ru.nav.exitPlay}
          className={buttonClass({ variant: 'ghost', size: 'icon' })}
        >
          <X className="size-5" aria-hidden="true" />
        </Link>
      </div>

      <div key={node.id} className={cn(page, 'flex flex-col gap-5')}>
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
            <Card pad="lg" className="flex flex-col gap-2">
              <Eyebrow>{node.speaker}</Eyebrow>
              <p className="text-lead text-balance sm:text-lead-lg">{node.text}</p>
            </Card>
            <ul className="flex flex-col gap-3">
              {node.choices.map((choice, i) => (
                <li key={choice.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => submit(choice.id)}
                    // The stagger is CSS only (tw-animate-css); `backwards` holds each card
                    // back through its own delay instead of flashing in at full opacity.
                    style={{
                      animationDelay: `${i * 60}ms`,
                      animationDuration: '260ms',
                      animationFillMode: 'backwards',
                    }}
                    className={cn(
                      surface({ interactive: true, pad: 'sm' }),
                      'relative flex min-h-16 w-full items-center overflow-hidden text-left text-base leading-snug',
                      // The brand accent that says "tappable", drawn as a pseudo-element so it
                      // cannot fight the card's own border colour on hover.
                      "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-brand before:opacity-0 before:transition-opacity before:content-['']",
                      'hover:before:opacity-100 focus-visible:before:opacity-100',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
                      'disabled:pointer-events-none disabled:opacity-50',
                      // Slide only, deliberately no fade-in. `fade-in` sets --tw-enter-opacity:0
                      // and animate-in fills backwards, so until the animation actually RUNS the
                      // element sits at opacity 0 — and a hidden or throttled tab never advances
                      // it (verified: playState "running", currentTime stuck at 0). That would
                      // leave the only interactive element of the core screen invisible. A
                      // stalled slide merely leaves the card 8px low, which nobody notices.
                      'animate-in slide-in-from-bottom-2',
                    )}
                  >
                    {choice.text}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {node.type === 'end' && (
          <Card
            pad="lg"
            className="flex flex-col items-center gap-5 text-center animate-in slide-in-from-bottom-2"
          >
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
            <Link
              href={`/debrief/${run.sessionId}`}
              className={buttonClass({ variant: 'primary', size: 'lg' })}
            >
              {ru.player.toDebrief}
            </Link>
          </Card>
        )}
      </div>
    </>
  )
}
