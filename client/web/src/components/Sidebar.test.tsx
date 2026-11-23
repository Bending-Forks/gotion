// @vitest-environment jsdom
import { cleanup, render, within } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { afterEach, expect, test } from 'vitest'
import { Sidebar, type PageNode } from './Sidebar'

afterEach(cleanup)

const research = { workspaceId: 'w1', name: 'Research', role: 'Admin' as const, main: true }
const teaching = { workspaceId: 'w2', name: 'Teaching', role: 'Viewer' as const, main: false }
const pages: PageNode[] = [
  { title: '', children: [{ pageId: 'p1', title: 'Experiments', icon: 'FlaskConical', children: [{ pageId: 'p2', title: 'Trial 1', children: [] }] }] },
]

function sidebar() {
  const Stub = createRoutesStub([
    { path: '/workspaces/:workspaceId', Component: () => <Sidebar workspaces={[research, teaching]} current={research} pages={pages} /> },
  ])
  render(<Stub initialEntries={['/workspaces/w1']} />)
}

test('the page tree links each page from the root page down (US-04)', () => {
  sidebar()
  const tree = within(document.querySelector('.page-tree') as HTMLElement)
  const links = tree.getAllByRole('link').map((a) => [a.textContent?.trim(), a.getAttribute('href')])
  expect(links).toEqual([
    ['Untitled', '/workspaces/w1'],
    ['Experiments', '/workspaces/w1/pages/p1'],
    ['Trial 1', '/workspaces/w1/pages/p2'],
  ])
})

test('the switcher lists every workspace with the role of the user, and marks the open one (US-02)', () => {
  sidebar()
  const menu = within(document.getElementById('workspaces')!)
  const items = menu.getAllByRole('link', { hidden: true }).map((a) => [a.textContent, a.getAttribute('href')])
  expect(items).toEqual([
    ['Research Admin', '/workspaces/w1'],
    ['Teaching Viewer', '/workspaces/w2'],
  ])
  expect(menu.getByLabelText('Open', { selector: 'svg' })).toBeTruthy()
})
