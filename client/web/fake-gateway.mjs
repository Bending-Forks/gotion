// A fake API gateway for development and the tests of the client, until the real one exists: `npm run fake-gateway`, then `npm run dev`.
// Sign in as alice@example.com with the password "password123", or register. Whoever signs in sees the workspaces of Alice. It serves the client API of Account and Membership as their specifications describe it: Open workspace saves the main workspace, a workspace the user is not a member of answers 404, the commands of an Admin answer 403 to the other roles, and a workspace keeps at least one Admin (409).
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

const cookie = '__Host-gotion-token'
const port = Number(process.env.PORT ?? 8080)
const alice = 'a11ce000-0000-4000-8000-000000000001'
const users = new Map([['alice@example.com', { userId: alice, password: 'password123' }]])
const workspace = (workspaceId, name, ...members) => ({ workspaceId, name, members, invitations: [] })
const workspaces = [
  workspace('0b4f3c1e-0000-4000-8000-000000000001', 'Alice', { userId: alice, role: 'Admin' }),
  workspace(
    '0b4f3c1e-0000-4000-8000-000000000002',
    'Product',
    { userId: alice, role: 'Editor' },
    { userId: 'b0b00000-0000-4000-8000-000000000002', role: 'Admin' },
  ),
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

const blank = (name) => typeof name !== 'string' || !name.trim()
const roleOf = (w) => w.members.find((m) => m.userId === alice)?.role

// Changes the members, and takes the change back if the workspace would lose its last Admin
function keepingAnAdmin(w, change) {
  const before = structuredClone(w.members)
  change()
  if (w.members.some((m) => m.role === 'Admin')) return [204]
  w.members = before
  return [409, 'The workspace keeps at least one Admin']
}

// The commands on one workspace, by method and path after the workspace; each answers [status, body or problem title]
const commands = {
  'POST /open': (w) => ((main = w.workspaceId), [204]),
  'GET /members': (w) => [200, { members: w.members }],
  'GET /invitations': (w) => [200, { invitations: w.invitations }],
  'PATCH ': (w, body) => (blank(body?.name) ? [400, 'The name is blank'] : ((w.name = body.name), [204])),
  'DELETE ': (w) => {
    workspaces.splice(workspaces.indexOf(w), 1)
    if (main === w.workspaceId) main = undefined
    return [204]
  },
  'POST /invitations': (w, body) => {
    const invitee = users.get(body?.email)?.userId
    if (!invitee) return [422, 'No user is registered with this email address']
    if ([...w.members.map((m) => m.userId), ...w.invitations.map((i) => i.inviteeId)].includes(invitee))
      return [409, 'Already a member or invited']
    const invitation = { inviteeId: invitee, role: body.role, invitedBy: alice }
    w.invitations.push(invitation)
    return [201, invitation]
  },
  'PUT /members/role': (w, body, member) => keepingAnAdmin(w, () => (member.role = body?.role)),
  'DELETE /members': (w, _, member) => keepingAnAdmin(w, () => w.members.splice(w.members.indexOf(member), 1)),
  'POST /leave': (w) => keepingAnAdmin(w, () => w.members.splice(w.members.findIndex((m) => m.userId === alice), 1)),
}
const adminOnly = ['PATCH ', 'DELETE ', 'POST /invitations', 'PUT /members/role', 'DELETE /members']

export const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://gateway')
  const body = await readJson(req)
  if (req.method === 'POST' && pathname === '/v1/users') {
    if (users.has(body?.email)) return problem(res, 409, 'The email address is already in use')
    const userId = randomUUID()
    users.set(body?.email, { userId, password: body?.password })
    return send(res, 201, { userId })
  }
  if (req.method === 'POST' && pathname === '/v1/sessions') {
    if (users.get(body?.email)?.password !== body?.password) return problem(res, 401, 'Wrong email or password')
    return res
      .writeHead(204, { 'Set-Cookie': `${cookie}=fake; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800` })
      .end()
  }
  if (!req.headers.cookie?.split(/;\s*/).includes(`${cookie}=fake`)) return problem(res, 401, 'Sign in first')
  const mine = workspaces.filter((w) => roleOf(w))
  if (req.method === 'GET' && pathname === '/v1/directory')
    return send(res, 200, { workspaces: mine.map((w) => ({ workspaceId: w.workspaceId, name: w.name, role: roleOf(w), main: w.workspaceId === main })) })
  if (req.method === 'POST' && pathname === '/v1/workspaces') {
    if (blank(body?.name)) return problem(res, 400, 'The name is blank')
    const created = workspace(randomUUID(), body.name, { userId: alice, role: 'Admin' })
    workspaces.push(created)
    return send(res, 201, { workspaceId: created.workspaceId, name: created.name })
  }
  const [, workspaceId, memberId, rest = ''] = pathname.match(/^\/v1\/workspaces\/([^/]+)(?:\/members\/([^/]+))?(\/[a-z]+)?$/) ?? []
  const w = mine.find((w) => w.workspaceId === workspaceId)
  const key = `${req.method} ${memberId ? `/members${rest}` : rest}`
  const member = w?.members.find((m) => m.userId === memberId)
  if (!w || !commands[key] || (memberId && !member)) return problem(res, 404, 'Not found')
  if (adminOnly.includes(key) && roleOf(w) !== 'Admin') return problem(res, 403, 'Only an Admin can do this')
  const [status, answer] = commands[key](w, body, member)
  return status >= 400 ? problem(res, status, answer) : send(res, status, answer)
})

if (import.meta.url === `file://${process.argv[1]}`) server.listen(port, () => console.log(`fake gateway on :${port}`))
