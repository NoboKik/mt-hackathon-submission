// Drizzle schema for Проводник 400: users, curated and generated scenarios, game sessions and
// unlocked achievements. Migrations in drizzle/ are generated from this file.
// `sessions` holds game sessions, not auth sessions: auth is a signed cookie with no table.

import type { AchievementCode, Competency, Outcome, Scenario, score } from '@p400/shared'
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

const tstz = (name: string) => timestamp(name, { withTimezone: true })

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  position: text('position').notNull(),
  depot: text('depot').notNull(),
  avatar: text('avatar'),
  createdAt: tstz('created_at').notNull().defaultNow(),
})

export const scenarios = pgTable('scenarios', {
  id: text('id').primaryKey(), // the scenario slug, same as the JSON file's `id`
  title: text('title').notNull(),
  category: text('category').notNull(),
  difficulty: integer('difficulty').notNull(),
  json: jsonb('json').$type<Scenario>().notNull(), // the full validated scenario
  version: integer('version').notNull().default(1),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
})

/** One decision in a session's history, appended per `choose` call. */
export type PathStep = {
  nodeId: string
  choiceId: string // a choice id, or 'timeout'
  clientElapsedMs: number
  serverElapsedMs: number
}

export type ScoreBreakdown = ReturnType<typeof score>

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Sessions are a user's history: they go when the user goes (the seed deletes users).
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Scenarios are content and only ever get upserted; refuse to drop one that has history.
    scenarioId: text('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'restrict' }),
    seed: integer('seed').notNull(),
    startedAt: tstz('started_at').notNull().defaultNow(),
    finishedAt: tstz('finished_at'),
    // Live state.
    currentNode: text('current_node').notNull(),
    nodeStartedAt: tstz('node_started_at').notNull(),
    loyalty: integer('loyalty').notNull(),
    safety: integer('safety').notNull(),
    // Result, set when the session ends.
    outcome: text('outcome').$type<Outcome>(),
    score: integer('score'),
    scoreBreakdown: jsonb('score_breakdown').$type<ScoreBreakdown>(),
    competencyDeltas: jsonb('competency_deltas')
      .$type<Partial<Record<Competency, number>>>()
      .notNull()
      .default({}),
    path: jsonb('path').$type<PathStep[]>().notNull().default([]),
  },
  // Best score and attempt counts per scenario.
  (t) => [index('sessions_user_scenario_idx').on(t.userId, t.scenarioId)],
)

// One row per badge a user has earned. No catalogue table: the titles live in i18n/ru.ts and the
// conditions in packages/shared/src/achievements.ts, so a third copy in Postgres would only drift.
// The composite primary key is what makes unlocking idempotent — insert ... on conflict do
// nothing ... returning hands back exactly the badges that were new, with no read-then-write race.
export const userAchievements = pgTable(
  'user_achievements',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code').$type<AchievementCode>().notNull(),
    earnedAt: tstz('earned_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.code] })],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type ScenarioRow = typeof scenarios.$inferSelect
export type NewScenarioRow = typeof scenarios.$inferInsert
export type GameSession = typeof sessions.$inferSelect
export type NewGameSession = typeof sessions.$inferInsert
export type NewUserAchievement = typeof userAchievements.$inferInsert
