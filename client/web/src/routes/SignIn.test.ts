import { expect, test } from 'vitest'
import { form, stubFetch } from '../testing'
import { signIn } from './SignIn'

const credentials = { email: 'alice@example.com', password: 'password123' }

test('a sign-in sends the credentials and opens the Workspace directory', async () => {
  const fetch = stubFetch(204)
  const response = (await signIn({ request: form(credentials) })) as Response
  expect(fetch).toHaveBeenCalledWith('/v1/sessions', expect.objectContaining({ method: 'POST', body: JSON.stringify(credentials) }))
  expect(response.headers.get('Location')).toBe('/')
})

test('a refused sign-in stays on the form and shows the problem', async () => {
  stubFetch(401, { title: 'Unauthorized', status: 401, detail: 'Wrong email or password' })
  expect(await signIn({ request: form(credentials) })).toBe('Wrong email or password')
})
