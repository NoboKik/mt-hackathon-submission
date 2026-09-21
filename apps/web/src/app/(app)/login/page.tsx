'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button, Card, Eyebrow, Field } from '@/components/ui'
import { ru } from '@/i18n/ru'
import { post } from '@/lib/client'

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
    // One floating panel, optically centred in what is left of the viewport under the
    // floating header. 60vh + the layout's own pt-20/pb-16 still fits a 375x812 phone
    // without introducing a scrollbar on the first screen a new user sees.
    <div className="flex min-h-[60vh] flex-col justify-center py-4 sm:py-8">
      {/* elevation="rest" ships shadow-card; twMerge promotes it to the heavier shadow-lift,
          which is what lets this one card read as the only object on the page. */}
      <Card pad="lg" className="mx-auto w-full max-w-sm shadow-lift">
        <header className="flex flex-col gap-2">
          {/* The tagline runs to two lines at 375px, and text-eyebrow's line-height is 1. */}
          <Eyebrow className="text-balance leading-4">{ru.app.tagline}</Eyebrow>
          <h1 className="text-display text-balance">{ru.auth.title}</h1>
          <p className="text-sm text-balance text-muted-foreground">{ru.auth.subtitle}</p>
        </header>

        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            signIn.mutate({ email, password })
          }}
        >
          <Field
            label={ru.auth.email}
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label={ru.auth.password}
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {signIn.error && (
            <p
              role="alert"
              className="rounded-card bg-danger/12 px-3 py-2.5 text-sm font-medium text-danger-text"
            >
              {signIn.error.message}
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            type="submit"
            disabled={signIn.isPending}
            className="w-full"
          >
            {ru.auth.signIn}
          </Button>
        </form>

        {/* Guests without an account use the demo login, so it sits on the same card at the
            same size as the real submit — secondary only by variant, never below a fold. */}
        <hr className="my-6 border-border" />

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="lg"
            disabled={signIn.isPending}
            onClick={() => signIn.mutate(undefined)}
            className="w-full"
          >
            {ru.auth.demo}
          </Button>
          <p className="text-xs text-balance text-muted-foreground">{ru.auth.demoHint}</p>
        </div>
      </Card>
    </div>
  )
}
