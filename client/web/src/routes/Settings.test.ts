import { expect, test } from 'vitest'
import { form, redirectedTo, requests, stubFetch } from '../testing'
import { manage, settings } from './Settings'

const params = { workspaceId: 'w1' }

test('the settings read the members and the invitations of the workspace (US-03)', async () => {
  const fetch = stubFetch(200, { members: [], invitations: [] })
  expect(await settings({ params })).toEqual({ members: [], invitations: [] })
  expect(requests(fetch)).toEqual(['GET /v1/workspaces/w1/members', 'GET /v1/workspaces/w1/invitations'])
})

test.each([
  ['rename', { name: 'Lab notes' }, 'PATCH /v1/workspaces/w1', { name: 'Lab notes' }],
  ['invite', { email: 'bob@example.com', role: 'Editor' }, 'POST /v1/workspaces/w1/invitations', { email: 'bob@example.com', role: 'Editor' }],
  ['role', { memberId: 'u2', role: 'Viewer' }, 'PUT /v1/workspaces/w1/members/u2/role', { role: 'Viewer' }],
  ['remove', { memberId: 'u2' }, 'DELETE /v1/workspaces/w1/members/u2', undefined],
])('%s sends %o as %s', async (intent, fields, request, body) => {
  const fetch = stubFetch(204)
  expect(await manage({ params, request: form({ intent, ...fields }) })).toBeNull()
  expect(requests(fetch)).toEqual([request])
  expect(fetch.mock.calls[0]![1]?.body).toBe(body && JSON.stringify(body))
})

test.each([
  ['delete', 'DELETE /v1/workspaces/w1'],
  ['leave', 'POST /v1/workspaces/w1/leave'],
])('%s goes back to the directory, which opens another workspace', async (intent, request) => {
  const fetch = stubFetch(204)
  expect(await redirectedTo(manage({ params, request: form({ intent }) }))).toBe('/')
  expect(requests(fetch)).toEqual([request])
})

test('a refused command shows its problem', async () => {
  stubFetch(409, { title: 'Conflict', status: 409, detail: 'The workspace keeps at least one Admin' })
  expect(await manage({ params, request: form({ intent: 'leave' }) })).toBe('The workspace keeps at least one Admin')
})
