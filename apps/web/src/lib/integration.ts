// GET /api/integration/progress: the export an HR or LMS system pulls. Pure, like analytics.ts:
// flat rows in, the response out. The numbers follow the profile's rules (best score per
// scenario for XP, competency points floored at 0), so HR sees what the conductor sees.

import { createHash, timingSafeEqual } from 'node:crypto'
import {
  type AchievementCode,
  COMPETENCIES,
  type Competency,
  type IntegrationEmployee,
  type IntegrationProgressResponse,
  levelForXp,
  promotionReadiness,
} from '@p400/shared'

export type IntegrationUser = { id: string; name: string; depot: string; crew: string }
export type IntegrationRun = {
  userId: string
  scenarioId: string
  category: Competency
  score: number
  competencyDeltas: Partial<Record<Competency, number>>
  finishedAt: Date
}
export type IntegrationBadge = { userId: string; code: AchievementCode }

/** `Authorization: Bearer <token>` against the configured token, in constant time. */
export function bearerOk(header: string | null, token: string): boolean {
  const given = header?.match(/^Bearer (.+)$/)?.[1]
  if (!given) return false
  // Hashing first makes both sides 32 bytes, so timingSafeEqual never throws on a length mismatch.
  const digest = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(digest(given), digest(token))
}

export function integrationProgress(
  users: readonly IntegrationUser[],
  runs: readonly IntegrationRun[],
  badges: readonly IntegrationBadge[],
  now: Date,
): IntegrationProgressResponse {
  const employees = new Map<
    string,
    Omit<IntegrationEmployee, 'readiness'> & { best: Map<string, number>; serviceBest: number }
  >()
  for (const u of users) {
    employees.set(u.id, {
      ...u,
      xp: 0,
      rank: 'trainee',
      competencies: Object.fromEntries(COMPETENCIES.map((k) => [k, 0])) as Record<
        Competency,
        number
      >,
      badges: [],
      runs: 0,
      lastRunAt: null,
      best: new Map(),
      serviceBest: 0,
    })
  }
  for (const r of runs) {
    const e = employees.get(r.userId)
    if (!e) continue
    e.runs++
    e.best.set(r.scenarioId, Math.max(e.best.get(r.scenarioId) ?? 0, r.score))
    if (r.category === 'service') e.serviceBest = Math.max(e.serviceBest, r.score)
    for (const k of COMPETENCIES) e.competencies[k] += r.competencyDeltas[k] ?? 0
    const at = r.finishedAt.toISOString()
    if (!e.lastRunAt || at > e.lastRunAt) e.lastRunAt = at
  }
  for (const b of badges) employees.get(b.userId)?.badges.push(b.code)

  return {
    generatedAt: now.toISOString(),
    employees: [...employees.values()].map(({ best, serviceBest, ...e }) => {
      const xp = [...best.values()].reduce((sum, points) => sum + points, 0)
      for (const k of COMPETENCIES) e.competencies[k] = Math.max(0, e.competencies[k])
      return {
        ...e,
        xp,
        rank: levelForXp(xp).key,
        readiness: promotionReadiness(e.competencies, serviceBest),
      }
    }),
  }
}
