import { Outlet, useLoaderData, useRouteLoaderData, type Params } from 'react-router'
import { call } from '../api/client'
import type { Directory } from '../api/types'
import { Sidebar } from '../components/Sidebar'

// Opening a workspace saves it as the user's main one, and Account refuses a workspace the user is not a member of (US-02)
export async function workspace({ params }: { params: Params }) {
  await call('POST', `/v1/workspaces/${params.workspaceId}/open`)
  const { workspaces } = await call<Directory>('GET', '/v1/directory')
  // Open succeeded, so the user is a member and the directory lists the workspace
  return { workspaces, current: workspaces.find((w) => w.workspaceId === params.workspaceId)! }
}

// The workspace open in the layout, with the role of the user in it, for the routes inside
export const useWorkspace = () => useRouteLoaderData<typeof workspace>('workspace')!

export function Workspace() {
  const { workspaces, current } = useLoaderData<typeof workspace>()
  return (
    <div className="workspace">
      {/* shortcut: Editing has no client API for the page tree yet (how it serves the sub-pages is still open in the report), so the tree holds only the root page; load it here once it has */}
      <Sidebar key={current.workspaceId} workspaces={workspaces} current={current} pages={[{ title: '', children: [] }]} />
      <Outlet />
    </div>
  )
}
