import { Link } from 'react-router'
import { User } from './User'

// An in-app notification of an invitation or a mention (US-10), as the client shows it
export type Notification = { notificationId: string; read: boolean; from: string; workspaceId: string } & (
  | { subject: 'invitation' }
  | { subject: 'mention'; pageId: string }
)

type Props = {
  notifications: Notification[]
  onAccept?: (n: Notification) => void
  onDecline?: (n: Notification) => void
  onRead?: (n: Notification) => void
}

// Each command shows only once its handler is given
export function Inbox({ notifications, onAccept, onDecline, onRead }: Props) {
  return (
    <section className="inbox" aria-label="Inbox">
      <h2>Inbox</h2>
      {notifications.length === 0 && <p className="muted">No notifications</p>}
      <ul>
        {notifications.map((n) => (
          <li key={n.notificationId} className={n.read ? 'read' : 'unread'}>
            <User userId={n.from} />
            {n.subject === 'invitation' ? (
              <p>invited you to a workspace</p>
            ) : (
              <p>
                mentioned you in a <Link to={`/workspaces/${n.workspaceId}/pages/${n.pageId}`}>comment</Link>
              </p>
            )}
            <div className="actions">
              {n.subject === 'invitation' && onAccept && (
                <button type="button" className="primary" onClick={() => onAccept(n)}>
                  Accept
                </button>
              )}
              {n.subject === 'invitation' && onDecline && (
                <button type="button" onClick={() => onDecline(n)}>
                  Decline
                </button>
              )}
              {!n.read && onRead && (
                <button type="button" onClick={() => onRead(n)}>
                  Mark as read
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
