import type { ReactNode } from 'react'
import { Form, useActionData } from 'react-router'
import type { Credentials } from '../api/types'

// The email address and password a sign-in or a registration form sends (US-01)
export async function credentials(request: Request): Promise<Credentials> {
  const form = await request.formData()
  return { email: String(form.get('email')), password: String(form.get('password')) }
}

type Props = { title: string; submit: ReactNode; newPassword?: boolean; children: ReactNode }

// The form of Sign in and Register, with the problem its action returned
export function CredentialsForm({ title, submit, newPassword = false, children }: Props) {
  const problem = useActionData<string>()
  return (
    <main className="auth">
      <h1>{title}</h1>
      <Form method="post">
        <label>
          Email <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password{' '}
          <input name="password" type="password" autoComplete={newPassword ? 'new-password' : 'current-password'} required />
        </label>
        {problem && <p role="alert">{problem}</p>}
        <button type="submit" className="primary">
          {submit}
        </button>
      </Form>
      <p>{children}</p>
    </main>
  )
}
