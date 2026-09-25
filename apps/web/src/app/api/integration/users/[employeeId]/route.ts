import { IntegrationUserBody, type IntegrationUserResponse } from '@p400/shared'
import { NextResponse } from 'next/server'
import { putIntegrationUser } from '@/db/queries'
import { fail } from '@/lib/api'
import { hashPassword } from '@/lib/auth'
import { bearerOk } from '@/lib/integration'

/**
 * Inbound provisioning: the HR system creates or updates a conductor by табельный номер, so
 * nobody self-registers. Same Bearer token and same 404-while-unset rule as /progress.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const token = process.env.INTEGRATION_TOKEN
  if (!token) return fail(404, 'integrationOff')
  if (!bearerOk(req.headers.get('authorization'), token)) return fail(401, 'unauthorized')

  const { employeeId } = await params
  if (!/^[\w.-]{1,64}$/.test(employeeId)) return fail(400, 'badRequest')
  const body = IntegrationUserBody.safeParse(await req.json().catch(() => null))
  if (!body.success) return fail(400, 'badRequest', body.error.issues)

  const { password, name, ...rest } = body.data
  const result = await putIntegrationUser(
    employeeId,
    { ...rest, displayName: name },
    password === undefined ? undefined : hashPassword(password),
  )
  if (result === 'passwordRequired') return fail(400, 'passwordRequired')
  if (result === 'emailTaken') return fail(409, 'emailTaken')
  return NextResponse.json<IntegrationUserResponse>(
    { ...result, employeeId },
    { status: result.created ? 201 : 200 },
  )
}
