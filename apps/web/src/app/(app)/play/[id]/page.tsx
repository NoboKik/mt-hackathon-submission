import { Player } from '@/components/player'

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <Player scenarioId={id} />
}
