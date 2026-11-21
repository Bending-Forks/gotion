import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { LogIn } from 'lucide-react'
import { call } from '../api/client'
import type { Credentials } from '../api/types'

export function SignIn() {
  const navigate = useNavigate()
  const [error, setError] = useState<string>()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const credentials: Credentials = { email: String(form.get('email')), password: String(form.get('password')) }
    try {
      await call('POST', '/v1/sessions', credentials)
      await navigate('/')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <main>
      <h1>Sign in to Gotion</h1>
      <form onSubmit={submit}>
        <label>
          Email <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">
          <LogIn aria-hidden size={16} /> Sign in
        </button>
      </form>
    </main>
  )
}
