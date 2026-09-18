import type { Metadata } from 'next'
import { ru } from '@/i18n/ru'
import './globals.css'

export const metadata: Metadata = {
  title: ru.app.name,
  description: ru.app.tagline,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body>{children}</body>
    </html>
  )
}
