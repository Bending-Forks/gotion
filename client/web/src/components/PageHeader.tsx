import { useId, type FormEvent } from 'react'
import { ImagePlus, Shapes } from 'lucide-react'
import { PageIcon, pageIcons, type IconName } from './PageIcon'

// The metadata of a page (US-05): its cover is a link to an image
export type PageMetadata = { title: string; icon?: IconName; cover?: string }

type Props = { page: PageMetadata; onChange?: (page: PageMetadata) => void }

// The cover, icon and title of a page; without onChange, as for a Viewer, they can be read but not changed (US-04)
export function PageHeader({ page, onChange }: Props) {
  const iconPicker = useId()
  const coverForm = useId()
  const setCover = (cover: string | undefined) => {
    onChange?.({ ...page, cover })
    document.getElementById(coverForm)?.hidePopover()
  }
  return (
    <header className="page-header">
      {page.cover && <img className="cover" src={page.cover} alt="" />}
      <div className="page-title">
        {page.icon && <PageIcon icon={page.icon} size={64} />}
        {onChange && (
          <div className="page-controls">
            <button type="button" popoverTarget={iconPicker}>
              <Shapes aria-hidden size={16} /> {page.icon ? 'Change icon' : 'Add icon'}
            </button>
            <button type="button" popoverTarget={coverForm}>
              <ImagePlus aria-hidden size={16} /> {page.cover ? 'Change cover' : 'Add cover'}
            </button>
            <div id={iconPicker} popover="auto" className="menu icon-picker" aria-label="Icons">
              {(Object.keys(pageIcons) as IconName[]).map((icon) => (
                <button key={icon} type="button" aria-label={icon} popoverTarget={iconPicker} popoverTargetAction="hide" onClick={() => onChange({ ...page, icon })}>
                  <PageIcon icon={icon} />
                </button>
              ))}
              {page.icon && (
                <button type="button" popoverTarget={iconPicker} popoverTargetAction="hide" onClick={() => onChange({ ...page, icon: undefined })}>
                  Remove
                </button>
              )}
            </div>
            <form
              id={coverForm}
              popover="auto"
              className="menu inline-form"
              onSubmit={(e: FormEvent<HTMLFormElement>) => {
                e.preventDefault()
                setCover(String(new FormData(e.currentTarget).get('cover')))
              }}
            >
              <input name="cover" type="url" aria-label="Link to the cover image" placeholder="https://…" defaultValue={page.cover} required />
              <button type="submit">Save</button>
              {page.cover && (
                <button type="button" onClick={() => setCover(undefined)}>
                  Remove
                </button>
              )}
            </form>
          </div>
        )}
        <input
          className="title"
          aria-label="Title"
          placeholder="Untitled"
          value={page.title}
          readOnly={!onChange}
          onChange={(e) => onChange?.({ ...page, title: e.target.value })}
        />
      </div>
    </header>
  )
}
