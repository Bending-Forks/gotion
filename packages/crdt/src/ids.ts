/**
 * The identities carried by the operations and the messages of the protocol.
 *
 * @module
 */

/**
 * The number of a replica: one page open in one tab of a client. Editing assigns it when the
 * replica joins the session of the page, the next number of that page, and records in its database
 * the user it gave it to, so two replicas of the same page never get the same number. A replica
 * keeps it when it reconnects; a tab that is reloaded joins again and gets a new one. It is a
 * positive integer.
 */
export type ReplicaId = number;

/**
 * The identity of an element of the sequence, a character or the marker of a block, and the
 * timestamp of an operation.
 *
 * `counter` is the Lamport clock of the replica: before each operation the replica sets it past
 * every counter it has seen, its own and those of the operations it received, so an operation
 * always has a greater counter than every id it refers to. Ids are ordered by `counter`, then by
 * `replica`, an order that respects what each operation builds on, as the move of Kleppmann et al.
 * needs. A replica never uses a counter twice, so `(replica, counter)` is unique in its page.
 * `counter` is a positive integer.
 *
 * Editing checks a submitted operation in this order. One whose id is already in the log is a
 * resubmission after a reconnect: Editing acknowledges it again, with its `seq`, if it is the same
 * operation, without checking it again, and closes the connection as malformed otherwise. Two
 * operations are the same when their canonical JSON is: `encodeOperation(decodeOperation(row))` for
 * the one in the log, which a jsonb column may give back with its keys in another order, against
 * `encodeOperation` of the one submitted. Any other operation must carry the number of
 * the connection that submits it as its `replica`, and a counter greater than every counter that
 * replica used before.
 */
export type Id = { readonly replica: ReplicaId; readonly counter: number };

/**
 * The `length` consecutive ids of one replica, from `counter` to `counter + length - 1`: the
 * characters of one insertion, or a part of them.
 */
export type IdRange = { readonly replica: ReplicaId; readonly counter: number; readonly length: number };

/**
 * The identity of a block in its page: the id of its marker in the sequence, which is also the id of
 * the operation that inserted the block. It never changes, whatever the block becomes.
 */
export type BlockId = Id;

/**
 * The identity of a page, a UUID that does not tell its workspace: Editing keeps the workspace of
 * each page (see the Page aggregate) and checks the format, not here.
 */
export type PageId = string;

/** The identity of a user, as Account issues it in the sign-in token. */
export type UserId = string;

/**
 * The place of an operation in the session log of its page. The log of a page starts at 1, so 0
 * means that a replica holds no operation of it yet.
 */
export type Seq = number;

/**
 * Where a block goes among its siblings: a key of fractional indexing, in the format of Greenspan's
 * "Implementing Fractional Indexing" that the `fractional-indexing` library also writes. A key is
 * made of base-62 digits (`0-9A-Za-z`): its first letter says how many digits its integer part
 * has, and the digits after the integer part, if any, do not end in `0`. Keys compare by UTF-16
 * code unit, as `<` does in JavaScript and the `C` collation in PostgreSQL, never with
 * `localeCompare`, and between two different keys another one can always be made.
 *
 * Siblings are ordered by key, then by the place of their markers in the sequence. A block divided
 * from another takes the key of the divided block, so the blocks divided from one block, at once or
 * one after the other, follow the order of their text (Implementation, CRDT package). A block inserted between two
 * siblings with the same key takes that key too, with its marker right before the marker of the
 * later one. Only a move between two siblings with the same key needs keys of their own: the
 * replica first moves the siblings with that key on one side of the place to new keys.
 */
export type PositionKey = string;
