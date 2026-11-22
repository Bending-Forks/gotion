// The client's dev server against the fake gateway, through the same proxy a developer uses
import { afterAll, beforeAll, expect, test } from 'vitest'
import type { AddressInfo } from 'node:net'
import { createServer, type ViteDevServer } from 'vite'
// @ts-expect-error: a plain ES module with no type declarations
import { server as gateway } from '../fake-gateway.mjs'
import type { Directory } from './api/types'

let vite: ViteDevServer
let origin: string

beforeAll(async () => {
  await new Promise<void>((resolve) => gateway.listen(0, resolve))
  process.env.GOTION_GATEWAY = `http://localhost:${(gateway.address() as AddressInfo).port}`
  vite = await createServer({ root: new URL('..', import.meta.url).pathname, server: { port: 0 }, logLevel: 'silent' })
  await vite.listen()
  origin = vite.resolvedUrls!.local[0]!.replace(/\/$/, '')
})

afterAll(async () => {
  await vite.close()
  gateway.close()
})

const alice = { email: 'alice@example.com', password: 'password123' }
const product = '0b4f3c1e-0000-4000-8000-000000000002'

const post = (path: string, body?: unknown, cookie = '') =>
  fetch(`${origin}${path}`, { method: 'POST', headers: { cookie }, body: JSON.stringify(body) })
const directory = async (cookie: string): Promise<Directory> =>
  (await fetch(`${origin}/v1/directory`, { headers: { cookie } })).json()

// Signs Alice in and returns the cookie that carries her token
const signIn = async () => (await post('/v1/sessions', alice)).headers.get('set-cookie')!.split(';')[0]!

test('the directory needs the sign-in, which sets the token cookie', async () => {
  expect((await fetch(`${origin}/v1/directory`)).status).toBe(401)
  expect((await post('/v1/sessions', { ...alice, password: 'nope' })).status).toBe(401)

  const signedIn = await post('/v1/sessions', alice)
  expect(signedIn.status).toBe(204)
  expect(signedIn.headers.get('set-cookie')).toMatch(/HttpOnly; Secure; SameSite=Strict/)
  expect((await directory(await signIn())).workspaces).toHaveLength(2)
})

test('opening a workspace makes it the main one, as Account does', async () => {
  const cookie = await signIn()
  expect((await post(`/v1/workspaces/${product}/open`, undefined, cookie)).status).toBe(204)
  const { workspaces } = await directory(cookie)
  expect(workspaces.filter((w) => w.main).map((w) => w.workspaceId)).toEqual([product])
})

test('opening a workspace the user is not a member of answers 404, as Account does', async () => {
  const cookie = await signIn()
  expect((await post('/v1/workspaces/00000000-0000-4000-8000-000000000000/open', undefined, cookie)).status).toBe(404)
})

test('the client routes are served by the SPA', async () => {
  const page = await fetch(`${origin}/sign-in`)
  expect(page.status).toBe(200)
  expect(await page.text()).toContain('<div id="root"></div>')
})
