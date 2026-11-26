import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { after, before, describe, test } from 'node:test';
import { decodeOperation, PROTOCOL_VERSION, type Operation } from '@gotion/crdt';
import { Client, Pool } from 'pg';
import { LogExtendedError, type SessionLog } from '../app/session-log.ts';
import { createSessionLog } from './log-store.ts';
import { migrate } from './postgres.ts';
import { createTestDatabase } from './database-fixture.ts';

// Integration test against a real PostgreSQL, with the migrations of Editing: TEST_DATABASE_URL names a server where the test may create and drop a database.
const server = process.env.TEST_DATABASE_URL;

const edit = (counter: number): Operation => ({ type: 'insertText', version: 1, id: { replica: 3, counter }, at: { parent: null, side: 'right' }, text: 'ciao' });

describe('the session log on PostgreSQL', { skip: !server && 'TEST_DATABASE_URL is not set' }, () => {
  let url: string;
  let pool: Pool;
  let log: SessionLog;
  let drop: () => Promise<void>;

  before(async () => {
    ({ url, drop } = await createTestDatabase(server!));
    const silent = { debug() {}, info() {}, warn() {}, error() {} };
    await migrate(url, fileURLToPath(new URL('../../migrations', import.meta.url)), silent);
    pool = new Pool({ connectionString: url });
    log = createSessionLog(pool);
  });
  after(async () => {
    await pool.end();
    await drop();
  });

  test('a second operation with the same seq of a page is refused', async () => {
    const page = crypto.randomUUID();
    await log.append(page, 1, edit(1));

    await assert.rejects(log.append(page, 1, edit(2)), LogExtendedError);

    const { rows } = await pool.query('SELECT seq, operation FROM session_log WHERE page_id = $1', [page]);
    assert.deepEqual(rows.map((r) => [r.seq, decodeOperation(r.operation)]), [['1', edit(1)]]);
    await log.append(crypto.randomUUID(), 1, edit(2));
  });

  test('an append is committed, with the version of the protocol, once it resolves', async () => {
    const page = crypto.randomUUID();
    await log.append(page, 1, edit(1));

    // A connection outside the pool sees only committed rows: the pool could hand back the very connection of the append.
    const reader = new Client(url);
    await reader.connect();
    const { rows } = await reader.query("SELECT operation->'version' AS version FROM session_log WHERE page_id = $1 AND seq = 1", [page]);
    await reader.end();
    assert.deepEqual(rows, [{ version: PROTOCOL_VERSION }]);
  });

  test('the last seq of a page is 0 until its first append', async () => {
    const page = crypto.randomUUID();
    assert.equal(await log.lastSeq(page), 0);
    await log.append(page, 1, edit(1));
    await log.append(page, 2, edit(2));
    assert.equal(await log.lastSeq(page), 2);
  });
});
