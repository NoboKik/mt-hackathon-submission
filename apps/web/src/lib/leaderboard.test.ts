import type { LeaderboardRow } from '@p400/shared'
import { expect, test } from 'vitest'
import { leaderboardPage } from './leaderboard'

const MSK = 'Депо Москва-Октябрьская'
const SPB = 'Депо Санкт-Петербург-Московский'

// Already sorted by total descending and ranked, the way the SQL hands them over.
const board: LeaderboardRow[] = [
  { userId: 'u1', displayName: 'Ольга Орлова', depot: MSK, total: 300, rank: 1 },
  { userId: 'u2', displayName: 'Иван Титов', depot: SPB, total: 250, rank: 2 },
  { userId: 'u3', displayName: 'Мария Гусева', depot: MSK, total: 250, rank: 2 },
  { userId: 'u4', displayName: 'Павел Орлов', depot: SPB, total: 200, rank: 4 },
  { userId: 'u5', displayName: 'Анна Соколова', depot: MSK, total: 100, rank: 5 },
].map((r) => ({ position: 'Проводник', avatar: null, scenarios: 2, ...r }))

test('a depot filter re-ranks from 1 and keeps every depot in the picker', () => {
  const page = leaderboardPage(board, 'u5', MSK)
  expect(page.top.map((r) => [r.userId, r.rank])).toEqual([
    ['u1', 1],
    ['u3', 2],
    ['u5', 3],
  ])
  expect(page.me?.rank).toBe(3)
  expect(page.depots).toEqual([MSK, SPB].sort())
})

test('tied totals share a rank and the next one is skipped', () => {
  const tied = board.map((r) => ({ ...r, depot: MSK }))
  const page = leaderboardPage(tied, 'u4', MSK)
  expect(page.top.map((r) => r.rank)).toEqual([1, 2, 2, 4, 5])
})

test('the viewer comes back even when they are outside the top N', () => {
  const page = leaderboardPage(board, 'u5', null, 2)
  expect(page.top.map((r) => r.userId)).toEqual(['u1', 'u2'])
  expect(page.me).toEqual(board[4])
  expect(page.me?.rank).toBe(5)
})

test('a viewer outside the filtered depot has no row', () => {
  const page = leaderboardPage(board, 'u5', SPB)
  expect(page.me).toBeNull()
  expect(page.top.map((r) => r.userId)).toEqual(['u2', 'u4'])
})

// The rows are the shared 30-second cache: re-ranking them in place would corrupt every later
// request until the cache expired.
test('filtering never writes to the array it was handed', () => {
  const before = structuredClone(board)
  leaderboardPage(board, 'u5', MSK)
  leaderboardPage(board, 'u2', SPB, 1)
  expect(board).toEqual(before)
})
