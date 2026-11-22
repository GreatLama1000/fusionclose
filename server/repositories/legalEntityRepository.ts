import type { LegalEntity, LegalEntityInput, LegalEntityPatch } from '../../shared/engagementSetup';
import type { Queryable } from '../db/pool';

/** Data layer for `legal_entity_master`. SQL only — no validation or business rules (see services/). */

type Row = {
  id: string; engagement_id: string; le_code: string; le_name: string; parent_code: string | null;
  entity_type: string; country: string; ownership_direct_pct: string; ownership_indirect_pct: string;
  ownership_total_pct: string; nci_pct: string | null; consolidation_pct: string | null;
  consolidation_method: string; consolidation_structure: string | null; local_currency: string;
  functional_currency: string; reporting_currency: string; classification: string | null;
  fiscal_year_end: string; primary_gaap: string; secondary_gaap: string | null;
  acquisition_date: string | null; disposal_date: string | null; created_at: Date; updated_at: Date;
};

const num = (v: string | null) => (v === null ? null : Number(v));

const toEntity = (r: Row): LegalEntity => ({
  id: r.id,
  engagementId: r.engagement_id,
  code: r.le_code,
  name: r.le_name,
  parentCode: r.parent_code,
  entityType: r.entity_type,
  country: r.country,
  ownershipDirectPct: Number(r.ownership_direct_pct),
  ownershipIndirectPct: Number(r.ownership_indirect_pct),
  ownershipTotalPct: Number(r.ownership_total_pct),
  nciPct: num(r.nci_pct),
  consolidationPct: num(r.consolidation_pct),
  consolidationMethod: r.consolidation_method,
  consolidationStructure: r.consolidation_structure,
  localCurrency: r.local_currency,
  functionalCurrency: r.functional_currency,
  reportingCurrency: r.reporting_currency,
  classification: r.classification,
  fiscalYearEnd: r.fiscal_year_end,
  primaryGaap: r.primary_gaap,
  secondaryGaap: r.secondary_gaap,
  acquisitionDate: r.acquisition_date,
  disposalDate: r.disposal_date,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

/** entity property -> column. Single source for INSERT and UPDATE. */
const COLUMNS = {
  code: 'le_code',
  name: 'le_name',
  parentCode: 'parent_code',
  entityType: 'entity_type',
  country: 'country',
  ownershipDirectPct: 'ownership_direct_pct',
  ownershipIndirectPct: 'ownership_indirect_pct',
  ownershipTotalPct: 'ownership_total_pct',
  nciPct: 'nci_pct',
  consolidationPct: 'consolidation_pct',
  consolidationMethod: 'consolidation_method',
  consolidationStructure: 'consolidation_structure',
  localCurrency: 'local_currency',
  functionalCurrency: 'functional_currency',
  reportingCurrency: 'reporting_currency',
  classification: 'classification',
  fiscalYearEnd: 'fiscal_year_end',
  primaryGaap: 'primary_gaap',
  secondaryGaap: 'secondary_gaap',
  acquisitionDate: 'acquisition_date',
  disposalDate: 'disposal_date',
} as const;

type Writable = LegalEntityInput & { ownershipTotalPct: number };
const keys = Object.keys(COLUMNS) as (keyof typeof COLUMNS)[];

export class LegalEntityRepository {
  async list(db: Queryable, engagementId: string): Promise<LegalEntity[]> {
    const { rows } = await db.query<Row>(
      'SELECT * FROM legal_entity_master WHERE engagement_id = $1 ORDER BY created_at, le_code',
      [engagementId],
    );
    return rows.map(toEntity);
  }

  async findByCode(db: Queryable, engagementId: string, code: string): Promise<LegalEntity | null> {
    const { rows } = await db.query<Row>(
      'SELECT * FROM legal_entity_master WHERE engagement_id = $1 AND le_code = $2',
      [engagementId, code],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async insert(db: Queryable, engagementId: string, e: Writable): Promise<LegalEntity> {
    const cols = keys.map((k) => COLUMNS[k]);
    const placeholders = cols.map((_, i) => `$${i + 2}`);
    const { rows } = await db.query<Row>(
      `INSERT INTO legal_entity_master (engagement_id, ${cols.join(', ')})
       VALUES ($1, ${placeholders.join(', ')}) RETURNING *`,
      [engagementId, ...keys.map((k) => e[k])],
    );
    return toEntity(rows[0]);
  }

  /** Partial update; returns null when the entity does not exist. `code` is not patchable. */
  async update(
    db: Queryable,
    engagementId: string,
    code: string,
    patch: LegalEntityPatch & { ownershipTotalPct?: number },
  ): Promise<LegalEntity | null> {
    const sets: string[] = [];
    const params: unknown[] = [engagementId, code];
    for (const k of keys) {
      if (k === 'code' || !(k in patch)) continue;
      params.push((patch as Record<string, unknown>)[k]);
      sets.push(`${COLUMNS[k]} = $${params.length}`);
    }
    if (!sets.length) return this.findByCode(db, engagementId, code);
    const { rows } = await db.query<Row>(
      `UPDATE legal_entity_master SET ${sets.join(', ')}, updated_at = now()
       WHERE engagement_id = $1 AND le_code = $2 RETURNING *`,
      params,
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  /** Returns true when a row was deleted. The parent FK rejects deleting an entity that still has children. */
  async delete(db: Queryable, engagementId: string, code: string): Promise<boolean> {
    const { rowCount } = await db.query(
      'DELETE FROM legal_entity_master WHERE engagement_id = $1 AND le_code = $2',
      [engagementId, code],
    );
    return (rowCount ?? 0) > 0;
  }
}
