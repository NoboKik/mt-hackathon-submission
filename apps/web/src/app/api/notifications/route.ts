import { type NotificationsResponse, notificationsFor } from '@p400/shared'
import { NextResponse } from 'next/server'
import { notificationInput } from '@/db/queries'
import { ru } from '@/i18n/ru'
import { fail } from '@/lib/api'
import { currentUserId } from '@/lib/auth'

/** The daily scenario, the streak and the bell's feed, all derived now. Nothing is queued. */
export async function GET() {
  const userId = await currentUserId()
  if (!userId) return fail(401, ru.errors.unauthorized)

  const input = await notificationInput(userId)
  if (!input) return fail(401, ru.errors.unauthorized)

  const res: NotificationsResponse = notificationsFor({ ...input, now: Date.now() })
  return NextResponse.json(res)
}
