// Crew analytics for GET /api/admin/analytics. Pure, like leaderboard.ts: the query hands over
// every user and every finished curated run, and the filtering and counting happen here.
// NOTE: whole-company rows filtered in memory. Thirty conductors and a few hundred runs;
// push the depot/crew WHERE into SQL when that stops being true.

import {
  type AdminAnalyticsResponse,
  type AnalyticsNode,
  COMPETENCIES,
  type Competency,
  type IntegrationEmployee,
  type Outcome,
  type Scenario,
} from '@p400/shared'

export const TOP_NODES = 8

export type AnalyticsUser = { id: string; depot: string; crew: string }
export type AnalyticsRun = {
  userId: string
  scenarioId: string
  outcome: Outcome
  competencyDeltas: Partial<Record<Competency, number>>
  path: { nodeId: string; choiceId: string }[]
}

export function crewAnalytics(
  users: readonly AnalyticsUser[],
  runs: readonly AnalyticsRun[],
  scenarios: ReadonlyMap<string, { title: string; json: Scenario }>,
  depot: string | null,
  crew: string | null,
  // The HR export's rows, so the readiness column is the number HR and the profile see.
  employees: readonly IntegrationEmployee[] = [],
): AdminAnalyticsResponse {
  const byDepot = new Map<string, Set<string>>()
  for (const u of users) {
    const crews = byDepot.get(u.depot) ?? new Set()
    if (u.crew) crews.add(u.crew)
    byDepot.set(u.depot, crews)
  }
  const units = [...byDepot]
    .map(([name, crews]) => ({ depot: name, crews: [...crews].sort() }))
    .sort((a, b) => a.depot.localeCompare(b.depot))

  const inScope = new Set(
    users
      .filter((u) => (!depot || u.depot === depot) && (!crew || u.crew === crew))
      .map((u) => u.id),
  )
  const scoped = runs.filter((r) => inScope.has(r.userId))

  const totals = Object.fromEntries(COMPETENCIES.map((k) => [k, 0])) as Record<Competency, number>
  for (const r of scoped) for (const k of COMPETENCIES) totals[k] += r.competencyDeltas[k] ?? 0
  // Per conductor in scope, not per run: a crew that plays more should not look weaker for it.
  // NOTE: raw points, so an axis fewer scenarios train (medical) reads low on supply alone.
  // Normalise by the points each run could have earned if that skews the conclusion.
  const competencies = COMPETENCIES.map((key) => ({
    key,
    avg: inScope.size ? Math.round((totals[key] / inScope.size) * 10) / 10 : 0,
  }))
  const weakest = scoped.length
    ? competencies.reduce((low, c) => (c.avg < low.avg ? c : low)).key
    : null

  const nodes = new Map<string, AnalyticsNode>()
  const nodeFor = (scenarioId: string, nodeId: string) => {
    const key = `${scenarioId}\u0000${nodeId}`
    let n = nodes.get(key)
    if (!n) {
      const s = scenarios.get(scenarioId)
      const node = s?.json.nodes[nodeId]
      n = {
        scenarioId,
        scenarioTitle: s?.title ?? scenarioId,
        nodeId,
        text: node && node.type !== 'end' ? node.text : nodeId,
        visits: 0,
        timeouts: 0,
        fails: 0,
      }
      nodes.set(key, n)
    }
    return n
  }
  for (const r of scoped) {
    for (const step of r.path) {
      const n = nodeFor(r.scenarioId, step.nodeId)
      n.visits++
      if (step.choiceId === 'timeout') n.timeouts++
    }
    const last = r.path.at(-1)
    if (r.outcome === 'fail' && last) nodeFor(r.scenarioId, last.nodeId).fails++
  }

  return {
    depot,
    crew,
    units,
    conductors: inScope.size,
    runs: scoped.length,
    competencies,
    weakest,
    nodes: [...nodes.values()]
      .filter((n) => n.timeouts + n.fails > 0)
      .sort(
        (a, b) =>
          b.timeouts + b.fails - (a.timeouts + a.fails) ||
          (b.timeouts + b.fails) / b.visits - (a.timeouts + a.fails) / a.visits,
      )
      .slice(0, TOP_NODES),
    readiness: employees
      .filter((e) => inScope.has(e.id))
      .map((e) => ({ id: e.id, name: e.name, crew: e.crew, ...e.readiness }))
      .map(({ criteria: _, ...row }) => row)
      .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name)),
  }
}
