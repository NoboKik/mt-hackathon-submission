'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ru } from '@/i18n/ru'
import { post } from '@/lib/client'

const field =
  'border-input bg-card rounded-card focus-visible:ring-ring w-full border px-3 py-2.5 text-base focus-visible:ring-2 focus-visible:outline-none'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signIn = useMutation({
    mutationFn: (body?: { email: string; password: string }) =>
      post(body ? '/auth/login' : '/auth/demo', body),
    onSuccess: () => router.push('/'),
  })

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-7 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{ru.auth.title}</h1>
        <p className="text-muted-foreground text-sm text-balance">{ru.auth.subtitle}</p>
      </header>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          signIn.mutate({ email, password })
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-muted-foreground text-xs font-semibold">
            {ru.auth.email}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-muted-foreground text-xs font-semibold">
            {ru.auth.password}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
        </div>

        {signIn.error && (
          <p className="text-danger text-sm" role="alert">
            {signIn.error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={signIn.isPending}
          className="bg-brand hover:bg-brand-hover focus-visible:ring-ring rounded-card px-4 py-2.5 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        >
          {ru.auth.signIn}
        </button>
      </form>

      <div className="border-border flex flex-col gap-2 border-t pt-5">
        <button
          type="button"
          disabled={signIn.isPending}
          onClick={() => signIn.mutate(undefined)}
          className="border-brand-text text-brand-text hover:bg-secondary focus-visible:ring-ring rounded-card border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        >
          {ru.auth.demo}
        </button>
        <p className="text-muted-foreground text-xs">{ru.auth.demoHint}</p>
      </div>
    </div>
  )
}
