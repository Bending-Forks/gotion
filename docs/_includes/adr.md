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
- The store of the log is still to choose; it must make an append durable before it returns,
  and refuse an append whose sequence number is not the next one of its page, so that two
  instances of Editing can never both extend the log of the same page.
- The operations in the log outlive the version of the protocol that wrote them: a change to the
  operations needs a version on each one and a way to replay the older ones.

**Compliance.**

- The chaos test of QA-04 kills Editing under load and checks that every acknowledged operation
  is in the page after the restart.
- The SLI of QA-01 is measured from the submit to the ack, so an ack sent before the append
  shows up as a broken test, not as a better number.

### ADR-03: Editing keeps a local copy of the roles, Account and Discussion ask Membership

**Status:** Proposed.

**Context.** Membership is the one writer of the roles and of who is a member, but three other
contexts check them on their own commands, as the [Roles](#roles) table shows: Account lets only
an Admin rename or delete a workspace and keeps the main workspace among the user's own, Editing
lets a Viewer read but not change the content, and Discussion lets only members post, resolve
and be mentioned. The [Context Map](#context-map) says *what* each of them gets from Membership;
this record settles *how* it reaches them, which is
[PP-04](analysis.html#open-pain-points). Notification is not part of it: it reacts to Member
Invited and never checks a role or a membership.

The three contexts differ in what is at stake. Editing checks the role on every edit, on the path
that QA-01 bounds at 500 ms (p95) from the edit to the ack, and inside a session that stays open
for as long as the page is edited. Account checks it on renaming and deleting a workspace, rare
commands that cannot be undone. Discussion checks it on a comment, where a few milliseconds more
change nothing. QA-06 asks that every request of a non-member or a Viewer is denied. The
alternatives were:

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
- **Account asks Membership** whether the user is an Admin before renaming or deleting a
  workspace, and whether the user is a member before setting a main workspace. If Membership
  does not answer, the command is refused. Account keeps listening to Member Removed only for
  the policy that replaces a removed main workspace.
- **Discussion asks Membership** whether the author, every user mentioned and whoever resolves
  are members, in one query per command for all of them. If Membership does not answer, the
  command is refused. Discussion no longer listens to the events of Membership.
- **Membership's open-host service answers two queries**, in the same published language as
  its events: the role of a user in a workspace, and which of a set of users are members of a
  workspace. For a workspace that does not exist it answers as for one the user is not a member
  of, so the query leaks nothing (QA-06).
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

- **Editing is eventually consistent with Membership.** Between Member Removed and the moment
  Editing applies it, a removed member can still edit and still receives the operations of the
  session; between Member Role Changed and its event, a member demoted to Viewer can still edit.
  The window is the lag of the events, bounded by the response measure added to QA-06.
- **Account and Discussion depend on Membership at run time.** When it is down, no workspace can
  be renamed or deleted and no comment posted. Account and Membership already depend on each
  other through events; now each one also calls the other (Membership asks Account for the user
  registered with an email address), so each one's availability depends on the other's.
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
- Every service is built into its own container image, so the deployment handles a Go service and a Node.js one the same way.

This settles the runtimes left open by ADR-01.

**Consequences.** On the good side:

- The CRDT is written once. The convergence test of QA-05 runs on the package both sides import, so it covers Editing as well as the client.
- The client and Editing are upgraded together (ADR-01). With the protocol and the block schema as shared types, a change on one side that the other does not follow fails the type check.
- A Go service compiles to one static binary, so its image is small and carries no runtime.

On the bad side:

- Each language has its own build, tests, linter and image, so the CI has jobs for both, and the team works in two languages.
- The events cross languages: Editing publishes and consumes them in TypeScript, the other services in Go. Each published language needs a schema from which both sides generate their types, and its format is still to choose. Without it, a field renamed on one side breaks the other only at run time.
- The skeleton of a service exists twice, in Go and in TypeScript: the hexagonal structure, `/health` and `/metrics`, the Kafka consumer that ignores a repeated event, the migrations of QA-08.

**Compliance.**

- A fitness function checks that the client and Editing import the CRDT only from the shared package.
- The CI builds, tests and packages each service in its own runtime, and `success` collects the jobs of both.
- A contract test of each event checks that a consumer in one language reads what a producer in the other writes, against the shared schema.
- The SLI of QA-01 is also measured while Editing takes a snapshot, so a task that blocks the thread shows up as a slower ack.

### ADR-05: Services publish their events after the commit

**Status:** Proposed.

**Context.** Every service keeps its state in its own database and publishes its events on Kafka ([Decomposition](#decomposition), [Contracts](#contracts)). The two writes are in separate systems, and a service can stop between them. A policy downstream depends on each event: a lost Member Removed leaves a removed member able to edit, against QA-06, and a lost Workspace Deleted leaves the membership and the pages of the workspace in place. The alternatives were:

- publish before the commit;
- publish after the commit;
- a transaction across the database and Kafka;
- a Transactional Outbox: the event written into a table of the same database, in the same transaction as the state, and published by a process that polls the table;
- the same outbox, published by reading the transaction log of the database (change data capture), with a connector such as Debezium on Kafka Connect.

Publishing before the commit sends an event for a change that a failed commit then drops, so the other contexts react to something that did not happen. A transaction across the two is not available: Kafka has transactions of its own, but they cannot include the commit of an external database. Publishing after the commit never sends such an event, but loses one if the service stops after the commit and before Kafka acknowledges it. The outbox closes that gap: the event is stored with the state, and published again until it gets through. It costs, in every service that publishes, a table and its migration, a publisher, the deletion of the events already sent, and a lock so that only one replica publishes at a time and the events of an aggregate keep their order. Change data capture adds no polling, but also Kafka Connect and a connector next to the services.

**Decision.** We will publish every event after the change of state that raises it is stored, and accept that an event can be lost when its service stops in between:

- Account, Membership and Discussion publish after the commit of the transaction;
- Editing publishes after the operation is in the session log ([ADR-02](#adr-02-editing-acknowledges-an-operation-once-it-is-in-a-durable-log)) and applied to the Page Block Tree;
- the Kafka producer retries until Kafka acknowledges each event, keeping the events in memory while Kafka is down.

**Consequences.** On the good side:

- No event is published for a change that was not stored.
- Nothing is added to the services or to the deployment, and the replicas of a service stay interchangeable, as [State and scaling](#state-and-scaling) assumes.
- An outbox can be added later inside the service that needs it: its events, their contracts and the idempotent consumers stay the same.

On the bad side:

- An event is lost if its service stops after the commit and before Kafka acknowledges it, and nothing raises it again. The window is a few milliseconds in a crash, but lasts as long as Kafka is down, since the events wait in memory.
- A lost event is a policy that never runs, and nothing reports it. A lost Member Removed breaks QA-06 for that member; a lost Block Deleted or Page Deleted leaves its comment threads in Discussion. The chaos test of QA-04 kills Editing on purpose, so it can leave such threads, although no edit is lost.
- The cascades across contexts stop at a lost event ([Event delivery](#event-delivery)).

**Compliance.**

- A test of each service makes the commit fail and checks that no event is published.
- A test stops Kafka, runs a command, starts Kafka again and checks that the event arrives while the service keeps running.
