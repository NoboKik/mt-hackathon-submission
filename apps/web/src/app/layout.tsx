import type { Metadata } from 'next'
import { Commissioner } from 'next/font/google'
import { ru } from '@/i18n/ru'
import './globals.css'

// Self-hosted at build time: no request to Google at runtime, which also keeps the
// first paint off a third party. See the note in tokens.css for why this face.
const sans = Commissioner({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '700'],
  variable: '--font-commissioner',
  display: 'swap',
})

export const metadata: Metadata = {
  title: ru.app.name,
  description: ru.app.tagline,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`dark ${sans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
