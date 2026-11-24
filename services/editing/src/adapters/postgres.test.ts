import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { Client } from 'pg';
import { migrate } from './postgres.ts';
import { createTestDatabase } from './test-database.ts';

// Integration test against a real PostgreSQL: TEST_DATABASE_URL names a server where the test may create and drop a database.
const server = process.env.TEST_DATABASE_URL;

test('two instances starting on an empty database apply each migration once', { skip: !server && 'TEST_DATABASE_URL is not set' }, async () => {
  const { url, drop } = await createTestDatabase(server!);
  after(drop);

  // A migration that fails if it runs twice, and a pause so that the second instance arrives while the first is migrating.
  const dir = mkdtempSync(join(tmpdir(), 'editing-migrations-'));
  writeFileSync(join(dir, '1_first.sql'), '-- Up Migration\nSELECT pg_sleep(0.5);\nCREATE TABLE first (id int);\n');
  const silent = { debug() {}, info() {}, warn() {}, error() {} };

  await Promise.all([migrate(url, dir, silent), migrate(url, dir, silent)]);

  const db = new Client(url);
  await db.connect();
  const { rows } = await db.query('SELECT name FROM pgmigrations');
  await db.end();
  assert.deepEqual(rows, [{ name: '1_first' }]);
});
