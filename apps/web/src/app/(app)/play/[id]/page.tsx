import { notFound, redirect } from 'next/navigation'
import { Player } from '@/components/player'
import { scenarioById } from '@/db/queries'
import { currentUserId } from '@/lib/auth'

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ auto?: string }>
}) {
  const { id } = await params
  const { auto } = await searchParams
  // Middleware only checks that a cookie exists; the briefing is content, so verify it here.
  if (!(await currentUserId())) redirect('/login')
  const found = await scenarioById(id)
  if (!found) notFound()
  const { title, intro } = found.scenario
  return <Player scenarioId={id} title={title} intro={intro} auto={auto === '1'} />
}
