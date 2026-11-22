// A fake API gateway for development and the tests of the client, until the real one exists: `npm run fake-gateway`, then `npm run dev`.
// Sign in as alice@example.com with the password "password123". Open workspace behaves as in Account: it saves the main workspace, and answers 404 for a workspace the user is not a member of.
import { createServer } from 'node:http'

const cookie = '__Host-gotion-token'
const port = Number(process.env.PORT ?? 8080)
const workspaces = [
  { workspaceId: '0b4f3c1e-0000-4000-8000-000000000001', name: 'Alice', role: 'Admin' },
  { workspaceId: '0b4f3c1e-0000-4000-8000-000000000002', name: 'Product', role: 'Editor' },
]
let main = workspaces[0].workspaceId

const send = (res, status, body, type = 'application/json') =>
  body === undefined ? res.writeHead(status).end() : res.writeHead(status, { 'Content-Type': type }).end(JSON.stringify(body))
const problem = (res, status, title) => send(res, status, { title, status }, 'application/problem+json')

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
    return send(res, 200, { workspaces: workspaces.map((w) => ({ ...w, main: w.workspaceId === main })) })
  const opened = req.method === 'POST' && pathname.match(/^\/v1\/workspaces\/([^/]+)\/open$/)?.[1]
  if (opened && workspaces.some((w) => w.workspaceId === opened)) {
    main = opened
    return send(res, 204)
  }
  problem(res, 404, 'Not found')
})

if (import.meta.url === `file://${process.argv[1]}`) server.listen(port, () => console.log(`fake gateway on :${port}`))
