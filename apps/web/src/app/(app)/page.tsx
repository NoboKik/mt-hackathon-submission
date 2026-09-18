import { ru } from '@/i18n/ru'

// Placeholder until the catalogue screen lands.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-brand-text text-sm font-semibold tracking-[0.2em] uppercase">
        {ru.app.tagline}
      </p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{ru.app.name}</h1>
      <p className="text-muted-foreground text-lg text-balance">{ru.home.subtitle}</p>
      <p className="text-muted-foreground border-border border-t pt-6 text-sm">{ru.home.status}</p>
    </main>
  )
}
