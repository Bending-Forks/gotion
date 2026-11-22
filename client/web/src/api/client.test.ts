import { expect, test } from 'vitest'
import { stubFetch } from '../testing'
import { ApiError, call } from './client'

test('a 401 sends the user to the sign-in (ADR-09)', async () => {
  stubFetch(401, { title: 'Unauthorized', status: 401 })
  const thrown = await call('GET', '/v1/directory').catch((e: unknown) => e)
  expect(thrown).toBeInstanceOf(Response)
  expect((thrown as Response).headers.get('Location')).toBe('/sign-in')
})

test('a refused sign-in is thrown as its problem, for the form to show', async () => {
  stubFetch(401, { title: 'Unauthorized', status: 401, detail: 'Wrong email or password' })
  const thrown = await call('POST', '/v1/sessions', {}).catch((e: unknown) => e)
  expect(thrown).toBeInstanceOf(ApiError)
  expect(thrown).toMatchObject({ message: 'Wrong email or password', problem: { status: 401 } })
})

test('a 204 returns nothing and a JSON body is parsed', async () => {
  stubFetch(204)
  expect(await call('POST', '/v1/sessions', {})).toBeUndefined()
  stubFetch(200, { workspaces: [] })
  expect(await call('GET', '/v1/directory')).toEqual({ workspaces: [] })
})

test('a URL outside the API of the gateway is refused before any request (BR-01)', async () => {
  const fetch = stubFetch(200, {})
  for (const url of ['https://example.com/v1/directory', '//example.com/v1/directory', '/assets/logo.svg'])
    await expect(call('GET', url)).rejects.toThrow(url)
  expect(fetch).not.toHaveBeenCalled()
})
