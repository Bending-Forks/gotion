import { useState } from 'react'
import { useParams } from 'react-router'
import { MessageSquare } from 'lucide-react'
import { Comments } from '../components/Comments'
import { PageHeader, type PageMetadata } from '../components/PageHeader'
import { PageIcon } from '../components/PageIcon'
import { User } from '../components/User'
import { Editor } from '../editor/Editor'
import { useWorkspace } from './Workspace'

// A new view for each page, so that nothing of one page stays in the next
export function Page() {
  const { pageId } = useParams()
  return <PageView key={pageId ?? 'root'} />
}

// shortcut: Editing has no client API for the metadata and the session yet, and Discussion none for the threads, so the page starts empty and lives only in this view, with no collaborator and no thread; load them here once they have
function PageView() {
  const { current } = useWorkspace()
  const editable = current.role !== 'Viewer'
  const [page, setPage] = useState<PageMetadata>({ title: '' })
  const [comments, setComments] = useState(false)
  const collaborators: string[] = []
  return (
    <div className="page-view">
      <main className="page">
        <header className="topbar">
          <span className="breadcrumb">
            {current.name} / <PageIcon icon={page.icon} size={16} /> {page.title || 'Untitled'}
          </span>
          <ul className="collaborators" aria-label="Connected collaborators">
            {collaborators.map((userId) => (
              <li key={userId}>
                <User userId={userId} />
              </li>
            ))}
          </ul>
          <button type="button" aria-pressed={comments} onClick={() => setComments(!comments)}>
            <MessageSquare aria-hidden size={16} /> Comments
          </button>
        </header>
        <PageHeader page={page} onChange={editable ? setPage : undefined} />
        <Editor editable={editable} />
      </main>
      {comments && <Comments threads={[]} />}
    </div>
  )
}
