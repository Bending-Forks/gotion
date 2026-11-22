import { expect, test } from 'vitest'
import { requests, stubFetch } from '../testing'
import { workspace } from './Workspace'

const research = { workspaceId: 'w1', name: 'Research', role: 'Admin', main: false }
const teaching = { workspaceId: 'w2', name: 'Teaching', role: 'Viewer', main: true }

test('opening a workspace saves it as the main one, then reads the directory (US-02)', async () => {
  const fetch = stubFetch(200, { workspaces: [research, teaching] })
  expect(await workspace({ params: { workspaceId: 'w1' } })).toEqual({ workspaces: [research, teaching], current: research })
  expect(requests(fetch)).toEqual(['POST /v1/workspaces/w1/open', 'GET /v1/directory'])
})
