'use client'

import type { LeaderboardPeriod, LeaderboardResponse, LeaderboardRow } from '@p400/shared'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ru } from '@/i18n/ru'
import { ApiError, api } from '@/lib/client'
import { cn } from '@/lib/utils'

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: 'week', label: ru.leaderboard.week },
  { key: 'all', label: ru.leaderboard.all },
]

function Row({ row, isMe }: { row: LeaderboardRow; isMe: boolean }) {
  return (
    <li
      className={cn(
        'rounded-card grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-4 border p-4',
        isMe ? 'border-brand-text bg-brand/10' : 'border-border bg-card',
      )}
    >
      <span className="text-muted-foreground text-sm font-semibold tabular-nums">{row.rank}</span>
      <span className="flex flex-col gap-0.5">
        <span className="flex items-baseline gap-2 text-sm">
          {row.displayName}
          {isMe && (
            <span className="text-brand-text text-xs font-semibold">{ru.leaderboard.you}</span>
          )}
        </span>
        <span className="text-muted-foreground text-xs">
          {row.position} · {row.depot}
        </span>
      </span>
      <span className="flex flex-col items-end gap-0.5">
        <span className="text-base font-semibold tabular-nums">{row.total}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {ru.leaderboard.scenarios}: {row.scenarios}
        </span>
      </span>
    </li>
  )
}

export default function LeaderboardPage() {
  const router = useRouter()
  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const [depot, setDepot] = useState<string>('')

  const board = useQuery({
    queryKey: ['leaderboard', period, depot],
    queryFn: () =>
      api<LeaderboardResponse>(
        `/leaderboard?period=${period}${depot ? `&depot=${encodeURIComponent(depot)}` : ''}`,
      ),
    retry: false,
  })

  useEffect(() => {
    if (board.error instanceof ApiError && board.error.status === 401) router.push('/login')
  }, [board.error, router])

  const d = board.data
  // The viewer's own row is pinned below when the filtered top N does not contain it.
  const meShown = d?.me && d.top.some((r) => r.userId === d.me?.userId)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{ru.leaderboard.title}</h1>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="border-border flex rounded-full border p-0.5" role="tablist">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'focus-visible:ring-ring rounded-full px-4 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
                period === p.key ? 'bg-brand font-semibold text-white' : 'text-muted-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {d && d.depots.length > 0 && (
          <select
            value={depot}
            onChange={(e) => setDepot(e.target.value)}
            aria-label={ru.leaderboard.depot}
            className="border-input bg-card rounded-card focus-visible:ring-ring border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="">{ru.leaderboard.allDepots}</option>
            {d.depots.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {board.isPending && <p className="text-muted-foreground text-sm">{ru.common.loading}</p>}
      {board.error && <p className="text-danger text-sm">{board.error.message}</p>}

      {d && d.top.length === 0 && (
        <p className="text-muted-foreground text-sm">{ru.leaderboard.empty}</p>
      )}

      {d && d.top.length > 0 && (
        <ul className="flex flex-col gap-2">
          {d.top.map((row) => (
            <Row key={row.userId} row={row} isMe={row.userId === d.me?.userId} />
          ))}
        </ul>
      )}

      {d?.me && !meShown && (
        <ul className="border-border flex flex-col gap-2 border-t pt-4">
          <Row row={d.me} isMe={true} />
        </ul>
      )}
    </div>
  )
}
