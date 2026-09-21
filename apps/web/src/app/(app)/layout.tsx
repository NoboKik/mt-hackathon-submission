import Link from 'next/link'
import { Providers } from '@/app/providers'
import { ru } from '@/i18n/ru'

// The wordmark is typographic on purpose: the organizer's marks belong to them, so the app
// carries its own name rather than borrowing ВСМ-400 or Moscow Transport branding.
function Wordmark() {
  return (
    <Link
      href="/"
      className="focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="text-base font-bold tracking-tight">{ru.app.name}</span>
    </Link>
  )
}

const links = [
  { href: '/', label: ru.nav.scenarios },
  { href: '/profile', label: ru.nav.profile },
  { href: '/leaderboard', label: ru.nav.leaderboard },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex min-h-dvh flex-col">
        <header className="border-border/70 bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-6 px-5 py-3">
            <Wordmark />
            <nav>
              <ul className="flex items-center gap-5 text-sm">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">{children}</main>
      </div>
    </Providers>
  )
}
