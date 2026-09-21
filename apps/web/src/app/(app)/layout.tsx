import { Providers } from '@/app/providers'
import { AppHeader } from '@/components/app-header'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </Providers>
  )
}
