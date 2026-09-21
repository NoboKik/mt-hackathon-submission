'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { Button, buttonClass, Card, Eyebrow } from '@/components/ui'
import { ru } from '@/i18n/ru'
import { ApiError, post } from '@/lib/client'

type AutoResponse = { scenarioId: string } | { status: 'generating' }

const POLL_MS = 4_000
const GIVE_UP_MS = 120_000

/**
 * Auto mode's lobby: ask the pool for a scenario, and while it is still being generated, ask
 * again every few seconds. A query rather than an effect so React Query owns the interval,
 * dedupes the strict-mode double mount and stops polling on unmount. gcTime 0: a cached
 * scenarioId from the last visit would otherwise redirect straight back into that scenario.
 */
export function AutoMode() {
  const router = useRouter()
  const startedAt = useRef(Date.now())

  const q = useQuery({
    queryKey: ['auto'],
    queryFn: () => post<AutoResponse>('/auto'),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const data = query.state.data
      return data && !('scenarioId' in data) && Date.now() - startedAt.current < GIVE_UP_MS
        ? POLL_MS
        : false
    },
  })

  const scenarioId = q.data && 'scenarioId' in q.data ? q.data.scenarioId : null

  useEffect(() => {
    if (scenarioId) router.replace(`/play/${scenarioId}?auto=1`)
  }, [scenarioId, router])

  useEffect(() => {
    if (q.error instanceof ApiError && q.error.status === 401) router.push('/login')
  }, [q.error, router])

  const generating = q.data !== undefined && !scenarioId
  const gaveUp = generating && q.dataUpdatedAt - startedAt.current >= GIVE_UP_MS

  const back = (
    <Link href="/" className={buttonClass({ variant: 'outline' })}>
      {ru.debrief.toCatalogue}
    </Link>
  )

  let body: React.ReactNode
  if (q.error) {
    body = (
      <>
        <Card elevation="flat" pad="lg" className="w-full border-danger/40 bg-danger/12">
          <p className="text-sm text-danger-text">{q.error.message}</p>
        </Card>
        {back}
      </>
    )
  } else if (gaveUp) {
    body = (
      <>
        <Card elevation="flat" pad="lg" className="w-full border-warn/40 bg-warn/12">
          <p className="text-sm text-warn-text">{ru.auto.gaveUp}</p>
        </Card>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={q.isFetching}
            onClick={() => {
              startedAt.current = Date.now()
              q.refetch()
            }}
          >
            {ru.common.retry}
          </Button>
          {back}
        </div>
      </>
    )
  } else if (generating) {
    body = (
      <Card pad="lg" className="flex w-full flex-col gap-2" role="status">
        <p className="text-lead text-balance">{ru.auto.generating}</p>
        <p className="text-sm text-muted-foreground">{ru.auto.generatingHint}</p>
      </Card>
    )
  } else {
    // Pending, or a scenario id that is already being navigated to.
    body = (
      <p className="text-sm text-muted-foreground" role="status">
        {ru.common.loading}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Eyebrow>{ru.app.tagline}</Eyebrow>
        <h1 className="text-display text-balance">{ru.auto.title}</h1>
      </header>
      <div className="flex flex-col items-start gap-4">{body}</div>
    </div>
  )
}
