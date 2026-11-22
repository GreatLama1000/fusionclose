import type { Queryable } from '../db/pool';

/**
 * Data layer for the Command Center. Reads legal_entity_master and engagement_config and returns
 * raw facts (counts, depth, timestamps) aggregated in SQL. SQL only — statuses and percentages
 * are worked out in server/services/commandCenterService.ts.
 */

/** Stage 1 (Engagement Setup) facts for one engagement, straight from the database */
export type SetupFacts = {
  entityCount: number;
  /** entities with consolidation method "Deconsolidated" or a disposal date on/before today */
  deconsolidatedCount: number;
  /** distinct LE Names in engagement_config that still exist in legal_entity_master */
  configuredCount: number;
  /** entities with no parent */
  rootCount: number;
  /** LE Names of up to two top-level entities (enough to tell "exactly one" from "several") */
  rootNames: string[];
  /** depth of the deepest parent chain, 1 = only top-level entities, 0 = no entities */
  levels: number;
  /** latest updated_at across both tables, ISO timestamp */
  lastUpdatedAt: string | null;
};

type Row = {
  entity_count: number; deconsolidated_count: number; configured_count: number; root_count: number;
  root_names: string[] | null; levels: number; last_updated_at: Date | null;
};

/* parent_code is guarded by an FK and a self-reference CHECK, and the service refuses cycles on write;
   the depth cap only stops a recursive walk if a legacy row ever forms a loop. */
const SETUP_FACTS_SQL = `
WITH RECURSIVE
  le AS (
    SELECT le_code, le_name, parent_code, consolidation_method, disposal_date, updated_at
      FROM legal_entity_master
     WHERE engagement_id = $1
  ),
  tree AS (
    SELECT le_code, 1 AS depth FROM le WHERE parent_code IS NULL
    UNION ALL
    SELECT c.le_code, t.depth + 1
      FROM le c JOIN tree t ON c.parent_code = t.le_code
     WHERE t.depth < 100
  ),
  cfg AS (
    SELECT DISTINCT c.le_name, c.updated_at
      FROM engagement_config c
     WHERE c.engagement_id = $1
       AND EXISTS (SELECT 1 FROM le WHERE le.le_name = c.le_name)
  )
SELECT
  (SELECT count(*)::int FROM le)                                                        AS entity_count,
  (SELECT count(*)::int FROM le
    WHERE consolidation_method = 'Deconsolidated'
       OR (disposal_date IS NOT NULL AND disposal_date <= current_date))               AS deconsolidated_count,
  (SELECT count(DISTINCT le_name)::int FROM cfg)                                        AS configured_count,
  (SELECT count(*)::int FROM le WHERE parent_code IS NULL)                              AS root_count,
  (SELECT array_agg(le_name ORDER BY le_code)
     FROM (SELECT le_name, le_code FROM le WHERE parent_code IS NULL ORDER BY le_code LIMIT 2) r) AS root_names,
  (SELECT COALESCE(max(depth), 0)::int FROM tree)                                       AS levels,
  GREATEST(
    (SELECT max(updated_at) FROM le),
    (SELECT max(updated_at) FROM engagement_config WHERE engagement_id = $1)
  )                                                                                     AS last_updated_at
`;

export class CommandCenterRepository {
  async setupFacts(db: Queryable, engagementId: string): Promise<SetupFacts> {
    const { rows } = await db.query<Row>(SETUP_FACTS_SQL, [engagementId]);
    const r = rows[0];
    return {
      entityCount: r.entity_count,
      deconsolidatedCount: r.deconsolidated_count,
      configuredCount: r.configured_count,
      rootCount: r.root_count,
      rootNames: r.root_names ?? [],
      levels: r.levels,
      lastUpdatedAt: r.last_updated_at ? r.last_updated_at.toISOString() : null,
    };
  }
}
