import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { ru } from '@/i18n/ru'
import './globals.css'

// Moscow Sans, the organizer's brand face. It ships only 400 and 800, so `font-medium`
// resolves to 400 and `font-semibold`/`font-bold` to 800 by the browser's nearest-weight rule.
const sans = localFont({
  src: [
    { path: './fonts/MoscowSans-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/MoscowSans-ExtraBold.otf', weight: '800', style: 'normal' },
  ],
  variable: '--font-moscow',
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
