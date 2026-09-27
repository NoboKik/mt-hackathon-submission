'use client'

import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Menu, TrainFront, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { NotificationBell } from '@/components/notifications'
import { ThemeToggle } from '@/components/ui'
import { ru } from '@/i18n/ru'
import { post } from '@/lib/client'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: ru.nav.scenarios },
  { href: '/profile', label: ru.nav.profile },
  { href: '/leaderboard', label: ru.nav.leaderboard },
  { href: '/admin/analytics', label: ru.nav.analytics },
] as const

// The wordmark is typographic plus a generic glyph on purpose: the organizer's marks belong
// to them, so the app carries its own name rather than borrowing ВСМ-400 or Moscow Transport
// branding. The arcs in their logo are exactly the thing not to reuse.
function Wordmark({
  className,
  onClick,
  onHeader,
}: {
  className?: string
  onClick?: () => void
  onHeader?: boolean
}) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className={cn(
        'rounded-card flex items-center gap-2 focus-visible:ring-2 focus-visible:outline-none',
        onHeader ? 'focus-visible:ring-header-foreground' : 'focus-visible:ring-ring',
        className,
      )}
    >
      <TrainFront
        className={cn('size-6 shrink-0', !onHeader && 'text-brand-text')}
        aria-hidden="true"
      />
      <span className="text-lg font-bold tracking-tight whitespace-nowrap sm:text-xl">
        {ru.app.name}
      </span>
    </Link>
  )
}

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const drawer = useRef<HTMLDialogElement>(null)
  // The header has no auth state of its own; /login is the one page you're signed out on.
  const signedIn = pathname !== '/login'

  const signOut = async () => {
    drawer.current?.close()
    await post('/auth/logout')
    // The next account must not see the previous one's profile from the cache.
    queryClient.clear()
    router.push('/login')
  }

  // Close the drawer when the viewport grows past the sm breakpoint. `sm:hidden` on the
  // <dialog> does not do this on its own: once showModal() puts the element in the top
  // layer it keeps rendering at display:block regardless — measured, not assumed — so a
  // phone rotated from portrait to landscape (812px wide, past the 640px breakpoint) would
  // sit under a full-screen menu covering the desktop layout it just switched to.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 40rem)')
    const close = () => {
      if (desktop.matches) drawer.current?.close()
    }
    close()
    desktop.addEventListener('change', close)
    return () => desktop.removeEventListener('change', close)
  }, [])

  return (
    <>
      {/* transport.mos.ru's bar: full-bleed red, white type, the active link a full-height tile
          one shade darker. No blur, no pill, no bottom rule — the red is the edge. */}
      <header className="bg-header text-header-foreground sticky top-0 z-40">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark onHeader />

          <div className="flex items-center gap-1">
            {signedIn && (
              <nav className="hidden sm:block">
                <ul className="flex h-14 items-stretch">
                  {LINKS.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={isActive(pathname, link.href) ? 'page' : undefined}
                        className={cn(
                          'hover:bg-header-active focus-visible:ring-header-foreground flex h-full items-center px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                          isActive(pathname, link.href) && 'bg-header-active',
                        )}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {/* Mounted only when signed in, so /login never asks for a feed it would 401 on. */}
            {signedIn && (
              <div className="sm:ml-2">
                <NotificationBell />
              </div>
            )}

            <ThemeToggle className="text-header-foreground hover:bg-header-active hover:text-header-foreground focus-visible:ring-header-foreground" />

            {signedIn && (
              <button
                type="button"
                aria-label={ru.nav.signOut}
                title={ru.nav.signOut}
                onClick={signOut}
                className="hover:bg-header-active focus-visible:ring-header-foreground hidden size-11 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none sm:flex"
              >
                <LogOut className="size-5" aria-hidden="true" />
              </button>
            )}

            {signedIn && (
              <button
                type="button"
                aria-label={ru.nav.menu}
                onClick={() => drawer.current?.showModal()}
                className="hover:bg-header-active focus-visible:ring-header-foreground flex size-11 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none sm:hidden"
              >
                <Menu className="size-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* A native <dialog>: focus trap, Esc to close, inert background and top-layer stacking
          are all the platform's job here, which is why there is no Sheet component and no
          Radix dependency. Phone only. Animation lives in globals.css. */}
      <dialog
        ref={drawer}
        aria-label={ru.nav.menu}
        className="drawer bg-background text-foreground fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 p-0 sm:hidden"
      >
        <div className="flex h-full flex-col p-3">
          <div className="flex h-14 items-center justify-between pl-1">
            <Wordmark onClick={() => drawer.current?.close()} />
            <button
              type="button"
              aria-label={ru.nav.close}
              onClick={() => drawer.current?.close()}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-11 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          <nav className="mt-6">
            <ul className="flex flex-col gap-2">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => drawer.current?.close()}
                    aria-current={isActive(pathname, link.href) ? 'page' : undefined}
                    className={cn(
                      'rounded-card focus-visible:ring-ring flex h-14 items-center px-4 text-lg font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      isActive(pathname, link.href)
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {signedIn && (
            <button
              type="button"
              onClick={signOut}
              className="rounded-card text-foreground hover:bg-muted focus-visible:ring-ring mt-auto flex h-14 items-center gap-3 px-4 text-lg font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <LogOut className="text-muted-foreground size-5" aria-hidden="true" />
              {ru.nav.signOut}
            </button>
          )}

          <div
            className={cn(
              'border-border flex items-center justify-between border-t px-4 py-3',
              !signedIn && 'mt-auto',
            )}
          >
            <span className="text-muted-foreground text-sm">{ru.nav.theme}</span>
            <ThemeToggle />
          </div>
        </div>
      </dialog>
    </>
  )
}
