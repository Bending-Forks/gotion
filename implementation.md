---
title: Implementation
icon: 🛠️
nav_order: 4
---

## Microservices

### Editing client

The client edits a page with [BlockNote](https://www.blocknotejs.org), a block editor built on
ProseMirror. It sits behind the adapter of [ADR-01](design.html#adr-01-replicas-merge-concurrent-edits-with-our-own-crdt-editing-relays-the-operations)
and could be replaced without touching that record. Only the adapter imports it, and the
collaboration built into BlockNote (Yjs) is not used.

**Why BlockNote.** Its blocks already match the ones of US-07: `paragraph`, `heading` with
levels 1 to 6, `bulletListItem`, `numberedListItem`, `checkListItem` and `codeBlock` with its
language. It nests blocks, and its custom blocks cover the page block and any new block type
(QA-09). The core is under MPL-2.0 and its `xl-*` packages under GPL-3.0, both compatible with
the GPL-3.0 of Gotion (BR-06).

**The adapter.**

- It turns the changes of the editor into operations of the CRDT, and applies the remote
  operations as minimal ProseMirror steps through `editor.transact`, outside the undo history.
- BlockNote reports a changed block, not the typed characters. The adapter compares the text of
  the block before and after the change and uses the cursor to tell repeated characters apart.
  Paste and input methods (IME) are still to be tested.
- To turn an offset in a block into a ProseMirror position, the adapter relies on the shape of
  the BlockNote schema, which is not documented. It keeps this in one function, and the client
  pins the BlockNote version.
- Undoing a local deletion inserts new characters instead of restoring the deleted ones, so an
  edit made meanwhile at that place by someone else may end up on the other side.
- Long pages need an index over the characters and batched operations.

**Markdown (BR-03).** The text of BlockNote is styled text, not Markdown. The schema allows only
the styles Markdown can express, and Editing writes each page as Markdown as well.

**Accessibility (QA-10).** BlockNote nests blocks with Tab and Shift+Tab and offers
`moveBlocksUp` and `moveBlocksDown`, but claims no WCAG conformance. QA-10 is to be reviewed.

**Tests.**

- Browser tests with several clients, run in CI, check that the cursor, the selection and the
  focus hold under remote edits, and that undo undoes only local edits.
- A test checks that the editor schema holds only the block types of US-07 and the page block,
  and only styles Markdown can express.

## Testing

<!-- TODO SLO: the scenarios whose target is 100 % are invariants, verified by tests and not
by an SLO: QA-04 zero loss of acknowledged edits (chaos test: kill the process under load,
then check every acknowledged edit after the restart), QA-05 convergence (property-based
test over 1 000 randomized interleavings), QA-06 (authorization matrix per role and
operation; for a non-member, "forbidden" and "non-existent" responses compared byte by byte),
QA-07 (after 5 failed logins the 6th attempt gets 429). -->

## Multiplatform

## Experiments

## Monitoring

<!-- TODO SLO: the SLOs are the response measures of the runtime scenarios, measured over 30
days: QA-01, QA-02, QA-03 and the recovery within 60 s of QA-04. For each one: the SLI as good
events over valid events, the target, the error budget, the metric and its PromQL query, the
Grafana dashboard and the alert (steps 4 and 5 of the lab notes "Quality Attributes in SRE").
The local render of QA-01 and the remote render of QA-02 are measured in the client, and
QA-02 corrects for the offset between the client and server clocks. Say also why the other
scenarios have no SLO: they are invariants (see Testing) or development time attributes (see
CI/CD in DevOps). -->
