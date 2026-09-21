import { NextResponse } from 'next/server'
import { unplayedGenerated, userExists } from '@/db/queries'
import { ru } from '@/i18n/ru'
import { fail } from '@/lib/api'
import { currentUserId } from '@/lib/auth'
import { LlmConfigError, llmConfig } from '@/llm/client'
import { topUpPool } from '@/llm/pool'

/**
 * Auto mode's next scenario: the oldest generated one this user has never started. Never
 * generates on the click — a flash model takes 20–60 s — only refills the pool behind it.
 */
export async function POST() {
  const userId = await currentUserId()
  if (!userId || !(await userExists(userId))) return fail(401, ru.errors.unauthorized)

  const [scenarioId] = await unplayedGenerated(userId)
  // Not awaited: the player gets their scenario now, the pool refills while they play it.
  void topUpPool(userId)
  if (scenarioId) return NextResponse.json({ scenarioId })

  try {
    llmConfig()
  } catch (e) {
    if (e instanceof LlmConfigError) return fail(503, ru.errors.llmNotConfigured)
    throw e
  }
  return NextResponse.json({ status: 'generating' }, { status: 202 })
}
