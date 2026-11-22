import {
  BlockNoteSchema,
  createBulletListItemBlockSpec,
  createCheckListItemBlockSpec,
  createCodeBlockSpec,
  createHeadingBlockSpec,
  createNumberedListItemBlockSpec,
  createParagraphBlockSpec,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
  type BlockSpec,
  type PropSchema,
} from '@blocknote/core'
import { pageBlock } from './PageBlock'

// Keeps only the fields of a block type, as the CRDT does (packages/crdt/src/schema.ts): the colours and the alignment BlockNote gives every block are not Markdown (BR-03)
function only<T extends string, P extends PropSchema, C extends 'inline' | 'none' | 'plain', K extends keyof P & string>(
  spec: BlockSpec<T, P, C>,
  ...fields: K[]
) {
  const propSchema = Object.fromEntries(fields.map((field) => [field, spec.config.propSchema[field]]))
  return { ...spec, config: { ...spec.config, propSchema } } as unknown as BlockSpec<T, Pick<P, K>, C>
}

// The language of a code block is the word after the opening fence in Markdown
const languages = ['bash', 'css', 'go', 'html', 'java', 'javascript', 'json', 'markdown', 'python', 'sql', 'typescript', 'yaml']

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: only(createParagraphBlockSpec()),
    heading: only(createHeadingBlockSpec({ levels: [1, 2, 3, 4, 5, 6], allowToggleHeadings: false }), 'level'),
    bulletListItem: only(createBulletListItemBlockSpec()),
    numberedListItem: only(createNumberedListItemBlockSpec()),
    checkListItem: only(createCheckListItemBlockSpec(), 'checked'),
    codeBlock: createCodeBlockSpec({
      supportedLanguages: Object.fromEntries([['text', { name: 'Plain text' }], ...languages.map((l) => [l, { name: l }])]),
    }),
    pageBlock: pageBlock(),
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    strike: defaultStyleSpecs.strike,
    code: defaultStyleSpecs.code,
  },
  // Text and links
  inlineContentSpecs: defaultInlineContentSpecs,
})
