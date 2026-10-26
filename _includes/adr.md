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
survives a crash of Editing, and QA-05 that none is silently discarded. The session merges an
operation, and the policy *when edits are merged, apply them to the page block tree* stores it.
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
- The store of the log is still to choose; it must make an append durable before it returns.
- The operations in the log outlive the version of the protocol that wrote them: a change to the
  operations needs a version on each one and a way to replay the older ones.

**Compliance.**

- The chaos test of QA-04 kills Editing under load and checks that every acknowledged operation
  is in the page after the restart.
- The SLI of QA-01 is measured from the submit to the ack, so an ack sent before the append
  shows up as a broken test, not as a better number.
