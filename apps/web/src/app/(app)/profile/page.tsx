'use client'

import { COMPETENCY_LEVELS, type MeResponse, type ProfileCompetency } from '@p400/shared'
import { useQuery } from '@tanstack/react-query'
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
import { ru } from '@/i18n/ru'
import { ApiError, api } from '@/lib/client'
import { cn } from '@/lib/utils'

const MENTOR = COMPETENCY_LEVELS[COMPETENCY_LEVELS.length - 1].minPoints

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  )
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
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--color-ink-600)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: 'var(--color-ink-400)', fontSize: 11 }}
            suppressHydrationWarning
          />
          <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
          <Radar
            dataKey="points"
            stroke="var(--color-brand-text)"
            fill="var(--color-brand)"
            fillOpacity={0.35}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
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
  if (me.error) return <p className="text-danger text-sm">{me.error.message}</p>

  const d = me.data
  const toNext = d.nextLevelXp === null ? null : d.nextLevelXp - d.xp

  return (
    <div className="flex flex-col gap-9">
      <header className="flex flex-col gap-1">
        <p className="text-brand-text text-xs font-semibold tracking-[0.18em] uppercase">
          {d.user.position} · {d.user.depot}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{d.user.displayName}</h1>
        <p className="text-muted-foreground text-sm">{ru.levels[d.level]}</p>
      </header>

      <section className="border-border bg-card rounded-card grid gap-6 border p-5 sm:grid-cols-3">
        <Stat
          label={ru.profile.xp}
          value={d.xp}
          hint={toNext === null ? ru.profile.maxLevel : `${ru.profile.toNextLevel}: ${toNext}`}
        />
        <Stat label={ru.profile.scenariosFinished} value={d.scenariosFinished} />
        <Stat label={ru.profile.attempts} value={d.attempts} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
          {ru.profile.radar}
        </h2>
        <div className="border-border bg-card rounded-card border p-2">
          <Radars competencies={d.competencies} />
        </div>
        <ul className="flex flex-wrap gap-2">
          {d.competencies.map((c) => (
            <li key={c.key} className="text-muted-foreground text-xs">
              {ru.competencies[c.key]}{' '}
              <span className="text-foreground font-semibold tabular-nums">{c.points}</span>{' '}
              <span className="text-brand-text">{ru.levels[c.level]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
          {ru.profile.badges}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {d.achievements.map((a) => {
            const copy = ru.achievements[a.code]
            const earned = a.earnedAt !== null
            return (
              <li
                key={a.code}
                className={cn(
                  'rounded-card border p-4',
                  earned ? 'border-safe/40 bg-safe/5' : 'border-border bg-card opacity-60',
                )}
              >
                <p
                  className={cn(
                    'text-sm font-semibold',
                    earned ? 'text-safe' : 'text-muted-foreground',
                  )}
                >
                  {copy.title}
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {copy.description}
                </p>
                {!earned && (
                  <p className="text-muted-foreground mt-2 text-xs">{ru.profile.locked}</p>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
          {ru.profile.history}
        </h2>
        {d.recentSessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">{ru.profile.historyEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {d.recentSessions.map((s) => (
              <li
                key={s.id}
                className="border-border bg-card rounded-card flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border p-4"
              >
                <span className="text-sm">{s.title}</span>
                <span className="flex items-baseline gap-3 text-xs">
                  {s.onExpertPath && <span className="text-safe">{ru.profile.expertRun}</span>}
                  <span
                    className={cn(
                      s.outcome === 'success'
                        ? 'text-safe'
                        : s.outcome === 'partial'
                          ? 'text-warn'
                          : 'text-danger',
                    )}
                  >
                    {ru.outcomes[s.outcome]}
                  </span>
                  <span className="text-foreground font-semibold tabular-nums">{s.score}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
