// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { Comments, type Thread } from './Comments'

afterEach(cleanup)

const bob = 'b0b00000-0000-4000-8000-000000000002'
const threads: Thread[] = [
  { threadId: 't1', resolved: false, comments: [{ commentId: 'c1', author: bob, text: 'Can we check this?', mentions: [] }] },
  { threadId: 't2', blockId: 'b1', resolved: true, comments: [{ commentId: 'c2', author: bob, text: 'Done', mentions: [bob] }] },
]

test('a page without threads says so, and with no handler offers no command', () => {
  render(<Comments threads={[]} />)
  expect(screen.getByText('No comments yet')).toBeTruthy()
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('a thread shows its anchor, its comments and their mentions, and a resolved one takes no reply (US-09)', () => {
  render(<Comments threads={threads} onPost={() => {}} onResolve={() => {}} />)
  expect(screen.getByText('On the page')).toBeTruthy()
  expect(screen.getByText('On a block, resolved')).toBeTruthy()
  expect(screen.getByText('@b0b00000')).toBeTruthy()
  // One reply and one resolve for the open thread, plus the composer of a new thread
  expect(screen.getAllByRole('button', { name: 'Reply' })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: /Resolve/ })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: 'Comment' })).toHaveLength(1)
})

test('a reply posts its text and its mention to its thread, and resolving names the thread', async () => {
  const onPost = vi.fn()
  const onResolve = vi.fn()
  render(<Comments threads={threads} members={[bob]} onPost={onPost} onResolve={onResolve} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Reply' }), { target: { value: 'Checked' } })
  fireEvent.change(screen.getAllByRole('combobox', { name: 'Mention' })[0]!, { target: { value: bob } })
  fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
  await vi.waitFor(() => expect(onPost).toHaveBeenCalledWith({ threadId: 't1', text: 'Checked', mentions: [bob] }))
  fireEvent.click(screen.getByRole('button', { name: /Resolve/ }))
  expect(onResolve).toHaveBeenCalledWith('t1')
})
