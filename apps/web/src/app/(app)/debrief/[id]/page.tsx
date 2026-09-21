import { Debrief } from '@/components/debrief'

export default async function DebriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <Debrief sessionId={id} />
}
