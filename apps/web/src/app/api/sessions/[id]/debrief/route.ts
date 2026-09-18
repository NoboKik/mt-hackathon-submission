import {
  type Debrief,
  type DebriefResponse,
  type DebriefStep,
  debriefFor,
  EngineError,
  type MeterKey,
  type Scenario,
  THRESHOLD_END_ID,
} from '@p400/shared'
import { NextResponse } from 'next/server'
import { sessionFor } from '@/db/queries'
import { ru } from '@/i18n/ru'
import { fail } from '@/lib/api'
import { currentUserId } from '@/lib/auth'

/** Choice text by choice id: the path stores ids, the debrief shows what the player picked. */
function choiceTexts(scenario: Scenario) {
  const texts = new Map<string, string>()
  for (const node of Object.values(scenario.nodes)) {
    if (node.type === 'choice') for (const c of node.choices) texts.set(c.id, c.text)
  }
  return texts
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId()
  if (!userId) return fail(401, ru.errors.unauthorized)

  const loaded = await sessionFor((await params).id, userId)
  if (!loaded) return fail(404, ru.errors.sessionNotFound)
  const { session, scenario } = loaded
  // Also narrows outcome and scoreBreakdown, which are null for as long as a session runs.
  if (!session.finishedAt || !session.outcome || !session.scoreBreakdown)
    return fail(409, ru.errors.sessionNotFinished)

  // Seeded history is finished but parked on its start node, and a threshold end can only
  // borrow a debrief from a success ending the scenario may not have. Neither has one to show.
  let debrief: Debrief
  try {
    debrief = debriefFor(scenario, session.currentNode)
  } catch (e) {
    if (e instanceof EngineError) return fail(409, ru.errors.debriefUnavailable)
    throw e
  }
  const texts = choiceTexts(scenario)
  const yourPath: DebriefStep[] = session.path.map((step) => {
    const node = scenario.nodes[step.nodeId]
    return {
      nodeId: step.nodeId,
      nodeText: node?.type === 'choice' ? node.text : '',
      choiceId: step.choiceId,
      // null on a timeout: the player picked nothing, so there is nothing to quote back.
      choiceText: texts.get(step.choiceId) ?? null,
      onExpertPath: debrief.expertPath.includes(step.choiceId),
    }
  })

  const meters = { loyalty: session.loyalty, safety: session.safety }
  // The synthetic end is stored as an id, not a node, so re-derive the meter that broke from the
  // stored meters — safety first, the same priority the engine uses.
  const failedMeter: MeterKey | undefined =
    session.currentNode !== THRESHOLD_END_ID
      ? undefined
      : meters.safety < scenario.failThresholds.safety
        ? 'safety'
        : 'loyalty'

  const res: DebriefResponse = {
    outcome: session.outcome,
    ...(failedMeter ? { failedMeter } : {}),
    meters,
    score: session.scoreBreakdown,
    competencyDeltas: session.competencyDeltas,
    lesson: debrief.lesson,
    regulation: debrief.regulation,
    yourPath,
    // The validator proves every expertPath id exists, so the fallback text never ships.
    expertPath: debrief.expertPath.map((id) => ({ choiceId: id, text: texts.get(id) ?? '' })),
  }
  return NextResponse.json(res)
}
