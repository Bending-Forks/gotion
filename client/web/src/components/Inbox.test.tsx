// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { Inbox, type Notification } from './Inbox'

afterEach(cleanup)

const alice = 'a11ce000-0000-4000-8000-000000000001'
const invitation: Notification = { notificationId: 'n1', read: false, from: alice, workspaceId: 'w1', subject: 'invitation' }
const mention: Notification = { notificationId: 'n2', read: true, from: alice, workspaceId: 'w1', subject: 'mention', pageId: 'p1' }

const inbox = (props: Parameters<typeof Inbox>[0]) =>
  render(
    <MemoryRouter>
      <Inbox {...props} />
    </MemoryRouter>,
  )

test('an empty inbox says so', () => {
  inbox({ notifications: [] })
  expect(screen.getByText('No notifications')).toBeTruthy()
})

test('an invitation can be accepted or declined, and an unread notification marked as read (US-10)', () => {
  const onAccept = vi.fn()
  const onDecline = vi.fn()
  const onRead = vi.fn()
  inbox({ notifications: [invitation, mention], onAccept, onDecline, onRead })
  fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
  // Only the invitation is unread
  fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }))
  expect([onAccept.mock.calls, onDecline.mock.calls, onRead.mock.calls]).toEqual([[[invitation]], [[invitation]], [[invitation]]])
})

test('a mention links to the page of its comment', () => {
  inbox({ notifications: [mention] })
  expect(screen.getByRole('link', { name: 'comment' }).getAttribute('href')).toBe('/workspaces/w1/pages/p1')
  expect(screen.queryByRole('button')).toBeNull()
})
