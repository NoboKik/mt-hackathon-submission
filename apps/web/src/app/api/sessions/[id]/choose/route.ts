import {
  ChooseBody,
  type ChooseResponse,
  type ChooseResult,
  COMPETENCIES,
  type Competency,
  choose,
  EngineError,
  statsFor,
  TIMER_GRACE_MS,
  unlockedCodes,
} from '@p400/shared'
import { NextResponse } from 'next/server'
import {
  achievementInput,
  advanceSession,
  clearLeaderboardCache,
  sessionFor,
  unlockAchievements,
} from '@/db/queries'
import type { PathStep } from '@/db/schema'
import { endText, expertPathTaken, fail, finishValues } from '@/lib/api'
import { currentUserId } from '@/lib/auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId()
  if (!userId) return fail(401, 'unauthorized')

  const body = ChooseBody.safeParse(await req.json().catch(() => null))
  if (!body.success) return fail(400, 'badRequest', body.error.issues)

  const loaded = await sessionFor((await params).id, userId)
  if (!loaded) return fail(404, 'sessionNotFound')
  const { session, scenario } = loaded
  // Covers a finished session, a stale node id and the double submit of the same step.
  if (session.finishedAt || session.currentNode !== body.data.nodeId) return fail(409, 'staleStep')

  // The server's clock is the referee: a real choice that arrives after the timer plus the grace
  // window is a timeout, whatever elapsedMs the client reports.
  const node = scenario.nodes[session.currentNode]
  const timerMs = node?.type === 'choice' ? node.timerSec * 1000 : 0
  const serverElapsedMs = Date.now() - session.nodeStartedAt.getTime()
  const timedOut = body.data.choiceId === 'timeout' || serverElapsedMs > timerMs + TIMER_GRACE_MS
  const choiceId = timedOut ? 'timeout' : body.data.choiceId

  let result: ChooseResult
  try {
    result = choose(
      scenario,
      session.currentNode,
      choiceId,
      {
        loyalty: session.loyalty,
        safety: session.safety,
      },
      session.seed,
      session.path.map((step) => step.choiceId),
    )
  } catch (e) {
    // A choice id the node doesn't have: a stale or hand-rolled client, not a server fault.
    if (e instanceof EngineError) return fail(400, 'badRequest')
    throw e
  }

  const next = endText(result.node)
  const path: PathStep[] = [
    ...session.path,
    { nodeId: body.data.nodeId, choiceId, clientElapsedMs: body.data.elapsedMs, serverElapsedMs },
  ]
  const competencyDeltas: Partial<Record<Competency, number>> = { ...session.competencyDeltas }
  for (const key of COMPETENCIES) {
    const delta = result.choice?.competencies[key]
    if (delta) competencyDeltas[key] = (competencyDeltas[key] ?? 0) + delta
  }
  const finish =
    next.type === 'end' ? finishValues(scenario, next.outcome, path, competencyDeltas) : undefined

  const written = await advanceSession(session.id, body.data.nodeId, {
    currentNode: next.id,
    nodeStartedAt: new Date(),
    loyalty: result.meters.loyalty,
    safety: result.meters.safety,
    path,
    competencyDeltas,
    ...finish,
  })
  // Another tab moved this session on between the read and the write.
  if (!written) return fail(409, 'staleStep')

  // Only a finished run can unlock anything, and only after the write won its race: a lost race
  // must not hand out a badge for a step some other tab actually took.
  // The rows are read back after the write, so they include the run that just ended.
  let achievements: string[] = []
  if (finish) {
    // The board is cached for 30 s, and a player checks it right after a run: without this
    // they would not see themselves climb until the cache expired.
    clearLeaderboardCache()
    const { rows, scenarioCount } = await achievementInput(userId)
    achievements = await unlockAchievements(
      userId,
      unlockedCodes(
        statsFor(rows, scenarioCount, {
          scenarioId: session.scenarioId,
          category: scenario.category,
          outcome: finish.outcome,
          score: finish.score,
          loyalty: result.meters.loyalty,
          safety: result.meters.safety,
          finishedAt: finish.finishedAt.getTime(),
          choiceIds: path.map((step) => step.choiceId),
          expertPath: expertPathTaken(scenario, next.id, path),
        }),
      ),
    )
  }

  const res: ChooseResponse = {
    steps: result.steps,
    node: next,
    meters: result.meters,
    failThresholds: scenario.failThresholds,
    deltas: {
      loyalty: result.meters.loyalty - session.loyalty,
      safety: result.meters.safety - session.safety,
    },
    timedOut,
    finished: finish !== undefined,
    ...(finish ? { score: finish.scoreBreakdown } : {}),
    // Newly unlocked only: a replay of the same perfect run returns [].
    achievements,
  }
  return NextResponse.json(res)
}
