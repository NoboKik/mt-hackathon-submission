'use client'

import {
  COMPETENCY_LEVELS,
  type GrowthZones,
  type MeResponse,
  type ProfileCompetency,
} from '@p400/shared'
import { useQuery } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import {
  buttonClass,
  Card,
  Chip,
  Eyebrow,
  OUTCOME_TONE,
  Progress,
  SectionTitle,
  Stat,
  surface,
} from '@/components/ui'
import { ru } from '@/i18n/ru'
import { ApiError, api } from '@/lib/client'
import { cn } from '@/lib/utils'

const MENTOR = COMPETENCY_LEVELS[COMPETENCY_LEVELS.length - 1].minPoints

/**
 * Two lines, split at the middle word. The axis labels are the competency names and
 * «Урегулирование конфликтов» on one line runs straight off a 375px chart — SVG text neither
 * wraps nor clips to its box, so the wrap has to be decided here.
 */
function wrapAxisLabel(value: string): string[] {
  const words = value.split(' ')
  if (words.length < 2) return [value]
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

/** First-line offset in ems, so a one- or two-line label sits correctly against its axis point. */
function firstLineDy(lines: number, verticalAnchor: string): number {
  if (verticalAnchor === 'end') return -1.15 * (lines - 1) // above the point: last baseline on it
  if (verticalAnchor === 'start') return 0.8 // below the point: first cap-height under it
  return 0.35 - 0.575 * (lines - 1) // beside the point: centred on it
}

function Radars({ competencies }: { competencies: ProfileCompetency[] }) {
  const data = competencies.map((c) => ({
    axis: ru.competencies[c.key],
    points: c.points,
  }))
  // The domain reaches at least the mentor threshold, so the shape means the same thing on a
  // fresh account as on a full one — a radar rescaled to its own max flatters every profile.
  const max = Math.max(MENTOR, ...competencies.map((c) => c.points))
  return (
    <div className="h-72 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        {/* 60%, not 72%: the remaining 40% is what the wrapped Cyrillic labels need at 375px. */}
        <RadarChart data={data} outerRadius="60%">
          <PolarGrid stroke="var(--border)" />
          {/* Every tick is placed from the chart's measured size, which the server does not
              have, so the SSR markup for this axis legitimately differs from the first client
              render. suppressHydrationWarning is what keeps that from logging as an error. */}
          <PolarAngleAxis
            dataKey="axis"
            suppressHydrationWarning
            tick={({ x, y, textAnchor, verticalAnchor, payload }) => {
              const lines = wrapAxisLabel(String(payload.value))
              return (
                <text
                  x={x}
                  y={y}
                  textAnchor={textAnchor}
                  fill="var(--muted-foreground)"
                  fontSize={11}
                  suppressHydrationWarning
                >
                  {lines.map((line, i) => (
                    <tspan
                      key={line}
                      x={x}
                      dy={`${i === 0 ? firstLineDy(lines.length, verticalAnchor) : 1.15}em`}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              )
            }}
          />
          <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
          <Radar dataKey="points" stroke="var(--brand)" fill="var(--brand)" fillOpacity={0.3} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Two or three sentences the server already concluded, then one scenario to go and play. */
function Growth({ growth: g }: { growth: GrowthZones }) {
  const t = ru.profile.growth
  const worst = g.offExpert[0]
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t.title}</SectionTitle>
      <Card className="flex flex-col gap-4">
        <div className="text-foreground flex flex-col gap-2 text-sm leading-relaxed">
          <p>
            {t.weakest(ru.competencies[g.weakest.key], g.weakest.points, g.weakest.othersAverage)}
          </p>
          {g.decisions === 0 ? (
            <p className="text-muted-foreground">{t.noDecisions}</p>
          ) : (
            <p>
              {worst && worst.percent > 0
                ? t.offExpert(ru.competencies[worst.category], worst.percent)
                : t.allExpert}
              {t.timeouts(g.timeoutPercent)}
            </p>
          )}
          {g.topMistake && (
            <p>{t.mistake(g.topMistake.text, g.topMistake.scenarioTitle, g.topMistake.count)}</p>
          )}
        </div>
        {g.recommended && (
          <div className="border-border flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <Eyebrow>{t.recommended}</Eyebrow>
              <p className="text-sm font-semibold">{g.recommended.title}</p>
            </div>
            <Link
              href={`/play/${g.recommended.id}`}
              className={cn(buttonClass({ variant: 'primary' }), 'w-full sm:w-auto')}
            >
              {t.start}
            </Link>
          </div>
        )}
      </Card>
    </section>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/me'),
    retry: false,
  })

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.push('/login')
  }, [me.error, router])

  if (me.isPending) return <p className="text-muted-foreground text-sm">{ru.common.loading}</p>
  if (me.error) return <p className="text-danger-text text-sm">{me.error.message}</p>

  const d = me.data
  const toNext = d.nextLevelXp === null ? null : d.nextLevelXp - d.xp

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-start gap-2">
        <Eyebrow>
          {d.user.position} · {d.user.depot}
        </Eyebrow>
        <h1 className="text-display">{d.user.displayName}</h1>
        <Chip tone="brand">{ru.levels[d.level]}</Chip>
      </header>

      <Card pad="lg" className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          <Stat label={ru.profile.xp} value={d.xp} />
          <Stat label={ru.profile.scenariosFinished} value={d.scenariosFinished} />
          <Stat
            label={ru.profile.attempts}
            value={d.attempts}
            className="col-span-2 sm:col-span-1"
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <SectionTitle>{ru.profile.progress}</SectionTitle>
            <span className="text-foreground text-xs font-semibold tabular-nums">
              {toNext === null ? ru.profile.maxLevel : `${d.xp} / ${d.nextLevelXp}`}
            </span>
          </div>
          <Progress value={d.xp} max={d.nextLevelXp ?? d.xp} label={ru.profile.progress} />
          {toNext !== null && (
            <p className="text-muted-foreground text-xs">
              {ru.profile.toNextLevel}: <span className="tabular-nums">{toNext}</span>
            </p>
          )}
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <SectionTitle>{ru.profile.radar}</SectionTitle>
        {/* pad="none": the chart runs edge to edge, which is the width the axis labels need. */}
        <Card pad="none" className="flex flex-col overflow-hidden">
          <Radars competencies={d.competencies} />
          <ul className="border-border grid gap-x-6 gap-y-2.5 border-t p-4 sm:grid-cols-2 sm:p-5">
            {d.competencies.map((c) => (
              <li key={c.key} className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground text-sm">{ru.competencies[c.key]}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="text-foreground text-sm font-semibold tabular-nums">
                    {c.points}
                  </span>
                  <Chip tone="brand">{ru.levels[c.level]}</Chip>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {d.growth && <Growth growth={d.growth} />}

      <section className="flex flex-col gap-3">
        <SectionTitle>{ru.profile.badges}</SectionTitle>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {d.achievements.map((a) => {
            const copy = ru.achievements[a.code]
            const earned = a.earnedAt !== null
            return (
              <li
                key={a.code}
                className={cn(
                  surface({ pad: 'sm', elevation: earned ? 'rest' : 'flat' }),
                  'flex flex-col gap-1.5',
                  // Not opacity: a faded card takes its description text below AA with it.
                  earned ? 'border-safe/40 bg-safe/8' : 'bg-muted',
                )}
              >
                <p
                  className={cn(
                    'text-sm font-semibold',
                    earned ? 'text-safe-text' : 'text-muted-foreground',
                  )}
                >
                  {copy.title}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">{copy.description}</p>
                {!earned && (
                  <p className="text-muted-foreground mt-auto flex items-center gap-1.5 pt-1 text-xs font-semibold">
                    <Lock aria-hidden="true" className="size-3.5 shrink-0" />
                    {ru.profile.locked}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>{ru.profile.history}</SectionTitle>
        {d.recentSessions.length === 0 ? (
          <Card>
            <p className="text-muted-foreground text-sm">{ru.profile.historyEmpty}</p>
          </Card>
        ) : (
          <Card pad="none">
            <ul className="divide-border divide-y">
              {d.recentSessions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5"
                >
                  {/* basis-full on a phone: the chip group is nowrap and does not shrink, so
                      with both chips present flex-1's zero basis leaves the title ~77px and it
                      breaks into five lines instead of the row ever wrapping. */}
                  <span className="min-w-0 flex-1 basis-full text-sm font-medium sm:basis-auto">
                    {s.title}
                  </span>
                  <span className="flex items-center gap-2">
                    {s.onExpertPath && <Chip tone="safe">{ru.profile.expertRun}</Chip>}
                    <Chip tone={OUTCOME_TONE[s.outcome]}>{ru.outcomes[s.outcome]}</Chip>
                    <span className="text-foreground w-10 text-right text-sm font-semibold tabular-nums">
                      {s.score}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}
