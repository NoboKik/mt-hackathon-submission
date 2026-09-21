import { Debrief } from '@/components/debrief'

export default async function DebriefPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ auto?: string }>
}) {
  const { id } = await params
  const { auto } = await searchParams
  return <Debrief sessionId={id} auto={auto === '1'} />
}
