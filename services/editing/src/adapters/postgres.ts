import { runner, type RunnerOption } from 'node-pg-migrate';

type Logger = NonNullable<RunnerOption['logger']>;

// Runs the migrations of Editing not yet applied (ADR-06). node-pg-migrate holds a PostgreSQL advisory lock while it migrates, and with `wait` an instance that starts at the same time as another waits for it, then finds the migrations applied, so none runs twice.
export async function migrate(databaseUrl: string, dir: string, logger: Logger): Promise<void> {
  await runner({ databaseUrl, dir, direction: 'up', migrationsTable: 'pgmigrations', advisoryLockMode: 'wait', logger });
}
