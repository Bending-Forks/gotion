import type { FastifyBaseLogger } from 'fastify';
import { runner, type RunnerOption } from 'node-pg-migrate';
import { Pool } from 'pg';

// The pool of connections to the database of Editing. A connection that drops while idle, because PostgreSQL restarted, is logged and replaced: without the listener its error would stop the process.
export function createPool(databaseUrl: string, log: FastifyBaseLogger): Pool {
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2000 });
  pool.on('error', (err) => log.warn({ err }, 'idle database connection lost'));
  return pool;
}

// Runs the migrations of Editing not yet applied (ADR-06). node-pg-migrate holds a PostgreSQL advisory lock while it migrates, and with `wait` an instance that starts at the same time as another waits for it, then finds the migrations applied, so none runs twice.
export async function migrate(databaseUrl: string, dir: string, logger: NonNullable<RunnerOption['logger']>): Promise<void> {
  await runner({ databaseUrl, dir, direction: 'up', migrationsTable: 'pgmigrations', advisoryLockMode: 'wait', logger });
}
