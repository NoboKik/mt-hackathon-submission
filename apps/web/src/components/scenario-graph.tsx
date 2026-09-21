'use client'

import type { AdminGraphResponse, GraphNode } from '@p400/shared'
import { useQuery } from '@tanstack/react-query'
import { ru } from '@/i18n/ru'
import { api } from '@/lib/client'

// NOTE: a hand-rolled layered layout instead of react-flow. A scenario is 6–12 nodes and a
// DAG the validator already proved acyclic, so BFS depth is the whole algorithm — a graph
// library would be 40 KB to place twelve boxes. Swap it in if scenarios ever get dragged around.
const BOX_W = 210
const BOX_H = 78
const GAP_X = 70
const GAP_Y = 26

type Placed = GraphNode & { x: number; y: number }

function layout(graph: AdminGraphResponse): { placed: Placed[]; width: number; height: number } {
  const depth = new Map<string, number>([[graph.start, 0]])
  const queue = [graph.start]
  // BFS, so a node lands one column right of the earliest branch that reaches it.
  while (queue.length) {
    const id = queue.shift() as string
    const d = depth.get(id) ?? 0
    for (const edge of graph.edges) {
      if (edge.source !== id || depth.has(edge.target)) continue
      depth.set(edge.target, d + 1)
      queue.push(edge.target)
    }
  }

  const columns = new Map<number, GraphNode[]>()
  for (const node of graph.nodes) {
    // An unreachable node cannot exist — validate.ts rejects those — but a column of its own
    // beats dropping it silently if one ever does.
    const d = depth.get(node.id) ?? 0
    const column = columns.get(d) ?? []
    column.push(node)
    columns.set(d, column)
  }

  const placed: Placed[] = []
  let height = 0
  for (const [d, nodes] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    nodes.forEach((node, i) => {
      placed.push({ ...node, x: d * (BOX_W + GAP_X), y: i * (BOX_H + GAP_Y) })
    })
    height = Math.max(height, nodes.length * (BOX_H + GAP_Y))
  }
  const width = (Math.max(...columns.keys()) + 1) * (BOX_W + GAP_X)
  return { placed, width, height }
}

const STROKE: Record<string, string> = {
  success: 'var(--color-safe)',
  partial: 'var(--color-warn)',
  fail: 'var(--color-danger)',
}

function nodeStroke(node: GraphNode) {
  if (node.type === 'end' && node.outcome) return STROKE[node.outcome]
  if (node.isStart) return 'var(--color-brand-text)'
  return 'var(--color-ink-500)'
}

const LINE_CHARS = 26
const MAX_LINES = 2

/**
 * Two lines of ~26 characters, the rest elided. SVG text does not wrap or clip to its box, so
 * anything this returns is drawn in full and would run straight through the node's edge and over
 * its neighbours. The full script lives in the scenario file; this is a map, not a script.
 */
function wrap(text: string) {
  const lines: string[] = ['']
  let overflow = false
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1]
    const candidate = last ? `${last} ${word}` : word
    if (candidate.length <= LINE_CHARS) {
      lines[lines.length - 1] = candidate
    } else if (lines.length < MAX_LINES) {
      lines.push(word.slice(0, LINE_CHARS))
    } else {
      overflow = true
      break
    }
  }
  if (overflow) lines[lines.length - 1] = `${lines[lines.length - 1].trimEnd()}…`
  return lines
}

export function ScenarioGraph({ scenarioId }: { scenarioId: string }) {
  const q = useQuery({
    queryKey: ['graph', scenarioId],
    queryFn: () => api<AdminGraphResponse>(`/admin/scenarios/${scenarioId}/graph`),
    retry: false,
  })

  if (q.isPending) return <p className="text-muted-foreground text-sm">{ru.common.loading}</p>
  if (q.error) return <p className="text-danger text-sm">{q.error.message}</p>

  const graph = q.data
  const { placed, width, height } = layout(graph)
  const at = new Map(placed.map((n) => [n.id, n]))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-brand-text text-xs font-semibold tracking-[0.18em] uppercase">
          {ru.competencies[graph.category]}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{graph.title}</h1>
        <p className="text-muted-foreground text-sm">{ru.admin.subtitle}</p>
      </header>

      <dl className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <div className="flex gap-1.5">
          <dt>{ru.admin.nodes}:</dt>
          <dd className="text-foreground tabular-nums">{graph.nodes.length}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>{ru.admin.edges}:</dt>
          <dd className="text-foreground tabular-nums">{graph.edges.length}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>{ru.admin.initial}:</dt>
          <dd className="text-foreground tabular-nums">
            {graph.initial.loyalty} / {graph.initial.safety}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>{ru.admin.thresholds}:</dt>
          <dd className="text-foreground tabular-nums">
            {graph.failThresholds.loyalty} / {graph.failThresholds.safety}
          </dd>
        </div>
      </dl>

      {/* Wide content scrolls in its own container; the page never scrolls sideways. */}
      <div className="border-border bg-card rounded-card overflow-x-auto border p-4">
        <svg
          width={width}
          height={height}
          viewBox={`-8 -8 ${width + 16} ${height + 16}`}
          role="img"
          aria-label={ru.admin.title}
        >
          <title>{ru.admin.title}</title>
          {graph.edges.map((edge) => {
            const from = at.get(edge.source)
            const to = at.get(edge.target)
            if (!from || !to) return null
            const x1 = from.x + BOX_W
            const y1 = from.y + BOX_H / 2
            const x2 = to.x
            const y2 = to.y + BOX_H / 2
            const mid = (x1 + x2) / 2
            return (
              <path
                key={edge.id}
                d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={edge.isTimeout ? 'var(--color-danger)' : 'var(--color-ink-500)'}
                strokeWidth={1.5}
                strokeDasharray={edge.isTimeout ? '5 4' : undefined}
              />
            )
          })}
          {placed.map((node) => (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={BOX_W}
                height={BOX_H}
                rx={10}
                fill="var(--color-ink-800)"
                stroke={nodeStroke(node)}
                strokeWidth={node.isStart ? 2 : 1.25}
              />
              <text
                x={node.x + 12}
                y={node.y + 20}
                fill="var(--color-ink-400)"
                fontSize={9.5}
                fontWeight={600}
                letterSpacing="0.08em"
              >
                {(node.isStart ? `${ru.admin.start} · ` : '') +
                  ru.admin.nodeTypes[node.type].toUpperCase()}
              </text>
              {wrap(node.text).map((line, i) => (
                <text
                  key={line}
                  x={node.x + 12}
                  y={node.y + 40 + i * 15}
                  fill="var(--color-ink-50)"
                  fontSize={11.5}
                >
                  {line}
                </text>
              ))}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
