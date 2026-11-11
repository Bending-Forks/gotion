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
Khononov: every relation has an upstream end (**U**), whose model the other
side depends on, and a downstream end (**D**), each marked with the integration pattern it
plays. Each context is filled with the type of the [subdomains](analysis.html#subdomains) it implements:
Account is half generic (identity) and half supporting (workspace organisation).

![Context map of Gotion]({{ '/assets/context-map/context-map.svg' | relative_url }})

The map is kept as code, in [Context Mapper](https://contextmapper.org)'s
language: [`gotion.cml`]({{ '/assets/context-map/gotion.cml' | relative_url }}) is the source, and
`assets/context-map/render.sh` regenerates the picture from it.

| Upstream | Downstream | Patterns | What crosses the boundary |
|---|---|---|---|
| Account | Membership | OHS, PL → CF | Workspace Created (*accept the creator as Admin*), Workspace Deleted (*delete its membership*); on request, the `UserId` registered with an email address (*invite member*) |
| Account | Editing | OHS, PL → CF | Workspace Created (*create its root page*), Workspace Deleted (*delete its root page*) |
| Membership | Account | OHS, PL → CF | The roles: only an Admin renames or deletes a workspace; opening a workspace requires membership. Member Removed, Member Left and Workspace Membership Deleted clear a lost main workspace |
| Membership | Editing | OHS, PL → ACL | The roles, read as whether a user may read or change the content |
| Membership | Discussion | OHS, PL → CF | Who is a member: only members post, resolve and are mentioned, whatever their role |
| Membership | Notification | OHS, PL → ACL | Member Invited (*send the invitation*) |
| Editing | Discussion | OHS, PL → CF | Page Deleted, Block Deleted (*delete its comment threads*) |
| Discussion | Notification | OHS, PL → ACL | Comment Posted (*notify the mentioned user*) |

Membership shares the roles through the events that change them: Member Joined, Member Role Changed, Member Removed, Member Left and Workspace Membership Deleted. Editing listens to all of them. Account listens to Member Removed, Member Left and Workspace Membership Deleted to clear a main workspace the user has lost. Account and Discussion read the roles and the members through queries instead (see ADR-03).

The same two people build all five contexts, so from a team point of view every relation would be a partnership. The map shows customer-supplier relations anyway, because each context becomes its own microservice, deployed and versioned separately.

- **Upstream, open-host service with a published language (OHS, PL).** Every upstream publishes its events in a format kept separate from its internal model, so it can change the model without breaking the contexts downstream. The events carry identities (`UserId`, `WorkspaceId`, `PageId`, `BlockId`) as plain values. There is no shared kernel and no library shared between services. For calls between contexts, Account's open-host service also answers one query, synchronously, in the same published language: which user is registered with an email address, which Membership asks before adding an invitation. Membership's answers two: the role of a user in a workspace, which Account and Editing ask, and which of a set of users are members of a workspace, which Discussion asks. The gateway also queries Membership for a user's workspace identities and roles, and Account for their names and the user's main workspace preference, to compose the [Workspace directory](#api-composition).
- **Downstream conformist (CF): it uses the events as they are.** Membership and Editing only need the workspace identity from Workspace Created and Workspace Deleted, and Membership takes the `UserId` returned by the user lookup as it is. Discussion only needs the identities in Page Deleted and Block Deleted, and who is a member, which it asks Membership. Account uses the roles with the names Membership gives them.
- **Downstream anticorruption layer (ACL): it translates the events into its own terms.** Notification turns Member Invited and Comment Posted into its own `Subject` (an invitation, a mention), so it never needs to know the models of Membership and Discussion. Editing turns the roles into the one thing it cares about: can this user read the content, or also change it? Editing holds a core subdomain, which is where an anticorruption layer pays off most, and with it a new role only changes the translation, not the Editing model.

Account and Membership depend on each other: Account tells Membership when a workspace is created or deleted and which user an email address belongs to, and Membership sends the roles back; each one also queries the other while it runs a command (ADR-03). This is the tightest coupling on the map. If the two contexts keep changing together, this is the first place to look.

The table says *what* Account, Editing and Discussion get from Membership; *how* the roles and
the membership reach them was PP-04, settled by
[ADR-03](#adr-03-editing-keeps-a-local-copy-of-the-roles-account-and-discussion-ask-membership):
Editing keeps a local copy of the roles, fed by the events, and asks Membership only when the copy
has no row; Account and Discussion ask Membership on each command that needs it. Notification is
not part of PP-04: it reacts to Member Invited and never checks a role or a membership.
