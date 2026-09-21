import { Providers } from '@/app/providers'
import { AppHeader } from '@/components/app-header'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        {/* pt-20 clears the floating header (14 header + 3 top offset + 3 breathing room). */}
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-20 pb-16 sm:px-5">{children}</main>
      </div>
    </Providers>
  )
}
