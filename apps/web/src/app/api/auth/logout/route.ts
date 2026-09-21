import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'

// Leaves the p400_invite cookie alone: on a shared laptop the next person still gets the demo.
export async function POST() {
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
