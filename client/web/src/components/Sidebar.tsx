import { Link, NavLink } from 'react-router'
import { Check, ChevronsUpDown, Inbox as InboxIcon, Settings } from 'lucide-react'
import type { DirectoryEntry } from '../api/types'
import { CreateWorkspace } from '../routes/Directory'
import { Inbox } from './Inbox'
import { PageIcon, type IconName } from './PageIcon'

// A page of the page tree: the root page has no id, since it opens with its workspace
export type PageNode = { pageId?: string; title: string; icon?: IconName; children: PageNode[] }

type Props = { workspaces: DirectoryEntry[]; current: DirectoryEntry; pages: PageNode[] }

// The workspace switcher (US-02), the inbox (US-10), the settings and members (US-03) and the page tree (US-04)
export function Sidebar({ workspaces, current, pages }: Props) {
  return (
    <nav className="sidebar" aria-label="Workspace">
      <button type="button" className="switcher" popoverTarget="workspaces">
        <span className="workspace-mark" aria-hidden>
          {current.name[0]?.toUpperCase()}
        </span>
        <span className="grow">{current.name}</span>
        <ChevronsUpDown aria-hidden size={14} />
      </button>
      <div id="workspaces" popover="auto" className="menu">
        <ul>
          {workspaces.map((w) => (
            <li key={w.workspaceId}>
              <Link to={`/workspaces/${w.workspaceId}`}>
                <span className="grow">{w.name}</span> <span className="muted">{w.role}</span>
                {w.workspaceId === current.workspaceId && <Check aria-label="Open" size={14} />}
              </Link>
            </li>
          ))}
        </ul>
        <CreateWorkspace />
      </div>

      <button type="button" popoverTarget="inbox">
        <InboxIcon aria-hidden size={16} /> Inbox
      </button>
      <div id="inbox" popover="auto" className="menu">
        <Inbox notifications={[]} />
      </div>
      <NavLink to="settings">
        <Settings aria-hidden size={16} /> Settings and members
      </NavLink>

      <h2>Pages</h2>
      <PageTree pages={pages} />
    </nav>
  )
}

export function PageTree({ pages }: { pages: PageNode[] }) {
  return (
    <ul className="page-tree">
      {pages.map((page) => {
        const link = (
          <NavLink to={page.pageId ? `pages/${page.pageId}` : '.'} end>
            <PageIcon icon={page.icon} /> {page.title || 'Untitled'}
          </NavLink>
        )
        return (
          <li key={page.pageId ?? 'root'}>
            {page.children.length ? (
              <details open>
                <summary>{link}</summary>
                <PageTree pages={page.children} />
              </details>
            ) : (
              link
            )}
          </li>
        )
      })}
    </ul>
  )
}
