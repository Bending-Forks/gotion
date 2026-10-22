## Architecture Decision Records

Each architecturally significant decision is recorded after Nygard and Richards: Title, Status,
Context, Decision, Consequences and Compliance. A record stays *Proposed* until it is reviewed,
and is never edited once *Accepted*: a later decision supersedes it.

### ADR-01: Use BlockNote as the block editor, synchronized by our own CRDT

**Status:** Proposed.

**Context.** Gotion needs a block editor in the browser for pages, their metadata and their
blocks (US-04 to US-07), edited together in real time (US-08). Concurrent edits must converge
(QA-05), the local render must stay within 50 ms (QA-01), and a new block type must not touch
synchronization or persistence (QA-09). The value of Gotion lies in its domain and its
architecture, so the editor is not worth building from scratch. The decision also answers
[PP-01](analysis.html#open-pain-points): are concurrent edits ordered and merged by a central
sequencer in Editing, or do replicas merge on their own? The alternatives were:

- writing the editor and an operational-transformation server ourselves, with Editing as the
  central sequencer;
- ProseMirror or Tiptap with Yjs, assembling the blocks of US-07 on top of them;
- [BlockNote](https://www.blocknotejs.org), a block-based editor built on ProseMirror whose
  blocks already work like Notion's, with its own collaboration on Yjs;
- BlockNote as the interface only, synchronized by a CRDT of ours.

Yjs, with or without BlockNote, works against the domain model. Every replica merges an update
as soon as it gets it, so Editing cannot refuse an edit, and the domain events must be derived
by comparing the document before and after each update. A move is a deletion plus an insertion,
so two concurrent moves of the same block can leave two copies of it. Yjs does not define when
an edit is acknowledged. And the merge of concurrent edits, a concern of the core subdomain,
would be left to a generic library.

**Decision.** We will use BlockNote as the editor of the client, without its Yjs collaboration,
and synchronize it with a CRDT of ours. This settles PP-01:

- every replica merges concurrent operations on its own, with our CRDT;
- Editing is the one relay of the operations of a page: it checks each operation, stores it,
  acknowledges it to its author and relays it to the other collaborators;
- the CRDT is a module with no dependency on BlockNote: a sequence of characters for the text
  of a block, with the styles as marks over its characters, and a tree of blocks with a move
  operation;
- in the client, an adapter turns the changes of the editor into operations, and applies
  remote operations as minimal ProseMirror steps through `editor.transact`, outside the undo
  history.

A prototype confirmed the approach. Ten clients typed in the same block, and the cursor and the
selection held under remote edits. Every client converged, and the local render stayed well
within QA-01.

BlockNote already has the block types of US-07 (`paragraph`, `heading` with levels 1 to 6,
`bulletListItem`, `numberedListItem`, `checkListItem`, `codeBlock` with its language) and
nesting. Its custom blocks cover the page block and any new block type.

**Consequences.** On the good side:

- No editor to build: the effort goes to the Editing service and to the synchronization.
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
- The core of BlockNote is under MPL-2.0 and its `xl-*` packages under GPL-3.0, both compatible
  with the GPL-3.0 of Gotion (BR-06).

On the bad side, each to be settled before or while Editing is built:

- **More to build:** the styles as marks, the tree of blocks with its move, a snapshot for a
  collaborator who joins late, reconnection and the resending of unacknowledged operations.
  Long pages also need an index over the characters and batched operations.
- **Presence (US-08)** is part of our own protocol, with no Yjs awareness to rely on.
- **An internal of BlockNote.** To turn an offset in a block into a ProseMirror position, the
  adapter relies on the shape of the BlockNote schema, which is not documented. The adapter
  keeps it in one function, the client pins the BlockNote version, and the tests of the
  adapter catch a change.
- **The local operations are derived.** BlockNote reports a changed block, not the typed
  characters, so the adapter compares the text of the block before and after the change, using
  the cursor to tell repeated characters apart. Paste and input methods (IME) are still to be
  tested.
- **Undo.** Undoing a local deletion inserts new characters instead of restoring the deleted
  ones, so an edit made meanwhile at that place by someone else may end up on the other side.
- **QA-09 holds only while the operations stay generic:** insert a block of any type with its
  properties, set a property, edit text. A block type that needs an operation of its own breaks
  it.
- **Markdown (BR-03).** The text of BlockNote is styled text, not Markdown. To keep BR-03, the
  schema allows only the styles Markdown can express, and Editing writes each page as Markdown
  as well.
- **Accessibility (QA-10).** BlockNote nests blocks with Tab and Shift+Tab and offers
  `moveBlocksUp` and `moveBlocksDown`, but claims no WCAG conformance. QA-10 is to be reviewed.
- **Coupling between client and Editing.** Both share the protocol of the operations and the
  block schema, so they are upgraded together.

**Compliance.**

- The convergence test of QA-05, over 1 000 randomized interleavings, runs on the CRDT module
  alone. It includes concurrent moves of the same block, moves that would create a cycle, and
  edits concurrent with a move.
- Browser tests with several clients, run in CI, check that the cursor, the selection and the
  focus hold under remote edits, and that undo undoes only local edits.
- A test checks that the editor schema holds only the block types of US-07 and the page block,
  and only styles Markdown can express.
- Fitness functions check that only the adapter of the client imports BlockNote or ProseMirror,
  and never the CRDT module or the domain of Editing.
