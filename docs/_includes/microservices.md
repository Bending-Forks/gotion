## Microservices

Each bounded context of the [strategic design](#bounded-contexts) runs as one microservice. This section says why the system is split that way, what each service offers and needs, how the services depend on each other at run time, how they keep their state and scale, and which contracts hold them together. The patterns the services rely on are in [Patterns](#patterns).

### Decomposition

The system is decomposed by subdomain. Each [subdomain](analysis.html#subdomains) belongs to one bounded context, and each bounded context is one service, with its own process, container image, database and deployment.

| Service | Subdomains | Type | User stories | Runtime |
|---|---|---|---|---|
| Account | Identity, Workspace organisation | Generic, supporting | US-01, US-02 | Go |
| Membership | Membership and roles | Supporting | US-03 | Go |
| Editing | Page content, Real-time collaboration | Core | US-04, US-05, US-06, US-07, US-08 | Node.js |
| Discussion | Discussion | Supporting | US-09 | Go |
| Notification | Notification | Generic | US-10 | Go |

The runtimes are settled by [ADR-04](#adr-04-editing-runs-on-nodejs-with-the-crdt-of-the-client-the-other-services-on-go).

With one service per bounded context, the boundary of a model is also the boundary of a deployment: a change to a model is a change to one service, which is built, tested, versioned and deployed alone. Three scenarios rely on it:

- **QA-09.** A new block type changes Editing and the client, and no other service.
- **QA-08.** Each service migrates its own schema, so no migration needs two services at once.
- **QA-04.** A crash of Editing stops the editing of pages, not signing in, inviting or commenting: no other service calls Editing while it runs a command.

**Why not smaller services.** A further split would put a network call inside a rule that one service now keeps on its own:

- Splitting page content from real-time collaboration would put a hop between the session and the Page Block Tree. The tree checks every operation before the ack, so the hop would be on the path of every keystroke, which QA-01 and QA-02 bound. The same holds for a service per aggregate of Editing.
- Splitting identity from workspace organisation would turn two steps of Account into calls between services: a workspace is created through `createWorkspace` on User, so that it always has a registered creator, and the main workspace is a preference kept on User. Identity is a generic subdomain, so if it is later covered by an existing component, Account is where that component plugs in, and the split can be made then.

**Why not fewer services.** Two merges were worth weighing:

- **Account with Membership.** They are the tightest pair of the [context map](#context-map): each publishes events the other consumes, and each queries the other while it runs a command ([ADR-03](#adr-03-editing-keeps-a-local-copy-of-the-roles-account-and-discussion-ask-membership)). One service would drop both queries. They stay apart because Membership is the upstream of four contexts, all of them through the roles, while the identity in Account may be replaced by an existing component: together, replacing identity would touch the service that every other context asks for the roles. If the two keep changing together, the merge is the first decision to revisit.
- **Notification inside Discussion,** which raises the mentions. Notification also tells about invitations, which come from Membership, so inside Discussion it would make Discussion consume the events of Membership again, which ADR-03 removed. On its own, Notification only subscribes, and no service depends on it at run time.

### Services

What each service offers and needs. The *client API* goes through the API gateway; the queries answered to other services, the events and the channels they travel on are its published language ([context map](#context-map)). Every event is published on Kafka keyed by the identity of its aggregate. A service publishes only the events that another context subscribes to: the policies that react to events of the same service, such as the deletion cascade inside Editing, run inside it and are not part of its published language.

#### Account

| Aspect | Description |
|---|---|
| Responsibility | Users and workspaces (`User`, `Workspace`), US-01, US-02 |
| Client API | Register, Sign in, Create, Rename and Delete workspace, Set main workspace. Sign in issues the token the gateway checks, which carries only the identity of the user (ADR-03) and is rate limited per account (QA-07) |
| Answers | The `UserId` registered with an email address, to Membership; the names of a batch of workspaces and the main workspace of a user, to the gateway for the [Workspace directory](#api-composition) |
| Asks | Membership: the role of the user in the workspace, which must be Admin before Rename and Delete workspace, and any role before opening a workspace, which sets it as main (Set main workspace) |
| Publishes | Workspace Created, Workspace Deleted |
| Consumes | Member Removed, Member Left and Workspace Membership Deleted, as a conformist, to replace an inaccessible main workspace with the next accessible one in directory order, or clear it if none remain |
| Owns | The users and the workspaces, as current state; the store keeps the email address unique |

#### Membership

| Aspect | Description |
|---|---|
| Responsibility | Members, roles and invitations (`Workspace Membership`), US-03 |
| Client API | Invite member, Accept and Decline invitation, Change member role, Remove member, Leave workspace; the members and invitations of a workspace |
| Answers | The role of a user in a workspace, to Account and Editing; which of a set of users are members of a workspace, to Discussion; the workspaces of a user with the role in each, to the gateway for the [Workspace directory](#api-composition). A workspace that does not exist is answered as one the user is not a member of (QA-06) |
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

Two things are still open, among the points under [Components and Connectors](#components-and-connectors): how Editing serves the opening of a page, the snapshot for a collaborator who joins late and the list of sub-pages; and where the read model for page block metadata lives. The workspace directory a user switches workspace with, which needs the workspaces of Account and the memberships of Membership, is composed by the gateway ([API Composition](#api-composition)).

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

A synchronous call couples the caller to the callee in time: the caller's command can only complete while the callee is up, so the availability of the command is at most the product of the availabilities of the two services. An event couples them only eventually: the producer does not wait, and a consumer that is down reads the event from Kafka when it is back. Gotion keeps the synchronous calls between services to the four that check data owned by another context before a command:

| Caller | Callee | Query | Before | If the callee fails |
|---|---|---|---|---|
| Account | Membership | Role of a user | Rename, Delete workspace; Set main workspace | The command is refused |
| Membership | Account | `UserId` of an email address | Invite member | The command is refused |
| Editing | Membership | Role of a user, only without a row in the local copy | Join session, Submit edit, Set title, icon, cover | The command is denied |
| Discussion | Membership | Which users are members | Post comment, Resolve thread | The command is refused |
| API Gateway | Membership, then Account | The workspaces of a user with their roles; the names of those workspaces and the main workspace | Workspace directory | The request fails |

Membership is the one service asked by three others and by the gateway, and no service calls Editing, Discussion or Notification. A crash of Membership therefore stops renaming and deleting workspaces, inviting, commenting and listing the workspaces of a user, but not the editing of the pages whose roles Editing already holds. Account and Membership call each other, so each one's availability depends on the other's, as ADR-03 records.

Every call is made by the adapter of a port, before the command reaches the aggregate (see [Building blocks](#building-blocks)), so the policy for a failure lives in that adapter, and the domain never waits on the network:

- **Fail closed.** A call that fails, times out or finds the circuit open ends in a refused command, never in an allowed one, as QA-06 requires.
- **Timeout.** Each call has a timeout well within the budget of the command that waits for it, so a slow callee never holds the caller's requests until they pile up. The values are set once the services are measured on the reference deployment.
- **One retry.** The queries only read, so the adapter retries a failed one once, within the same timeout.
- **Circuit breaker.** After repeated failures the adapter stops calling the callee for a while and refuses at once, then lets one call through to check whether the callee is back. A callee that is down then costs its callers a quick refusal instead of a timeout on every command.

Account, Membership and Discussion do not wait for Kafka to run a command: they store outgoing events with the state in their own Transactional Outbox, and a Polling Publisher sends them when Kafka is available (ADR-05). A consumer that is down catches up later. A removed member keeps editing until Editing applies Member Removed; QA-06 bounds that delay in normal operation, including the wait in the outbox, not during an outage. Editing still publishes directly and can lose an outgoing event if it stops before Kafka acknowledges it; its readiness also requires Kafka. [Event delivery](#event-delivery) describes that remaining limit.

### API Composition

The API gateway builds the *Workspace directory* on demand, so the client gets the workspaces of the signed-in user in one request (US-02). The gateway takes the `UserId` from the verified sign-in token, never from a user identifier supplied by the client (QA-06), then:

1. asks Membership for the `WorkspaceId` and role of each workspace the user belongs to;
2. asks Account for the names of those workspaces in one batch, and for the user's main workspace preference;
3. joins the answers by `WorkspaceId` and returns the directory, marking the main workspace only if it is among the user's memberships.

The gateway keeps no copy of this view and reads each service through its API. It holds no business rule either: joining by `WorkspaceId` and leaving out a main workspace the user no longer belongs to only shape the answer, since Account itself replaces a removed main workspace when Member Removed arrives, and every rule on workspaces and roles stays in Account and Membership. A workspace already deleted in Account is omitted while its membership is being removed by policy. If either service fails to answer, the directory request fails rather than returning an incomplete list. Account owns the workspace data and the preference, and Membership owns the memberships and roles.

### State and scaling

Account, Membership, Discussion and Notification keep their durable state in their databases; the first three also keep their pending outgoing events there. Each one runs as a Kubernetes Deployment, whose replicas are interchangeable behind a Service, and the consumers of a service share its Kafka partitions as one consumer group. Since every event is keyed by its aggregate, the events of one aggregate still reach one replica in order. Each publishing Go service runs its polling task in the same process; a database lock permits only one active publisher across its replicas, preserving the order of each aggregate's events (ADR-05). Notification publishes nothing and needs no outbox or publisher. The prototype runs one replica of each. Each database is one instance: the reference deployment is a single node, so replicating or partitioning the stores is out of scope.

Editing is different: it holds the session of every open page, with its collaborators and the replica of its tree, and it is the one relay of the operations of a page.

The CRDT needs every operation of a page to go through the same relay (ADR-01), so a page belongs to one instance of Editing, chosen by a fixed rule instead of an assignment kept somewhere: the instances form a Kubernetes StatefulSet, and page `P` belongs to the instance `hash(P) mod N`. The gateway reads `P` from the path of the WebSocket and forwards it to that instance by its stable DNS name (`editing-k.editing`), so no table of assignments and no service discovery are needed. When an instance crashes, Kubernetes replaces it with a new one under the same identity, which replays the session log of its pages from the last snapshot (ADR-02) while the clients reconnect: the pages stay with that identity, and nothing is rebalanced (QA-04). Two instances must never relay the same page at once, or the order of its operations splits. A StatefulSet starts the replacement only after the old instance has terminated, and, whatever the orchestrator does, each append to the session log carries the sequence number it expects for its page, so an instance that falls behind gets its append refused and acknowledges nothing. The prototype runs N = 1, which is enough for the five editors of a page in QA-02: while that instance restarts every page is read-only, for up to the 60 s of QA-04, not only the pages of one instance. With Compose (QA-08) the same rule is one container that restarts on failure. Changing N moves pages between instances, so it is done with Editing stopped.

### Contracts

The services are deployed and versioned separately, so what one of them shows to the others is a contract: the client API, the queries it answers and the events it publishes. Inside a service the model can change freely, and only a change of the contract concerns another service.

- **Each contract has a specification kept with its service.** The REST APIs, the client API and the queries alike, are described in OpenAPI; the events and their channels in AsyncAPI. The schema of each message is the source from which Go and TypeScript generate their types, since an event of Editing is published in TypeScript and consumed in Go, and the reverse (ADR-04).
- **Every event has the same envelope:** its own identifier, its type and the version of its schema, the identity of its aggregate, which is also its Kafka key, and when it happened. The body carries the identities and values the consumers need, never an object of the producer's model.
- **A compatible change keeps the version.** Adding an optional field is compatible: a consumer ignores a field it does not know. Removing or renaming a field, changing its type or its meaning is not: the producer publishes the new version next to the old one until every consumer has moved, then stops the old one. The queries follow the same rule, with the version in their path.
- **Every consumer is idempotent.** Kafka delivers an event at least once, so a consumer may read it twice, for instance after a restart of the consumer, or of a publisher that sent the event but had not marked it as sent (ADR-05). A consumer commits its offset only once the change the event causes is stored, and keeps the identifiers of the events it has applied, so a repeated one changes nothing. Many policies are idempotent anyway: deleting the threads of a page that has none changes nothing.
- **A contract test guards each contract.** The consumer states what it reads, and the test runs in the pipeline of the producer, so a change that breaks a consumer fails before it is merged. For the events, it checks that a consumer in one language reads what a producer in the other writes (ADR-04).

The protocol between the client and Editing is not one of these contracts: both import it from the same package as the CRDT, and they are upgraded together (ADR-01, ADR-04). The operations in the session log are the exception, because they outlive the version that wrote them: each one carries the version of the protocol, so that the older ones can still be replayed (ADR-02).

<!-- TODO ADR: choose the format of the schemas of the events and the queries (JSON Schema, Avro or Protocol Buffers), which ADR-04 leaves open, and whether a schema registry checks the compatibility of a new version before it is published. -->
