import { Link, redirect } from 'react-router'
import { UserPlus } from 'lucide-react'
import { call, formAction } from '../api/client'
import { CredentialsForm, credentials } from '../components/CredentialsForm'

// Registers the user, who gets a first workspace as its Admin, then signs them in (US-01)
export const signUp = formAction(async ({ request }: { request: Request }) => {
  const registration = await credentials(request)
  await call('POST', '/v1/users', registration)
  await call('POST', '/v1/sessions', registration)
  return redirect('/')
})

export function SignUp() {
  return (
    <CredentialsForm
      title="Create your Gotion account"
      newPassword
      submit={
        <>
          <UserPlus aria-hidden size={16} /> Sign up
        </>
      }
    >
      Already registered? <Link to="/sign-in">Sign in</Link>
    </CredentialsForm>
  )
}
