import { redirect, useFetcher } from 'react-router'
import { Plus } from 'lucide-react'
import { call, formAction } from '../api/client'
import type { Directory as DirectoryBody, Workspace } from '../api/types'
import { Inbox } from '../components/Inbox'

// At login Gotion opens the main workspace or, with none, the first of the directory, which becomes main once open; with no workspace the directory stays (US-02)
export async function directory() {
  const { workspaces } = await call<DirectoryBody>('GET', '/v1/directory')
  const open = workspaces.find((w) => w.main) ?? workspaces[0]
  if (open) throw redirect(`/workspaces/${open.workspaceId}`)
  return null
}

// The new workspace has the user as its first Admin and one root page (US-02)
export const createWorkspace = formAction(async ({ request }: { request: Request }) => {
  const name = String((await request.formData()).get('name'))
  const { workspaceId } = await call<Workspace>('POST', '/v1/workspaces', { name })
  return redirect(`/workspaces/${workspaceId}`)
})

// The empty Workspace directory, from which a user who belongs to no workspace creates one or accepts an invitation (US-01)
export function Directory() {
  return (
    <main className="directory">
      <h1>Welcome to Gotion</h1>
      <p>You belong to no workspace yet: create one, or accept an invitation from your inbox.</p>
      <CreateWorkspace />
      {/* shortcut: Notification has no client API yet, so the inbox is empty here and in the sidebar; load it once it has */}
      <Inbox notifications={[]} />
    </main>
  )
}

// Posts to the directory from wherever it is shown, and stays there with the problem if the name is refused
export function CreateWorkspace() {
  const fetcher = useFetcher<string>()
  return (
    <fetcher.Form method="post" action="/" className="inline-form">
      <input name="name" aria-label="Workspace name" placeholder="New workspace" required />
      <button type="submit">
        <Plus aria-hidden size={16} /> Create
      </button>
      {fetcher.data && <p role="alert">{fetcher.data}</p>}
    </fetcher.Form>
  )
}
