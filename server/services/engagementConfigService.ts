import type {
  EngagementConfigRecord, EngagementConfigValues, SaveEngagementConfigInput,
} from '../../shared/engagementSetup';
import { pool, withTransaction } from '../db/pool';
import { badRequest, notFound, translateDbError } from '../errors';
import { EngagementConfigRepository } from '../repositories/engagementConfigRepository';
import { LegalEntityRepository } from '../repositories/legalEntityRepository';

/** Business rules for the Engagement Configuration step. */

const MAX_KEYS = 200;
const MAX_VALUE_LEN = 2000;
const MAX_ENTITIES = 500;
const MAX_NAME_LEN = 255;
const KEY_RE = /^[a-z][a-z0-9_]{0,63}$/;

function parseInput(body: unknown): SaveEngagementConfigInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw badRequest('Body must be a JSON object');
  const { entityNames, values } = body as { entityNames?: unknown; values?: unknown };

  if (!Array.isArray(entityNames) || entityNames.length === 0) {
    throw badRequest('entityNames must list at least one legal entity');
  }
  if (entityNames.length > MAX_ENTITIES) throw badRequest(`At most ${MAX_ENTITIES} entities per save`);
  const names = new Set<string>();
  for (const n of entityNames) {
    if (typeof n !== 'string' || !n.trim()) throw badRequest('Every entity name must be a non-empty string');
    if (n.length > MAX_NAME_LEN) throw badRequest(`An entity name is longer than ${MAX_NAME_LEN} characters`);
    names.add(n);
  }

  if (typeof values !== 'object' || values === null || Array.isArray(values)) throw badRequest('values must be an object');
  const entries = Object.entries(values);
  if (entries.length > MAX_KEYS) throw badRequest(`At most ${MAX_KEYS} configuration keys`);
  const clean: EngagementConfigValues = {};
  for (const [k, v] of entries) {
    if (!KEY_RE.test(k)) throw badRequest(`Invalid configuration key “${k}”`);
    if (typeof v !== 'string') throw badRequest(`Value for “${k}” must be a string`);
    if (v.length > MAX_VALUE_LEN) throw badRequest(`Value for “${k}” is longer than ${MAX_VALUE_LEN} characters`);
    clean[k] = v;
  }
  return { entityNames: [...names], values: clean };
}

export class EngagementConfigService {
  constructor(
    private readonly repo = new EngagementConfigRepository(),
    private readonly entities = new LegalEntityRepository(),
  ) {}

  /** Every saved configuration of the engagement, oldest first. */
  list(engagementId: string): Promise<EngagementConfigRecord[]> {
    return this.repo.list(pool, engagementId);
  }

  /** Deletes the saved configuration of one legal entity. */
  async remove(engagementId: string, entityName: string): Promise<void> {
    if (!(await this.repo.delete(pool, engagementId, entityName))) {
      throw notFound(`No saved configuration for “${entityName}”`);
    }
  }

  /**
   * Saves one row per selected legal entity, all in one transaction. Each row holds the full set of answers
   * with `entity_name` set to that row's entity; an entity that already has a row is updated in place.
   * Returns the rows written.
   */
  async save(engagementId: string, body: unknown): Promise<EngagementConfigRecord[]> {
    const { entityNames, values } = parseInput(body);
    try {
      return await withTransaction(async (tx) => {
        const known = new Set((await this.entities.list(tx, engagementId)).map((e) => e.name));
        const unknown = entityNames.filter((n) => !known.has(n));
        if (unknown.length) throw badRequest(`Not in the Legal Entity Master: ${unknown.join(', ')}`);

        const saved: EngagementConfigRecord[] = [];
        for (const name of entityNames) {
          saved.push(await this.repo.upsert(tx, engagementId, name, { ...values, entity_name: name }));
        }
        return saved;
      });
    } catch (e) {
      throw translateDbError(e);
    }
  }
}
