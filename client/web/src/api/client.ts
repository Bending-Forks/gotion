import type { Problem } from './types'

export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail ?? problem.title)
  }
}

let onUnauthorized = () => {}

// The router registers here where to go on a 401: a missing, invalid or expired token (ADR-09)
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

// Every call goes to the gateway on the same origin; the browser sends the HttpOnly sign-in cookie by itself.
export async function call<T = void>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 401 && path !== '/v1/sessions') onUnauthorized()
  if (!response.ok) {
    const problem: Problem = response.headers.get('Content-Type')?.includes('json')
      ? await response.json()
      : { title: response.statusText, status: response.status }
    throw new ApiError(problem)
  }
  return (response.status === 204 ? undefined : await response.json()) as T
}
