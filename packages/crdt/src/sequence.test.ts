import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Sequence, type Id } from './index.ts';

// An operation as its author made it: `apply` replays it on any sequence, and `last` is the
// greatest counter it took, which the clock of a replica that receives it moves past.
type Op = { readonly id: Id; readonly last: number; readonly apply: (sequence: Sequence) => void };

// A replica that makes operations on its own sequence, as a client does, with a Lamport clock.
class Replica {
  readonly sequence = new Sequence();
  readonly #replica: number;
  #counter = 0;

  constructor(replica: number) {
    this.#replica = replica;
  }

  receive(...ops: Op[]): void {
    for (const op of ops) {
      op.apply(this.sequence);
      this.#counter = Math.max(this.#counter, op.last);
    }
  }

  /** Inserts the marker of a new block right after `after`, or at the start of the page. */
  block(after: Id | null, holdsText = true): Op {
    const at = this.sequence.positionAfter(after);
    return this.#make(1, (id) => (sequence) => sequence.insertMarker(id, at, holdsText));
  }

  /** Types `text` right after `after`, in one insertion. */
  type(after: Id, text: string): Op {
    const at = this.sequence.positionAfter(after);
    return this.#make([...text].length, (id) => (sequence) => sequence.insertText(id, at, text));
  }

  /** Types `text` right after `after` one character at a time, each after the one before. */
  typeForwards(after: Id, text: string): Op[] {
    const ops: Op[] = [];
    let previous = after;
    for (const character of text) {
      const op = this.type(previous, character);
      ops.push(op);
      previous = op.id;
    }
    return ops;
  }

  /** Types `text` right after `after` one character at a time, from the last to the first. */
  typeBackwards(after: Id, text: string): Op[] {
    return [...text].reverse().map((character) => this.type(after, character));
  }

  erase(...ids: Id[]): Op {
    const ranges = ids.map((id) => ({ ...id, length: 1 }));
    return this.#make(1, () => (sequence) => sequence.deleteText(ranges));
  }

  deleteBlock(block: Id): Op {
    return this.#make(1, () => (sequence) => sequence.deleteBlock(block));
  }

  #make(length: number, apply: (id: Id) => (sequence: Sequence) => void): Op {
    const id = { replica: this.#replica, counter: this.#counter + 1 };
    const op = { id, last: this.#counter + length, apply: apply(id) };
    this.receive(op);
    return op;
  }
}

/** The id of the character at `index` of the text that `op` inserted. */
function char(op: Op, index: number): Id {
  return { replica: op.id.replica, counter: op.id.counter + index };
}

/** Every order of the operations of `lists` that keeps the order of each list. */
function* interleavings(lists: readonly (readonly Op[])[]): Generator<Op[]> {
  if (lists.every((list) => list.length === 0)) {
    yield [];
    return;
  }
  for (const [index, list] of lists.entries()) {
    const [first, ...rest] = list;
    if (first === undefined) {
      continue;
    }
    for (const tail of interleavings(lists.with(index, rest))) {
      yield [first, ...tail];
    }
  }
}

/**
 * Applies `base`, then the operations each replica made concurrently, one list per replica, in
 * every order a replica can receive them, and checks that every order gives the same blocks.
 * Returns the text of each block.
 */
function merge(base: readonly Op[], ...concurrent: (readonly Op[])[]): string[] {
  let first: ReturnType<Sequence['blocks']> | undefined;
  for (const order of interleavings(concurrent)) {
    const replica = new Replica(99);
    replica.receive(...base, ...order);
    const blocks = replica.sequence.blocks();
    if (first === undefined) {
      first = blocks;
    } else {
      assert.deepEqual(blocks, first, `order ${order.map((op) => JSON.stringify(op.id)).join(' ')}`);
    }
  }
  assert.ok(first);
  return first.map((block) => block.text);
}

/** Alice with a page of one block per text, and Bob and Carol who received it. */
function page(...texts: string[]) {
  const alice = new Replica(1);
  const base: Op[] = [];
  const blocks: Op[] = [];
  const typed: Op[] = [];
  let after: Id | null = null;
  for (const text of texts) {
    const block = alice.block(after);
    const op = alice.type(block.id, text);
    base.push(block, op);
    blocks.push(block);
    typed.push(op);
    after = char(op, [...text].length - 1);
  }
  const bob = new Replica(2);
  const carol = new Replica(3);
  bob.receive(...base);
  carol.receive(...base);
  return { alice, bob, carol, base, blocks, typed };
}

describe('Sequence', () => {
  test('insertions at two places of a block at once keep both on every replica', () => {
    const { alice, bob, base, typed } = page('Hello world');
    const [hello] = typed;
    assert.ok(hello);

    const a = alice.type(char(hello, 4), '!');
    const b = bob.type(char(hello, 10), '?');

    assert.deepEqual(merge(base, [a], [b]), ['Hello! world?']);
  });

  test('two passages typed forwards at the same place at once do not interleave', () => {
    const { alice, bob, base, typed } = page('ab');
    const [ab] = typed;
    assert.ok(ab);

    const a = alice.typeForwards(char(ab, 0), 'XYZ');
    const b = bob.typeForwards(char(ab, 0), '123');

    const [text] = merge(base, a, b);
    assert.ok(text === 'aXYZ123b' || text === 'a123XYZb', text);
  });

  test('two passages typed backwards at the same place at once do not interleave', () => {
    const { alice, bob, base, typed } = page('ab');
    const [ab] = typed;
    assert.ok(ab);

    const a = alice.typeBackwards(char(ab, 0), 'XYZ');
    const b = bob.typeBackwards(char(ab, 0), '123');

    const [text] = merge(base, a, b);
    assert.ok(text === 'aXYZ123b' || text === 'a123XYZb', text);
  });

  test('a character deleted twice at once is deleted once, and text typed after it stays', () => {
    const { alice, bob, carol, base, typed } = page('Hello');
    const [hello] = typed;
    assert.ok(hello);

    const a = alice.erase(char(hello, 2));
    const b = bob.erase(char(hello, 2));
    const c = carol.type(char(hello, 2), 'X');

    assert.deepEqual(merge(base, [a], [b], [c]), ['HeXlo']);
  });

  test('deleting a block hides its characters and those typed in it meanwhile', () => {
    const { alice, bob, base, blocks, typed } = page('Hello', 'world');
    const [, worldBlock] = blocks;
    const [, world] = typed;
    assert.ok(worldBlock && world);

    const a = alice.deleteBlock(worldBlock.id);
    const b = [bob.type(char(world, 4), '!'), bob.type(worldBlock.id, '¡')];

    assert.deepEqual(merge(base, [a], b), ['Hello']);
  });

  test('a line break typed in a block is a character of that block', () => {
    const { alice, bob, base, typed } = page('ab');
    const [ab] = typed;
    assert.ok(ab);

    const a = alice.type(char(ab, 0), '\n');
    const b = bob.type(char(ab, 1), 'c');

    assert.deepEqual(merge(base, [a], [b]), ['a\nbc']);
  });

  test('two blocks divided from one block at once each take the characters after their marker', () => {
    const { alice, bob, base, typed } = page('one two three');
    const [text] = typed;
    assert.ok(text);

    const a = alice.block(char(text, 3));
    const b = bob.block(char(text, 7));

    assert.deepEqual(merge(base, [a], [b]), ['one ', 'two ', 'three']);
  });

  test('two blocks divided at the same place at once leave an empty block between the parts', () => {
    const { alice, bob, base, typed } = page('Hello world');
    const [text] = typed;
    assert.ok(text);

    const a = alice.block(char(text, 5));
    const b = bob.block(char(text, 5));

    assert.deepEqual(merge(base, [a], [b]), ['Hello ', '', 'world']);
  });

  test('a character typed where a block is divided at once ends up on one side on every replica', () => {
    const { alice, bob, carol, base, typed } = page('Hello world');
    const [text] = typed;
    assert.ok(text);

    const a = alice.block(char(text, 5));
    const b = bob.type(char(text, 5), 'X');
    const c = carol.type(char(text, 10), '!');

    const blocks = merge(base, [a], [b], [c]);
    assert.ok(
      JSON.stringify(blocks) === JSON.stringify(['Hello X', 'world!']) ||
        JSON.stringify(blocks) === JSON.stringify(['Hello ', 'Xworld!']),
      JSON.stringify(blocks),
    );
  });

  test('characters after the marker of a block without text belong to the block before it', () => {
    const { alice, base, blocks, typed } = page('ab');
    const [ab] = typed;
    const [first] = blocks;
    assert.ok(ab && first);

    const pageBlock = alice.block(char(ab, 1), false);
    const c = alice.type(pageBlock.id, 'c');

    assert.deepEqual(alice.sequence.blocks(), [
      { block: first.id, text: 'abc' },
      { block: pageBlock.id, text: '' },
    ]);
    assert.deepEqual(merge(base, [pageBlock, c]), ['abc', '']);
  });

  test('a block inserted at the start of the page comes before the others', () => {
    const { alice, base } = page('x');

    const a = alice.block(null);

    assert.deepEqual(merge(base, [a]), ['', 'x']);
  });

  test('a character is a code point, so an emoji outside the BMP takes one id', () => {
    const { alice, base, typed } = page('a😀b');
    const [text] = typed;
    assert.ok(text);

    const a = alice.erase(char(text, 1));

    assert.deepEqual(merge(base, [a]), ['ab']);
  });

  test('an operation received twice takes effect once', () => {
    const { alice, base, typed } = page('ab');
    const [ab] = typed;
    assert.ok(ab);

    const a = alice.type(char(ab, 0), 'X');
    const b = alice.block(char(ab, 0));

    assert.deepEqual(merge(base, [a, b, a, b]), ['a', 'Xb']);
  });

  test('an operation that names an element the sequence does not hold throws', () => {
    const { alice, blocks } = page('ab');
    const [block] = blocks;
    assert.ok(block);
    const sequence = alice.sequence;
    const unknown = { replica: 7, counter: 1 };

    assert.throws(() => sequence.insertText({ replica: 1, counter: 50 }, { parent: unknown, side: 'right' }, 'x'));
    assert.throws(() => sequence.deleteText([{ ...unknown, length: 1 }]));
    assert.throws(() => sequence.deleteText([{ ...block.id, length: 1 }]), 'a marker is not a character');
    assert.throws(() => sequence.deleteBlock(unknown));
    assert.deepEqual(sequence.blocks(), [{ block: block.id, text: 'ab' }]);
  });

  test('a deletion that names an element the sequence does not hold deletes nothing', () => {
    const { alice, typed } = page('ab');
    const [ab] = typed;
    assert.ok(ab);

    assert.throws(() => alice.sequence.deleteText([{ ...char(ab, 0), length: 1 }, { replica: 7, counter: 1, length: 1 }]));
    assert.deepEqual(
      alice.sequence.blocks().map((block) => block.text),
      ['ab'],
    );
  });
});
