import { type AdminGraphResponse, scenarioGraph } from '@p400/shared'
import { NextResponse } from 'next/server'
import { scenarioById } from '@/db/queries'
import { ru } from '@/i18n/ru'
import { fail } from '@/lib/api'
import { currentUserId } from '@/lib/auth'

// `users` has no role column, so this is gated on any signed-in user. A real admin gate is a
// migration and its own session.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId()
  if (!userId) return fail(401, ru.errors.unauthorized)

  const found = await scenarioById((await params).id)
  if (!found) return fail(404, ru.errors.scenarioNotFound)

  const graph = scenarioGraph(found.scenario)
  const res: AdminGraphResponse = {
    ...graph,
    // packages/shared holds no Russian, so the timeout branch arrives as a flag and gets its
    // words here. A consequence edge stays unlabelled: an auto-advance has nothing to quote.
    edges: graph.edges.map((e) => (e.isTimeout ? { ...e, label: ru.admin.timeoutEdge } : e)),
  }
  return NextResponse.json(res)
}
