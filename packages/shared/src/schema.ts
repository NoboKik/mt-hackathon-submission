import { z } from 'zod'

export const COMPETENCIES = ['conflict', 'medical', 'safety', 'service', 'communication'] as const
export type Competency = (typeof COMPETENCIES)[number]

const text = z.string().min(1)
const meter = z.number().int().min(0).max(100)
const Meters = z.strictObject({ loyalty: meter, safety: meter })

// Deltas, not meter values: no 0–100 bound here. The engine clamps the resulting meters.
export const Effects = z.strictObject({ loyalty: z.number().int(), safety: z.number().int() })
export type Effects = z.infer<typeof Effects>

// partialRecord, not record: Zod 4's record with an enum key demands every key.
const Competencies = z
  .partialRecord(z.enum(COMPETENCIES), z.number().int().min(-2).max(2))
  .refine((o) => Object.keys(o).length <= 2, 'at most 2 competencies')

export const Outcome = z.enum(['success', 'partial', 'fail'])
export type Outcome = z.infer<typeof Outcome>

export const Choice = z.strictObject({
  id: text,
  text,
  effects: Effects,
  competencies: Competencies,
  next: text,
})
export type Choice = z.infer<typeof Choice>

const ChoiceNode = z.strictObject({
  type: z.literal('choice'),
  speaker: text,
  text,
  image: text.optional(),
  timerSec: z.number().int().min(10).max(20),
  onTimeout: text,
  choices: z.array(Choice).min(2).max(4),
})

// v1.1: a range on one meter. `lt` is exclusive, `gte` inclusive, so `{lt: 40}` and `{gte: 40}`
// split the meter with nothing left over.
const Range = z
  .strictObject({ lt: meter.optional(), gte: meter.optional() })
  .refine((r) => r.lt !== undefined || r.gte !== undefined, 'needs lt or gte')

/** Every key given must hold. `chose` is a choice id picked earlier in this run. */
export const Condition = z
  .strictObject({ loyalty: Range.optional(), safety: Range.optional(), chose: text.optional() })
  .refine((c) => Object.keys(c).length > 0, 'empty condition always matches: use next instead')
export type Condition = z.infer<typeof Condition>

const ConsequenceNode = z.strictObject({
  type: z.literal('consequence'),
  text,
  effects: Effects,
  // v1.1, optional: the first branch whose condition holds wins, else `next`.
  branches: z
    .array(z.strictObject({ if: Condition, next: text }))
    .min(1)
    .optional(),
  next: text,
})

const EndNode = z.strictObject({
  type: z.literal('end'),
  outcome: Outcome,
  text,
  debrief: z.strictObject({
    expertPath: z.array(text).min(1),
    lesson: text,
    regulation: text,
  }),
})

export const Node = z.discriminatedUnion('type', [ChoiceNode, ConsequenceNode, EndNode])
export type Node = z.infer<typeof Node>

export const Scenario = z
  .strictObject({
    id: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be kebab-case: lowercase letters, digits, "-"'),
    title: text,
    category: z.enum(COMPETENCIES),
    difficulty: z.number().int().min(1).max(3),
    estimatedMinutes: z.number().int().min(3).max(7),
    intro: text,
    start: text,
    initial: Meters,
    failThresholds: Meters,
    nodes: z.record(z.string(), Node),
  })
  .superRefine((s, ctx) => {
    for (const m of ['loyalty', 'safety'] as const) {
      if (s.failThresholds[m] >= s.initial[m]) {
        ctx.addIssue({
          code: 'custom',
          path: ['failThresholds', m],
          message: `must be below initial.${m} (${s.initial[m]})`,
        })
      }
    }
  })
export type Scenario = z.infer<typeof Scenario>
