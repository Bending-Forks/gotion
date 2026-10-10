## Ubiquitous language

Each word below has exactly one meaning, in this report, in the code, and in the API: a block is a `Block` in the source, never a `Node` or an `Item`.

This glossary records the ubiquitous language of Gotion. Following DDD, the language is split by bounded context: a term is precise only inside the context where it is defined, and the same person or thing can take a different name in each context. The terms come from the [Event Storming](#event-storming) board, where the sticky wording is the language, and from the [user stories](#functional-requirements).

#### Account

| Term | Definition | Not to be confused with |
|---|---|---|
| User | A person registered in Gotion with an email address and a password (US-01). The identity that signs in. | *Member*, which is a user seen inside one workspace. |
| Workspace | A separate space that contains pages, used to keep different projects or teams apart (US-02). A user's first workspace is created when the user registers. | *Workspace Membership*, which holds who belongs to the workspace. |
| Main workspace | The user's default workspace. Initially it is the first workspace created when the user registers, and the user can choose another. If an Admin removes the user from it, Gotion automatically sets one of their remaining workspaces as main. Removal is refused if the user belongs to no other workspace (US-02, US-03). | *Active workspace*. |
| Active workspace | The workspace the user is currently working in; switching workspace changes it. | *Main workspace*. |

#### Membership

| Term | Definition | Not to be confused with |
|---|---|---|
| Workspace Membership | The set of members of one workspace, each with a role. A workspace always keeps at least one Admin, so the last Admin cannot leave it. | *Workspace*, which lives in the Account context. |
| Member | A user who belongs to a workspace. Every member has exactly one role: Admin, Editor or Viewer. | *User*, the identity in the Account context. |
| Role | What a member may do in the workspace: Admin, Editor or Viewer (US-03). | — |
| Admin | The role that can do everything an Editor can, and also invite members, remove them and change their role (US-03). The creator of a workspace becomes its first Admin. | — |
| Editor | The role that can create, change and delete the pages and blocks of the workspace. | — |
| Viewer | The role that can read the pages of the workspace and take part in their discussions, but cannot change their content. | — |
| Invitation | The request an Admin sends to a person to join a workspace. Accepting it turns the invitee into a member. | *Notification*, which only delivers the invitation. |
| Invitee | The person an invitation is addressed to, until they accept it. | *Member*. |

#### Editing

| Term | Definition | Not to be confused with |
|---|---|---|
| Page | A document of a workspace, with its metadata and its place in the page tree (US-04). A page is either the root page or a sub-page, which is also a block of its parent page. | *Page Block Tree*, the content of the page. |
| Root page | The only page of a workspace that has no parent, created together with the workspace. It holds content like any other page, and it is where new pages start: every other page is created inside it or inside one of its sub-pages, so every page of the workspace descends from it. A workspace has exactly one root page: no other can be created, and it is deleted only together with its workspace. | *Main workspace*. |
| Sub-page | Any page other than the root page: a page whose page block lives inside another page, its parent. | — |
| Page tree | The hierarchy of the pages of a workspace, rooted at the root page and given by the parent of each page. | *Page Block Tree*. |
| Page metadata | The title, icon and cover of a page (US-05). | *Page content*. |
| Block | The unit of content of a page: formatted text, heading, bulleted, numbered or to-do list, code (US-06, US-07). Blocks are ordered and can be nested. The type of a block comes from its block content. | — |
| Block content | What a block holds, in the shape its type needs: Markdown text for most types, plus a level for a heading and a checkbox for a to-do, the code for a code block, only the sub-page for a page block. Replacing it turns the block into another type, and the block stays the same block. | *Page Block Tree*, the content of the whole page. |
| Page block | The block that stands for a sub-page. Inserting, moving, deleting or updating it creates, moves, deletes or updates the metadata of that sub-page. A page block never turns into another type, and no other block turns into one. | *Page*, which the page block points to. |
| Page Block Tree | The ordered, nestable tree of the blocks of one page: the page content. There is one per page, and it is deleted as a whole when its page is deleted. | *Page tree*, which is made of pages. |
| Real-time Editing Session | The shared editing of one page by the collaborators who have it open (US-08). Their edits are merged and then applied to the Page Block Tree. The session is closed when its page is deleted. | *Workspace*: a session belongs to a single page. |
| Collaborator | A user who has joined the editing session of a page, or who takes part in a discussion. | *Member*, which is about belonging to the workspace. |
| Presence | The collaborators currently in the editing session of a page (US-08). | — |
| Edit | A change to the content of a page submitted by a collaborator during a session. | *Block*: an edit is applied to blocks. |
| Merge | The combination of concurrent edits into one consistent result, applied to the Page Block Tree. | — |

#### Notification

| Term | Definition | Not to be confused with |
|---|---|---|
| Notification | A message that informs a user of something relevant to them, such as an invitation or a mention, shown in-app (US-10). It is raised, delivered on a best-effort basis, and marked as read by the user. | *Comment*. |
| Recipient | The user a notification is addressed to. | — |

#### Discussion

| Term | Definition | Not to be confused with |
|---|---|---|
| Comment Thread | A conversation attached to a page or to a single block (US-09). It can be resolved when the discussion is over. | *Notification*. |
| Anchor | Where a comment thread is attached: the whole page (page anchor) or one block of it (block anchor). It is set when the thread opens and never changes. | *Mention*, which points at a member, not at content. |
| Comment | A message posted in a comment thread by any member of the workspace. Posting it does not change the content of the page. | *Edit*, which changes the content. |
| Mention | A reference to a member of the workspace written in a comment (US-09). It makes that member receive a notification. | — |

#### One person, many names

The same person takes a different name in each context, and each name carries only what that context needs.

| Context | Name | What the context knows about them |
|---|---|---|
| Account | User | Email address, credentials, workspaces |
| Membership | Member (Admin, Editor or Viewer), Invitee | Role in one workspace |
| Editing | Collaborator | Presence in the editing session of one page |
| Notification | Recipient | Where and how to reach them |
| Discussion | Collaborator, mentioned user | The comments they write and the mentions they receive |
