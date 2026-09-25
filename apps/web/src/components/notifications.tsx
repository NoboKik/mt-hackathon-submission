'use client'

import type { AppNotification, NotificationsResponse } from '@p400/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Award, Bell, CalendarCheck, Flame, Hourglass, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useRef } from 'react'
import { ru } from '@/i18n/ru'
import { api, post } from '@/lib/client'
import { cn } from '@/lib/utils'

/** One query behind the bell and the home screen's daily card: they read the same response. */
export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationsResponse>('/notifications'),
    retry: false,
  })

const ICON = {
  streak: Flame,
  daily: CalendarCheck,
  weekly: Hourglass,
  badge: Award,
  'new-scenario': Sparkles,
} as const

function view(n: AppNotification): { text: string; href: string } {
  switch (n.kind) {
    case 'streak':
      return { text: ru.notifications.streak(n.days), href: '/' }
    case 'daily':
      return { text: ru.notifications.daily(n.title), href: `/play/${n.scenarioId}` }
    case 'weekly':
      return { text: ru.notifications.weekly(n.title, n.days), href: `/play/${n.scenarioId}` }
    case 'badge':
      return { text: ru.notifications.badge(ru.achievements[n.code].title), href: '/profile' }
    case 'new-scenario':
      return { text: ru.notifications.newScenario(n.title), href: `/play/${n.scenarioId}` }
  }
}

/**
 * The header bell and its sheet. The sheet is the nav drawer's native <dialog> again, narrower
 * on desktop. Read state is written on close, not on open, so the dots stay visible while the
 * list is being read.
 */
export function NotificationBell() {
  const sheet = useRef<HTMLDialogElement>(null)
  const queryClient = useQueryClient()
  const { data } = useNotifications()
  const unread = data?.unread ?? 0

  const markRead = async () => {
    if (!unread) return
    await post('/notifications/read')
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <>
      <button
        type="button"
        aria-label={unread ? ru.notifications.unread(unread) : ru.notifications.title}
        title={ru.notifications.title}
        onClick={() => sheet.current?.showModal()}
        className="hover:bg-header-active focus-visible:ring-header-foreground relative flex size-11 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="bg-header-foreground text-brand absolute top-1.5 right-1 min-w-4.5 rounded-full px-1 text-center text-[0.6875rem] leading-4.5 font-bold tabular-nums"
          >
            {unread}
          </span>
        )}
      </button>

      <dialog
        ref={sheet}
        aria-label={ru.notifications.title}
        onClose={markRead}
        className="drawer bg-background text-foreground fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none border-0 p-0 sm:max-w-sm sm:shadow-float"
      >
        <div className="flex h-full flex-col p-3">
          <div className="flex h-14 items-center justify-between pl-1">
            <h2 className="text-lg font-bold">{ru.notifications.title}</h2>
            <button
              type="button"
              aria-label={ru.nav.close}
              onClick={() => sheet.current?.close()}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-11 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          {data?.items.length ? (
            <ul className="mt-2 flex flex-col gap-1 overflow-y-auto">
              {data.items.map((n) => {
                const Icon = ICON[n.kind]
                const { text, href } = view(n)
                return (
                  <li key={`${n.kind}-${n.at}-${text}`}>
                    <Link
                      href={href}
                      onClick={() => sheet.current?.close()}
                      className="rounded-card hover:bg-muted focus-visible:ring-ring flex items-start gap-3 px-3 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Icon
                        className={cn(
                          'mt-0.5 size-5 shrink-0',
                          n.read ? 'text-muted-foreground' : 'text-brand-text',
                        )}
                        aria-hidden="true"
                      />
                      <span className={cn('text-sm text-pretty', !n.read && 'font-semibold')}>
                        {text}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">
              {ru.notifications.empty}
            </p>
          )}
        </div>
      </dialog>
    </>
  )
}
