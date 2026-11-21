import { afterEach, expect, test, vi } from 'vitest'
import { ApiError, call, setUnauthorizedHandler } from './client'

const reply = (status: number, body?: unknown) =>
  vi.fn(async () =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: body === undefined ? {} : { 'Content-Type': 'application/problem+json' },
    }),
  )

afterEach(() => vi.unstubAllGlobals())

test('a 401 sends the user to the sign-in', async () => {
  const handler = vi.fn()
  setUnauthorizedHandler(handler)
  vi.stubGlobal('fetch', reply(401, { title: 'Unauthorized', status: 401 }))
  await expect(call('GET', '/v1/directory')).rejects.toBeInstanceOf(ApiError)
  expect(handler).toHaveBeenCalledOnce()
})

test('a failed sign-in stays on the sign-in and shows the problem', async () => {
  const handler = vi.fn()
  setUnauthorizedHandler(handler)
  vi.stubGlobal('fetch', reply(401, { title: 'Unauthorized', status: 401, detail: 'Wrong email or password' }))
  await expect(call('POST', '/v1/sessions', { email: 'a@b.c', password: 'x' })).rejects.toThrow('Wrong email or password')
  expect(handler).not.toHaveBeenCalled()
})

test('a 204 returns nothing and a JSON body is parsed', async () => {
  vi.stubGlobal('fetch', reply(204))
  expect(await call('POST', '/v1/sessions', {})).toBeUndefined()
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ workspaces: [] })))
  expect(await call('GET', '/v1/directory')).toEqual({ workspaces: [] })
})
