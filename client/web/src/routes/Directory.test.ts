import { expect, test } from 'vitest'
import { form, stubFetch } from '../testing'
import { openWorkspace } from './Directory'

test('opening a workspace saves it as the main one and goes to it', async () => {
  const fetch = stubFetch(204)
  const response = await openWorkspace({ request: form({ workspaceId: 'w1' }) })
  expect(fetch).toHaveBeenCalledWith('/v1/workspaces/w1/open', expect.objectContaining({ method: 'POST' }))
  expect(response.headers.get('Location')).toBe('/workspaces/w1')
})
