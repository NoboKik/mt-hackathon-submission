import { Providers } from '@/app/providers'

/**
 * The scenario runner gets its own route group so the shell header can be absent instead of
 * conditionally hidden. During a run the floating bar carries the meters and the countdown —
 * the nav would compete with the only two numbers that matter — and the way out is the ✕ in
 * that bar or the debrief at the end. The URL is unchanged: route groups do not appear in it.
 */
export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex min-h-dvh flex-col">{children}</div>
    </Providers>
  )
}
