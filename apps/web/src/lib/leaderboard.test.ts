import type { LeaderboardRow } from '@p400/shared'
import { expect, test } from 'vitest'
import { leaderboardPage } from './leaderboard'

const MSK = 'Депо Москва-Октябрьская'
const SPB = 'Депо Санкт-Петербург-Московский'

// Already sorted by total descending and ranked, the way the SQL hands them over.
// u4 shares a crew name with u1 and u5 but not their depot: crew names repeat across depots.
const board: LeaderboardRow[] = [
  {
    userId: 'u1',
    displayName: 'Ольга Орлова',
    depot: MSK,
    crew: 'Бригада № 3',
    total: 300,
    rank: 1,
  },
  { userId: 'u2', displayName: 'Иван Титов', depot: SPB, crew: 'Бригада № 1', total: 250, rank: 2 },
  {
    userId: 'u3',
    displayName: 'Мария Гусева',
    depot: MSK,
    crew: 'Бригада № 7',
    total: 250,
    rank: 2,
  },
  {
    userId: 'u4',
    displayName: 'Павел Орлов',
    depot: SPB,
    crew: 'Бригада № 3',
    total: 200,
    rank: 4,
  },
  {
    userId: 'u5',
    displayName: 'Анна Соколова',
    depot: MSK,
    crew: 'Бригада № 3',
    total: 100,
    rank: 5,
  },
].map((r) => ({ position: 'Проводник', avatar: null, scenarios: 2, ...r }))

test('a depot filter re-ranks from 1 and keeps every depot in the picker', () => {
  const page = leaderboardPage(board, 'u5', 'company', MSK)
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
  const page = leaderboardPage(tied, 'u4', 'company', MSK)
  expect(page.top.map((r) => r.rank)).toEqual([1, 2, 2, 4, 5])
})

test('the viewer comes back even when they are outside the top N', () => {
  const page = leaderboardPage(board, 'u5', 'company', null, 2)
  expect(page.top.map((r) => r.userId)).toEqual(['u1', 'u2'])
  expect(page.me).toEqual(board[4])
  expect(page.me?.rank).toBe(5)
})

test('a viewer outside the filtered depot has no row', () => {
  const page = leaderboardPage(board, 'u5', 'company', SPB)
  expect(page.me).toBeNull()
  expect(page.top.map((r) => r.userId)).toEqual(['u2', 'u4'])
})

test("crew scope keeps the viewer's depot and crew, depot scope the whole depot", () => {
  const crew = leaderboardPage(board, 'u5', 'crew', null)
  expect(crew.top.map((r) => [r.userId, r.rank])).toEqual([
    ['u1', 1],
    ['u5', 2],
  ])
  const depot = leaderboardPage(board, 'u5', 'depot', null)
  expect(depot.top.map((r) => r.userId)).toEqual(['u1', 'u3', 'u5'])
  expect(depot.me?.rank).toBe(3)
})

// The rows are the shared 30-second cache: re-ranking them in place would corrupt every later
// request until the cache expired.
test('filtering never writes to the array it was handed', () => {
  const before = structuredClone(board)
  leaderboardPage(board, 'u5', 'company', MSK)
  leaderboardPage(board, 'u2', 'crew', null, 1)
  expect(board).toEqual(before)
})
