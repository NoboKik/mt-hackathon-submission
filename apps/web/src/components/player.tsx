'use client'

import type {
  AchievementCode,
  ChooseResponse,
  ClientNode,
  Meters,
  StartSessionResponse,
} from '@p400/shared'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MeterPair } from '@/components/meters'
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
    <div className="flex items-center gap-3">
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        role="timer"
        aria-label={ru.player.timerLabel}
      >
        <circle cx="32" cy="32" r={r} className="fill-none stroke-muted" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          className={cn(
            'fill-none transition-[stroke-dashoffset,stroke] duration-200 ease-linear',
            urgent ? 'stroke-danger' : 'stroke-brand-text',
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
          className={cn(
            'fill-foreground text-lg font-semibold tabular-nums',
            urgent && 'fill-danger',
          )}
        >
          {left}
        </text>
      </svg>
      <span className="text-muted-foreground text-xs">
        {ru.player.timeLeft}, {ru.player.seconds}
      </span>
    </div>
  )
}

function Consequence({ node }: { node: Extract<ClientNode, { type: 'consequence' }> }) {
  return (
    <div className="border-border/60 bg-muted/40 rounded-card border p-4">
      <p className="text-muted-foreground text-sm leading-relaxed">{node.text}</p>
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
      <div className="border-danger/40 bg-danger/10 rounded-card border p-6">
        <p className="text-danger text-sm">{error}</p>
      </div>
    )
  }
  if (!run || !node) {
    return <p className="text-muted-foreground py-16 text-center text-sm">{ru.player.loading}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border-border bg-card rounded-card sticky top-3 z-10 border p-4 shadow-lg">
        <MeterPair meters={run.meters} deltas={run.deltas} />
      </div>

      {run.steps
        .filter((s): s is Extract<ClientNode, { type: 'consequence' }> => s.type === 'consequence')
        .map((s) => (
          <Consequence key={s.id} node={s} />
        ))}

      {run.timedOut && (
        <p className="text-warn text-sm font-medium" role="status">
          {ru.player.timedOut}
        </p>
      )}

      {node.type === 'choice' && (
        <section className="flex flex-col gap-5">
          <header className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-brand-text text-xs font-semibold tracking-[0.18em] uppercase">
                {node.speaker}
              </span>
              <p className="text-xl leading-snug text-balance sm:text-2xl">{node.text}</p>
            </div>
            <Countdown left={left} total={node.timerSec} />
          </header>
          <ul className="flex flex-col gap-3">
            {node.choices.map((choice) => (
              <li key={choice.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submit(choice.id)}
                  className="border-border bg-card hover:border-brand-text hover:bg-secondary focus-visible:ring-ring w-full rounded-card border p-4 text-left text-base leading-snug transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                >
                  {choice.text}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {node.type === 'end' && (
        <section className="flex flex-col items-start gap-4">
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase',
              node.outcome === 'success'
                ? 'bg-safe/15 text-safe'
                : node.outcome === 'partial'
                  ? 'bg-warn/15 text-warn'
                  : 'bg-danger/15 text-danger',
            )}
          >
            {ru.outcomes[node.outcome]}
          </span>
          <p className="text-xl leading-snug text-balance">{node.text}</p>
          {run.achievements && run.achievements.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                {ru.debrief.unlocked}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {run.achievements.map((code) => (
                  <li
                    key={code}
                    className="border-safe/40 bg-safe/10 text-safe rounded-full border px-3 py-1.5 text-xs font-semibold"
                  >
                    {ru.achievements[code as AchievementCode]?.title ?? code}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Link
            href={`/debrief/${run.sessionId}`}
            className="bg-brand hover:bg-brand-hover focus-visible:ring-ring rounded-card px-5 py-2.5 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {ru.player.toDebrief}
          </Link>
        </section>
      )}
    </div>
  )
}
