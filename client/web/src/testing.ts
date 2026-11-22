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

// Where a loader or an action sends the user, whether it returns its redirect or throws it
export async function redirectedTo(result: Promise<unknown>) {
  const response = await result.catch((e: unknown) => e)
  return response instanceof Response ? response.headers.get('Location') : undefined
}

// The requests a stubbed fetch received, as "METHOD path"
export const requests = (fetch: ReturnType<typeof stubFetch>) => fetch.mock.calls.map(([path, init]) => `${init?.method} ${path}`)
