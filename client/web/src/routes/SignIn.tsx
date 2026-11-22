import { Link, redirect } from 'react-router'
import { LogIn } from 'lucide-react'
import { call, formAction } from '../api/client'
import { CredentialsForm, credentials } from '../components/CredentialsForm'

// Goes to the Workspace directory, or stays on the form with the problem
export const signIn = formAction(async ({ request }: { request: Request }) => {
  await call('POST', '/v1/sessions', await credentials(request))
  return redirect('/')
})

export function SignIn() {
  return (
    <CredentialsForm
      title="Sign in to Gotion"
      submit={
        <>
          <LogIn aria-hidden size={16} /> Sign in
        </>
      }
    >
      No account yet? <Link to="/sign-up">Sign up</Link>
    </CredentialsForm>
  )
}
