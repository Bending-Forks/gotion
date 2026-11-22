import { expect, test } from 'vitest'
import { form, redirectedTo, requests, stubFetch } from '../testing'
import { createWorkspace, directory } from './Directory'

const research = { workspaceId: 'w1', name: 'Research', role: 'Admin', main: false }
const teaching = { workspaceId: 'w2', name: 'Teaching', role: 'Viewer', main: true }

test('at login Gotion opens the main workspace (US-02)', async () => {
  stubFetch(200, { workspaces: [research, teaching] })
  expect(await redirectedTo(directory())).toBe('/workspaces/w2')
})

test('with no main workspace Gotion opens the first of the directory', async () => {
  stubFetch(200, { workspaces: [research, { ...teaching, main: false }] })
  expect(await redirectedTo(directory())).toBe('/workspaces/w1')
})

test('with no workspace the directory stays open, and empty', async () => {
  stubFetch(200, { workspaces: [] })
  expect(await directory()).toBeNull()
})

test('a new workspace opens once created', async () => {
  const fetch = stubFetch(201, { workspaceId: 'w3', name: 'Lab' })
  expect(await redirectedTo(createWorkspace({ request: form({ name: 'Lab' }) }))).toBe('/workspaces/w3')
  expect(requests(fetch)).toEqual(['POST /v1/workspaces'])
  expect(fetch.mock.calls[0]![1]?.body).toBe(JSON.stringify({ name: 'Lab' }))
})

test('a refused workspace stays on the form with its problem', async () => {
  stubFetch(400, { title: 'Bad Request', status: 400, detail: 'The name is blank' })
  expect(await createWorkspace({ request: form({ name: ' ' }) })).toBe('The name is blank')
})
