'use client'

import type { AdminAnalyticsResponse, AnalyticsNode } from '@p400/shared'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, Eyebrow, fieldClass, SectionTitle, Stat } from '@/components/ui'
import { ru } from '@/i18n/ru'
import { ApiError, api } from '@/lib/client'
import { cn } from '@/lib/utils'

const t = ru.analytics
const num = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })

// NOTE: both charts are plain div bars, not Recharts. One measure per row and a label that
// has to wrap at 375px — an SVG axis would only take width away from the words.

/** Five axes, one series. The weakest bar carries the accent: it is the chart's conclusion. */
function Competencies({ d }: { d: AdminAnalyticsResponse }) {
  const max = Math.max(1, ...d.competencies.map((c) => c.avg))
  return (
    <ul className="flex flex-col gap-3">
      {d.competencies.map((c) => {
        const weak = c.key === d.weakest
        return (
          <li key={c.key} className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className={cn(weak && 'font-semibold')}>{ru.competencies[c.key]}</span>
              <span className="tabular-nums text-muted-foreground">{num(c.avg)}</span>
            </span>
            <div
              className="h-2 rounded-full bg-muted"
              title={`${ru.competencies[c.key]}: ${num(c.avg)}`}
            >
              <div
                className={cn('h-full rounded-full', weak ? 'bg-brand' : 'bg-muted-foreground/50')}
                style={{ width: `${(Math.max(0, c.avg) / max) * 100}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Fails and timeouts stacked, scaled to the worst node; the counts are printed, not only drawn. */
function NodeRow({ n, max }: { n: AnalyticsNode; max: number }) {
  const pct = (v: number) => `${(v / max) * 100}%`
  return (
    <li className="flex flex-col gap-1.5 px-4 py-3 sm:px-5">
      <Link
        href={`/admin/${n.scenarioId}`}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {n.scenarioTitle}
      </Link>
      <p className="line-clamp-2 text-sm">{n.text}</p>
      <div
        className="flex h-2 gap-0.5"
        title={`${t.fails}: ${n.fails} · ${t.timeouts}: ${n.timeouts} · ${n.visits} ${t.visits}`}
      >
        {n.fails > 0 && <div className="rounded-full bg-danger" style={{ width: pct(n.fails) }} />}
        {n.timeouts > 0 && (
          <div className="rounded-full bg-warn" style={{ width: pct(n.timeouts) }} />
        )}
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {t.fails}: {n.fails} · {t.timeouts}: {n.timeouts} · {n.visits} {t.visits}
      </span>
    </li>
  )
}

function Legend() {
  return (
    <span className="flex gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-danger" />
        {t.fails}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-warn" />
        {t.timeouts}
      </span>
    </span>
  )
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [depot, setDepot] = useState('')
  const [crew, setCrew] = useState('')

  const q = useQuery({
    queryKey: ['admin-analytics', depot, crew],
    queryFn: () =>
      api<AdminAnalyticsResponse>(
        `/admin/analytics?${new URLSearchParams({ depot, crew }).toString()}`,
      ),
    retry: false,
  })

  useEffect(() => {
    if (q.error instanceof ApiError && q.error.status === 401) router.push('/login')
  }, [q.error, router])

  const d = q.data
  const crews = d?.units.find((u) => u.depot === depot)?.crews ?? []
  const weakest = d?.competencies.find((c) => c.key === d.weakest)
  const others = d?.competencies.filter((c) => c.key !== d.weakest) ?? []
  const othersAvg = others.reduce((s, c) => s + c.avg, 0) / Math.max(1, others.length)
  const worst = d?.nodes[0]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Eyebrow>{ru.app.name}</Eyebrow>
        <h1 className="text-display sm:text-display-lg">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={depot}
          onChange={(e) => {
            setDepot(e.target.value)
            setCrew('')
          }}
          aria-label={t.depot}
          className={cn(fieldClass, 'sm:w-72')}
        >
          <option value="">{t.allDepots}</option>
          {d?.units.map((u) => (
            <option key={u.depot} value={u.depot}>
              {u.depot}
            </option>
          ))}
        </select>
        {/* A crew only means something inside its depot: the names repeat across depots. */}
        <select
          value={crew}
          onChange={(e) => setCrew(e.target.value)}
          aria-label={t.crew}
          disabled={!depot}
          className={cn(fieldClass, 'sm:w-56')}
        >
          <option value="">{t.allCrews}</option>
          {crews.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {q.isPending && (
        <Card pad="lg" className="text-sm text-muted-foreground">
          {ru.common.loading}
        </Card>
      )}
      {q.error && (
        <Card pad="lg" className="text-sm text-danger-text">
          {q.error.message}
        </Card>
      )}

      {d && (
        <>
          <Card pad="lg" className="flex flex-col gap-4">
            <div className="flex gap-8">
              <Stat label={t.conductors} value={d.conductors} />
              <Stat label={t.runs} value={d.runs} />
            </div>
            {/* The ТЗ weighs conclusions over logs: the chart below backs a sentence up here. */}
            {weakest ? (
              <p className="text-base">
                <span className="font-semibold">{t.weakestLead}:</span>{' '}
                {ru.competencies[weakest.key]} — {num(weakest.avg)} {t.perConductor}, {t.againstAvg}{' '}
                {num(othersAvg)}.
                {worst && (
                  <>
                    {' '}
                    {t.worstLead} «{worst.scenarioTitle}»: {t.fails.toLowerCase()} {worst.fails},{' '}
                    {t.timeouts.toLowerCase()} {worst.timeouts}.
                  </>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t.noRuns}</p>
            )}
          </Card>

          <Card pad="lg" className="flex flex-col gap-4">
            <SectionTitle>{t.competencies}</SectionTitle>
            <Competencies d={d} />
          </Card>

          <Card pad="none" className="overflow-hidden">
            <div className="flex flex-col gap-2 p-4 sm:p-5">
              <SectionTitle>{t.nodes}</SectionTitle>
              <p className="text-xs text-muted-foreground">{t.nodesHint}</p>
              {d.nodes.length > 0 && <Legend />}
            </div>
            {d.nodes.length > 0 ? (
              <ul className="divide-y divide-border border-t border-border">
                {d.nodes.map((n) => (
                  <NodeRow
                    key={`${n.scenarioId}/${n.nodeId}`}
                    n={n}
                    max={d.nodes[0].fails + d.nodes[0].timeouts}
                  />
                ))}
              </ul>
            ) : (
              <p className="px-4 pb-5 text-sm text-muted-foreground sm:px-5">{t.noNodes}</p>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
