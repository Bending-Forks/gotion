// Helpers for the tests of the client, never imported by the client itself
import { vi } from 'vitest'

// Answers every request of the client with this status and, if given, this JSON body; vitest restores fetch after each test
export function stubFetch(status: number, body?: unknown) {
  const fetch = vi.fn(async (_path: string, _init?: RequestInit) =>
    body === undefined
      ? new Response(null, { status })
      : Response.json(body, { status, headers: status >= 400 ? { 'Content-Type': 'application/problem+json' } : {} }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

// A form submitted to the action of a route
export const form = (fields: Record<string, string>) =>
  new Request('http://gotion.test/', { method: 'POST', body: new URLSearchParams(fields) })
