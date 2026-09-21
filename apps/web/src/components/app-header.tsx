'use client'

import { Menu, TrainFront, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { ThemeToggle } from '@/components/ui'
import { ru } from '@/i18n/ru'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: ru.nav.scenarios },
  { href: '/profile', label: ru.nav.profile },
  { href: '/leaderboard', label: ru.nav.leaderboard },
] as const

// The wordmark is typographic plus a generic glyph on purpose: the organizer's marks belong
// to them, so the app carries its own name rather than borrowing ВСМ-400 or Moscow Transport
// branding. The arcs in their logo are exactly the thing not to reuse.
function Wordmark({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring rounded-card flex items-center gap-2 focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
    >
      <TrainFront className="text-brand-text size-5 shrink-0" aria-hidden="true" />
      <span className="text-sm font-bold tracking-tight whitespace-nowrap">{ru.app.name}</span>
    </Link>
  )
}

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export function AppHeader() {
  const pathname = usePathname()
  const drawer = useRef<HTMLDialogElement>(null)

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
      {/* An ordinary bar: solid, full-bleed, bottom rule, no blur and no pill. A floating
          pill reads as a detached widget once the viewport is wider than the content column,
          which is exactly where it looked worst. */}
      <header className="border-border bg-card sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark />

          <div className="flex items-center gap-1">
            <nav className="hidden sm:block">
              <ul className="flex items-center gap-6">
                {LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={isActive(pathname, link.href) ? 'page' : undefined}
                      className={cn(
                        'focus-visible:ring-ring rounded-sm text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
                        isActive(pathname, link.href)
                          ? 'text-foreground font-semibold'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <ThemeToggle className="sm:ml-4" />

            <button
              type="button"
              aria-label={ru.nav.menu}
              onClick={() => drawer.current?.showModal()}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-11 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none sm:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
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

          <div className="border-border mt-auto flex items-center justify-between border-t px-4 py-3">
            <span className="text-muted-foreground text-sm">{ru.nav.theme}</span>
            <ThemeToggle />
          </div>
        </div>
      </dialog>
    </>
  )
}
