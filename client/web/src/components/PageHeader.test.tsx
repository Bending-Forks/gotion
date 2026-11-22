// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { PageHeader } from './PageHeader'

afterEach(cleanup)

// jsdom has no Popover API, which every browser Gotion targets has
HTMLElement.prototype.hidePopover ??= () => {}

test('without onChange, as for a Viewer, the metadata can be read but not changed (US-04)', () => {
  render(<PageHeader page={{ title: 'Lab notebook', icon: 'FlaskConical', cover: 'https://images.test/cover.png' }} />)
  expect((screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement).readOnly).toBe(true)
  expect(screen.queryByRole('button')).toBeNull()
  expect(document.querySelector('img.cover')?.getAttribute('src')).toBe('https://images.test/cover.png')
})

test('an Editor sets the title, the icon and the cover of a page (US-05)', () => {
  const onChange = vi.fn()
  render(<PageHeader page={{ title: 'Experiments' }} onChange={onChange} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Lab notebook' } })
  fireEvent.click(screen.getByRole('button', { name: 'FlaskConical', hidden: true }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Link to the cover image', hidden: true }), { target: { value: 'https://images.test/cover.png' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save', hidden: true }))
  expect(onChange.mock.calls).toEqual([
    [{ title: 'Lab notebook' }],
    [{ title: 'Experiments', icon: 'FlaskConical' }],
    [{ title: 'Experiments', cover: 'https://images.test/cover.png' }],
  ])
})

test('an Editor removes the icon and the cover', () => {
  const onChange = vi.fn()
  render(<PageHeader page={{ title: 'Experiments', icon: 'Star', cover: 'https://images.test/cover.png' }} onChange={onChange} />)
  for (const button of screen.getAllByRole('button', { name: 'Remove', hidden: true })) fireEvent.click(button)
  expect(onChange.mock.calls).toEqual([
    [{ title: 'Experiments', icon: undefined, cover: 'https://images.test/cover.png' }],
    [{ title: 'Experiments', icon: 'Star', cover: undefined }],
  ])
})
