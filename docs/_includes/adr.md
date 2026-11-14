## Architecture Decision Records

Each architecturally significant decision is recorded after Nygard and Richards: Title, Status,
Context, Decision, Consequences and Compliance. A record stays *Proposed* until it is reviewed,
and is never edited once *Accepted*: a later decision supersedes it.

### ADR-01: Replicas merge concurrent edits with our own CRDT, Editing relays the operations

**Status:** Accepted.

**Context.** Pages are edited together in real time (US-08). Concurrent edits must converge
without dropping an acknowledged one (QA-05), the local render must stay within 50 ms (QA-01),
an acknowledged edit must reach the other collaborators within 300 ms (QA-02), and a new block
type must not touch synchronization or persistence (QA-09). The merge of
concurrent edits is a concern of the core subdomain, so it is worth owning. The decision answers
[PP-01](analysis.html#open-pain-points): are concurrent edits ordered and merged by a central
sequencer in Editing, or do replicas merge on their own? The alternatives were:

- operational transformation, with Editing as the central sequencer;
- Yjs, with any editor, including the collaboration built into BlockNote;
- a CRDT of ours that every replica runs, with Editing as the relay of the operations.

Operational transformation needs a transformation for every pair of kinds of operation: text
against text, text against a block inserted, moved or deleted, a move against a move, and so
on. Each new kind of operation adds a transformation against every existing one, and each pair
must be proved correct on its own. A move in a tree is a known hard case for it. A CRDT instead
defines each operation so that it commutes with the others, its convergence is tested on the
module alone, and a move in a tree has a published algorithm (Kleppmann et al.).

Yjs works against the domain model. A Yjs update is an encoded change of its own types, XML
elements and text, not an operation of the domain: to check a rule Editing would have to decode
each update and apply it to a copy of the page, and the domain events would be derived from
those low-level changes. Yjs has no move for an element, so a move is a deletion plus an
insertion: two concurrent moves of the same block can leave two copies of it, and nesting a
block is a move too, so what a collaborator types in it meanwhile goes with the deleted copy.
Yjs does not define when an edit is acknowledged. And the merge, a concern of the core
subdomain, would be left to a generic library.

**Decision.** We will synchronize the replicas with a CRDT of ours. This settles PP-01:

- every replica merges concurrent operations on its own, with our CRDT;
- Editing is the one relay of the operations of a page: it checks each operation, stores it,
  acknowledges it to its author and relays it to the other collaborators;
- the CRDT is a module with no dependency on any editor: a sequence of characters for the text
  of a block, with the styles as marks over its characters, and a tree of blocks with a move
  operation;
- dividing a block in two and joining a block to the one before move text from the sequence of
  one block to the sequence of another. The CRDT has no operation for that: the text is
  deleted in one block and a copy of it is inserted in the other;
- the editor of the client is only an adapter: it turns the changes of the editor into
  operations and applies the remote ones. The choice of the editor is a design choice behind
  the adapter, described in [Editing client](implementation.html#editing-client).

A prototype confirmed the approach. Ten clients typed in the same block, the cursor and the
selection held under remote edits, every client converged, and the local render stayed well
within QA-01. That prototype edited a single block. Three later ones, with BlockNote, Slate and
plain ProseMirror behind the same operations, also kept two clients in step while blocks
were divided, joined and nested, and while each client undid its own edits only.

**Consequences.** On the good side:

- The commands of the [Page Block Tree](#page-block-tree) stay commands. Editing refuses an
  operation that breaks a rule, for example a page block that changes type, together with the
  later operations of the same author that build on it, and the author reverts them before any
  other replica sees them. Block Inserted, Block Moved and Block Deleted
  come from the operations.
- The tree of blocks has its own move, so two concurrent moves can neither duplicate a block nor
  nest one under itself. Nesting a block moves it without touching its text, so what a
  collaborator types in it meanwhile stays.
- Editing defines when an edit is acknowledged. It can append each operation to a durable log
  before acknowledging it, as QA-01 and QA-04 ask, and that log is the Event Sourcing of
  Editing. The log itself is settled in
  [ADR-02](#adr-02-editing-acknowledges-an-operation-once-it-is-in-a-durable-log).
- The merge of concurrent edits, part of the core subdomain, is our own code.
- There is no Yjs server to run, and nothing keeps editing while disconnected: the editor
  becomes read-only when the connection drops, as the
  [scope](analysis.html#out-of-scope-for-now-1) requires.

On the bad side, each to be settled before or while Editing is built, except the accepted
risk:

- **More to build:** the styles as marks, the tree of blocks with its move, a snapshot for a
  collaborator who joins late, reconnection and the resending of unacknowledged operations.
- **Presence (US-08)** is part of our own protocol, with no Yjs awareness to rely on.
- **Accepted risk: QA-05 does not hold for an edit concurrent with dividing or joining its
  block.** The copy has new characters, so an operation that a collaborator makes meanwhile on
  the moved text still targets the old ones: an insertion ends up in the block that keeps the
  first part, a deletion is undone by the copy, dividing the same block at two points at once
  duplicates the text between them, and an edit in a block that is joined to the one before at
  the same time is lost. Every replica still converges, but these edits are discarded or
  misplaced without anyone being told. We accept the risk: it takes a block divided or joined
  within the round trip of another edit, in the text that moves, and avoiding it means changing
  the CRDT itself, with an operation that divides a block and forwards the moved characters, or
  one sequence for the whole page with a marker for each block.
- **QA-09 holds only while the operations stay generic:** insert a block of any type with its
  properties, set a property, edit text. A block type that needs an operation of its own breaks
  it.
- **One instance of Editing relays a page at a time.** Through a single relay every
  collaborator gets the operations of a page in an order that respects what each one builds on,
  as the CRDT needs. With several instances, every operation of a page must reach the same one,
  and the page moves to another when that instance fails (QA-04). How a page reaches its
  instance is still to be settled.
- **The CRDT runs on both sides.** Editing applies the operations to the Page Block Tree, so it
  runs the CRDT module as the client does: either Editing shares the runtime of the client, or
  the module is written twice and both versions pass the same tests. The runtimes are still to
  be settled.
- **Coupling between client and Editing.** Both share the protocol of the operations and the
  block schema, so they are upgraded together.
- **The adapter is the fragile part.** It derives the operations from the editor, which is
  described with its risks in [Editing client](implementation.html#editing-client).

**Compliance.**

- The convergence test of QA-05, over 1 000 randomized interleavings, runs on the CRDT module
  alone. It includes concurrent moves of the same block, moves that would create a cycle, and
  edits concurrent with a move. It also divides and joins blocks while other edits change the
  moved text, and divides the same block at two points at once: there it checks convergence
  only.
- Four deterministic tests pin down the outcomes of the accepted risk listed above, so that a
  change to the CRDT that alters them is noticed.
- A fitness function checks that only the adapter of the client imports the editor library or
  ProseMirror, and never the CRDT module or the domain of Editing.

### ADR-02: Editing acknowledges an operation once it is in a durable log

**Status:** Proposed.

**Context.** [ADR-01](#adr-01-replicas-merge-concurrent-edits-with-our-own-crdt-editing-relays-the-operations)
makes Editing the one relay of the operations of a page, so Editing decides when an edit counts
as acknowledged. Three scenarios depend on that moment: QA-01 times the server acknowledgement
and asks for the character to be durably persisted, QA-04 asks that every acknowledged edit
survives a crash of Editing, and QA-05 that none is silently discarded. The session takes an
operation and hands it to the Page Block Tree, which checks it and applies it.
The alternatives were:

- acknowledge after the merge, and apply the operation to the tree asynchronously;
- acknowledge after the operation is applied to the tree and the tree is saved;
- acknowledge after the operation is appended to a durable log of the session, then apply it to
  the tree.

Acknowledging after the merge breaks QA-04: a crash between the ack and the store loses an
acknowledged edit, and the SLI of QA-01 would time less than the real path. Saving the tree
before every ack is durable, but it puts a whole write of the tree on the path of every
keystroke, against the 500 ms (p95) of QA-01.

**Decision.** We will acknowledge an operation only once it is appended to a durable log:

- Editing checks the operation, appends it to the log of the session of its page, acknowledges
  it to its author, relays it to the other collaborators and then applies it to the page block
  tree;
- the log is the Event Sourcing of Editing: after a restart Editing replays it onto the tree
  from the last snapshot;
- the ack is where the timer of the QA-01 SLI stops, and where the timer of QA-02 starts.

**Consequences.** On the good side:

- One append per operation is the cheapest durable write, so the ack stays within QA-01.
- No acknowledged edit is lost in a crash (QA-04): what the tree misses is still in the log.
- Replaying the same order of operations keeps every replica converging (QA-05).
- The log also feeds the snapshot for a collaborator who joins late, one of the bad sides of
  ADR-01.

On the bad side:

- The log grows with every keystroke: it needs snapshots of the tree and a compaction of the
  operations before them.
- The tree lags behind the log for a moment, so anything that reads the tree, such as the page
  open of QA-03, may miss the last operations.
- The store of the log must make an append durable before it returns, and refuse an append whose sequence number is not the next one of its page, so that two instances of Editing can never both extend the log of the same page. [ADR-06](#adr-06-each-service-keeps-its-data-in-a-postgresql-server-of-its-own) chooses it and meets both.
- The operations in the log outlive the version of the protocol that wrote them: a change to the
  operations needs a version on each one and a way to replay the older ones.

**Compliance.**

- The chaos test of QA-04 kills Editing under load and checks that every acknowledged operation
  is in the page after the restart.
- The SLI of QA-01 is measured from the submit to the ack, so an ack sent before the append
  shows up as a broken test, not as a better number.

### ADR-03: Editing keeps a local copy of the roles, Account and Discussion ask Membership

**Status:** Proposed.

**Context.** Membership is the one writer of the roles and of who is a member, but three other contexts check them on their own commands, as the [Roles](#roles) table shows: Account lets only an Admin rename or delete a workspace and opens only workspaces the user belongs to, Editing lets a Viewer read but not change the content, and Discussion lets only members post, resolve and be mentioned. The [Context Map](#context-map) says *what* each of them gets from Membership; this record settles *how* it reaches them, which is [PP-04](analysis.html#open-pain-points). Notification is not part of it: it reacts to Member Invited and never checks a role or a membership.

The three contexts differ in what is at stake. Editing checks the role on every edit, on the path that QA-01 bounds at 500 ms (p95) from the edit to the ack, and inside a session that stays open for as long as the page is edited. Account checks it on renaming and deleting a workspace, rare commands that cannot be undone, and on opening one, where it only decides whether to save it as the main workspace. Discussion checks it on a comment, where a few milliseconds more change nothing. QA-06 asks that every request of a non-member or a Viewer is denied. The alternatives were:

- **a local copy of the roles**, kept by each context from the events of Membership (Member
  Joined, Member Role Changed, Member Removed, Member Left, Workspace Membership Deleted): a CQRS
  view of Membership's data inside the context that reads it, also called Event-Carried State
  Transfer;
- **a synchronous query to Membership** on every command that needs the role;
- **the roles in a JWT** issued at sign-in, which each service verifies on its own;
- **the local copy, with a query to Membership when the copy has no row** for the user and the
  workspace.

The local copy costs nothing on the path of an edit and keeps Editing working while Membership is
down, but a removed member keeps acting until the event arrives, and a member who has just joined
is refused until it arrives. The query is always up to date, but it puts a call to another
service before every ack, and when Membership is down nothing can be checked, so nothing is
allowed. A JWT is checked at no cost, but it cannot be revoked before it expires, it would carry
a role for every workspace of the user, and whoever issues it at sign-in would have to know the
roles of Membership, adding a dependency to Account and Membership, already the tightest pair of
the map.

**Decision.** Each context reads the roles in the way that fits its commands:

- **Editing keeps a local copy, and asks Membership only when the copy has no row.** Its
  `AccessLookupService` is an adapter over a table `(UserId, WorkspaceId) → read | change`, fed
  by the events of Membership: the anticorruption layer turns a role into what Editing cares
  about while it updates the table. When the table has no row, the adapter asks Membership once
  for that command. It does not write the answer into the table, so an answer that comes back
  after a later Member Removed cannot overwrite it: the event fills the table soon after anyway.
  If Membership does not answer, the command is denied. A short cache of the negative answers
  keeps a non-member who probes pages (the stimulus of QA-06) from turning every attempt into a
  call to Membership.
- **Editing removes a removed member from the open sessions.** On Member Removed, Member Left and
  Workspace Membership Deleted a policy makes the user leave the sessions of the workspace, so
  they stop receiving the operations of its pages. A change to Viewer needs no policy: the next
  edit is checked against the table and refused.
- **Account asks Membership** whether the user is an Admin before renaming or deleting a workspace, and whether the user is a member before opening a workspace and saving it as main. If Membership does not answer, the command is refused and the saved main workspace stays unchanged. Account listens to Member Removed, Member Left and Workspace Membership Deleted to clear a main workspace the user has lost.
- **Discussion asks Membership** whether the author, every user mentioned and whoever resolves
  are members, in one query per command for all of them. If Membership does not answer, the
  command is refused. Discussion no longer listens to the events of Membership.
- **For these command checks, Membership's open-host service answers two queries**, in the same published language as its events: the role of a user in a workspace, and which of a set of users are members of a workspace. For a workspace that does not exist it answers as for one the user is not a member of, so the query leaks nothing (QA-06).
- The sign-in token carries only the identity of the user, never a role.

This settles PP-04.

**Consequences.** On the good side:

- The check on an edit is a local read, so QA-01 keeps its whole budget for the append of
  [ADR-02](#adr-02-editing-acknowledges-an-operation-once-it-is-in-a-durable-log), and Editing
  keeps accepting edits while Membership is down.
- A member who has just joined is not refused by Editing, and a new instance of Editing answers
  while its table is still being rebuilt from the events.
- Renaming and deleting a workspace see the roles as they are now: a demoted Admin cannot delete
  it a moment later.
- Discussion has no copy to keep, no consumer and nothing to rebuild.
- The domain of Editing, Account and Discussion does not change: `AccessLookupService` and
  `MembershipLookupService` are ports, and the choice is in their adapters.

On the bad side:

- **Editing is eventually consistent with Membership.** Between Member Removed and the moment Editing applies it, a removed member can still edit and still receives the operations of the session; between Member Role Changed and its event, a member demoted to Viewer can still edit. The window is the lag of the events, including their wait in the outbox of Membership ([ADR-05](#adr-05-go-publishers-use-a-transactional-outbox-with-polling)), bounded by the response measure added to QA-06.
- **Account and Discussion depend on Membership at run time.** When it is down, no workspace can be renamed or deleted, opening one leaves the main workspace as it was, and no comment can be posted. Account and Membership already depend on each other through events; now each one also calls the other (Membership asks Account for the user registered with an email address), so each one's availability depends on the other's.
- Editing has two adapters behind one port, the table and the query, both to be tested.
- While a new instance of Editing rebuilds its table, every check falls back to Membership, so a
  restart under load moves that load onto Membership for a moment.
- Membership's queries are part of its published language: changing them is a change of its
  contract, versioned like its events.

**Compliance.**

- A contract test of each adapter checks that a denied, an unreachable and a slow Membership all
  end in a refused command.
- The security test of QA-06 removes a member while they are editing, demotes another to Viewer,
  and checks that Editing refuses their edits and drops the removed one from the session within
  the bound of QA-06.
- The SLI of QA-01 is measured with the table of the roles in place, so a call to Membership on
  the path of an edit shows up as a slower ack.
- A fitness function checks that only the adapter of `AccessLookupService` in Editing consumes
  the events of Membership, and that Discussion consumes none of them.

### ADR-04: Editing runs on Node.js with the CRDT of the client, the other services on Go

**Status:** Proposed.

**Context.** The backend services are written in Go, the client in TypeScript with React. [ADR-01](#adr-01-replicas-merge-concurrent-edits-with-our-own-crdt-editing-relays-the-operations) runs our CRDT on both sides, in the client and in Editing, the real-time service of US-08, and leaves open whether Editing shares the runtime of the client or has a second implementation of the module that passes the same tests. With two implementations, QA-05 would rest on two pieces of code that must agree on every operation, and any difference between them would make the client and Editing diverge on the same page.

**Decision.** We will assign the runtimes as follows:

- Account, Membership, Discussion and Notification are written in Go.
- Editing is written in TypeScript and runs on Node.js. It holds the WebSocket of every open page and relays its operations (ADR-01).
- The CRDT is one TypeScript package, with no dependency on the browser, on Node.js or on any editor. The client and Editing both import it. The protocol of the operations and the block schema are shared the same way.
- The client is written in TypeScript with React.
- The API gateway is written in Go too, on the same chassis as the four Go services ([ADR-07](#adr-07-each-runtime-has-its-own-microservice-chassis-assembled-from-libraries)).
- Every service is built into its own container image, so the deployment handles a Go service and a Node.js one the same way.

This settles the runtimes left open by ADR-01.

**Consequences.** On the good side:

- The CRDT is written once. The convergence test of QA-05 runs on the package both sides import, so it covers Editing as well as the client.
- The client and Editing are upgraded together (ADR-01). With the protocol and the block schema as shared types, a change on one side that the other does not follow fails the type check.
- A Go service compiles to one static binary, so its image is small and carries no runtime.

On the bad side:

- Each language has its own build, tests, linter and image, so the CI has jobs for both, and the team works in two languages.
- The events cross languages: Editing publishes and consumes them in TypeScript, the other services in Go. Each published language needs a schema from which both sides generate their types, in the format of [ADR-08](#adr-08-contracts-are-json-schema-with-no-schema-registry). Without it, a field renamed on one side breaks the other only at run time.
- The skeleton of a service exists twice, in Go and in TypeScript: the hexagonal structure, `/health` and `/metrics`, the Kafka consumer that ignores a repeated event, the migrations of QA-08. ADR-07 reduces it to a thin chassis per runtime, assembled from libraries.

**Compliance.**

- A fitness function checks that the client and Editing import the CRDT only from the shared package.
- The CI builds, tests and packages each service in its own runtime, and `success` collects the jobs of both.
- A contract test of each event checks that a consumer in one language reads what a producer in the other writes, against the shared schema.
- The SLI of QA-01 is also measured while Editing takes a snapshot, so a task that blocks the thread shows up as a slower ack.

### ADR-05: Go publishers use a Transactional Outbox with polling

**Status:** Accepted.

**Context.** Account, Membership and Discussion are the Go services that both change their own state and publish events on Kafka ([Decomposition](#decomposition), [Contracts](#contracts)). The two writes are in separate systems, and a service can stop between them. A lost Member Removed leaves a removed member able to edit, against QA-06; a lost Workspace Deleted leaves the membership and the pages of the workspace in place; a lost Comment Posted never notifies the mentioned users (US-10). The alternatives were:

- publish before the commit;
- publish after the commit;
- a transaction across the database and Kafka;
- a Transactional Outbox: the event written into a table of the same database, in the same transaction as the state, and published by a process that polls the table;
- the same outbox, published by reading the transaction log of the database (change data capture), with a connector such as Debezium on Kafka Connect.

Publishing before the commit can announce a change that is rolled back. Publishing directly after the commit avoids that, but can lose the event if the service stops before Kafka acknowledges it. Kafka transactions alone do not make the database commit and the publication atomic. The outbox closes that gap by storing the event with the state. Polling uses the service's database and Kafka client; change data capture would also add Kafka Connect and a connector to the deployment.

**Decision.** Account, Membership and Discussion will each use a Transactional Outbox with a Polling Publisher:

- The transaction that changes the aggregate also inserts its outgoing events, with their stable identifiers and payloads, into an outbox in the same database. This applies to client commands and to policies triggered by incoming events. For a consumed event, the record that it was applied is part of that transaction too; its Kafka offset is committed only afterwards.
- A background task in the service polls committed, pending rows, publishes them on Kafka and marks each one as sent only after Kafka acknowledges it. Pending rows survive restarts and Kafka outages; sent rows are cleaned up afterwards. The task is an infrastructure adapter, not another service.
- Changes to the same aggregate are serialized in their database transactions, including the insertion into the outbox. The publisher preserves that order and does not pass an unacknowledged event with a later one of the same aggregate. A database lock allows only one publisher per service to be active across its replicas; another replica takes over when the lock is released after a failure.
- An event can be published again if the publisher stops after Kafka acknowledges it but before the row is marked as sent. It keeps the same identifier, and the idempotent consumers of [Contracts](#contracts) ignore the duplicate.
- Notification has no outbox because it publishes no events. Editing is excluded: it still publishes directly after the operation is in its session log ([ADR-02](#adr-02-editing-acknowledges-an-operation-once-it-is-in-a-durable-log)) and applied to the Page Block Tree, retrying from memory until Kafka acknowledges it.
- The library that realizes the outbox and its publisher, the Forwarder of Watermill, is chosen in [ADR-07](#adr-07-each-runtime-has-its-own-microservice-chassis-assembled-from-libraries).

**Consequences.** On the good side:

- A committed change in Account, Membership or Discussion cannot lose its outgoing event merely because the service restarts. A rolled-back change publishes nothing.
- Commands in those services do not wait for Kafka: an outage leaves events in the database until publication resumes.
- No new deployment component is needed, and the event contracts and idempotent consumers stay the same.

On the bad side:

- Each of the three services needs a table and migration, the publisher, its lock and cleanup. A long Kafka outage grows the pending rows; their count and oldest age must be monitored.
- Polling adds latency. Its interval and the backlog must fit the 5 s (p99) revocation bound of QA-06 in normal operation; durable publication alone cannot guarantee that bound during an outage.
- Editing can still lose Page Deleted or Block Deleted if it stops before Kafka acknowledges them. The session log protects acknowledged edits, not the delivery of those events: Discussion can retain orphan threads, including after the chaos test of QA-04. Cascades through Editing retain that limit.

**Compliance.**

- For each of the three services, a failed transaction leaves neither the state change nor an outbox row, and publishes no event.
- A test stops Kafka, commits a command, restarts the service and then Kafka, and checks that the pending event arrives.
- A test stops the publisher after Kafka acknowledges an event but before it is marked as sent; after restart, the duplicate changes nothing in the consumer.
- Concurrent commands and competing publishers are tested for publication in transaction order within each aggregate and takeover after the active publisher stops.
- A repeated incoming event changes the state and enqueues its outgoing events only once, including when the consumer restarts before committing its offset.
- The security test of QA-06 measures from the change in Membership to its application in Editing, including the wait in the outbox.

### ADR-06: Each service keeps its data in a PostgreSQL server of its own

**Status:** Proposed.

**Context.** Every service owns its store, and no other service reads or migrates it (Database-per-Service, [Repository view](#components-and-connectors)). Three records ask something of those stores. [ADR-02](#adr-02-editing-acknowledges-an-operation-once-it-is-in-a-durable-log) leaves the store of the session log of Editing to choose, with two requirements: an append is durable before it returns, and an append whose sequence number is not the next one of its page is refused. [ADR-05](#adr-05-go-publishers-use-a-transactional-outbox-with-polling) needs the change of an aggregate and its outbox row in one transaction in Account, Membership and Discussion. [ADR-03](#adr-03-editing-keeps-a-local-copy-of-the-roles-account-and-discussion-ask-membership) keeps a copy of the roles in Editing. Two scenarios bound the choice: QA-08 installs the whole system on a clean host, with the schema migrations run automatically and no manual database step, and QA-01 allows 500 ms (p95) from an edit to its ack, which includes the append. The alternatives were:

- a dedicated event store for the session log, such as EventStoreDB (now KurrentDB), next to the database of the other stores;
- Kafka as the session log;
- a database of a different technology for each service;
- PostgreSQL for every store, the session log included.

An event store has the append the log needs: it takes the version the stream is expected to have and refuses the append otherwise. But it is a second engine to install, configure, back up and migrate next to the one of the other services, for a single store. Kafka is already deployed, but it has no append conditional on the expected sequence number, so it cannot refuse the append of an instance that fell behind. A different database for each service adds technologies that QA-08 must install, migrate and back up.

**Decision.** We will keep every store in PostgreSQL, with one server for each service:

- Account, Membership, Editing, Discussion and Notification each have their own PostgreSQL server, holding the schema of that service only, with no replica. The API gateway has no database.
- The session log of Editing is a table with the primary key `(page_id, seq)`. An append is an `INSERT` in a transaction that commits before Editing acknowledges the operation; an `INSERT` with a `seq` already used violates the key, and that is the refused append of ADR-02 and of [State and scaling](#state-and-scaling).
- The session log, the snapshots, the pages and the copy of the roles are all in the one server of Editing. The Log store and Database adapters of [Hexagonal Architecture](#hexagonal-architecture) implement two different ports on the same database.
- Each service migrates its own schema when it starts, under a PostgreSQL advisory lock, so that two instances starting together never run the same migration twice. The Go services use goose, with the migrations embedded in the binary; Editing uses node-pg-migrate.

This settles the store of the log that ADR-02 left open.

**Consequences.** On the good side:

- One database engine to install, configure and back up for all the services, and a fresh install creates every schema with no manual step (QA-08).
- The primary key alone meets both requirements of ADR-02: a committed insert is durable, and a repeated `seq` is refused by the database, not by the code of Editing.
- The change of an aggregate, its outbox row and the record of an applied event commit in one transaction, as ADR-05 needs.

On the bad side:

- Every operation of a page waits for a commit before its ack: one write to the database on the path that QA-01 bounds, to be measured.
- Five PostgreSQL servers run on the reference node of 8 GB, next to Kafka and the services, so their memory must be sized to fit.
- The log grows with every operation, and needs the snapshots and the compaction that ADR-02 already lists.
- An instance that starts with a new migration runs it before it becomes ready, so a long migration delays its readiness.
- Each server is a single point of failure of its service. The reference deployment is a single node, so replicating the stores is out of scope.

**Compliance.**

- A test appends two operations with the same `seq` to the log of a page: the second is refused.
- The fresh install test of QA-08 starts from empty databases and runs no manual step on them.
- The SLI of QA-01 is measured with the append on PostgreSQL.

### ADR-07: Each runtime has its own microservice chassis, assembled from libraries

**Status:** Proposed.

**Context.** [ADR-04](#adr-04-editing-runs-on-nodejs-with-the-crdt-of-the-client-the-other-services-on-go) puts four services on Go and Editing on Node.js, and records among its bad sides that the skeleton of a service exists twice. Next to its domain, every service needs the same cross-cutting concerns: the health checks and the metrics of [Observability](#observability), its configuration in each environment, the timeout, retry and circuit breaker of [Dependencies at run time](#dependencies-at-run-time), the keyed publication and the idempotent consumers of [Contracts](#contracts), the outbox of [ADR-05](#adr-05-go-publishers-use-a-transactional-outbox-with-polling), the REST APIs of the OpenAPI specifications, the access to the data, the migrations of [ADR-06](#adr-06-each-service-keeps-its-data-in-a-postgresql-server-of-its-own) and the logs. The API gateway needs most of them too. Some concerns are already covered by the platform: Kubernetes finds a service by the DNS name of its Service, injects the configuration of a ConfigMap or a Secret as environment variables, which Compose sets the same way, and polls the health checks. The alternatives were:

- a framework for Go: go-kit, go-micro, or one that generates the code of a service, such as go-zero or Kratos;
- NestJS for Editing;
- Dapr, a sidecar that offers the same building blocks to both runtimes;
- one chassis per runtime, assembled from libraries that each cover one concern.

The last release of go-kit is v0.13.0, of August 2023, and its last commit is of March 2024; its packages for service discovery and tracing cover what Kubernetes already does or what the prototype leaves out. go-micro has a registry and a broker of its own, which overlap with Kubernetes and Kafka; its Kafka broker is in a separate repository of plugins and does not set the key of a message, which the order of the events of an aggregate needs. go-zero and Kratos impose a folder structure of their own on the code they generate. The Kafka transport of NestJS is built on KafkaJS, whose last release is of February 2023, and a NestJS application is built around its decorators. Dapr gives both runtimes one sidecar, but adds a control plane and a sidecar for every service to the deployment, in Kubernetes and in Compose.

**Decision.** Each runtime will have a thin chassis of its own, assembled from libraries:

- One shared Go module is the chassis of the API gateway and of Account, Membership, Discussion and Notification, on Go 1.25 or later. Fastify with its plugins is the chassis of Editing.
- Each concern is covered by these libraries:

| Concern | Go services and API gateway | Editing |
|---|---|---|
| HTTP server, REST APIs from the OpenAPI contracts | `net/http`, with the strict server of `oapi-codegen` | `fastify` |
| WebSocket | The gateway forwards it with `net/http/httputil.ReverseProxy` | `@fastify/websocket` |
| Kafka: keyed publisher, router of the consumers | `ThreeDotsLabs/watermill` with `watermill-kafka` | `@confluentinc/kafka-javascript` |
| Transactional Outbox and Polling Publisher (ADR-05) | `watermill-sql`, with its standard PostgreSQL schema, and the Forwarder of Watermill | None: Editing publishes directly |
| PostgreSQL driver and data access | `jackc/pgx/v5`, with the code generated by `sqlc` | `pg` |
| Migrations (ADR-06) | `pressly/goose` | `node-pg-migrate` |
| Metrics | `prometheus/client_golang` | `fastify-metrics`, on `prom-client` |
| Timeout, retry, circuit breaker | `context` of the standard library, `sony/gobreaker/v2` | `opossum` |
| Types of the messages ([ADR-08](#adr-08-contracts-are-json-schema-with-no-schema-registry)) | `go-jsonschema` | `json-schema-to-typescript`, `openapi-typescript` |
| Logs | `log/slog` of the standard library, JSON on the standard output | pino, part of Fastify |
| Health checks, configuration | Two handlers, environment variables read with `os.Getenv` | Two routes, environment variables |

- The libraries appear only in `main` and in the adapters of [Hexagonal Architecture](#hexagonal-architecture), never in the domain model or in the application services.
- No OpenTelemetry: distributed tracing is left out of the prototype ([Observability](#observability)), and Prometheus scrapes the metrics of each service directly.

Watermill realizes the outbox of ADR-05 as follows:

- The change of the aggregate, the outbox row and the record of an applied event share one `pgx.Tx`, which the SQL publisher of Watermill writes into through `TxFromPgx`.
- The PostgreSQL schema orders the rows by the identifier of the transaction that wrote them (`xid8`), and reads a row only once every transaction with a lower identifier has ended, so no row is passed while an earlier transaction is still open. The transactions of one aggregate are serialized, and each one locks its aggregate before any other write, so its events keep their order.
- The row of the consumer group in the offsets table is locked with `FOR UPDATE`, so only one replica at a time reads and publishes the pending rows: the lock between publishers of ADR-05.
- *Marked as sent* is the offset committed for that consumer group: every row up to it has been sent.
- The standard schema keeps the sent rows, and a small periodic task of ours deletes the old ones.
- The `PollInterval` of the Forwarder is set well within the 5 s (p99) of QA-06.
- The Kafka key of each event is the identity of its aggregate, set through `NewWithPartitioningMarshaler`.
- The consumers deduplicate on the identifier in the envelope of [Contracts](#contracts), never on the `UUID` of a Watermill message, which is empty for the events published by Editing.
- The Go producer is synchronous, so the Forwarder confirms a row only after Kafka acknowledges it.

This narrows the skeleton that ADR-04 records twice to one thin chassis per runtime.

**Consequences.** On the good side:

- Two thin chassis, each a set of libraries that cover one concern each, while discovery, configuration and probes stay with the platform.
- The outbox of ADR-05 is not written by hand: the order, the lock between replicas and the offset of what is sent come from `watermill-sql`.
- The contracts generate code: the REST servers from OpenAPI, the access to the data from SQL, the types of the messages from JSON Schema.

On the bad side:

- More dependencies to keep up to date. Renovate finds them in `go.mod` and `package.json`.
- The `Message` type of Watermill must stay inside the adapters.
- The Kafka client of Confluent for Node.js is a native binding, so the image of Editing is built from an official Node.js image.
- Every Go module needs Go 1.25 or later.
- The cleanup of the outbox and its metrics, the pending rows and the age of the oldest one promised in [Observability](#observability), stay our code, which reads the tables of Watermill.

**Compliance.**

- A fitness function in the CI forbids importing these libraries from the domain and application packages: the depguard rules of golangci-lint for Go, dependency-cruiser for TypeScript.
- The Compliance tests of ADR-05 run against the publisher built on Watermill.
- A test checks that the Kafka key of every event is the identity of its aggregate.

### ADR-08: Contracts are JSON Schema, with no schema registry

**Status:** Proposed.

**Context.** [Contracts](#contracts) gives each contract a specification kept with its service, OpenAPI for the REST APIs and AsyncAPI for the events, and makes the schema of each message the source of the types of both languages. [ADR-04](#adr-04-editing-runs-on-nodejs-with-the-crdt-of-the-client-the-other-services-on-go) leaves the format of those schemas to choose: the events of Editing are produced in TypeScript and consumed in Go, and the reverse. It is also open whether a schema registry checks a new version before it is published. The alternatives were:

- JSON Schema, with JSON on the wire;
- Avro;
- Protocol Buffers.

Avro messages are binary, and are usually read through a schema registry, one more component to deploy. Protocol Buffers are binary too, with solid type generation in both languages, but they are less natural to describe in AsyncAPI, whose schemas are JSON Schema, as those of OpenAPI 3.1 are.

**Decision.** We will write the contracts in JSON Schema:

- The payload of every event and query is a JSON Schema, inside the AsyncAPI specification of the events and the OpenAPI 3.1 specification of the REST APIs. The messages travel as JSON on Kafka and over HTTP, events in the envelope of Contracts.
- Go generates its types with `go-jsonschema` and TypeScript with `json-schema-to-typescript`; Editing generates the types of its calls to Membership with `openapi-typescript`. The generated code is never edited by hand.
- No schema registry: the consumer-driven contract tests of Contracts, in the pipeline of each producer, guard the compatibility of a new version.

This settles the format left open by ADR-04.

**Consequences.** On the good side:

- A message can be read as it is, in a Kafka tool or a log.
- One schema language for the REST APIs and the events, with generators in both languages.
- No registry to deploy (QA-08).

On the bad side:

- JSON messages are larger than binary ones.
- Without a registry, nothing at run time stops an incompatible message: only the tests in the pipeline do.

**Compliance.**

- The CI regenerates the types from the schemas and fails if they differ from the committed ones.
- The contract test of each event checks a producer in one language against a consumer in the other (ADR-04).
