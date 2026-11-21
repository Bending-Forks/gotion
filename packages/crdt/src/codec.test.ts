import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  BLOCK_TYPES,
  characterCount,
  CLOSE_CODES,
  decodeBlockContent,
  decodeClientMessage,
  decodeOperation,
  decodeServerMessage,
  encodeClientMessage,
  encodeOperation,
  encodeServerMessage,
  MARKS,
  ProtocolError,
  UnsupportedVersionError,
  type BlockContent,
  type BlockType,
  type ClientMessage,
  type Operation,
  type ServerMessage,
} from './index.ts';

// One sample of each type of block, operation and message. The mapped types make `tsc` fail when
// a new type has no sample, so every type goes through the tests below.

const contents: { readonly [T in BlockType]: Extract<BlockContent, { type: T }> } = {
  text: { type: 'text' },
  heading: { type: 'heading', level: 2 },
  bulletedList: { type: 'bulletedList' },
  numberedList: { type: 'numberedList' },
  toDo: { type: 'toDo', checked: false },
  code: { type: 'code', language: 'python' },
  pageBlock: { type: 'pageBlock', subPage: 'workspace-1/page-2' },
};

const operations: { readonly [T in Operation['type']]: Extract<Operation, { type: T }> } = {
  insertBlock: {
    type: 'insertBlock',
    version: 1,
    id: { replica: 2, counter: 7 },
    at: { parent: { replica: 1, counter: 5 }, side: 'right' },
    place: { parent: null, key: 'a0V' },
    content: { type: 'heading', level: 2 },
  },
  updateBlock: {
    type: 'updateBlock',
    version: 1,
    id: { replica: 2, counter: 8 },
    block: { replica: 2, counter: 7 },
    content: { type: 'toDo', checked: true },
  },
  moveBlock: {
    type: 'moveBlock',
    version: 1,
    id: { replica: 3, counter: 9 },
    block: { replica: 2, counter: 7 },
    place: { parent: { replica: 1, counter: 1 }, key: 'Zz' },
  },
  deleteBlock: { type: 'deleteBlock', version: 1, id: { replica: 3, counter: 10 }, block: { replica: 2, counter: 7 } },
  joinBlock: { type: 'joinBlock', version: 1, id: { replica: 3, counter: 11 }, block: { replica: 2, counter: 7 } },
  insertText: {
    type: 'insertText',
    version: 1,
    id: { replica: 1, counter: 12 },
    at: { parent: { replica: 2, counter: 7 }, side: 'right' },
    text: 'Ciao 👋\nmondo\t!',
  },
  deleteText: {
    type: 'deleteText',
    version: 1,
    id: { replica: 1, counter: 30 },
    ranges: [
      { replica: 1, counter: 12, length: 4 },
      { replica: 2, counter: 20, length: 1 },
    ],
  },
};

const clientMessages: { readonly [T in ClientMessage['type']]: Extract<ClientMessage, { type: T }> } = {
  joinSession: { type: 'joinSession', version: 1 },
  leaveSession: { type: 'leaveSession' },
  submitEdit: { type: 'submitEdit', operation: operations.insertText },
};

const serverMessages: { readonly [T in ServerMessage['type']]: Extract<ServerMessage, { type: T }> } = {
  sessionJoined: {
    type: 'sessionJoined',
    replica: 4,
    seq: 2,
    snapshot: { operations: [operations.insertBlock, operations.insertText] },
  },
  ack: { type: 'ack', id: { replica: 1, counter: 12 }, seq: 412 },
  refused: { type: 'refused', ids: [{ replica: 1, counter: 12 }, { replica: 1, counter: 30 }], reason: 'invalid' },
  relayed: { type: 'relayed', seq: 413, operation: operations.moveBlock },
  presence: { type: 'presence', collaborators: ['alice', 'bob'] },
  sessionClosed: { type: 'sessionClosed' },
};

// Variants that the samples above do not cover: optional fields left out or set, the other values
// of an enumeration, every operation and every content inside a message.
const otherClientMessages: readonly ClientMessage[] = [
  { type: 'joinSession', version: 1, rejoin: { replica: 4, seq: 0 } },
  { type: 'joinSession', version: 1, rejoin: { replica: 4, seq: 413 } },
  ...Object.values(operations).map((operation): ClientMessage => ({ type: 'submitEdit', operation })),
  ...[...Object.values(contents), { type: 'code' } as const].map(
    (content): ClientMessage => ({ type: 'submitEdit', operation: { ...operations.updateBlock, content } }),
  ),
  {
    type: 'submitEdit',
    operation: { ...operations.insertText, at: { parent: null, side: 'right' } },
  },
  {
    type: 'submitEdit',
    operation: { ...operations.insertText, at: { parent: { replica: 1, counter: 3 }, side: 'left' } },
  },
];

const otherServerMessages: readonly ServerMessage[] = [
  { type: 'sessionJoined', replica: 4, seq: 413 },
  { type: 'sessionJoined', replica: 1, seq: 0, snapshot: { operations: [] } },
  { type: 'refused', ids: [{ replica: 1, counter: 12 }], reason: 'forbidden' },
  { type: 'refused', ids: [{ replica: 1, counter: 12 }], reason: 'unavailable' },
  { type: 'presence', collaborators: [] },
];

const allClientMessages = [...Object.values(clientMessages), ...otherClientMessages];
const allServerMessages = [...Object.values(serverMessages), ...otherServerMessages];

describe('the block schema', () => {
  test('has the types of block of US-07 and the page block', () => {
    assert.deepEqual(BLOCK_TYPES, Object.keys(contents));
  });

  test('has the styles Markdown can express', () => {
    assert.deepEqual(MARKS, ['bold', 'italic', 'code', 'strikethrough', 'link']);
  });

  // The JSON of each content as the session log keeps it, inside the operations.
  const stored: { readonly [T in BlockType]: string } = {
    text: '{"type":"text"}',
    heading: '{"type":"heading","level":2}',
    bulletedList: '{"type":"bulletedList"}',
    numberedList: '{"type":"numberedList"}',
    toDo: '{"type":"toDo","checked":false}',
    code: '{"type":"code","language":"python"}',
    pageBlock: '{"type":"pageBlock","subPage":"workspace-1/page-2"}',
  };

  for (const type of BLOCK_TYPES) {
    test(`writes and reads ${type} as the session log keeps it`, () => {
      assert.equal(JSON.stringify(decodeBlockContent(contents[type], 'content')), stored[type]);
      assert.deepEqual(decodeBlockContent(JSON.parse(stored[type]), 'content'), contents[type]);
    });
  }

  test('writes and reads a code block without a language as the session log keeps it', () => {
    assert.deepEqual(decodeBlockContent(JSON.parse('{"type":"code"}'), 'content'), { type: 'code' });
  });
});

describe('every message', () => {
  for (const message of allClientMessages) {
    test(`from the client reads back as it was written: ${encodeClientMessage(message)}`, () => {
      assert.deepEqual(decodeClientMessage(encodeClientMessage(message)), message);
    });
  }

  for (const message of allServerMessages) {
    test(`from Editing reads back as it was written: ${encodeServerMessage(message)}`, () => {
      assert.deepEqual(decodeServerMessage(encodeServerMessage(message)), message);
    });
  }
});

// The copies of a message with one field too many or one required field too few, at every level.
type Path = readonly (string | number)[];
const OPTIONAL_FIELDS = new Set(['language', 'rejoin', 'snapshot']);

function mutants(root: unknown): [string, unknown][] {
  const result: [string, unknown][] = [];
  const visit = (node: unknown, path: Path): void => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, [...path, index]));
      return;
    }
    if (typeof node !== 'object' || node === null) {
      return;
    }
    result.push([`${['message', ...path].join('.')} with an unknown field`, edit(root, path, (copy) => ({ ...copy, unknown: 1 }))]);
    for (const [key, child] of Object.entries(node)) {
      if (!OPTIONAL_FIELDS.has(key)) {
        result.push([
          `${['message', ...path, key].join('.')} left out`,
          edit(root, path, (copy) => Object.fromEntries(Object.entries(copy).filter(([field]) => field !== key))),
        ]);
      }
      visit(child, [...path, key]);
    }
  };
  visit(root, []);
  return result;
}

function edit(root: unknown, path: Path, change: (node: object) => object): unknown {
  const copy: unknown = structuredClone(root);
  if (path.length === 0) {
    return change(copy as object);
  }
  let parent = copy as Record<string | number, unknown>;
  for (const step of path.slice(0, -1)) {
    parent = parent[step] as Record<string | number, unknown>;
  }
  const last = path[path.length - 1] as string | number;
  parent[last] = change(parent[last] as object);
  return copy;
}

describe('every message is refused with a field too many or a required field too few', () => {
  const sides: [string, readonly unknown[], (json: string) => unknown][] = [
    ['from the client', allClientMessages, decodeClientMessage],
    ['from Editing', allServerMessages, decodeServerMessage],
  ];
  for (const [side, messages, decode] of sides) {
    for (const message of messages) {
      test(`${side}: ${JSON.stringify(message)}`, () => {
        for (const [what, mutant] of mutants(message)) {
          assert.throws(() => decode(JSON.stringify(mutant)), ProtocolError, what);
        }
      });
    }
  }
});

describe('every operation', () => {
  // The JSON of the operations as the session log keeps it. It outlives the version of the protocol
  // that wrote it (ADR-02), so a change here is a change of the protocol and needs a new version.
  const stored: { readonly [T in Operation['type']]: string } = {
    insertBlock:
      '{"type":"insertBlock","version":1,"id":{"replica":2,"counter":7},"at":{"parent":{"replica":1,"counter":5},"side":"right"},"place":{"parent":null,"key":"a0V"},"content":{"type":"heading","level":2}}',
    updateBlock:
      '{"type":"updateBlock","version":1,"id":{"replica":2,"counter":8},"block":{"replica":2,"counter":7},"content":{"type":"toDo","checked":true}}',
    moveBlock:
      '{"type":"moveBlock","version":1,"id":{"replica":3,"counter":9},"block":{"replica":2,"counter":7},"place":{"parent":{"replica":1,"counter":1},"key":"Zz"}}',
    deleteBlock: '{"type":"deleteBlock","version":1,"id":{"replica":3,"counter":10},"block":{"replica":2,"counter":7}}',
    joinBlock: '{"type":"joinBlock","version":1,"id":{"replica":3,"counter":11},"block":{"replica":2,"counter":7}}',
    insertText:
      '{"type":"insertText","version":1,"id":{"replica":1,"counter":12},"at":{"parent":{"replica":2,"counter":7},"side":"right"},"text":"Ciao 👋\\nmondo\\t!"}',
    deleteText:
      '{"type":"deleteText","version":1,"id":{"replica":1,"counter":30},"ranges":[{"replica":1,"counter":12,"length":4},{"replica":2,"counter":20,"length":1}]}',
  };

  for (const [type, json] of Object.entries(stored) as [Operation['type'], string][]) {
    test(`${type} is written and read as the session log keeps it`, () => {
      assert.equal(encodeOperation(operations[type]), json);
      assert.deepEqual(decodeOperation(JSON.parse(json)), operations[type]);
    });
  }

  test('is written with its fields in the same order, however it was built', () => {
    const shuffled = Object.fromEntries(Object.entries(operations.insertBlock).reverse()) as Operation;
    assert.equal(encodeOperation(shuffled), stored.insertBlock);
  });

  test('is checked before it is written', () => {
    const extra = { ...operations.deleteBlock, local: true };
    assert.throws(() => encodeOperation(extra), ProtocolError);
    assert.throws(() => encodeOperation({ ...operations.deleteBlock, id: { replica: 1, counter: 0 } }), ProtocolError);
    assert.throws(
      () => encodeClientMessage({ type: 'submitEdit', operation: { ...operations.insertText, text: '' } }),
      ProtocolError,
    );
    assert.throws(() => encodeServerMessage({ type: 'presence', collaborators: ['alice', 'alice'] }), ProtocolError);
  });
});

describe('the version of the protocol', () => {
  const unsupported = (path: string) => (error: unknown) =>
    error instanceof UnsupportedVersionError && error.path === path && error.version === 2;

  test('of a newer client is told apart from a malformed message, whatever else it holds', () => {
    assert.throws(
      () => decodeClientMessage(JSON.stringify({ type: 'joinSession', version: 2, capabilities: ['marks'] })),
      unsupported('message.version'),
    );
  });

  test('of a newer operation is told apart, whatever its type', () => {
    assert.throws(
      () => decodeClientMessage(JSON.stringify({ type: 'submitEdit', operation: { type: 'setMark', version: 2 } })),
      unsupported('message.operation.version'),
    );
    assert.throws(() => decodeOperation({ ...operations.joinBlock, version: 2 }), unsupported('operation.version'));
  });

  test('of a newer operation relayed or in a snapshot is told apart', () => {
    const newer = { type: 'setMark', version: 2 };
    assert.throws(
      () => decodeServerMessage(JSON.stringify({ type: 'relayed', seq: 1, operation: newer })),
      unsupported('message.operation.version'),
    );
    assert.throws(
      () => decodeServerMessage(JSON.stringify({ type: 'sessionJoined', replica: 1, seq: 1, snapshot: { operations: [newer] } })),
      unsupported('message.snapshot.operations[0].version'),
    );
  });

  test('that is not a positive integer makes the message malformed', () => {
    for (const version of [0, '1', 1.5, null]) {
      assert.throws(
        () => decodeOperation({ ...operations.joinBlock, version }),
        (error: unknown) =>
          error instanceof ProtocolError && !(error instanceof UnsupportedVersionError) && error.path === 'operation.version',
      );
    }
  });
});

describe('the characters of a text', () => {
  test('are its code points, so an emoji of one code point is one character', () => {
    assert.equal(characterCount('Ciao 👋\nmondo'), 12);
    assert.equal(characterCount('👋'), 1);
    assert.equal(characterCount('🇮🇹'), 2);
    assert.equal(characterCount(''), 0);
  });
});

describe('a position key', () => {
  const move = (key: string): string =>
    JSON.stringify({ type: 'submitEdit', operation: { ...operations.moveBlock, place: { parent: null, key } } });

  test('is read in the format of fractional indexing', () => {
    for (const key of ['a0', 'a0V', 'Zz', 'zzzzzzzzzzzzzzzzzzzzzzzzzzz', 'A00000000000000000000000001', 'b00V']) {
      assert.doesNotThrow(() => decodeClientMessage(move(key)), key);
    }
  });

  test('is refused out of that format', () => {
    const invalid = ['', 'a', 'b0', '0a', 'a-0', 'a00', 'a0V0', 'é0', `A${'0'.repeat(26)}`];
    for (const key of invalid) {
      assert.throws(
        () => decodeClientMessage(move(key)),
        (error: unknown) => error instanceof ProtocolError && error.path === 'message.operation.place.key',
        JSON.stringify(key),
      );
    }
  });
});

describe('the close codes', () => {
  test('are distinct and in the range WebSocket leaves to applications', () => {
    const codes = Object.values(CLOSE_CODES);
    assert.equal(new Set(codes).size, codes.length);
    for (const code of codes) {
      assert.ok(code >= 4000 && code <= 4999, String(code));
    }
  });
});

// Reading a message that does not follow the protocol fails with a ProtocolError that names where.
function refuses(decode: (json: string) => unknown, value: unknown, path: string): void {
  const json = typeof value === 'string' ? value : JSON.stringify(value);
  assert.throws(
    () => decode(json),
    (error: unknown) => error instanceof ProtocolError && error.path === path,
    `expected a ProtocolError at ${path} for ${json}`,
  );
}

const submit = (operation: unknown): unknown => ({ type: 'submitEdit', operation });
const update = (content: unknown): unknown => submit({ ...operations.updateBlock, content });
const self = { replica: 1, counter: 50 };

describe('a message from the client is refused when', () => {
  const cases: readonly [string, unknown, string][] = [
    ['it is not JSON', '{"type":', 'message'],
    ['it is not an object', '[]', 'message'],
    ['it is null', 'null', 'message'],
    ['it has no type', {}, 'message.type'],
    ['its type is one of Editing', { type: 'ack' }, 'message.type'],
    ['it has a field its type does not have', { type: 'leaveSession', seq: 1 }, 'message'],
    ['it has a __proto__ field', '{"type":"leaveSession","__proto__":{}}', 'message'],
    ['a join lacks the version', { type: 'joinSession' }, 'message.version'],
    ['a rejoin is null', { type: 'joinSession', version: 1, rejoin: null }, 'message.rejoin'],
    ['a rejoin has replica 0', { type: 'joinSession', version: 1, rejoin: { replica: 0, seq: 0 } }, 'message.rejoin.replica'],
    ['a rejoin has a negative seq', { type: 'joinSession', version: 1, rejoin: { replica: 1, seq: -1 } }, 'message.rejoin.seq'],
    ['a submission has no operation', { type: 'submitEdit' }, 'message'],
    ['an operation has no version', submit({ ...operations.deleteBlock, version: undefined }), 'message.operation.version'],
    ['an operation type is unknown', submit({ ...operations.deleteBlock, type: 'splitBlock' }), 'message.operation.type'],
    ['a counter is 0', submit({ ...operations.deleteBlock, id: { replica: 1, counter: 0 } }), 'message.operation.id.counter'],
    ['a counter is not an integer', submit({ ...operations.deleteBlock, id: { replica: 1, counter: 1.5 } }), 'message.operation.id.counter'],
    ['a counter is not safe', submit({ ...operations.deleteBlock, id: { replica: 1, counter: 2 ** 53 } }), 'message.operation.id.counter'],
    ['a replica is a string', submit({ ...operations.deleteBlock, block: { replica: '1', counter: 1 } }), 'message.operation.block.replica'],
    ['a block refers to the operation itself', submit({ ...operations.deleteBlock, id: self, block: self }), 'message.operation.block'],
    ['a block comes after the operation', submit({ ...operations.joinBlock, id: self, block: { replica: 2, counter: 51 } }), 'message.operation.block'],
    ['a block is updated by an older operation', submit({ ...operations.updateBlock, id: self, block: { replica: 2, counter: 60 } }), 'message.operation.block'],
    ['a block is moved under itself', submit({ ...operations.moveBlock, id: self, place: { parent: self, key: 'a0' } }), 'message.operation.place.parent'],
    ['a block is inserted after its own marker', submit({ ...operations.insertBlock, id: self, at: { parent: self, side: 'right' } }), 'message.operation.at.parent'],
    ['a block is inserted under itself', submit({ ...operations.insertBlock, id: self, place: { parent: self, key: 'a0' } }), 'message.operation.place.parent'],
    ['a text is inserted after itself', submit({ ...operations.insertText, id: self, at: { parent: self, side: 'right' } }), 'message.operation.at.parent'],
    ['a range reaches the operation', submit({ ...operations.deleteText, id: self, ranges: [{ replica: 1, counter: 45, length: 6 }] }), 'message.operation.ranges[0]'],
    ['a range comes after the operation', submit({ ...operations.deleteText, id: self, ranges: [{ replica: 2, counter: 70, length: 1 }] }), 'message.operation.ranges[0]'],
    ['a side is neither left nor right', submit({ ...operations.insertText, at: { parent: null, side: 'up' } }), 'message.operation.at.side'],
    ['a text goes to the left of the root', submit({ ...operations.insertText, at: { parent: null, side: 'left' } }), 'message.operation.at.side'],
    ['a sequence position lacks its parent', submit({ ...operations.insertText, at: { side: 'right' } }), 'message.operation.at'],
    ['a text is empty', submit({ ...operations.insertText, text: '' }), 'message.operation.text'],
    ['a text has NUL', submit({ ...operations.insertText, text: 'a\u0000b' }), 'message.operation.text'],
    ['a text has a carriage return', submit({ ...operations.insertText, text: 'a\r\nb' }), 'message.operation.text'],
    ['a text has a C1 control character', submit({ ...operations.insertText, text: 'a\u0085b' }), 'message.operation.text'],
    ['a text has a line separator', submit({ ...operations.insertText, text: 'a\u2028b' }), 'message.operation.text'],
    ['a text has half of a surrogate pair', submit({ ...operations.insertText, text: 'a\uD83D' }), 'message.operation.text'],
    [
      'a text takes counters past the largest safe integer',
      submit({ ...operations.insertText, id: { replica: 1, counter: Number.MAX_SAFE_INTEGER }, text: 'ab' }),
      'message.operation.text',
    ],
    ['a deletion has no range', submit({ ...operations.deleteText, ranges: [] }), 'message.operation.ranges'],
    ['a range has length 0', submit({ ...operations.deleteText, ranges: [{ replica: 1, counter: 1, length: 0 }] }), 'message.operation.ranges[0].length'],
    ['a content type is unknown', update({ type: 'quote' }), 'message.operation.content.type'],
    ['a content has a field its type does not have', update({ type: 'text', level: 1 }), 'message.operation.content'],
    ['a content has text', update({ type: 'text', text: 'Hello' }), 'message.operation.content'],
    ['a heading has level 7', update({ type: 'heading', level: 7 }), 'message.operation.content.level'],
    ['a heading has level 0', update({ type: 'heading', level: 0 }), 'message.operation.content.level'],
    ['a heading has level "2"', update({ type: 'heading', level: '2' }), 'message.operation.content.level'],
    ['a heading lacks its level', update({ type: 'heading' }), 'message.operation.content'],
    ['a to-do lacks its checkbox', update({ type: 'toDo' }), 'message.operation.content'],
    ['a to-do checkbox is not a boolean', update({ type: 'toDo', checked: 'yes' }), 'message.operation.content.checked'],
    ['a code language is empty', update({ type: 'code', language: '' }), 'message.operation.content.language'],
    ['a code language has a space', update({ type: 'code', language: 'objective c' }), 'message.operation.content.language'],
    ['a code language has a backtick', update({ type: 'code', language: 'py`' }), 'message.operation.content.language'],
    ['a code language has NUL', update({ type: 'code', language: 'py\u0000' }), 'message.operation.content.language'],
    ['a code language has half of a surrogate pair', update({ type: 'code', language: 'py\uD800' }), 'message.operation.content.language'],
    ['a page block has an empty sub-page', update({ type: 'pageBlock', subPage: '' }), 'message.operation.content.subPage'],
    ['a page block has a control character in its sub-page', update({ type: 'pageBlock', subPage: 'p\u0001' }), 'message.operation.content.subPage'],
    ['a page block has a field too many', update({ type: 'pageBlock', subPage: 'p', title: 'T' }), 'message.operation.content'],
  ];

  for (const [name, value, path] of cases) {
    test(name, () => refuses(decodeClientMessage, value, path));
  }
});

describe('a message from Editing is refused when', () => {
  const cases: readonly [string, unknown, string][] = [
    ['its type is one of the client', { type: 'joinSession', version: 1 }, 'message.type'],
    ['an ack has seq 0', { type: 'ack', id: { replica: 1, counter: 1 }, seq: 0 }, 'message.seq'],
    ['an ack lacks the id', { type: 'ack', seq: 1 }, 'message'],
    ['a relayed operation has seq 0', { type: 'relayed', seq: 0, operation: operations.deleteBlock }, 'message.seq'],
    ['a join answer has replica 0', { type: 'sessionJoined', replica: 0, seq: 0 }, 'message.replica'],
    ['a join answer lacks the seq', { type: 'sessionJoined', replica: 1 }, 'message'],
    ['a snapshot is null', { type: 'sessionJoined', replica: 1, seq: 0, snapshot: null }, 'message.snapshot'],
    [
      'a snapshot holds a bad operation',
      { type: 'sessionJoined', replica: 1, seq: 1, snapshot: { operations: [{ type: 'leaveSession', version: 1 }] } },
      'message.snapshot.operations[0].type',
    ],
    ['a refusal lists no operation', { type: 'refused', ids: [], reason: 'invalid' }, 'message.ids'],
    ['a refusal has an unknown reason', { type: 'refused', ids: [{ replica: 1, counter: 1 }], reason: 'busy' }, 'message.reason'],
    ['a presence lists a user twice', { type: 'presence', collaborators: ['alice', 'alice'] }, 'message.collaborators'],
    ['a presence lists an empty user', { type: 'presence', collaborators: [''] }, 'message.collaborators[0]'],
    ['a presence carries cursors', { type: 'presence', collaborators: [], cursors: [] }, 'message'],
    ['a closed session carries a reason', { type: 'sessionClosed', reason: 'deleted' }, 'message'],
  ];

  for (const [name, value, path] of cases) {
    test(name, () => refuses(decodeServerMessage, value, path));
  }
});

describe('an operation of the session log is refused when', () => {
  test('it is not an object', () => {
    assert.throws(
      () => decodeOperation('insertText'),
      (error: unknown) => error instanceof ProtocolError && error.path === 'operation',
    );
  });
});
