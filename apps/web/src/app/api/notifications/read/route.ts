import { NextResponse } from 'next/server'
import { markNotificationsSeen } from '@/db/queries'
import { fail } from '@/lib/api'
import { currentUserId } from '@/lib/auth'

export async function POST() {
  const userId = await currentUserId()
  if (!userId) return fail(401, 'unauthorized')

  await markNotificationsSeen(userId)
  return NextResponse.json({ ok: true })
}
