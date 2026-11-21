/**
 * The protocol between the client and Editing: the operations of the CRDT and the messages of the
 * session of a page, which travel as JSON over the WebSocket of the page.
 *
 * The protocol is not one of the contracts between services: the client and Editing both import it
 * from this package and are upgraded together (ADR-01, ADR-04). The operations are the exception,
 * because the session log keeps them after the version that wrote them: each one carries the
 * version of the protocol, so that an older one can still be replayed (ADR-02).
 *
 * @module
 */

import type { BlockId, Id, IdRange, PositionKey, ReplicaId, Seq, UserId } from './ids.ts';
import type { BlockContent } from './schema.ts';

/** The version of the protocol that this package writes and reads. */
export const PROTOCOL_VERSION = 1;

/** A version of the protocol that this package reads. */
export type ProtocolVersion = typeof PROTOCOL_VERSION;

/** The sides of its parent that an element of the sequence can go to, as in Fugue. */
export const SIDES = ['left', 'right'] as const;

/** The side of its parent that an element of the sequence goes to. */
export type Side = (typeof SIDES)[number];

/**
 * Where a new element goes in the sequence of the page, which follows Fugue (Weidner and
 * Kleppmann): it becomes a child of `parent`, an element that already exists, on `side`. With
 * `parent` `null` it becomes a right child of the root of the sequence, the only side of the root
 * that Fugue uses. The order of the sequence is a walk of that tree, so concurrent insertions at the
 * same place keep the text of each collaborator together.
 */
export type SequencePosition = { readonly parent: Id | null; readonly side: Side };

/**
 * Where a block goes in the tree of blocks: under `parent`, or at the top of the page when `parent`
 * is `null`, at `key` among its siblings.
 */
export type TreePlace = { readonly parent: BlockId | null; readonly key: PositionKey };

/**
 * Inserts a block: its marker at `at` in the sequence, and the block at `place` in the tree, with
 * its content and no text. The id of the operation becomes the {@link BlockId} of the block and the
 * id of its marker.
 *
 * Dividing a block (Enter) is an insertion whose marker goes right after the character where the
 * block is divided, so the characters after it belong to the new block without being copied; the
 * new block goes under the parent of the divided one, with its key (see {@link PositionKey}).
 * Enter at the start of a block divides nothing: it inserts an empty block before it, with its key
 * and its marker right before the marker of that block, which keeps its text, its type and the
 * comment threads anchored to it.
 */
export type InsertBlock = {
  readonly type: 'insertBlock';
  readonly version: ProtocolVersion;
  readonly id: Id;
  readonly at: SequencePosition;
  readonly place: TreePlace;
  readonly content: BlockContent;
};

/**
 * Replaces the content of a block, which may turn it into another type. Setting a property, such as
 * the level of a heading or the checkbox of a to-do, is an update with the same type and the new
 * value, which is the same as long as each type has at most one property. The block keeps its id,
 * its place, its marker and its text. Of two concurrent updates of the same block, every replica
 * keeps the one with the greater id: the content is a last-writer-wins register (Implementation, CRDT package).
 */
export type UpdateBlock = {
  readonly type: 'updateBlock';
  readonly version: ProtocolVersion;
  readonly id: Id;
  readonly block: BlockId;
  readonly content: BlockContent;
};

/**
 * Moves or nests a block, with the move operation of Kleppmann et al. for replicated trees. The id
 * is its timestamp: of two concurrent moves that would make a cycle, the later one has no effect.
 * The marker and the characters of the block stay where they are.
 */
export type MoveBlock = {
  readonly type: 'moveBlock';
  readonly version: ProtocolVersion;
  readonly id: Id;
  readonly block: BlockId;
  readonly place: TreePlace;
};

/**
 * Deletes a block, the blocks nested in it and their characters, and keeps its marker, so that a
 * character typed in it meanwhile stays in the deleted block instead of moving to the one before.
 * A block that is joined and deleted at the same time is deleted, with its characters (ADR-01).
 */
export type DeleteBlock = {
  readonly type: 'deleteBlock';
  readonly version: ProtocolVersion;
  readonly id: Id;
  readonly block: BlockId;
};

/**
 * Joins a block to the one before it (Backspace at its start): removes its marker and takes it out
 * of the tree, so that its characters belong to the block of the previous marker, with no copy. A
 * concurrent update or move of the joined block has no effect; a concurrent deletion wins, and
 * deletes its characters. For now it joins only blocks that are neighbours in the sequence too, and
 * never a page block or a block to a page block: Editing refuses the others (ADR-01). After the
 * block between two others is deleted its marker stays between them, so joining the next one to
 * the block before waits for the join of blocks that are not neighbours.
 */
export type JoinBlock = {
  readonly type: 'joinBlock';
  readonly version: ProtocolVersion;
  readonly id: Id;
  readonly block: BlockId;
};

/**
 * Inserts text into the sequence. Each character of `text` is a Unicode code point (see
 * `characterCount`). The first one goes at `at` and has the id of the operation; each next one is
 * the right child of the one before it and has the next counter, so the text takes the counters
 * from `id.counter` to `id.counter + characterCount(text) - 1`. A line break inside a block
 * (Shift+Enter) is the character `\n`; tabs are allowed, other control characters are not.
 */
export type InsertText = {
  readonly type: 'insertText';
  readonly version: ProtocolVersion;
  readonly id: Id;
  readonly at: SequencePosition;
  readonly text: string;
};

/**
 * Deletes the characters with the ids of `ranges`. Deleting a character that is already deleted
 * has no further effect. Editing refuses a range that covers a marker, or an id that is not a
 * character of the page.
 */
export type DeleteText = {
  readonly type: 'deleteText';
  readonly version: ProtocolVersion;
  readonly id: Id;
  readonly ranges: readonly IdRange[];
};

/**
 * An operation of the CRDT: an edit that a collaborator submits and that every replica applies.
 * The operations are generic, so a new type of block needs none of its own (QA-09).
 *
 * Every id an operation refers to has a smaller counter than the operation (see {@link Id}); the
 * decoders refuse one that does not. A replica applies an operation once: one whose id it already
 * holds is ignored.
 */
export type Operation = InsertBlock | UpdateBlock | MoveBlock | DeleteBlock | JoinBlock | InsertText | DeleteText;

/**
 * Asks to join the session of the page of the WebSocket. A replica that reconnects sends `rejoin`
 * with the number Editing gave it and the last `seq` it holds. Its `type` and its integer `version`
 * never change from one version of the protocol to the next, so Editing can always tell a client
 * of another version.
 */
export type JoinSession = {
  readonly type: 'joinSession';
  readonly version: ProtocolVersion;
  readonly rejoin?: { readonly replica: ReplicaId; readonly seq: Seq };
};

/** Leaves the session. */
export type LeaveSession = { readonly type: 'leaveSession' };

/** Submits an operation of the replica, already applied to it. */
export type SubmitEdit = { readonly type: 'submitEdit'; readonly operation: Operation };

/**
 * A message from the client to Editing. The first one on a WebSocket is {@link JoinSession}, and
 * only the first: Editing closes the connection as malformed otherwise.
 */
export type ClientMessage = JoinSession | LeaveSession | SubmitEdit;

/**
 * The state of a page that a replica starts from. For now it is the operations accepted up to the
 * `seq` of {@link SessionJoined}, in the order of the log. A long page needs the state of the
 * sequence and of the tree instead, for the page open of QA-03; those parts of the CRDT will
 * replace it.
 */
export type Snapshot = { readonly operations: readonly Operation[] };

/**
 * The answer to {@link JoinSession}: the number of the replica and the last `seq` of the page.
 *
 * On a first join it carries the snapshot of the page up to that `seq`, and the operations after it
 * follow as {@link Relayed} messages.
 *
 * Editing resumes a rejoin if it gave that number to the same user for the same page, as it records
 * in its database; if an older connection of that replica is still open, Editing closes it first,
 * with {@link CLOSE_CODES} `replaced`.
 * Then the answer carries no snapshot, and every operation after the `seq` of the rejoin follows as
 * a {@link Relayed} message, the replica's own included: the replica ignores those it holds and
 * takes its own as acknowledged. It then submits again the operations still without an ack, and
 * Editing acknowledges again, without storing it twice, one that is already in its log (see
 * {@link Id}).
 *
 * A rejoin that Editing does not resume is answered as a first join, with a new number: the replica
 * starts again from the snapshot, and the operations it had not seen acknowledged are lost.
 */
export type SessionJoined = {
  readonly type: 'sessionJoined';
  readonly replica: ReplicaId;
  readonly seq: Seq;
  readonly snapshot?: Snapshot;
};

/** Confirms that the operation with the id `id` is in the session log, at `seq` (ADR-02). */
export type Ack = { readonly type: 'ack'; readonly id: Id; readonly seq: Seq };

/** The reasons for refusing an operation. */
export const REFUSAL_REASONS = ['invalid', 'forbidden', 'unavailable'] as const;

/**
 * Why Editing refused an operation: it breaks a rule of the Page Block Tree (`invalid`), the role of
 * the author does not allow changing the content (`forbidden`), or the role could not be checked
 * because Membership did not answer (`unavailable`, ADR-03).
 */
export type RefusalReason = (typeof REFUSAL_REASONS)[number];

/**
 * Refuses an operation, together with the operations of the same author that build on it, all
 * listed in `ids`. None of them reached the log or another replica, and the author reverts them.
 *
 * An operation builds on another when it refers to its id, or to an id that the other inserted (as
 * the parent of a position, a block, the parent of a place or in a range), directly or through other
 * operations. Editing also refuses, each in a refusal of its own, the operations that arrive later
 * and build on a refused one.
 */
export type Refused = {
  readonly type: 'refused';
  readonly ids: readonly Id[];
  readonly reason: RefusalReason;
};

/** An operation of another collaborator, or of the replica itself after a rejoin, at `seq`. */
export type Relayed = { readonly type: 'relayed'; readonly seq: Seq; readonly operation: Operation };

/**
 * The users who have the page open, sent whole whenever one joins or leaves. It shows no cursor
 * and does not go through the session log.
 */
export type Presence = { readonly type: 'presence'; readonly collaborators: readonly UserId[] };

/** The session is closed because its page was deleted; it accepts no more edits. */
export type SessionClosed = { readonly type: 'sessionClosed' };

/**
 * A message from Editing to the client. A client that cannot read one, for instance after Editing
 * was upgraded, reloads.
 */
export type ServerMessage = SessionJoined | Ack | Refused | Relayed | Presence | SessionClosed;

/**
 * The codes Editing closes the WebSocket of a page with when it cannot go on with the session, in
 * the range that WebSocket leaves to applications. They mirror the HTTP status of the same case, and
 * do not depend on the version of the protocol, so a client of any version understands them. A
 * client treats a code from 4000 to 4999 that it does not know as `malformed`, so the list can grow.
 */
export const CLOSE_CODES = {
  /**
   * A message did not follow the protocol, came out of order, or resubmitted an id with another
   * operation, so the replica may have diverged: the client reloads.
   */
  malformed: 4400,
  /**
   * The page does not exist, or the user may not read it, or no longer may: the client leaves the
   * page. A deleted page gets the same answer as a page the user may not read (QA-06).
   */
  forbidden: 4403,
  /**
   * A newer connection of the same replica took over, after a rejoin: the client does not join
   * again from this connection, so two tabs that share a number cannot take turns forever.
   */
  replaced: 4409,
  /**
   * The client speaks another version of the protocol: the client reloads, once, and shows that
   * Gotion is being upgraded if the code comes again, since its code may be newer than Editing.
   */
  unsupportedVersion: 4426,
  /**
   * The session cannot go on here for now: the role could not be checked when joining, or another
   * instance of Editing extended the log of the page. The client joins again later, with `rejoin`.
   */
  unavailable: 4503,
} as const;
