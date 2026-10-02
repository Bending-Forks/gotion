## Strategic Design

### Subdomains

Subdomains are discovered, bounded contexts are designed. The subdomains exist in the business
before any design, so they were read off the timeline of the board: each pivotal event opens a
phase of the business, and the events that follow it, up to the next pivotal event, belong to
the same area.

| Subdomain | Opened by | Events | Type |
|---|---|---|---|
| Identity | User Registered | User Registered, User Signed In | Generic |
| Workspace organisation | Workspace Created | Workspace Created, Workspace Renamed, Workspace Deleted, Main Workspace Changed | Supporting |
| Membership and roles | Member Invited | Member Invited, Member Joined, Invitation Declined, Member Role Changed, Member Removed, Member Left | Supporting |
| Page content | Page Created, Block Inserted | Page Created, Page Metadata Changed, Page Moved, Page Deleted, Block Inserted, Block Updated, Block Moved, Block Deleted, Block Tree Deleted | Core |
| Real-time collaboration | Session Joined | Session Joined, Edits Merged, Session Left, Session Closed | Core |
| Discussion | Comment Posted | Comment Posted, Thread Resolved | Supporting |
| Notification | Notification Raised | Notification Raised, Notification Delivered, Notification Read | Generic |

A **core** subdomain is complex and is what sets the product apart, a **supporting** one is specific to the product but simple and gives no advantage, a **generic** one is complex or not but solved the same way by everyone.

- **Core: page content and real-time collaboration.** They are why a team would move to Gotion
  instead of shared `.docx` files or a wiki ([Scenario](introduction.html#scenario), BR-05):
  nested pages made of Markdown blocks (BR-03), edited together and live. They are also the
  hardest part: QA-01, QA-02 and QA-05 all constrain them, and PP-01 is still open here. They get
  the most care in the model and in the code.
- **Supporting: workspace organisation, membership and roles, discussion.** They follow rules of
  our own (one root page per workspace, the last Admin, threads anchored to blocks), but the
  logic is mostly creating and updating records, and no team picks Gotion for them.
- **Generic: identity and notification.** Signing in with an email address and a password, and
  an in-app inbox, work the same everywhere. So it opens the possibility to adopt an existing solution
  rather than build one, but BR-01 narrows that choice: Gotion makes no calls to external services at
  runtime, so a generic subdomain can be covered by a library or a self-hosted component, not by
  a hosted service.

### Bounded Contexts

The bounded contexts are the ones drawn at [step 10 of the Event Storming](analysis.html#10-bounded-contexts). Two of them
hold two subdomains each.

| Bounded context | Subdomains | Aggregates |
|---|---|---|
| Account | Identity, Workspace organisation | `User`, `Workspace` |
| Membership | Membership and roles | `Workspace Membership` |
| Editing | Page content, Real-time collaboration | `Page`, `Page Block Tree`, `Real-time Editing Session` |
| Discussion | Discussion | `Comment Thread` |
| Notification | Notification | `Notification` |

Editing keeps page content and real-time collaboration together because an edit merged by the
session turns at once into commands on the Page Block Tree; splitting them would put a network
hop inside the path that QA-02 bounds at 300 ms. Account keeps identity and workspace
organisation together because a user's first workspace is created when the user registers, and
the main workspace belongs to the user. Account therefore mixes a generic subdomain with a
supporting one: if identity is covered by an existing component, Account is where it plugs in.

### Context Map

The context map shows how the five bounded contexts depend on each other, in the notation of
Khononov used in the course: every relation has an upstream end (**U**), whose model the other
side depends on, and a downstream end (**D**), each marked with the integration pattern it
plays. Each context is filled with the type of the [subdomains](#subdomains) it implements:
Account is half generic (identity) and half supporting (workspace organisation).

![Context map of Gotion]({{ '/assets/context-map/context-map.svg' | relative_url }})

The map is kept as code, as the course suggests, in [Context Mapper](https://contextmapper.org)'s
language: [`gotion.cml`]({{ '/assets/context-map/gotion.cml' | relative_url }}) is the source, and
`assets/context-map/render.sh` regenerates the picture from it.

| Upstream | Downstream | Patterns | What crosses the boundary |
|---|---|---|---|
| Account | Membership | OHS, PL → CF | Workspace Created (*accept the creator as Admin*), Workspace Deleted (*delete its membership*) |
| Account | Editing | OHS, PL → CF | Workspace Created (*create its root page*), Workspace Deleted (*delete its root page*) |
| Membership | Account | OHS, PL → CF | The roles: only an Admin renames or deletes a workspace, and the main workspace is one the user is a member of |
| Membership | Editing | OHS, PL → ACL | The roles, read as whether a user may read or change the content |
| Membership | Discussion | OHS, PL → CF | The roles, and who is a member, for the mentions |
| Membership | Notification | OHS, PL → ACL | Member Invited (*send the invitation*) |
| Editing | Discussion | OHS, PL → CF | Page Deleted, Block Deleted (*delete its comment threads*) |
| Discussion | Notification | OHS, PL → ACL | Comment Posted (*notify the mentioned user*) |

The roles travel as the Membership events that change them: Member Joined, Member Role Changed,
Member Removed, Member Left and Workspace Membership Deleted.

The five contexts are built by the same two-person team, so as an organisation every relation
would be a partnership. The map records them as customer–supplier relations all the same,
because each context becomes a microservice that is deployed and versioned on its own: what
matters is which side owns each contract and which side translates it.

- **Every upstream is an open-host service with a published language.** It publishes its domain
  events in an integration format kept apart from its internal model, so the model can change
  without breaking the consumers. The events carry identities (`UserId`, `WorkspaceId`,
  `PageId`, `BlockId`) as plain values of that language: there is no shared kernel, and no
  library is shared between services.
- **A downstream conforms when it takes the events as they are.** Membership, Editing and
  Discussion only need the identities in Workspace Created, Workspace Deleted, Page Deleted and
  Block Deleted, and Account and Discussion use the roles with their own names.
- **A downstream translates when the upstream concepts do not belong in its model.**
  Notification turns Member Invited and Comment Posted into its own `Subject` (an invitation, a
  mention), and so never learns the models of Membership and Discussion. Editing holds a core
  subdomain, which is where the course recommends an anticorruption layer: it turns the roles
  into the only thing its model needs, whether a user may read or change the content, so a new
  role changes the translation and not the Editing model.

Account and Membership are upstream of each other: the life of a workspace flows from Account
to Membership, the roles flow back. It is the tightest coupling on the map, and the first place
to look if the two contexts keep changing together.

The relations above settle *what* Account, Editing and Discussion receive from Membership; *how*
the roles reach them is still PP-04. Either each context keeps a local copy of the roles, fed by
the events, which takes no call while a command runs (QA-01, QA-02) but lets a removed member act
until the event arrives (QA-06); or it asks Membership on every command, which is always up to
date but puts a call to another service in the path of every edit. The choice is recorded as an
Architecture Decision Record.
