// Browser-side fetch for app/api. Every route answers `{ error: code }` on failure (see
// lib/api.ts); turning that code into Russian text here is the one thing worth sharing.

import { ru } from '@/i18n/ru'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json', ...init?.headers } : init?.headers,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    const code = body?.error
    const text =
      code && Object.hasOwn(ru.errors, code) ? ru.errors[code as keyof typeof ru.errors] : undefined
    throw new ApiError(res.status, text ?? ru.common.error)
  }
  return res.json() as Promise<T>
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
