// Crew analytics names every colleague with their gaps and readiness: a conductor must get a 403,
// not the company. The database and the cookie are stubbed; the gate and the route are real.

import { beforeEach, expect, test, vi } from 'vitest'

const session = vi.hoisted(() => ({ userId: null as string | null, position: 'Проводник' }))

vi.mock('@/lib/auth', async (original) => ({
  ...(await original<typeof import('@/lib/auth')>()),
  currentUserId: async () => session.userId,
}))

vi.mock('@/db/queries', () => ({
  userProfile: async () => ({
    displayName: 'Ольга Кузнецова',
    position: session.position,
    depot: 'Депо Москва-Октябрьская',
    avatar: null,
  }),
  analyticsInput: async () => ({ users: [], runs: [], scenarios: [] }),
  integrationInput: async () => ({ users: [], runs: [], badges: [] }),
}))

const { GET } = await import('./route')
const get = () => GET(new Request('http://localhost/api/admin/analytics'))

beforeEach(() => {
  session.userId = '3f1b0c7a-8b4e-4a1d-9c2e-0d5f6a7b8c9d'
})

test('signed out is 401', async () => {
  session.userId = null
  expect((await get()).status).toBe(401)
})

test('a conductor is refused with 403', async () => {
  session.position = 'Проводник'
  const res = await get()
  expect(res.status).toBe(403)
  expect(await res.json()).toEqual({ error: 'analyticsForbidden' })
})

test.each(['Начальник поезда', 'Методист'])('%s gets the analytics', async (position) => {
  session.position = position
  expect((await get()).status).toBe(200)
})
