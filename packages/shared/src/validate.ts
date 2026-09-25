import { type Node, Scenario } from './schema'

export type ValidationResult = { ok: true; scenario: Scenario } | { ok: false; errors: string[] }

const edges = (node: Node): string[] =>
  node.type === 'choice'
    ? [...node.choices.map((c) => c.next), node.onTimeout]
    : node.type === 'consequence'
      ? [...(node.branches ?? []).map((b) => b.next), node.next]
      : []

export function validateScenario(data: unknown, fileId?: string): ValidationResult {
  const parsed = Scenario.safeParse(data)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    }
  }

  const s = parsed.data
  const errors: string[] = []
  // Object.hasOwn, not `in` / s.nodes[id]: a node id like "constructor" would hit the prototype.
  const exists = (id: string) => Object.hasOwn(s.nodes, id)
  const nodes = Object.entries(s.nodes)

  if (!exists(s.start)) errors.push(`start: node "${s.start}" does not exist`)

  for (const [id, node] of nodes) {
    for (const to of edges(node)) {
      if (!exists(to)) errors.push(`node "${id}": links to missing node "${to}"`)
    }
  }

  if (fileId !== undefined && s.id !== fileId) {
    errors.push(`id: "${s.id}" does not match file name "${fileId}"`)
  }

  if (nodes.length < 6 || nodes.length > 12) {
    errors.push(`nodes: ${nodes.length} nodes, expected 6–12`)
  }

  const ends = nodes.filter(([, n]) => n.type === 'end').length
  if (ends < 2 || ends > 4) errors.push(`nodes: ${ends} end nodes, expected 2–4`)

  const choiceIds = new Set<string>()
  for (const [id, node] of nodes) {
    if (node.type !== 'choice') continue
    for (const c of node.choices) {
      if (choiceIds.has(c.id)) errors.push(`node "${id}": choice id "${c.id}" is already used`)
      choiceIds.add(c.id)
    }
  }

  for (const [id, node] of nodes) {
    if (node.type !== 'consequence') continue
    for (const b of node.branches ?? []) {
      if (b.if.chose !== undefined && !choiceIds.has(b.if.chose))
        errors.push(`node "${id}": branch condition chose "${b.if.chose}" does not exist`)
    }
  }

  for (const [id, node] of nodes) {
    if (node.type !== 'end') continue
    for (const c of node.debrief.expertPath) {
      if (!choiceIds.has(c)) errors.push(`node "${id}": expertPath choice "${c}" does not exist`)
    }
  }

  if (exists(s.start)) {
    const seen = new Set([s.start])
    const queue = [s.start]
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      for (const to of edges(s.nodes[id] as Node)) {
        if (exists(to) && !seen.has(to)) {
          seen.add(to)
          queue.push(to)
        }
      }
    }
    for (const [id] of nodes) {
      if (!seen.has(id)) errors.push(`node "${id}": unreachable from start`)
    }
  }

  const state = new Map<string, 'visiting' | 'done'>()
  const visit = (id: string) => {
    state.set(id, 'visiting')
    for (const to of edges(s.nodes[id] as Node)) {
      if (!exists(to)) continue
      if (state.get(to) === 'visiting') errors.push(`node "${id}": link to "${to}" closes a cycle`)
      else if (!state.has(to)) visit(to)
    }
    state.set(id, 'done')
  }
  for (const [id] of nodes) if (!state.has(id)) visit(id)

  const tradeOff = nodes.some(
    ([, n]) =>
      n.type === 'choice' && n.choices.some((c) => c.effects.loyalty * c.effects.safety < 0),
  )
  if (!tradeOff)
    errors.push('nodes: no choice trades loyalty against safety (opposite-sign effects)')

  return errors.length ? { ok: false, errors } : { ok: true, scenario: s }
}
