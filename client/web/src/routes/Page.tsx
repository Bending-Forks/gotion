import { Link, useParams } from 'react-router'
import { FileText } from 'lucide-react'

// The pages of a workspace and the editor (BlockNote over the WebSocket of Editing) arrive with their own tasks; this is the route they fill
export function Page() {
  const { workspaceId, pageId } = useParams()
  return (
    <main>
      <Link to="/">← Workspaces</Link>
      <h1>
        <FileText aria-hidden size={20} /> {pageId ? `Page ${pageId}` : 'No page open'}
      </h1>
      <p>Workspace {workspaceId}</p>
    </main>
  )
}
