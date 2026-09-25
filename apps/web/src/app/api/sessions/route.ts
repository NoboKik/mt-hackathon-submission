import { randomInt } from 'node:crypto'
import { enter, StartSessionBody, type StartSessionResponse } from '@p400/shared'
import { NextResponse } from 'next/server'
import { createSession, scenarioById, userExists } from '@/db/queries'
import type { NewGameSession } from '@/db/schema'
import { endText, fail, finishValues } from '@/lib/api'
import { currentUserId } from '@/lib/auth'

export async function POST(req: Request) {
  const userId = await currentUserId()
  // The cookie can outlive its user, and only this route writes a row that references one:
  // without the check the insert trips the user_id foreign key and answers 500, not 401.
  if (!userId || !(await userExists(userId))) return fail(401, 'unauthorized')

  const body = StartSessionBody.safeParse(await req.json().catch(() => null))
  if (!body.success) return fail(400, 'badRequest', body.error.issues)

  // Trusted content: the seed only stores scenarios that passed the validator.
  const found = await scenarioById(body.data.scenarioId)
  if (!found) return fail(404, 'scenarioNotFound')
  const { scenario, source, status } = found

  // Seeds the choice shuffle; the same seed replays the same order.
  const seed = randomInt(2 ** 31)
  const result = enter(scenario, scenario.start, scenario.initial, seed)
  const node = endText(result.node)
  const values: NewGameSession = {
    userId,
    scenarioId: scenario.id,
    seed,
    currentNode: node.id,
    nodeStartedAt: new Date(),
    loyalty: result.meters.loyalty,
    safety: result.meters.safety,
    // A start chain that breaks a threshold is over before the player chooses anything.
    ...(node.type === 'end' ? finishValues(scenario, node.outcome, [], {}) : {}),
  }

  const res: StartSessionResponse = {
    sessionId: await createSession(values),
    seed,
    scenario: { id: scenario.id, title: scenario.title, intro: scenario.intro, source, status },
    steps: result.steps,
    node,
    meters: result.meters,
    failThresholds: scenario.failThresholds,
    finished: node.type === 'end',
  }
  return NextResponse.json(res)
}
