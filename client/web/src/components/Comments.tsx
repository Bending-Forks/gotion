import { Check } from 'lucide-react'
import { User, userName } from './User'

// A comment thread on the page or on one of its blocks (US-09), as the client shows it
export type Comment = { commentId: string; author: string; text: string; mentions: string[] }
export type Thread = { threadId: string; blockId?: string; resolved: boolean; comments: Comment[] }
export type Post = { threadId?: string; text: string; mentions: string[] }

type Props = {
  threads: Thread[]
  // The members of the workspace, who can be mentioned
  members?: string[]
  onPost?: (post: Post) => void
  onResolve?: (threadId: string) => void
}

// Any member can comment and resolve, Viewers included; each command shows only once its handler is given
export function Comments({ threads, members = [], onPost, onResolve }: Props) {
  return (
    <aside className="comments" aria-label="Comments">
      <h2>Comments</h2>
      {threads.length === 0 && <p className="muted">No comments yet</p>}
      {threads.map((t) => (
        <article key={t.threadId} className="thread">
          <p className="muted">
            {t.blockId ? 'On a block' : 'On the page'}
            {t.resolved && ', resolved'}
          </p>
          {t.comments.map((c) => (
            <div key={c.commentId} className="comment">
              <User userId={c.author} />
              <p>
                {c.text}{' '}
                {c.mentions.map((m) => (
                  <span key={m} className="mention">
                    @{userName(m)}
                  </span>
                ))}
              </p>
            </div>
          ))}
          {!t.resolved && onPost && <Composer label="Reply" members={members} onPost={(post) => onPost({ ...post, threadId: t.threadId })} />}
          {!t.resolved && onResolve && (
            <button type="button" onClick={() => onResolve(t.threadId)}>
              <Check aria-hidden size={14} /> Resolve
            </button>
          )}
        </article>
      ))}
      {onPost && <Composer label="Comment" members={members} onPost={onPost} />}
    </aside>
  )
}

// A new thread on the page, or a reply; React resets the form once posted
function Composer({ label, members, onPost }: { label: string; members: string[]; onPost: (post: Post) => void }) {
  return (
    <form
      className="composer"
      action={(form) => onPost({ text: String(form.get('text')), mentions: form.getAll('mention').map(String).filter(Boolean) })}
    >
      <textarea name="text" aria-label={label} placeholder="Add a comment…" required />
      {members.length > 0 && (
        <select name="mention" aria-label="Mention">
          <option value="">No mention</option>
          {members.map((m) => (
            <option key={m} value={m}>
              @{userName(m)}
            </option>
          ))}
        </select>
      )}
      <button type="submit" className="primary">
        {label}
      </button>
    </form>
  )
}
