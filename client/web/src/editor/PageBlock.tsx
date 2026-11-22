import { createReactBlockSpec } from '@blocknote/react'
import { FileText } from 'lucide-react'
import { Link, useParams } from 'react-router'

// The block that stands for a sub-page, and holds nothing but it (US-04)
export const pageBlock = createReactBlockSpec(
  { type: 'pageBlock', propSchema: { subPage: { default: '' } }, content: 'none' },
  { render: ({ block }) => <PageLink pageId={block.props.subPage} /> },
)

// shortcut: shows every sub-page as Untitled, since the report has not settled where the metadata of a page block is read (Components and Connectors); show its title and icon (US-05) once it has
function PageLink({ pageId }: { pageId: string }) {
  const { workspaceId } = useParams()
  return (
    <Link className="page-block" to={`/workspaces/${workspaceId}/pages/${pageId}`} contentEditable={false}>
      <FileText aria-hidden size={18} /> Untitled
    </Link>
  )
}
