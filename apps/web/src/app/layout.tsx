import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ru } from '@/i18n/ru'
import './globals.css'

// Self-hosted at build time: no request to Google at runtime, which also keeps the
// first paint off a third party. See the note in tokens.css for why this face.
// 500 and 600 are loaded because the type scale uses them — without them `font-medium`
// and `font-semibold` silently render as 400.
const sans = Inter({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: ru.app.name,
  description: ru.app.tagline,
}

// Light is the default, so this only ever ADDS a class — there is nothing to remove and
// no second code path. It runs before first paint, which is the whole point: set from
// React instead and every dark-theme visitor gets a white flash on every navigation.
const THEME_SCRIPT = `try{if(localStorage.theme==='dark')document.documentElement.classList.add('dark')}catch{}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script above mutates this element's class list before
    // React hydrates, so the server and client markup legitimately differ by one token.
    <html lang="ru" className={sans.variable} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a blocking inline script is
            the only way to set the theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
