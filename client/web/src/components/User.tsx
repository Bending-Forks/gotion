// shortcut: the services give only the UserId of a member, with no name or email address, so a user is shown by the start of their id; show the email address once the gateway gives it
export const userName = (userId: string) => userId.slice(0, 8)

// A user, with an avatar made of the first letter of their name
export function User({ userId }: { userId: string }) {
  const name = userName(userId)
  return (
    <span className="user" title={name}>
      <span className="avatar" aria-hidden>
        {name[0]?.toUpperCase()}
      </span>
      <span className="user-name">{name}</span>
    </span>
  )
}
