import { Player } from '@/components/player'

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ auto?: string }>
}) {
  const { id } = await params
  const { auto } = await searchParams
  return <Player scenarioId={id} auto={auto === '1'} />
}
