import { encodeOperation } from '@gotion/crdt';
import type { Pool } from 'pg';
import { LogExtendedError, type SessionLog } from '../app/session-log.ts';

// The Log store: the session log in the table `session_log` of the database of Editing.
export function createSessionLog(pool: Pool): SessionLog {
  return {
    async lastSeq(page) {
      // bigint comes back as a string; a seq stays far below 2^53.
      const { rows } = await pool.query<{ seq: string }>('SELECT coalesce(max(seq), 0) AS seq FROM session_log WHERE page_id = $1', [page]);
      return Number(rows[0]!.seq);
    },

    // One INSERT outside BEGIN is a transaction of its own, which PostgreSQL commits, and with the default synchronous_commit flushes to disk, before it answers: the promise resolves only once the append is durable. The primary key refuses a seq already taken with a unique violation.
    async append(page, seq, operation) {
      try {
        await pool.query('INSERT INTO session_log (page_id, seq, operation) VALUES ($1, $2, $3)', [page, seq, encodeOperation(operation)]);
      } catch (err) {
        if ((err as { code?: unknown }).code === '23505') throw new LogExtendedError(page, seq);
        throw err;
      }
    },
  };
}
