// The generator's prompt. Pure: no fetch, no env — generate.ts owns the loop.

import regulations from '../../../../content/regulations.json'
import example from '../../../../content/scenarios/medical-faint-01.json'
import type { ChatMessage } from './client'
import type { IncidentSeed } from './seeds'

/** The only strings a generated debrief may cite: a model left alone invents clause numbers. */
export const REGULATIONS: readonly string[] = regulations.map((r) => r.text)

// The example's own regulation predates the list, so the copy the model sees cites the list.
const shownExample = {
  ...example,
  nodes: Object.fromEntries(
    Object.entries(example.nodes).map(([id, n]) => {
      const { image: _, ...node } = n as Record<string, unknown>
      return [
        id,
        'debrief' in n ? { ...node, debrief: { ...n.debrief, regulation: REGULATIONS[0] } } : node,
      ]
    }),
  ),
}

const SYSTEM = `You write training scenarios for «Проводник 400», a game for conductors on the
ВСМ-400 high-speed train Moscow — St Petersburg. Respond with one JSON object: a single scenario,
nothing else (valid json). All player-facing text is in natural Russian.

Scenario JSON (every field required unless marked optional, no extra fields):
- title, category, difficulty (1–3), estimatedMinutes (3–7), intro (2–3 sentences setting the
  scene: carriage, speed, where the train is, who is on board to help), start (a node id),
  initial {loyalty, safety} (60–80 each), failThresholds {loyalty, safety} (15–30, below initial),
  nodes {id: node}.
- A "choice" node: type, speaker, text, timerSec (integer 10–20), onTimeout (node id), choices
  (2–4). Each choice: id (unique across the whole scenario: c1, c2, …), text, effects
  {loyalty, safety} (integer deltas, usually −25…+20), competencies (0–2 keys, values −2…2),
  next (node id). No "image" field.
- A "consequence" node: type, text, effects, next. It auto-advances; use it for what happens
  after a timeout or a bad call.
- An "end" node: type, outcome ("success" | "partial" | "fail"), text, debrief {expertPath:
  [choice ids of the best path, in order], lesson (2–3 sentences: what a good conductor does
  and why), regulation}.
- speaker: "narrator" for the scene itself, or "passenger", "conductor", "dispatcher", "medic"
  for a line of dialogue, or a short Russian role for anyone else (e.g. «Мама мальчика»).

Rules:
- 6–12 nodes in total, 2–4 end nodes, exactly one "success" end, and every node reachable
  from start. No cycles: every link moves the story forward.
- The timeout branch is real and usually the worst one.
- At least one choice must trade the meters against each other: loyalty up and safety down,
  or the reverse (e.g. letting a drunk passenger stay pleases him and endangers others).
- Node text is read under a timer: at most two short sentences. Choice text: one short line
  in the conductor's voice.
- Competencies (keys): conflict — de-escalation, neutral language, separating parties;
  medical — recognising symptoms, calling the medic/dispatcher, not moving the patient;
  safety — unattended baggage, braking announcements, evacuation order; service — service
  recovery, proactive offers, compensation within policy; communication — clear announcements,
  crew coordination, informing the dispatcher.
- debrief.regulation: copy exactly one of these strings verbatim, the one that fits best:
${REGULATIONS.map((r) => `  - ${r}`).join('\n')}
- Realistic and calm in tone, like a real service academy case. No violence, no gore, no jokes.

Example of a complete, valid scenario:
${JSON.stringify(shownExample)}`

export function promptMessages(seed: IncidentSeed, avoid: readonly string[]): ChatMessage[] {
  const user = [
    `Write a new scenario. category: "${seed.category}".`,
    `Incident: ${seed.incident}.`,
    `Passenger: ${seed.passenger}.`,
    `Circumstance: ${seed.circumstance}.`,
    avoid.length
      ? `Do not repeat any of these existing scenarios:\n${avoid.map((t) => `- ${t}`).join('\n')}`
      : '',
  ]
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user.filter(Boolean).join('\n') },
  ]
}
