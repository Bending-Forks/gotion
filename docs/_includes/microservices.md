## Microservices

Each bounded context of the [strategic design](#bounded-contexts) runs as one microservice. This
section says why the system is split that way, and what each service offers and needs. The
patterns the services rely on are in [Patterns](#patterns).

### Decomposition

The system is decomposed by subdomain. Each [subdomain](analysis.html#subdomains) belongs to one
bounded context, and each bounded context is one service, with its own process, container
image, database and deployment.

| Service | Subdomains | Type | User stories | Runtime |
|---|---|---|---|---|
| Account | Identity, Workspace organisation | Generic, supporting | US-01, US-02 | Go |
| Membership | Membership and roles | Supporting | US-03 | Go |
| Editing | Page content, Real-time collaboration | Core | US-04, US-05, US-06, US-07, US-08 | Node.js |
| Discussion | Discussion | Supporting | US-09 | Go |
| Notification | Notification | Generic | US-10 | Go |

The runtimes are settled by
[ADR-04](#adr-04-editing-runs-on-nodejs-with-the-crdt-of-the-client-the-other-services-on-go).

With one service per bounded context, the boundary of a model is also the boundary of a
deployment: a change to a model is a change to one service, which is built, tested, versioned
and deployed alone. Three scenarios rely on it:

- **QA-09.** A new block type changes Editing and the client, and no other service.
- **QA-08.** Each service migrates its own schema, so no migration needs two services at once.
- **QA-04.** A crash of Editing stops the editing of pages, not signing in, inviting or
  commenting: no other service calls Editing while it runs a command.

**Why not smaller services.** A further split would put a network call inside a rule that one
service now keeps on its own:

- Splitting page content from real-time collaboration would put a hop between the session and
  the Page Block Tree. The tree checks every operation before the ack, so the hop would be on
  the path of every keystroke, which QA-01 and QA-02 bound. The same holds for a service per
  aggregate of Editing.
- Splitting identity from workspace organisation would turn two steps of Account into calls
  between services: a workspace is created through `createWorkspace` on User, so that it always
  has a registered creator, and the main workspace is a preference kept on User. Identity is a
  generic subdomain, so if it is later covered by an existing component, Account is where that
  component plugs in, and the split can be made then.

**Why not fewer services.** Two merges were worth weighing:

- **Account with Membership.** They are the tightest pair of the
  [context map](#context-map): each publishes events the other consumes, and each queries the
  other while it runs a command
  ([ADR-03](#adr-03-editing-keeps-a-local-copy-of-the-roles-account-and-discussion-ask-membership)).
  One service would drop both queries. They stay apart because Membership is the upstream of
  four contexts, all of them through the roles, while the identity in Account may be replaced
  by an existing component: together, replacing identity would touch the service that every
  other context asks for the roles. If the two keep changing together, the merge is the first
  decision to revisit.
- **Notification inside Discussion,** which raises the mentions. Notification also tells
  about invitations, which come from Membership, so inside Discussion it would make Discussion
  consume the events of Membership again, which ADR-03 removed. On its own, Notification only
  subscribes, and no service depends on it at run time.

### Services

What each service offers and needs. The *client API* goes through the API gateway; the queries
answered to other services, the events and the channels they travel on are its published
language ([context map](#context-map)). Every event is published on Kafka keyed by the
identity of its aggregate. A service publishes only the events that another context
subscribes to: the policies that react to events of the same service, such as the deletion
cascade inside Editing, run inside it and are not part of its published language.

#### Account

| Aspect | Description |
|---|---|
| Responsibility | Users and workspaces (`User`, `Workspace`), US-01, US-02 |
| Client API | Register, Sign in, Create, Rename and Delete workspace, Set main workspace. Sign in issues the token the gateway checks, which carries only the identity of the user (ADR-03) and is rate limited per account (QA-07) |
| Answers | The `UserId` registered with an email address, to Membership |
| Asks | Membership: the role of the user in the workspace, which must be Admin before Rename and Delete workspace, and any role before Set main workspace |
| Publishes | Workspace Created, Workspace Deleted |
| Consumes | Member Removed, as a conformist, to replace a removed main workspace |
| Owns | The users and the workspaces, as current state; the store keeps the email address unique |

#### Membership

| Aspect | Description |
|---|---|
| Responsibility | Members, roles and invitations (`Workspace Membership`), US-03 |
| Client API | Invite member, Accept and Decline invitation, Change member role, Remove member, Leave workspace; the members and invitations of a workspace |
| Answers | The role of a user in a workspace, to Account and Editing; which of a set of users are members of a workspace, to Discussion. A workspace that does not exist is answered as one the user is not a member of (QA-06) |
| Asks | Account: the `UserId` of an email address, before Invite member |
| Publishes | Member Joined, Member Role Changed, Member Removed, Member Left, Workspace Membership Deleted, Member Invited |
| Consumes | Workspace Created and Workspace Deleted, as a conformist, to create and delete the membership of a workspace |
| Owns | One Workspace Membership per workspace, as current state |

#### Editing

| Aspect | Description |
|---|---|
| Responsibility | Pages and their content (`Page`, `Page Block Tree`, `Real-time Editing Session`), US-04 to US-08; the one relay of the operations of a page (ADR-01) |
| Client API | One WebSocket per open page: Join and Leave session, Submit edit, then the ack or the refusal of each operation, the operations of the others, the presence and Session Closed. Over REST: Set title, icon, cover |
| Answers | Nothing: no service asks Editing, since every `PageId` holds the `WorkspaceId` of its page |
| Asks | Membership: the role of a user, only when the local copy of the roles has no row (ADR-03) |
| Publishes | Page Deleted, Block Deleted, for Discussion |
| Consumes | Workspace Created and Workspace Deleted, as a conformist, to create and delete the root page; Member Joined, Member Role Changed, Member Removed, Member Left and Workspace Membership Deleted, through an anticorruption layer that turns a role into *read* or *change* |
| Owns | Event-sourced (ADR-02): the session log of every page, snapshots of the Page Block Trees, the pages and the local copy of the roles |

Two things are still open, among the points under
[Components and Connectors](#components-and-connectors): how Editing serves the opening of a
page, the snapshot for a collaborator who joins late and the list of sub-pages; and which
service holds the read models, such as the workspace directory a user switches workspace with,
which needs the workspaces of Account and the memberships of Membership.

#### Discussion

| Aspect | Description |
|---|---|
| Responsibility | Comment threads on pages and blocks (`Comment Thread`), US-09 |
| Client API | Post comment, which opens a new thread with its first comment or adds one to an open thread, Resolve thread; the threads of a page |
| Answers | Nothing |
| Asks | Membership: whether the author, the users mentioned and whoever resolves are members, in one query per command |
| Publishes | Comment Posted, for Notification |
| Consumes | Page Deleted and Block Deleted, as a conformist, to delete the threads anchored to them |
| Owns | The comment threads, as current state |

#### Notification

| Aspect | Description |
|---|---|
| Responsibility | The in-app notifications of invitations and mentions (`Notification`), US-10 |
| Client API | The notifications of the user, Mark as read |
| Answers | Nothing |
| Asks | Nothing |
| Publishes | Nothing |
| Consumes | Member Invited and Comment Posted, through an anticorruption layer that turns them into its own `Subject`, an invitation or a mention |
| Owns | The notifications, as current state |

### Dependencies at run time

A synchronous call couples the caller to the callee in time: the caller's command can only
complete while the callee is up, so the availability of the command is at most the product of
the availabilities of the two services. An event couples them only eventually: the producer
does not wait, and a consumer that is down reads the event from Kafka when it is back. Gotion
keeps the synchronous calls between services to the four that check data owned by another
context before a command:

| Caller | Callee | Query | Before | If the callee fails |
|---|---|---|---|---|
| Account | Membership | Role of a user | Rename, Delete workspace; Set main workspace | The command is refused |
| Membership | Account | `UserId` of an email address | Invite member | The command is refused |
| Editing | Membership | Role of a user, only without a row in the local copy | Join session, Submit edit, Set title, icon, cover | The command is denied |
| Discussion | Membership | Which users are members | Post comment, Resolve thread | The command is refused |

Membership is the one service asked by three others, and no service calls Editing,
Discussion or Notification. A crash of Membership therefore stops renaming and deleting
workspaces, inviting and commenting, but not the editing of the pages whose roles Editing
already holds. Account and Membership call each other, so each one's availability depends on
the other's, as ADR-03 records.

Every call is made by the adapter of a port, before the command reaches the aggregate (see
[Building blocks](#building-blocks)), so the policy for a failure lives in that adapter, and
the domain never waits on the network:

- **Fail closed.** A call that fails, times out or finds the circuit open ends in a refused
  command, never in an allowed one, as QA-06 requires.
- **Timeout.** Each call has a timeout well within the budget of the command that waits for it,
  so a slow callee never holds the caller's requests until they pile up. The values are set
  once the services are measured on the reference deployment.
- **One retry.** The queries only read, so the adapter retries a failed one once, within the
  same timeout.
- **Circuit breaker.** After repeated failures the adapter stops calling the callee for a
  while and refuses at once, then lets one call through to check whether the callee is back.
  A callee that is down then costs its callers a quick refusal instead of a timeout on every
  command.

The events have no such dependency. While Kafka or a consumer is down, the producer keeps
running its commands, and the policies downstream run later: a deleted page keeps its comment
threads for a while, and a removed member keeps editing until Editing applies Member Removed,
within the bound of QA-06. No event may be lost between the change of state that raises it and
Kafka; how a service ensures it belongs to [Patterns](#patterns).
