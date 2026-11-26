/**
 * The one sequence of characters that holds the text of a whole page, with the marker of each block
 * in it.
 *
 * The sequence follows Fugue (Weidner and Kleppmann): every element, a character or a marker, is a
 * child of the element it was inserted next to, on the left or on the right, and the order of the
 * sequence is a walk of that tree: the left children, then the element, then the right children,
 * siblings on the same side ordered by their ids. Concurrent insertions at the same place keep the
 * text of each collaborator together, typed forwards or backwards.
 *
 * A character belongs to the block of the nearest marker before it whose block holds text, so a
 * character a concurrent insertion puts after the marker of a page block goes to the block before.
 * Deleting a block keeps its marker, so a character typed in it meanwhile stays in the deleted block
 * and is not shown, instead of moving to the block before. A line break inside a block is a
 * character like any other.
 *
 * Deleted characters stay in the tree, since later insertions may name them as their parent.
 *
 * @module
 */

import { compareIds, type BlockId, type Id, type IdRange } from './ids.ts';
import type { SequencePosition, Side } from './protocol.ts';

type Element = {
  readonly id: Id;
  /** The character, a Unicode code point, or `null` for the marker of a block. */
  readonly character: string | null;
  /** For a marker, whether its block holds text: a page block does not. */
  readonly holdsText: boolean;
  readonly left: Element[];
  readonly right: Element[];
  /** A deleted character, or the marker of a deleted block. */
  deleted: boolean;
};

/** The text of a block that is not deleted. */
export type BlockText = { readonly block: BlockId; readonly text: string };

const key = (id: Id) => `${id.replica}:${id.counter}`;

/**
 * The sequence of a page on one replica. It applies each operation once and in an order that
 * respects what the operation builds on, as the session of the page delivers them; an operation
 * whose id it already holds has no effect.
 */
export class Sequence {
  /** The root of the tree, which has only right children. */
  readonly #root: Element = { id: { replica: 0, counter: 0 }, character: null, holdsText: false, left: [], right: [], deleted: false };
  readonly #elements = new Map<string, Element>();

  /**
   * Inserts the characters of `text` at `at`: the first one has the id `id`, and each next one is
   * the right child of the one before it, with the next counter.
   *
   * @throws {Error} if the parent of `at` is not in the sequence.
   */
  insertText(id: Id, at: SequencePosition, text: string): void {
    if (this.#elements.has(key(id))) {
      return;
    }
    let parent = this.#parent(at);
    let side = at.side;
    let counter = id.counter;
    for (const character of text) {
      parent = this.#attach({ replica: id.replica, counter }, parent, side, character, false);
      side = 'right';
      counter++;
    }
  }

  /**
   * Inserts the marker of the block `block` at `at`. A block that holds no text, a page block, gets
   * no character: those after its marker belong to the block before.
   *
   * @throws {Error} if the parent of `at` is not in the sequence.
   */
  insertMarker(block: BlockId, at: SequencePosition, holdsText: boolean): void {
    if (!this.#elements.has(key(block))) {
      this.#attach(block, this.#parent(at), at.side, null, holdsText);
    }
  }

  /**
   * Deletes the characters of `ranges`, all or none.
   *
   * @throws {Error} if an id is not a character of the sequence.
   */
  deleteText(ranges: readonly IdRange[]): void {
    const deleted: Element[] = [];
    for (const { replica, counter, length } of ranges) {
      for (let offset = 0; offset < length; offset++) {
        const element = this.#get({ replica, counter: counter + offset });
        if (element.character === null) {
          throw new Error(`${key(element.id)} is a marker, not a character`);
        }
        deleted.push(element);
      }
    }
    for (const element of deleted) {
      element.deleted = true;
    }
  }

  /**
   * Deletes the characters of a block, those inserted in it later included, and keeps its marker.
   *
   * @throws {Error} if `block` is not the marker of a block of the sequence.
   */
  deleteBlock(block: BlockId): void {
    const element = this.#get(block);
    if (element.character !== null) {
      throw new Error(`${key(block)} is a character, not a marker`);
    }
    element.deleted = true;
  }

  /**
   * Where an element goes to come right after `after` in the sequence, or at its start when `after`
   * is `null`, as Fugue places it: the right child of `after` if it has none, otherwise the left
   * child of the element that follows it.
   *
   * @throws {Error} if `after` is not in the sequence.
   */
  positionAfter(after: Id | null): SequencePosition {
    let next = (after === null ? this.#root : this.#get(after)).right[0];
    if (next === undefined) {
      return { parent: after, side: 'right' };
    }
    while (next.left[0] !== undefined) {
      next = next.left[0];
    }
    return { parent: next.id, side: 'left' };
  }

  /** The blocks that are not deleted, in the order of their markers, each with its text. */
  blocks(): BlockText[] {
    const blocks: { readonly block: BlockId; readonly characters: string[]; readonly deleted: boolean }[] = [];
    let owner: (typeof blocks)[number] | undefined;
    // ponytail: walks the whole tree on every read, an index over the sequence replaces it for long pages
    for (const element of this.#walk()) {
      if (element.character === null) {
        const block = { block: element.id, characters: [], deleted: element.deleted };
        blocks.push(block);
        if (element.holdsText) {
          owner = block;
        }
      } else if (!element.deleted && owner !== undefined) {
        owner.characters.push(element.character);
      }
    }
    return blocks.filter((block) => !block.deleted).map((block) => ({ block: block.block, text: block.characters.join('') }));
  }

  /** The elements in the order of the sequence, without recursion, since a run of text is a chain as deep as it is long. */
  *#walk(): Generator<Element> {
    const stack = this.#root.right.toReversed().map((element) => ({ element, expand: true }));
    for (let entry = stack.pop(); entry !== undefined; entry = stack.pop()) {
      const { element, expand } = entry;
      if (!expand) {
        yield element;
        continue;
      }
      stack.push(...element.right.toReversed().map((child) => ({ element: child, expand: true })));
      stack.push({ element, expand: false });
      stack.push(...element.left.toReversed().map((child) => ({ element: child, expand: true })));
    }
  }

  #parent(at: SequencePosition): Element {
    return at.parent === null ? this.#root : this.#get(at.parent);
  }

  #get(id: Id): Element {
    const element = this.#elements.get(key(id));
    if (element === undefined) {
      throw new Error(`${key(id)} is not in the sequence`);
    }
    return element;
  }

  #attach(id: Id, parent: Element, side: Side, character: string | null, holdsText: boolean): Element {
    const element: Element = { id, character, holdsText, left: [], right: [], deleted: false };
    const siblings = side === 'left' ? parent.left : parent.right;
    const index = siblings.findIndex((sibling) => compareIds(sibling.id, id) > 0);
    siblings.splice(index === -1 ? siblings.length : index, 0, element);
    this.#elements.set(key(id), element);
    return element;
  }
}
