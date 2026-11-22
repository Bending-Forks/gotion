import { Form, redirect, useLoaderData } from 'react-router'
import { Star } from 'lucide-react'
import { call } from '../api/client'
import type { Directory as DirectoryBody } from '../api/types'

// The workspaces of the signed-in user, in one request to the gateway (US-02)
export const directory = () => call<DirectoryBody>('GET', '/v1/directory')

// Open workspace saves it as the user's main workspace in Account
export async function openWorkspace({ request }: { request: Request }) {
  const workspaceId = String((await request.formData()).get('workspaceId'))
  await call('POST', `/v1/workspaces/${workspaceId}/open`)
  return redirect(`/workspaces/${workspaceId}`)
}

export function Directory() {
  const { workspaces } = useLoaderData<typeof directory>()
  return (
    <main>
      <h1>Workspaces</h1>
      <ul>
        {workspaces.map((w) => (
          <li key={w.workspaceId}>
            <Form method="post">
              <button type="submit" name="workspaceId" value={w.workspaceId}>
                {w.name}
              </button>{' '}
              ({w.role}) {w.main && <Star aria-label="Main workspace" size={14} />}
            </Form>
          </li>
        ))}
      </ul>
    </main>
  )
}
