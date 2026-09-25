'use client'

import type { AdminGraphResponse, GraphNode } from '@p400/shared'
import { useQuery } from '@tanstack/react-query'
import { Card, Chip, Eyebrow, Stat } from '@/components/ui'
import { ru } from '@/i18n/ru'
import { ApiError, api } from '@/lib/client'
import { cn } from '@/lib/utils'

// NOTE: a hand-rolled layered layout instead of react-flow. A scenario is 6–12 nodes and a
// DAG the validator already proved acyclic, so BFS depth is the whole algorithm — a graph
// library would be 40 KB to place twelve boxes. Swap it in if scenarios ever get dragged around.
const BOX_W = 210
const BOX_H = 78
// Wide enough for most of a v1.1 branch condition, drawn in this gap before its target.
const GAP_X = 100
const GAP_Y = 26
/** Breathing room around the drawing, so a 2px start border is not clipped by the viewBox. */
const PAD = 10

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
    // The last row carries no trailing gap: on a phone that gap is dead scroll height.
    height = Math.max(height, nodes.length * (BOX_H + GAP_Y) - GAP_Y)
  }
  const width = Math.max(...columns.keys()) * (BOX_W + GAP_X) + BOX_W
  return { placed, width, height }
}

/**
 * Every colour here is a *semantic* var (`--card`, `--border`, `--safe`…), never a raw ramp var.
 * SVG attributes cannot take Tailwind classes, and the raw `--color-ink-*` / `--color-paper-*`
 * ramps do not flip with the theme. The semantic layer is redefined under `.dark`, so these follow the theme.
 */
const OUTCOME_COLOR: Record<string, string> = {
  success: 'var(--safe)',
  partial: 'var(--warn)',
  fail: 'var(--danger)',
}

/** The type marker dot — the same three readings the legend chips above the canvas show. */
function nodeAccent(node: GraphNode) {
  if (node.type === 'end') return (node.outcome && OUTCOME_COLOR[node.outcome]) || 'var(--border)'
  // Not --brand: the brand is red, and a red choice dot would read as a fail ending.
  return node.type === 'choice' ? 'var(--safety)' : 'var(--muted-foreground)'
}

function nodeStroke(node: GraphNode) {
  if (node.isStart) return 'var(--safety)'
  if (node.type === 'end' && node.outcome) return OUTCOME_COLOR[node.outcome]
  return 'var(--border)'
}

/** SVG text never clips, so a branch label keeps this many characters; <title> has the rest. */
const EDGE_LABEL_CHARS = 22
const clip = (text: string) =>
  text.length > EDGE_LABEL_CHARS ? `${text.slice(0, EDGE_LABEL_CHARS - 1).trimEnd()}…` : text

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

function Dot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', className)} />
}

/** The two meters keep their own hues here, exactly as the in-play HUD shows them. */
function MeterPairValue({ loyalty, safety }: { loyalty: number; safety: number }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-loyalty" title={ru.player.loyalty}>
        {loyalty}
      </span>
      <span className="text-base font-normal text-muted-foreground">/</span>
      <span className="text-safety" title={ru.player.safety}>
        {safety}
      </span>
    </span>
  )
}

export function ScenarioGraph({ scenarioId }: { scenarioId: string }) {
  const q = useQuery({
    queryKey: ['graph', scenarioId],
    queryFn: () => api<AdminGraphResponse>(`/admin/scenarios/${scenarioId}/graph`),
    retry: false,
  })

  if (q.isPending) return <p className="text-sm text-muted-foreground">{ru.common.loading}</p>
  if (q.error)
    return (
      <Card>
        <p className="text-sm font-semibold text-danger-text">
          {q.error instanceof ApiError && q.error.status === 404
            ? ru.admin.notFound
            : q.error.message}
        </p>
      </Card>
    )

  const graph = q.data
  const { placed, width, height } = layout(graph)
  const at = new Map(placed.map((n) => [n.id, n]))
  const svgW = width + PAD * 2
  const svgH = height + PAD * 2

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header className="flex flex-col items-start gap-2">
        <Eyebrow>{ru.admin.title}</Eyebrow>
        <h1 className="text-display text-balance">{graph.title}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{ru.admin.subtitle}</p>
        <Chip tone="brand" className="mt-1">
          {ru.competencies[graph.category]}
        </Chip>
      </header>

      <Card>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          <Stat label={ru.admin.nodes} value={graph.nodes.length} />
          <Stat label={ru.admin.edges} value={graph.edges.length} />
          <Stat label={ru.admin.initial} value={<MeterPairValue {...graph.initial} />} />
          <Stat label={ru.admin.thresholds} value={<MeterPairValue {...graph.failThresholds} />} />
        </div>
      </Card>

      <Card pad="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <Chip>
            <Dot className="bg-safety" />
            {ru.admin.nodeTypes.choice}
          </Chip>
          <Chip>
            <Dot className="bg-muted-foreground" />
            {ru.admin.nodeTypes.consequence}
          </Chip>
          <Chip>
            {/* A finale is coloured by its outcome, so its legend swatch shows all three. */}
            <span aria-hidden="true" className="flex gap-0.5">
              <Dot className="bg-safe" />
              <Dot className="bg-warn" />
              <Dot className="bg-danger" />
            </span>
            {ru.admin.nodeTypes.end}
          </Chip>
          <Chip tone="danger">
            <svg aria-hidden="true" className="h-0.5 w-4" viewBox="0 0 16 2">
              <line
                x1="0"
                y1="1"
                x2="16"
                y2="1"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
            </svg>
            {ru.admin.timeoutEdge}
          </Chip>
          <Chip>
            <svg aria-hidden="true" className="h-0.5 w-4" viewBox="0 0 16 2">
              <line x1="0" y1="1" x2="16" y2="1" stroke="currentColor" strokeWidth="2" />
            </svg>
            {ru.admin.branchEdge}
          </Chip>
        </div>

        {/* Wide content scrolls in its own container; the page never scrolls sideways.
         * The inner w-max keeps the canvas fill and its padding under the whole drawing
         * instead of stopping at the viewport edge once it is scrolled. */}
        <div className="overflow-x-auto">
          <div className="w-max min-w-full bg-muted p-4">
            <svg
              className="block"
              width={svgW}
              height={svgH}
              style={{ minWidth: `${svgW}px` }}
              viewBox={`${-PAD} ${-PAD} ${svgW} ${svgH}`}
              role="img"
              aria-label={ru.admin.title}
            >
              <title>{ru.admin.title}</title>
              <defs>
                {/* markerUnits defaults to strokeWidth, so both heads scale with their line. */}
                <marker
                  id="p400-edge-arrow"
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--muted-foreground)" opacity={0.55} />
                </marker>
                <marker
                  id="p400-edge-arrow-timeout"
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--danger)" opacity={0.85} />
                </marker>
              </defs>
              {graph.edges.map((edge) => {
                const from = at.get(edge.source)
                const to = at.get(edge.target)
                if (!from || !to) return null
                const x1 = from.x + BOX_W
                const y1 = from.y + BOX_H / 2
                const x2 = to.x
                const y2 = to.y + BOX_H / 2
                const mid = (x1 + x2) / 2
                const isBranch = Boolean(edge.condition || edge.isFallback)
                return (
                  <path
                    key={edge.id}
                    d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={
                      edge.isTimeout
                        ? 'var(--danger)'
                        : isBranch
                          ? 'var(--foreground)'
                          : 'var(--muted-foreground)'
                    }
                    // Edges recede so the boxes lead. A branch edge stays darker: its condition is the thing to read.
                    strokeWidth={1.25}
                    strokeOpacity={edge.isTimeout ? 0.85 : isBranch ? 0.7 : 0.5}
                    strokeDasharray={edge.isTimeout ? '5 4' : undefined}
                    markerEnd={`url(#p400-edge-arrow${edge.isTimeout ? '-timeout' : ''})`}
                  >
                    {edge.label && <title>{edge.label}</title>}
                  </path>
                )
              })}
              {placed.map((node) => (
                <g key={node.id}>
                  <rect
                    x={node.x}
                    y={node.y}
                    width={BOX_W}
                    height={BOX_H}
                    rx={8}
                    fill="var(--card)"
                    stroke={nodeStroke(node)}
                    strokeWidth={node.isStart ? 1.75 : 1.125}
                  />
                  <circle cx={node.x + 15} cy={node.y + 17} r={3.5} fill={nodeAccent(node)} />
                  <text
                    x={node.x + 25}
                    y={node.y + 21}
                    fill="var(--muted-foreground)"
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
                      x={node.x + 15}
                      y={node.y + 44 + i * 15}
                      fill="var(--foreground)"
                      fontSize={11.5}
                      fontWeight={500}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              ))}
              {/* After the boxes, so nothing covers them. Every edge arrives flat at the left of
               * its target's midline, so the label sits just above the arrowhead, in the gap
               * before the target. The halo in the canvas colour keeps it legible over lines.
               * NOTE: two labelled edges into one target overlap; split the target if that
               * ever happens. */}
              {graph.edges.map((edge) => {
                const to = at.get(edge.target)
                if (!to || !edge.label || !(edge.condition || edge.isFallback)) return null
                return (
                  <text
                    key={edge.id}
                    x={to.x - 8}
                    y={to.y + BOX_H / 2 - 5}
                    textAnchor="end"
                    fill="var(--foreground)"
                    stroke="var(--muted)"
                    strokeWidth={3}
                    paintOrder="stroke"
                    fontSize={9.5}
                    fontWeight={600}
                  >
                    {clip(edge.label)}
                    <title>{edge.label}</title>
                  </text>
                )
              })}
            </svg>
          </div>
        </div>
      </Card>
    </div>
  )
}
