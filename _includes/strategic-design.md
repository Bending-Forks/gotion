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

The policies of the board that cross the boundaries of the bounded contexts are their integration
points, and those of the future microservices:

| From | Event | Policy | To |
|---|---|---|---|
| Account | Workspace Created | Accept the creator as Admin | Membership |
| Account | Workspace Created | Create its root page | Editing |
| Account | Workspace Deleted | Delete its root page | Editing |
| Membership | Member Invited | Send the invitation | Notification |
| Discussion | Comment Posted | Notify the mentioned user | Notification |
| Account | Workspace Deleted | Delete its membership | Membership |
| Editing | Page Deleted | Delete its comment threads | Discussion |
| Editing | Block Deleted | Delete its comment threads | Discussion |

Besides these policies, Account, Editing and Discussion need the roles held by Membership, as
listed under [Roles](#roles).

<!-- TODO context map: upstream/downstream relation and integration pattern of each pair of
contexts, and how the roles reach the other contexts (PP-04). -->
