import { redirect } from 'react-router'
import type { Problem } from './types'

export class ApiError extends Error {
  readonly problem: Problem

  constructor(problem: Problem) {
    super(problem.detail ?? problem.title)
    this.problem = problem
  }
}

// Every call goes to the API of the gateway on the same origin, and nowhere else (BR-01); the browser sends the HttpOnly sign-in cookie by itself.
// Call it from loaders and actions: on a missing, invalid or expired token it throws a redirect to the sign-in, which React Router follows (ADR-09).
export async function call<T = void>(method: string, path: string, body?: unknown): Promise<T> {
  if (!path.startsWith('/v1/')) throw new Error(`${path} is not a path of the gateway API`)
  const response = await fetch(path, {
    method,
    ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  // A 401 on Sign in is a wrong password, which the form shows
  if (response.status === 401 && path !== '/v1/sessions') throw redirect('/sign-in')
  if (!response.ok) {
    throw new ApiError(
      response.headers.get('Content-Type')?.includes('json')
        ? await response.json()
        : { title: response.statusText, status: response.status },
    )
  }
  return (response.status === 204 ? undefined : await response.json()) as T
}

// An action whose refused command stays on its form: it returns the problem for the form to show, and lets a redirect or a network error through
export const formAction =
  <A extends unknown[], R>(action: (...args: A) => Promise<R>) =>
  async (...args: A): Promise<R | string> => {
    try {
      return await action(...args)
    } catch (e) {
      if (e instanceof ApiError) return e.message
      throw e
    }
  }
