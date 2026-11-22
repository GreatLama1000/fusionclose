import type {
  ImportResult, LegalEntity, LegalEntityInput, LegalEntityPatch,
} from '../../shared/engagementSetup';
import { pool, withTransaction } from '../db/pool';
import { badRequest, conflict, notFound, translateDbError } from '../errors';
import { LegalEntityRepository } from '../repositories/legalEntityRepository';

/** Business rules for the Legal Entity Master step. All DB access goes through the repository. */

const MAX_IMPORT_ROWS = 2000;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function str(o: Record<string, unknown>, k: string, required: boolean, max = 200): string | null {
  const v = o[k];
  if (v === undefined || v === null || v === '') {
    if (required) throw badRequest(`${k} is required`);
    return null;
  }
  if (typeof v !== 'string') throw badRequest(`${k} must be a string`);
  const t = v.trim();
  if (!t && required) throw badRequest(`${k} is required`);
  if (t.length > max) throw badRequest(`${k} must be at most ${max} characters`);
  return t || null;
}

function pct(o: Record<string, unknown>, k: string, required: boolean): number | null {
  const v = o[k];
  if (v === undefined || v === null || v === '') {
    if (required) throw badRequest(`${k} is required`);
    return null;
  }
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) throw badRequest(`${k} must be a number between 0 and 100`);
  return v;
}

function date(o: Record<string, unknown>, k: string): string | null {
  const s = str(o, k, false, 10);
  if (s === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw badRequest(`${k} must be a yyyy-mm-dd date`);
  return s;
}

/** Validates an untrusted body into a full entity input. */
function parseInput(body: unknown): LegalEntityInput {
  if (!isObj(body)) throw badRequest('Body must be a JSON object');
  const input: LegalEntityInput = {
    code: str(body, 'code', true, 40)!,
    name: str(body, 'name', true)!,
    parentCode: str(body, 'parentCode', false, 40),
    entityType: str(body, 'entityType', true)!,
    country: str(body, 'country', true)!,
    ownershipDirectPct: pct(body, 'ownershipDirectPct', false) ?? 0,
    ownershipIndirectPct: pct(body, 'ownershipIndirectPct', false) ?? 0,
    nciPct: pct(body, 'nciPct', false),
    consolidationPct: pct(body, 'consolidationPct', false),
    consolidationMethod: str(body, 'consolidationMethod', true)!,
    consolidationStructure: str(body, 'consolidationStructure', false),
    localCurrency: str(body, 'localCurrency', true, 3)!,
    functionalCurrency: str(body, 'functionalCurrency', true, 3)!,
    reportingCurrency: str(body, 'reportingCurrency', true, 3)!,
    classification: str(body, 'classification', false),
    fiscalYearEnd: str(body, 'fiscalYearEnd', true, 20)!,
    primaryGaap: str(body, 'primaryGaap', true)!,
    secondaryGaap: str(body, 'secondaryGaap', false),
    acquisitionDate: date(body, 'acquisitionDate'),
    disposalDate: date(body, 'disposalDate'),
  };
  return input;
}

const PATCHABLE: (keyof LegalEntityInput)[] = [
  'name', 'parentCode', 'entityType', 'country', 'ownershipDirectPct', 'ownershipIndirectPct', 'nciPct',
  'consolidationPct', 'consolidationMethod', 'consolidationStructure', 'localCurrency', 'functionalCurrency',
  'reportingCurrency', 'classification', 'fiscalYearEnd', 'primaryGaap', 'secondaryGaap', 'acquisitionDate',
  'disposalDate',
];

/** Own. Total = Direct + Indirect (the grid's auto-computed column), capped at 100. */
const total = (direct: number, indirect: number) => Math.min(100, Number((direct + indirect).toFixed(6)));

function checkDates(e: { acquisitionDate: string | null; disposalDate: string | null }) {
  if (e.acquisitionDate && e.disposalDate && e.disposalDate < e.acquisitionDate) {
    throw badRequest('disposalDate cannot be before acquisitionDate');
  }
}

export class LegalEntityService {
  constructor(private readonly repo = new LegalEntityRepository()) {}

  list(engagementId: string): Promise<LegalEntity[]> {
    return this.repo.list(pool, engagementId);
  }

  async create(engagementId: string, body: unknown): Promise<LegalEntity> {
    const input = parseInput(body);
    checkDates(input);
    try {
      return await withTransaction(async (tx) => {
        if (await this.repo.findByCode(tx, engagementId, input.code)) {
          throw conflict(`LE Code “${input.code}” already exists in this engagement`);
        }
        if (input.parentCode && !(await this.repo.findByCode(tx, engagementId, input.parentCode))) {
          throw badRequest(`Parent “${input.parentCode}” does not exist in this engagement`);
        }
        return this.repo.insert(tx, engagementId, {
          ...input,
          ownershipTotalPct: total(input.ownershipDirectPct, input.ownershipIndirectPct),
        });
      });
    } catch (e) {
      throw translateDbError(e);
    }
  }

  async update(engagementId: string, code: string, body: unknown): Promise<LegalEntity> {
    if (!isObj(body)) throw badRequest('Body must be a JSON object');
    if ('code' in body && body.code !== code) throw badRequest('LE Code cannot be changed');
    try {
      return await withTransaction(async (tx) => {
        const current = await this.repo.findByCode(tx, engagementId, code);
        if (!current) throw notFound(`Entity “${code}” not found`);

        // validate the merged result so partial patches obey the same rules as create
        const merged = parseInput({ ...current, ...pick(body) });
        checkDates(merged);

        if (merged.parentCode) {
          if (merged.parentCode === code) throw badRequest('An entity cannot be its own parent');
          await this.assertNoCycle(tx, engagementId, code, merged.parentCode);
        }

        const patch: LegalEntityPatch & { ownershipTotalPct: number } = {
          ownershipTotalPct: total(merged.ownershipDirectPct, merged.ownershipIndirectPct),
        };
        for (const k of PATCHABLE) if (k in body) (patch as Record<string, unknown>)[k] = merged[k];
        const saved = await this.repo.update(tx, engagementId, code, patch);
        return saved!;
      });
    } catch (e) {
      throw translateDbError(e);
    }
  }

  async remove(engagementId: string, code: string): Promise<void> {
    try {
      const gone = await this.repo.delete(pool, engagementId, code);
      if (!gone) throw notFound(`Entity “${code}” not found`);
    } catch (e) {
      const err = translateDbError(e);
      // the self-referencing parent FK fires when subsidiaries still point here
      if (err.code === 'CONFLICT') throw conflict(`“${code}” still has subsidiaries — remove or re-parent them first`);
      throw err;
    }
  }

  /**
   * Bulk import (CSV/workbook upload). Mirrors the screen's rules: rows without a code, duplicates in the
   * file and codes that already exist are skipped; an unknown parent imports the entity as a root.
   * All-or-nothing for the rows that pass — one transaction.
   */
  async importMany(engagementId: string, body: unknown): Promise<ImportResult> {
    const rowsIn = isObj(body) ? body.entities : undefined;
    if (!Array.isArray(rowsIn)) throw badRequest('Body must be { "entities": [...] }');
    if (rowsIn.length > MAX_IMPORT_ROWS) throw badRequest(`At most ${MAX_IMPORT_ROWS} entities per import`);

    const skipped: ImportResult['skipped'] = [];
    const orphaned: ImportResult['orphaned'] = [];
    try {
      const inserted = await withTransaction(async (tx) => {
        const existing = new Set((await this.repo.list(tx, engagementId)).map((e) => e.code));
        const valid = new Map<string, LegalEntityInput>();

        rowsIn.forEach((raw, i) => {
          const label = isObj(raw) && typeof raw.code === 'string' && raw.code ? raw.code : `row ${i + 1}`;
          try {
            const input = parseInput(raw);
            checkDates(input);
            if (existing.has(input.code)) throw badRequest(`LE Code “${input.code}” already exists`);
            if (valid.has(input.code)) throw badRequest(`duplicate LE Code “${input.code}” in file`);
            valid.set(input.code, input);
          } catch (e) {
            skipped.push({ code: label, reason: e instanceof Error ? e.message : 'invalid row' });
          }
        });

        for (const e of valid.values()) {
          if (e.parentCode && !valid.has(e.parentCode) && !existing.has(e.parentCode)) {
            orphaned.push({ code: e.code, parentCode: e.parentCode });
            e.parentCode = null;
          }
        }

        // insert parents before children so the parent FK is satisfied; a cycle never resolves and is skipped
        const done = new Set(existing);
        let pending = [...valid.values()];
        const out: LegalEntity[] = [];
        while (pending.length) {
          const ready = pending.filter((e) => !e.parentCode || done.has(e.parentCode));
          if (!ready.length) {
            for (const e of pending) skipped.push({ code: e.code, reason: 'parent chain forms a cycle' });
            break;
          }
          for (const e of ready) {
            out.push(await this.repo.insert(tx, engagementId, {
              ...e, ownershipTotalPct: total(e.ownershipDirectPct, e.ownershipIndirectPct),
            }));
            done.add(e.code);
          }
          pending = pending.filter((e) => !done.has(e.code));
        }
        return out;
      });
      return { inserted, skipped, orphaned };
    } catch (e) {
      throw translateDbError(e);
    }
  }

  /** Walk up from the proposed parent; reaching `code` means the move would create a loop. */
  private async assertNoCycle(db: Parameters<LegalEntityRepository['list']>[0], engagementId: string, code: string, parentCode: string) {
    const byCode = new Map((await this.repo.list(db, engagementId)).map((e) => [e.code, e]));
    if (!byCode.has(parentCode)) throw badRequest(`Parent “${parentCode}” does not exist in this engagement`);
    let cur: string | null = parentCode;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      if (cur === code) throw badRequest(`Moving “${code}” under “${parentCode}” would create a cycle`);
      seen.add(cur);
      cur = byCode.get(cur)?.parentCode ?? null;
    }
  }
}

/** keep only patchable fields from a request body */
function pick(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(PATCHABLE.filter((k) => k in body).map((k) => [k, body[k]]));
}
