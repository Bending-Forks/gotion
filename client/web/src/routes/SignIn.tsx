import { Form, redirect, useActionData } from 'react-router'
import { LogIn } from 'lucide-react'
import { ApiError, call } from '../api/client'
import type { Credentials } from '../api/types'

// Returns the problem for the form to show, or goes to the Workspace directory
export async function signIn({ request }: { request: Request }) {
  const form = await request.formData()
  const credentials: Credentials = { email: String(form.get('email')), password: String(form.get('password')) }
  try {
    await call('POST', '/v1/sessions', credentials)
  } catch (e) {
    if (e instanceof ApiError) return e.message
    throw e
  }
  return redirect('/')
}

export function SignIn() {
  const problem = useActionData<typeof signIn>()
  return (
    <main>
      <h1>Sign in to Gotion</h1>
      <Form method="post">
        <label>
          Email <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {typeof problem === 'string' && <p role="alert">{problem}</p>}
        <button type="submit">
          <LogIn aria-hidden size={16} /> Sign in
        </button>
      </Form>
    </main>
  )
}
