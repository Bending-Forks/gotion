// A fake API gateway for development and the tests of the client, until the real one exists: `npm run fake-gateway`, then `npm run dev`.
// Sign in as alice@example.com with the password "password123".
import { createServer } from 'node:http'

const cookie = '__Host-gotion-token'
const port = Number(process.env.PORT ?? 8080)
const directory = {
  workspaces: [
    { workspaceId: '0b4f3c1e-0000-4000-8000-000000000001', name: 'Alice', role: 'Admin', main: true },
    { workspaceId: '0b4f3c1e-0000-4000-8000-000000000002', name: 'Product', role: 'Editor', main: false },
  ],
}

const problem = (res, status, title) => {
  res.writeHead(status, { 'Content-Type': 'application/problem+json' }).end(JSON.stringify({ title, status }))
}

const readJson = async (req) => {
  let body = ''
  for await (const chunk of req) body += chunk
  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

export const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://gateway')
  if (req.method === 'POST' && pathname === '/v1/sessions') {
    const credentials = await readJson(req)
    if (credentials?.email !== 'alice@example.com' || credentials?.password !== 'password123')
      return problem(res, 401, 'Wrong email or password')
    return res
      .writeHead(204, { 'Set-Cookie': `${cookie}=fake; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800` })
      .end()
  }
  if (!req.headers.cookie?.split(/;\s*/).includes(`${cookie}=fake`)) return problem(res, 401, 'Sign in first')
  if (req.method === 'GET' && pathname === '/v1/directory')
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(directory))
  if (req.method === 'POST' && /^\/v1\/workspaces\/[^/]+\/open$/.test(pathname)) return res.writeHead(204).end()
  problem(res, 404, 'Not found')
})

if (import.meta.url === `file://${process.argv[1]}`) server.listen(port, () => console.log(`fake gateway on :${port}`))
