// @vitest-environment jsdom
import { BlockNoteEditor } from '@blocknote/core'
import { expect, test } from 'vitest'
import { slashMenuItems } from './Editor'
import { schema } from './schema'

const editor = () => BlockNoteEditor.create({ schema })

test('the slash menu offers the block types of US-07 and a sub-page among the basic blocks, and nothing else', () => {
  expect(slashMenuItems(editor()).map((item) => item.title)).toEqual([
    'Heading 1',
    'Heading 2',
    'Heading 3',
    'Numbered List',
    'Bullet List',
    'Check List',
    'Paragraph',
    'Code Block',
    'Page',
    'Heading 4',
    'Heading 5',
    'Heading 6',
  ])
})

test('the Page item inserts a page block for a new sub-page (US-04)', () => {
  const e = editor()
  slashMenuItems(e).find((item) => item.title === 'Page')!.onItemClick()
  expect(e.document[0]).toMatchObject({ type: 'pageBlock', props: { subPage: expect.stringMatching(/^[0-9a-f-]{36}$/) } })
})

test('a block in the editor carries only the fields of its type, as the CRDT does', () => {
  const e = BlockNoteEditor.create({
    schema,
    initialContent: [
      { type: 'paragraph', content: 'Question' },
      { type: 'heading', props: { level: 2 }, content: 'Method' },
      { type: 'numberedListItem', content: 'First step' },
      { type: 'checkListItem', content: 'Review' },
    ],
  })
  expect(e.document.map((b) => [b.type, b.props])).toEqual([
    ['paragraph', {}],
    ['heading', { level: 2 }],
    ['numberedListItem', {}],
    ['checkListItem', { checked: false }],
  ])
})
