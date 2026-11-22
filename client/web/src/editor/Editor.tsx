import '@blocknote/ariakit/style.css'
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu, type BlockNoteEditor } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/ariakit'
import { SuggestionMenuController, getDefaultReactSlashMenuItems, useCreateBlockNote, type DefaultReactSuggestionItem } from '@blocknote/react'
import { FileText } from 'lucide-react'
import { schema } from './schema'

type Editor = BlockNoteEditor<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>

// The items of the slash menu: the block types of the schema, without the emoji picker BlockNote adds, and a sub-page among the basic blocks (US-04, US-07)
export function slashMenuItems(editor: Editor): DefaultReactSuggestionItem[] {
  const items = getDefaultReactSlashMenuItems(editor).filter((item) => !('key' in item && item.key === 'emoji'))
  const codeBlock = items.findIndex((item) => 'key' in item && item.key === 'code_block')
  items.splice(codeBlock + 1, 0, {
    title: 'Page',
    subtext: 'A sub-page inside this page',
    group: items[codeBlock]?.group,
    icon: <FileText size={18} />,
    onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'pageBlock', props: { subPage: crypto.randomUUID() } }),
  })
  return items
}

// The content of a page (US-06, US-07); a Viewer reads it but cannot change it (US-04)
export function Editor({ editable }: { editable: boolean }) {
  // shortcut: the content lives only in this editor, and is lost when the page closes, until the adapter and the session with Editing arrive (ADR-01)
  const editor = useCreateBlockNote({ schema })
  return (
    <BlockNoteView editor={editor} editable={editable} slashMenu={false} theme="light">
      <SuggestionMenuController triggerCharacter="/" getItems={async (query) => filterSuggestionItems(slashMenuItems(editor), query)} />
    </BlockNoteView>
  )
}
