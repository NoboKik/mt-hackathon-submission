import { type AdminGraphResponse, type Condition, type Scenario, scenarioGraph } from '@p400/shared'
import { NextResponse } from 'next/server'
import { scenarioById } from '@/db/queries'
import { ru } from '@/i18n/ru'
import { fail } from '@/lib/api'
import { currentUserId } from '@/lib/auth'

function conditionLabel(c: Condition, scenario: Scenario): string {
  const parts: string[] = []
  for (const m of ['loyalty', 'safety'] as const) {
    if (c[m]?.gte !== undefined) parts.push(`${ru.admin.branchMeter[m]} ≥ ${c[m].gte}`)
    if (c[m]?.lt !== undefined) parts.push(`${ru.admin.branchMeter[m]} < ${c[m].lt}`)
  }
  if (c.chose !== undefined) {
    const choice = Object.values(scenario.nodes)
      .flatMap((n) => (n.type === 'choice' ? n.choices : []))
      .find((ch) => ch.id === c.chose)
    parts.push(`${ru.admin.branchChose} «${choice?.text ?? c.chose}»`)
  }
  return parts.join(ru.admin.branchAnd)
}

// Open to any signed-in user: the graph is course content with no personal data in it, unlike
// crew analytics, which is limited to crew leads and methodists.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId()
  if (!userId) return fail(401, 'unauthorized')

  const found = await scenarioById((await params).id)
  if (!found) return fail(404, 'scenarioNotFound')

  const graph = scenarioGraph(found.scenario)
  const res: AdminGraphResponse = {
    ...graph,
    // packages/shared holds no Russian, so the timeout branch arrives as a flag and gets its
    // words here, and so do v1.1 branch conditions. A plain consequence edge stays unlabelled:
    // an auto-advance has nothing to quote.
    edges: graph.edges.map((e) =>
      e.isTimeout
        ? { ...e, label: ru.admin.timeoutEdge }
        : e.condition
          ? { ...e, label: conditionLabel(e.condition, found.scenario) }
          : e.isFallback
            ? { ...e, label: ru.admin.fallbackEdge }
            : e,
    ),
  }
  return NextResponse.json(res)
}
