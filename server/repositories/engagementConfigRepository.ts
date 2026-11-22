import type { EngagementConfigRecord, EngagementConfigValues } from '../../shared/engagementSetup';
import type { Queryable } from '../db/pool';

/**
 * Data layer for `engagement_config`. One row per (engagement, legal entity name); the answers are jsonb.
 * SQL only — validation lives in the service.
 */

type Row = {
  engagement_id: string; le_name: string; config: EngagementConfigValues; version: number;
  created_at: Date; updated_at: Date;
};

const toRecord = (r: Row): EngagementConfigRecord => ({
  engagementId: r.engagement_id,
  entityName: r.le_name,
  values: r.config,
  version: r.version,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

export class EngagementConfigRepository {
  async list(db: Queryable, engagementId: string): Promise<EngagementConfigRecord[]> {
    const { rows } = await db.query<Row>(
      'SELECT * FROM engagement_config WHERE engagement_id = $1 ORDER BY created_at, le_name',
      [engagementId],
    );
    return rows.map(toRecord);
  }

  /** Returns true when a row was deleted. */
  async delete(db: Queryable, engagementId: string, leName: string): Promise<boolean> {
    const { rowCount } = await db.query(
      'DELETE FROM engagement_config WHERE engagement_id = $1 AND le_name = $2',
      [engagementId, leName],
    );
    return (rowCount ?? 0) > 0;
  }

  /** Insert the row for this entity, or replace its answers (and bump `version`) if it already exists. */
  async upsert(db: Queryable, engagementId: string, leName: string, values: EngagementConfigValues): Promise<EngagementConfigRecord> {
    const { rows } = await db.query<Row>(
      `INSERT INTO engagement_config (engagement_id, le_name, config) VALUES ($1, $2, $3)
       ON CONFLICT (engagement_id, le_name) DO UPDATE
         SET config = EXCLUDED.config, version = engagement_config.version + 1, updated_at = now()
       RETURNING *`,
      [engagementId, leName, JSON.stringify(values)],
    );
    return toRecord(rows[0]);
  }
}
