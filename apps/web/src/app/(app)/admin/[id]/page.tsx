import { ScenarioGraph } from '@/components/scenario-graph'

export default async function AdminGraphPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ScenarioGraph scenarioId={id} />
}
