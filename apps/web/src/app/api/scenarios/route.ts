import { NextResponse } from 'next/server'
import { scenarioList } from '@/db/queries'
import { fail } from '@/lib/api'
import { currentUserId } from '@/lib/auth'

export async function GET() {
  const userId = await currentUserId()
  if (!userId) return fail(401, 'unauthorized')

  return NextResponse.json(await scenarioList(userId))
}
