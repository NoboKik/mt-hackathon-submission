'use client'

import type { LeaderboardPeriod, LeaderboardResponse, LeaderboardRow } from '@p400/shared'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, Eyebrow, fieldClass } from '@/components/ui'
import { ru } from '@/i18n/ru'
import { ApiError, api } from '@/lib/client'
import { cn } from '@/lib/utils'

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: 'week', label: ru.leaderboard.week },
  { key: 'all', label: ru.leaderboard.all },
]

/** ISO → «21 сент., 14:03». Locale tag, not copy — the words come from Intl. */
function formatUpdated(iso: string) {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  return at.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * One row of the board — a list item, not a card. The whole board is a single elevated
 * surface, so the rows carry nothing but a divider; twenty bordered boxes read as a
 * wireframe, one card with twenty rows reads as a table.
 */
function Row({ row, isMe }: { row: LeaderboardRow; isMe: boolean }) {
  // The podium is typographic on purpose: gold/silver/bronze would be three more accent
  // colours, and this app has exactly one.
  const podium = row.rank <= 3

  return (
    <li
      className={cn(
        'relative flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5',
        // The viewer's own row: tinted fill plus a 3px brand bar down the left edge. Both
        // halves flip with the theme, so it stays legible either way.
        isMe &&
          "bg-accent before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-brand before:content-['']",
      )}
    >
      <span
        className={cn(
          // Fixed width so the numerals form a column: two digits still fit at 375px.
          'w-8 shrink-0 text-right tabular-nums',
          podium ? 'text-brand-text text-xl font-bold' : 'text-base text-muted-foreground',
        )}
      >
        {row.rank}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-semibold sm:text-base">{row.displayName}</span>
          {isMe && (
            // Not a Chip: the me-row fill is bg-accent and every chip tone would vanish
            // into it. Typographic marker instead.
            <span className="text-eyebrow tracking-eyebrow shrink-0 font-semibold text-brand-text uppercase">
              {ru.leaderboard.you}
            </span>
          )}
        </span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {row.position} · {row.depot}
        </span>
      </div>

      <span className="flex shrink-0 flex-col items-end">
        <span className="text-base font-bold tabular-nums sm:text-lg">{row.total}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
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
  const me = d?.me ?? null
  // The viewer's own row is pinned below when the filtered top N does not contain it.
  const meShown = !!me && !!d?.top.some((r) => r.userId === me.userId)
  const pinned = me && !meShown ? me : null
  const updated = d ? formatUpdated(d.updatedAt) : null

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Eyebrow>{ru.app.name}</Eyebrow>
        <h1 className="text-display sm:text-display-lg">{ru.leaderboard.title}</h1>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Segmented control: one well, the active period a filled pill inside it. */}
        <div className="flex w-full rounded-full bg-muted p-1 sm:w-auto" role="tablist">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'flex h-10 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex-none',
                period === p.key
                  ? 'bg-brand text-primary-foreground shadow-card'
                  : 'text-muted-foreground hover:text-foreground',
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
            // The shared input recipe, so the filter matches the login fields — including
            // its 16px text, which is what stops iOS zooming the page on focus.
            className={cn(fieldClass, 'sm:w-56')}
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

      {board.isPending && (
        <Card pad="lg" className="text-sm text-muted-foreground">
          {ru.common.loading}
        </Card>
      )}
      {board.error && (
        <Card pad="lg" className="text-sm text-danger-text">
          {board.error.message}
        </Card>
      )}

      {d && d.top.length === 0 && (
        <Card pad="lg" className="text-sm text-muted-foreground">
          {ru.leaderboard.empty}
        </Card>
      )}

      {d && (d.top.length > 0 || pinned) && (
        <Card pad="none" className="overflow-hidden">
          {d.top.length > 0 && (
            <ul className="divide-y divide-border">
              {d.top.map((row) => (
                <Row key={row.userId} row={row} isMe={row.userId === me?.userId} />
              ))}
            </ul>
          )}

          {/* The pinned row is a continuation of the same board, not a second box: the dashed
              rule is the gap in the ranking, drawn inside the card it belongs to. */}
          {pinned && (
            <ul className={cn(d.top.length > 0 && 'border-t border-dashed border-border')}>
              <Row row={pinned} isMe={true} />
            </ul>
          )}
        </Card>
      )}

      {updated && (
        <p className="text-xs text-muted-foreground sm:text-right">
          {ru.leaderboard.updated}: {updated}
        </p>
      )}
    </div>
  )
}
