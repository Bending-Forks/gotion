import { randomBytes } from 'node:crypto';
import { Client } from 'pg';

// For the integration tests: creates an empty database on `server`, the TEST_DATABASE_URL, and returns its URL with the function that drops it.
export async function createTestDatabase(server: string): Promise<{ url: string; drop: () => Promise<void> }> {
  const admin = new Client(server);
  await admin.connect();
  const name = `editing_test_${randomBytes(6).toString('hex')}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(server);
  url.pathname = `/${name}`;
  // Without FORCE, which would kill the sessions a pool is still closing (pool.end() resolves before they are gone): PostgreSQL waits up to 5 s for them to exit.
  const drop = async () => {
    await admin.query(`DROP DATABASE ${name}`);
    await admin.end();
  };
  return { url: url.href, drop };
}
