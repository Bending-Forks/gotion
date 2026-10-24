## Architecture Decision Records

Each architecturally significant decision is recorded after Nygard and Richards: Title, Status,
Context, Decision, Consequences and Compliance. A record stays *Proposed* until it is reviewed,
and is never edited once *Accepted*: a later decision supersedes it.

### ADR-01: Replicas merge concurrent edits with our own CRDT, Editing relays the operations

**Status:** Proposed.

**Context.** Pages are edited together in real time (US-08). Concurrent edits must converge
without dropping an acknowledged one (QA-05), the local render must stay within 50 ms (QA-01),
and a new block type must not touch synchronization or persistence (QA-09). The merge of
concurrent edits is a concern of the core subdomain, so it is worth owning. The decision answers
[PP-01](analysis.html#open-pain-points): are concurrent edits ordered and merged by a central
sequencer in Editing, or do replicas merge on their own? The alternatives were:

- operational transformation, with Editing as the central sequencer;
- Yjs, with any editor, including the collaboration built into BlockNote;
- a CRDT of ours that every replica runs, with Editing as the relay of the operations.

Yjs works against the domain model. Every replica merges an update as soon as it gets it, so
Editing cannot refuse an edit, and the domain events must be derived by comparing the document
before and after each update. A move is a deletion plus an insertion, so two concurrent moves
of the same block can leave two copies of it. Yjs does not define when an edit is acknowledged.
And the merge, a concern of the core subdomain, would be left to a generic library.

**Decision.** We will synchronize the replicas with a CRDT of ours. This settles PP-01:

- every replica merges concurrent operations on its own, with our CRDT;
- Editing is the one relay of the operations of a page: it checks each operation, stores it,
  acknowledges it to its author and relays it to the other collaborators;
- the CRDT is a module with no dependency on any editor: a sequence of characters for the text
  of a block, with the styles as marks over its characters, and a tree of blocks with a move
  operation;
- the editor of the client is only an adapter: it turns the changes of the editor into
  operations and applies the remote ones. The choice of the editor is a design choice behind
  the adapter, described in [Editing client](implementation.html#editing-client).

A prototype confirmed the approach. Ten clients typed in the same block, the cursor and the
selection held under remote edits, every client converged, and the local render stayed well
within QA-01.

**Consequences.** On the good side:

- The commands of the [Page Block Tree](#page-block-tree) stay commands. Editing refuses an
  operation that breaks a rule, for example a page block that changes type, and its author
  reverts it before any other replica sees it. Block Inserted, Block Moved and Block Deleted
  come from the operations.
- The tree of blocks has its own move, so two concurrent moves can neither duplicate a block nor
  nest one under itself.
- Editing defines when an edit is acknowledged. It can append each operation to a durable log
  before acknowledging it, as QA-01 and QA-04 ask, and that log is the Event Sourcing of
  Editing. The log itself is settled in its own record.
- The merge of concurrent edits, part of the core subdomain, is our own code.
- There is no Yjs server to run, and nothing keeps editing while disconnected: the editor
  becomes read-only when the connection drops, as the
  [scope](analysis.html#out-of-scope-for-now-1) requires.

On the bad side, each to be settled before or while Editing is built:

- **More to build:** the styles as marks, the tree of blocks with its move, a snapshot for a
  collaborator who joins late, reconnection and the resending of unacknowledged operations.
- **Presence (US-08)** is part of our own protocol, with no Yjs awareness to rely on.
- **QA-09 holds only while the operations stay generic:** insert a block of any type with its
  properties, set a property, edit text. A block type that needs an operation of its own breaks
  it.
- **Coupling between client and Editing.** Both share the protocol of the operations and the
  block schema, so they are upgraded together.
- **The adapter is the fragile part.** It derives the operations from the editor, which is
  described with its risks in [Editing client](implementation.html#editing-client).

**Compliance.**

- The convergence test of QA-05, over 1 000 randomized interleavings, runs on the CRDT module
  alone. It includes concurrent moves of the same block, moves that would create a cycle, and
  edits concurrent with a move.
- A fitness function checks that only the adapter of the client imports the editor library or
  ProseMirror, and never the CRDT module or the domain of Editing.
