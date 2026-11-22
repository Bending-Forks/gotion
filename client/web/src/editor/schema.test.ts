// The editor holds only what the CRDT holds (packages/crdt/src/schema.ts): the block types of US-07, the page block, and the styles Markdown can express (BR-03)
import { expect, test } from 'vitest'
import { schema } from './schema'

test('the editor has only the block types of US-07 and the page block, each with only the fields of its type', () => {
  const fields = Object.fromEntries(Object.entries(schema.blockSchema).map(([type, block]) => [type, Object.keys(block.propSchema)]))
  expect(fields).toEqual({
    paragraph: [],
    heading: ['level'],
    bulletListItem: [],
    numberedListItem: [],
    checkListItem: ['checked'],
    codeBlock: ['language'],
    pageBlock: ['subPage'],
  })
})

test('a heading has a level from 1 to 6', () => {
  expect(schema.blockSchema.heading.propSchema.level.values).toEqual([1, 2, 3, 4, 5, 6])
})

test('the text has only the styles Markdown can express, and links', () => {
  expect(Object.keys(schema.styleSchema)).toEqual(['bold', 'italic', 'strike', 'code'])
  expect(Object.keys(schema.inlineContentSchema)).toEqual(['text', 'link'])
})
