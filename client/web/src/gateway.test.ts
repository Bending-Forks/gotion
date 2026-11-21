// The client's dev server against the fake gateway, through the same proxy a developer uses
import { afterAll, beforeAll, expect, test } from 'vitest'
import type { AddressInfo } from 'node:net'
import { createServer, type ViteDevServer } from 'vite'
// @ts-expect-error: a plain ES module with no type declarations
import { server as gateway } from '../fake-gateway.mjs'

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

test('the directory needs the sign-in, which sets the token cookie', async () => {
  expect((await fetch(`${origin}/v1/directory`)).status).toBe(401)
  const wrong = await fetch(`${origin}/v1/sessions`, { method: 'POST', body: JSON.stringify({ email: 'alice@example.com', password: 'nope' }) })
  expect(wrong.status).toBe(401)

  const signIn = await fetch(`${origin}/v1/sessions`, {
    method: 'POST',
    body: JSON.stringify({ email: 'alice@example.com', password: 'password123' }),
  })
  expect(signIn.status).toBe(204)
  const token = signIn.headers.get('set-cookie')!
  expect(token).toMatch(/HttpOnly; Secure; SameSite=Strict/)

  const directory = await fetch(`${origin}/v1/directory`, { headers: { cookie: token.split(';')[0]! } })
  expect(directory.status).toBe(200)
  expect((await directory.json()).workspaces).toHaveLength(2)
})

test('the client routes are served by the SPA', async () => {
  const page = await fetch(`${origin}/sign-in`)
  expect(page.status).toBe(200)
  expect(await page.text()).toContain('<div id="root"></div>')
})
