import { expect, test } from 'vitest'
import { form, redirectedTo, requests, stubFetch } from '../testing'
import { signUp } from './SignUp'

const credentials = { email: 'alice@example.com', password: 'password123' }

test('a registration signs the new user in and opens the directory (US-01)', async () => {
  const fetch = stubFetch(201, { userId: 'u1' })
  expect(await redirectedTo(signUp({ request: form(credentials) }))).toBe('/')
  expect(requests(fetch)).toEqual(['POST /v1/users', 'POST /v1/sessions'])
  expect(fetch.mock.calls.map(([, init]) => init?.body)).toEqual([JSON.stringify(credentials), JSON.stringify(credentials)])
})

test('an email address already in use stays on the form with its problem', async () => {
  stubFetch(409, { title: 'Conflict', status: 409, detail: 'The email address is already in use' })
  expect(await signUp({ request: form(credentials) })).toBe('The email address is already in use')
})
