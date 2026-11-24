import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import type { Operation, PageId, ReplicaId, Seq, ServerMessage } from '@gotion/crdt';
import { LogExtendedError, PageLog, type Collaborators, type SessionLog } from './session-log.ts';

const page = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const edit = (counter: number): Operation => ({ type: 'insertText', version: 1, id: { replica: 2, counter }, at: { parent: null, side: 'right' }, text: 'a' });

// A session log whose appends commit only when the test says so, and collaborators that record what they are sent.
function fakes(lastSeq: Seq) {
  const commits: { seq: Seq; commit: () => void; refuse: () => void }[] = [];
  const log: SessionLog = {
    lastSeq: async () => lastSeq,
    append: (_page, seq) =>
      new Promise((resolve, reject) => commits.push({ seq, commit: resolve, refuse: () => reject(new LogExtendedError(page, seq)) })),
  };
  const sent: { replica: ReplicaId; message: ServerMessage }[] = [];
  const collaborators: Collaborators = { send: (_page: PageId, replica, message) => void sent.push({ replica, message }) };
  return { log, collaborators, commits, sent };
}

test('an operation is appended at the next seq of the page and acknowledged only once the append commits', async () => {
  const { log, collaborators, commits, sent } = fakes(41);
  const pageLog = await PageLog.open(page, log, collaborators);

  const appended = pageLog.append(edit(5));
  await setImmediate();
  assert.deepEqual(commits.map((c) => c.seq), [42]);
  assert.deepEqual(sent, [], 'no ack before the commit');

  commits[0]!.commit();
  assert.equal(await appended, 42);
  assert.deepEqual(sent, [{ replica: 2, message: { type: 'ack', id: { replica: 2, counter: 5 }, seq: 42 } }]);
  assert.equal(pageLog.seq, 42);
});

test('an append refused because another instance extended the log acknowledges nothing, now or later', async () => {
  const { log, collaborators, commits, sent } = fakes(0);
  const pageLog = await PageLog.open(page, log, collaborators);

  const first = pageLog.append(edit(1));
  await setImmediate();
  commits[0]!.refuse();
  await assert.rejects(first, LogExtendedError);

  const second = pageLog.append(edit(2));
  await setImmediate();
  commits[1]!.refuse();
  await assert.rejects(second, LogExtendedError);

  assert.deepEqual(commits.map((c) => c.seq), [1, 1], 'the stale instance never skips past the seq it found taken');
  assert.deepEqual(sent, []);
  assert.equal(pageLog.seq, 0);
});
