## Strategic Design

### Bounded Contexts

The bounded contexts are the ones drawn at [step 10 of the Event Storming](analysis.html#10-bounded-contexts),
and each implements one or more of the [subdomains](analysis.html#subdomains) found in the
analysis. Two of them hold two subdomains each.

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
plays. Each context is filled with the type of the [subdomains](analysis.html#subdomains) it implements:
Account is half generic (identity) and half supporting (workspace organisation).

![Context map of Gotion]({{ '/assets/context-map/context-map.svg' | relative_url }})

The map is kept as code, as the course suggests, in [Context Mapper](https://contextmapper.org)'s
language: [`gotion.cml`]({{ '/assets/context-map/gotion.cml' | relative_url }}) is the source, and
`assets/context-map/render.sh` regenerates the picture from it.

| Upstream | Downstream | Patterns | What crosses the boundary |
|---|---|---|---|
| Account | Membership | OHS, PL → CF | Workspace Created (*accept the creator as Admin*), Workspace Deleted (*delete its membership*); on request, the `UserId` registered with an email address (*invite member*) |
| Account | Editing | OHS, PL → CF | Workspace Created (*create its root page*), Workspace Deleted (*delete its root page*) |
| Membership | Account | OHS, PL → CF | The roles: only an Admin renames or deletes a workspace, and the main workspace is one the user is a member of |
| Membership | Editing | OHS, PL → ACL | The roles, read as whether a user may read or change the content |
| Membership | Discussion | OHS, PL → CF | Who is a member: only members post, resolve and are mentioned, whatever their role |
| Membership | Notification | OHS, PL → ACL | Member Invited (*send the invitation*) |
| Editing | Discussion | OHS, PL → CF | Page Deleted, Block Deleted (*delete its comment threads*) |
| Discussion | Notification | OHS, PL → ACL | Comment Posted (*notify the mentioned user*) |

Membership shares the roles through the events that change them: Member Joined, Member Role Changed, Member Removed, Member Left and Workspace Membership Deleted. Discussion listens to all of them except Member Role Changed, because it only needs to know who is a member.

The same two people build all five contexts, so from a team point of view every relation would be a partnership. The map shows customer-supplier relations anyway, because each context becomes its own microservice, deployed and versioned separately.

- **Upstream, open-host service with a published language (OHS, PL).** Every upstream publishes its events in a format kept separate from its internal model, so it can change the model without breaking the contexts downstream. The events carry identities (`UserId`, `WorkspaceId`, `PageId`, `BlockId`) as plain values. There is no shared kernel and no library shared between services. Account's open-host service also answers one query, synchronously, in the same published language: which user is registered with an email address, which Membership asks before adding an invitation.
- **Downstream conformist (CF): it uses the events as they are.** Membership and Editing only need the workspace identity from Workspace Created and Workspace Deleted, and Membership takes the `UserId` returned by the user lookup as it is. Discussion only needs the identities in Page Deleted and Block Deleted, and who is a member. Account uses the roles with the names Membership gives them.
- **Downstream anticorruption layer (ACL): it translates the events into its own terms.** Notification turns Member Invited and Comment Posted into its own `Subject` (an invitation, a mention), so it never needs to know the models of Membership and Discussion. Editing turns the roles into the one thing it cares about: can this user read the content, or also change it? Editing holds a core subdomain, which is where the course recommends an anticorruption layer, and with it a new role only changes the translation, not the Editing model.

Account and Membership depend on each other: Account tells Membership when a workspace is created or deleted and which user an email address belongs to, and Membership sends the roles back. This is the tightest coupling on the map. If the two contexts keep changing together, this is the first place to look.

The table says *what* Account, Editing and Discussion get from Membership, but not *how* the roles and the membership reach them. That is still open (PP-04), with two options:

- Each context keeps a local copy of the roles, updated by the events. A command needs no extra call (QA-01, QA-02), but a removed member can still act until the event arrives (QA-06).
- Each context asks Membership on every command. The answer is always up to date, but every edit waits on a call to another service.

The choice will be recorded in an Architecture Decision Record.
