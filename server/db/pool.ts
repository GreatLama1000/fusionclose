import { Pool, PoolClient, QueryResult, QueryResultRow, types } from 'pg';
import { config } from '../config';

// `date` columns come back as 'yyyy-mm-dd' strings, not timezone-shifted JS Dates
types.setTypeParser(types.builtins.DATE, (v: string) => v);

export const pool = new Pool({ connectionString: config.databaseUrl, max: config.poolMax });

/** Anything that can run a query: the pool, or a client inside a transaction. */
export interface Queryable {
  query<R extends QueryResultRow = any>(text: string, params?: unknown[]): Promise<QueryResult<R>>;
}

/** Run `fn` in a single transaction; commits on success, rolls back on throw. */
export async function withTransaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
