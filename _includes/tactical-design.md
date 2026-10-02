## Tactical Design

### Building blocks

Each bounded context has its own model, drawn as a UML class diagram with the DDD stereotypes:
`Aggregate Root`, `Entity`, `Value Object`, `Repository`. A box groups the classes of one
aggregate. Every aggregate root has a repository that stores and loads it whole; factories and
domain services are named in the text where creation or a rule needs one.

Three rules shape every aggregate:

1. **Only the root is referenced from outside.** Inner entities, such as the blocks of a Page
   Block Tree, change only through a command on the root, which checks the invariants first.
2. **Aggregates refer to each other by identity.** A Page holds a `WorkspaceId`, never the
   Workspace. Across contexts the identities are the only thing shared: `UserId`, `WorkspaceId`,
   `PageId`, `BlockId`.
3. **One command changes one aggregate, in one transaction.** A rule that spans two aggregates is
   kept by a policy that reacts to an event, so it holds eventually rather than at once. Those
   rules are collected in [Rules across aggregates](#rules-across-aggregates).

For each aggregate, the commands are listed with who issues them: an actor, named by the role
the command requires, or a policy. A role is held by Membership, so the commands of the other
contexts check it from outside, as summarised in [Roles](#roles).

### Account

```mermaid
classDiagram
  direction LR
  namespace User_aggregate {
    class User {
      <<Aggregate Root>>
      id: UserId
      email: Email
      password: PasswordHash
      mainWorkspace: WorkspaceId
    }
    class Email {
      <<Value Object>>
    }
    class PasswordHash {
      <<Value Object>>
    }
  }
  namespace Workspace_aggregate {
    class Workspace {
      <<Aggregate Root>>
      id: WorkspaceId
      name: WorkspaceName
    }
    class WorkspaceName {
      <<Value Object>>
    }
  }
  class UserRepository {
    <<Repository>>
  }
  class WorkspaceRepository {
    <<Repository>>
  }
  User --> Email
  User --> PasswordHash
  Workspace --> WorkspaceName
  User ..> Workspace : mainWorkspace, by id
  UserRepository ..> User : stores
  WorkspaceRepository ..> Workspace : stores
```

#### User

The identity that signs in (US-01), and the owner of the user's preferences.

- The email address is unique among users. The rule spans every User, so the User factory checks
  it against the `UserRepository` when a user registers.
- The password is kept only as a `PasswordHash`; signing in compares against it and changes no
  state.
- The main workspace is one the user is a member of. Membership holds that fact, so the check is
  made against it (see [Roles](#roles)).

| Command | Issued by | Event |
|---|---|---|
| Register | Visitor | User Registered |
| Sign in | User | User Signed In |
| Set main workspace | User; policy *whenever a user's first workspace is created, make it their main workspace* | Main Workspace Changed |

The main workspace is a preference of one user, while a workspace is shared by all its members.
Keeping it on Workspace, as the board did, would need a flag per member, and changing the main
workspace would update two workspaces in one transaction. The active workspace is not in the
model at all: switching workspace is a navigation choice of the client, with no rule to protect
and no policy reacting to it, served by the *Workspace directory* read model.

#### Workspace

A separate space of pages (US-02). The name is a `WorkspaceName`, never blank.

- Only an Admin of the workspace renames or deletes it.
- A deleted workspace accepts no further command. Its root page and its Workspace Membership are
  removed by policies, not in the same transaction.

| Command | Issued by | Event |
|---|---|---|
| Create workspace | User; policy *whenever a user registers, create their first workspace* | Workspace Created |
| Rename workspace | Admin | Workspace Renamed |
| Delete workspace | Admin | Workspace Deleted |

### Membership

```mermaid
classDiagram
  direction LR
  namespace Workspace_Membership_aggregate {
    class WorkspaceMembership {
      <<Aggregate Root>>
      workspace: WorkspaceId
      members: Member[1..*]
      invitations: Invitation[*]
    }
    class Member {
      <<Entity>>
      user: UserId
      role: Role
    }
    class Invitation {
      <<Entity>>
      id: InvitationId
      invitee: UserId
      role: Role
      invitedBy: UserId
    }
    class Role {
      <<Value Object>>
      Admin
      Editor
      Viewer
    }
  }
  class WorkspaceMembershipRepository {
    <<Repository>>
  }
  WorkspaceMembership "1" *-- "1..*" Member
  WorkspaceMembership "1" *-- "*" Invitation
  Member --> Role
  Invitation --> Role
  WorkspaceMembershipRepository ..> WorkspaceMembership : stores
```

#### Workspace Membership

Who belongs to one workspace, with which role, and who has been invited to it (US-03). It is
identified by the `WorkspaceId` of its workspace.

- **A workspace always keeps at least one Admin.** Change member role, Remove member and Leave
  workspace are refused when they would leave no Admin: the last Admin has to promote another
  member before stepping down or leaving. The board had this rule as a purple sticky, but it
  forbids an operation rather than reacting to an event, so it is an invariant, not a policy.
- The membership starts with the creator of the workspace as its only member, an Admin. Its
  factory takes the creator, so there is no moment without an Admin.
- A user is a member at most once, with exactly one role.
- Only an Admin invites, changes roles and removes members. This check is local, since the roles
  live here.
- An invitation is addressed to a registered user, who receives it as an in-app notification
  (US-10), and who is neither a member nor already invited. It carries the role the invitee will
  have, chosen by the Admin.
- Only the invitee accepts or declines an invitation, and either answer ends it. An invitation
  does not expire: it stays pending until the invitee answers.

| Command | Issued by | Event |
|---|---|---|
| Invite member | Admin | Member Invited |
| Accept invitation | Invitee; policy *whenever a workspace is created, accept the creator as Admin*, carried out by the factory | Member Joined |
| Decline invitation | Invitee | Invitation Declined |
| Change member role | Admin | Member Role Changed |
| Remove member | Admin | Member Removed |
| Leave workspace | Member | Member Left |
| Delete workspace membership | Policy *whenever a workspace is deleted, delete its membership* | Workspace Membership Deleted |

### Editing

```mermaid
classDiagram
  direction TB
  namespace Page_aggregate {
    class Page {
      <<Aggregate Root>>
      id: PageId
      workspace: WorkspaceId
      parent: PageId [0..1]
      metadata: PageMetadata
    }
    class PageMetadata {
      <<Value Object>>
      title
      icon
      cover
    }
  }
  namespace Page_Block_Tree_aggregate {
    class PageBlockTree {
      <<Aggregate Root>>
      page: PageId
      blocks: Block[*]
    }
    class Block {
      <<Entity>>
      id: BlockId
      type: BlockType
      content: Markdown
      children: Block[*]
      subPage: PageId [0..1]
    }
    class BlockType {
      <<Value Object>>
      Text
      Heading
      BulletedList
      NumberedList
      ToDo
      Code
      Page
    }
    class Markdown {
      <<Value Object>>
    }
  }
  namespace Real_time_Editing_Session_aggregate {
    class RealTimeEditingSession {
      <<Aggregate Root>>
      page: PageId
      presence: Presence
      closed: Boolean
    }
    class Presence {
      <<Value Object>>
      collaborators: UserId[*]
    }
    class Edit {
      <<Value Object>>
      author: UserId
      change
    }
  }
  class PageRepository {
    <<Repository>>
  }
  class PageBlockTreeRepository {
    <<Repository>>
  }
  class RealTimeEditingSessionRepository {
    <<Repository>>
  }
  Page --> PageMetadata
  PageBlockTree "1" *-- "*" Block
  Block "1" *-- "*" Block : children
  Block --> BlockType
  Block --> Markdown
  RealTimeEditingSession --> Presence
  RealTimeEditingSession ..> Edit : merges
  Page ..> Page : parent, by id
  PageBlockTree ..> Page : page, by id
  Block ..> Page : subPage, by id
  RealTimeEditingSession ..> Page : page, by id
  PageRepository ..> Page : stores
  PageBlockTreeRepository ..> PageBlockTree : stores
  RealTimeEditingSessionRepository ..> RealTimeEditingSession : stores
```

#### Page

A document of a workspace, with its metadata and its place in the page tree (US-04, US-05).

- **Each workspace has exactly one root page**, the only page without a parent. It is created
  only by the policy on Workspace Created and deleted only by the policy on Workspace Deleted.
  The rule spans every page of the workspace, so the Page factory checks the `PageRepository`
  before creating a root page.
- **A sub-page is created, moved and deleted only through its page block.** Inserting, moving or
  deleting the page block in the tree of the parent page fires the matching command on Page. Each
  sub-page therefore has exactly one page block, and nothing flows back from Page to the block,
  so the loop raised while reviewing the board cannot happen.
- The parent of a sub-page is the page whose tree holds its page block, in the same workspace.
- Deleting a page is final (US-04): its content and its sub-pages are deleted with it, by
  policies.
- The metadata is set on the page itself or by updating its page block; both end up on Page. The
  page block shows the title, icon and cover through the read model, without keeping a copy.

| Command | Issued by | Event |
|---|---|---|
| Create page | Policies *whenever a workspace is created, create its root page* and *whenever a page block is inserted, create the sub-page* | Page Created |
| Set title, icon, cover | Editor; policy *whenever a page block is updated, update its metadata* | Page Metadata Changed |
| Move page | Policy *whenever a page block is moved, move it in the tree as well* | Page Moved |
| Delete page | Policies *whenever a page block is deleted, delete the page as well*, *whenever a page is deleted, delete its content and sub-pages* and *whenever a workspace is deleted, delete its root page* | Page Deleted |

#### Page Block Tree

The content of one page (US-06, US-07). It is identified by the `PageId` of its page and starts
empty together with it.

- The blocks form an ordered tree: every block has exactly one parent, the page or another block,
  and a position among its siblings. A block cannot be nested under itself or one of its
  descendants.
- The content of a block is Markdown (BR-03) and fits its type. A page block, and only a page
  block, refers to a sub-page.
- Deleting a block deletes the blocks nested in it. Block Deleted lists the page blocks removed
  with them, so that every sub-page underneath is deleted, not only the top one.
- A new block type is a new value of `BlockType` and its rendering, both inside Editing, with no
  change to any other aggregate or context (QA-09).

| Command | Issued by | Event |
|---|---|---|
| Insert block | Policy *when edits are merged, apply them to the page block tree* | Block Inserted |
| Update block | Same policy | Block Updated |
| Move or nest block | Same policy | Block Moved |
| Delete block | Same policy | Block Deleted |
| Delete block tree | Policy *whenever a page is deleted, delete its content and sub-pages* | Block Tree Deleted |

#### Real-time Editing Session

The shared editing of one page (US-08). It is identified by the `PageId` of its page. As agreed
while reviewing the board, the session exists even with a single collaborator: the first Join
session opens it, so editing alone and editing together follow the same path.

- Only a collaborator who has joined can submit edits, and only with a role that may change the
  content. A Viewer can join to follow the edits and appear in the presence, but cannot submit.
- Concurrent edits are merged into one result that every collaborator converges to, and no
  acknowledged edit is dropped (QA-05). Where edits are ordered and merged is PP-01, settled by an
  ADR; the `change` carried by an `Edit` takes its form from that decision.
- A closed session accepts no join and no edit. It is closed when its page is deleted, and the
  collaborators learn it from Session Closed itself: the *notify its participants* of the policy
  is that event, not an in-app notification, which US-10 keeps for invitations and mentions.

| Command | Issued by | Event |
|---|---|---|
| Join session | Collaborator | Session Joined |
| Leave session | Collaborator | Session Left |
| Submit edit | Editor | Edits Merged |
| Close session | Policy *when a page is deleted, close its editing session and notify its participants* | Session Closed |

### Discussion

```mermaid
classDiagram
  direction LR
  namespace Comment_Thread_aggregate {
    class CommentThread {
      <<Aggregate Root>>
      id: ThreadId
      workspace: WorkspaceId
      anchor: Anchor
      comments: Comment[1..*]
      resolved: Boolean
    }
    class Anchor {
      <<Value Object>>
      page: PageId
      block: BlockId [0..1]
    }
    class Comment {
      <<Entity>>
      id: CommentId
      author: UserId
      text: Markdown
      mentions: Mention[*]
    }
    class Mention {
      <<Value Object>>
      user: UserId
    }
  }
  class CommentThreadRepository {
    <<Repository>>
  }
  CommentThread --> Anchor
  CommentThread "1" *-- "1..*" Comment
  Comment --> Mention
  CommentThreadRepository ..> CommentThread : stores
```

#### Comment Thread

A conversation attached to a page or to one of its blocks (US-09).

- The anchor is fixed when the thread opens and never changes.
- A thread is never empty: its factory opens it together with its first comment.
- A resolved thread accepts no new comments.
- A mention names a member of the workspace.
- Any member of the workspace posts and resolves, whatever their role: a comment does not
  change the content of the page, so a Viewer can take part in the discussion too.

| Command | Issued by | Event |
|---|---|---|
| Post comment | Collaborator | Comment Posted |
| Resolve thread | Collaborator | Thread Resolved |
| Delete thread | Policies *whenever a page is deleted, delete its comment threads* and *whenever a block is deleted, delete its comment threads* | Thread Deleted |

### Notification

```mermaid
classDiagram
  direction LR
  namespace Notification_aggregate {
    class Notification {
      <<Aggregate Root>>
      id: NotificationId
      recipient: UserId
      subject: Subject
      status: Status
    }
    class Subject {
      <<Value Object>>
      Invitation
      Mention
    }
    class Status {
      <<Value Object>>
      Raised
      Delivered
      Read
    }
  }
  class NotificationRepository {
    <<Repository>>
  }
  Notification --> Subject
  Notification --> Status
  NotificationRepository ..> Notification : stores
```

#### Notification

A message telling one user about an invitation or a mention (US-10).

- The status only moves forward: Raised, then Delivered, then Read.
- Delivery is best effort and may be repeated: delivering an already delivered notification
  changes nothing.
- Only the recipient marks it as read.
- Mentioning oneself raises nothing: the policy fires only when *another* user is mentioned.

| Command | Issued by | Event |
|---|---|---|
| Raise notification | Policies *when MemberInvited then send the invitation* and *when another user is mentioned* | Notification Raised |
| Deliver notification | Policy *notification delivery with best effort* | Notification Delivered |
| Mark as read | User | Notification Read |

### Rules across aggregates

The rules that span more than one aggregate, and the policies that keep them. Between the event
and the reaction the rule does not hold yet: right after Workspace Created, for instance, the
root page may not exist, and the read models must allow for it.

| Rule | Kept by | Traces to |
|---|---|---|
| A new user has a workspace, and it is their main one | *Whenever a user registers, create their first workspace*; *whenever a user's first workspace is created, make it their main workspace* | US-01, US-02 |
| A workspace has an Admin from its creation | *Whenever a workspace is created, accept the creator as Admin* | US-03 |
| A workspace has exactly one root page | *Whenever a workspace is created, create its root page*, plus the check of the Page factory | US-04 |
| Every page block has its sub-page, and every sub-page its page block | *Whenever a page block is inserted, moved, deleted, updated…* | US-04 |
| Merged edits reach the content of the page | *When edits are merged, apply them to the page block tree* | US-08 |
| Deleting a workspace deletes everything in it | *Whenever a workspace is deleted, delete its root page*, then the cascade below; *whenever a workspace is deleted, delete its membership* | US-02, PP-05 |
| Deleting a page deletes its content, sub-pages, session and threads | *Whenever a page is deleted, delete its content and sub-pages*; *when a page is deleted, close its editing session*; *whenever a page is deleted, delete its comment threads* | US-04, US-09, PP-05 |
| Deleting a block deletes the threads anchored to it | *Whenever a block is deleted, delete its comment threads* | US-09, PP-05 |
| Invited and mentioned users are told | *When MemberInvited then send the invitation*; *when another user is mentioned* | US-10 |

### Roles

The roles live in Membership, but most of the commands that need them belong to other contexts.
The table states which role each command requires; the relations that carry them are in the
[Context Map](#context-map), and how the roles reach the other contexts is PP-04.

| Command | Context | Admin | Editor | Viewer |
|---|---|---|---|---|
| Rename workspace, Delete workspace | Account | ✓ | | |
| Invite member, Change member role, Remove member | Membership | ✓ | | |
| Leave workspace | Membership | ✓ | ✓ | ✓ |
| Set title, icon, cover; Submit edit | Editing | ✓ | ✓ | |
| Join session | Editing | ✓ | ✓ | ✓ |

Three more checks read Membership without a role: the main workspace of a user is one the user
is a member of, only a member posts a comment or resolves a thread, and a mention names a member
of the workspace.

### Changes from the board

The model refines the board, and these changes are to be carried back to it:

- *Set main workspace* moves from Workspace to User, and *Switch workspace* with *Workspace
  Switched* leave the model, as explained under [User](#user).
- *Rename workspace* → *Workspace Renamed* is added, as US-02 requires.
- *Decline invitation* → *Invitation Declined* settles PP-02, and *Leave workspace* → *Member
  Left* settles PP-03. The sticky *not possible to leave the workspace if you are last Admin*
  becomes an invariant of Workspace Membership.
- The deletion policies of Membership and Discussion, with *Workspace Membership Deleted* and
  *Thread Deleted*, settle PP-05.
- The Editor no longer issues *Move page* and *Delete page*: the Editor moves or deletes the page
  block, and the policies do the rest.
- Moving a sub-page under a different parent page is not modelled: a page block moves only within
  the tree of its own page.
