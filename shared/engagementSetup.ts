/**
 * Contract shared by the browser (src/api) and the server (server/).
 * Mirrors the two EngagementSetup.tsx steps: Legal Entity Master + Engagement Configuration.
 * Option values (entity type, consolidation method, GAAP, …) are the labels the UI shows.
 */

export type LegalEntity = {
  id: string;
  engagementId: string;
  code: string;
  name: string;
  /** LE code of the parent within the same engagement; null for a root */
  parentCode: string | null;
  entityType: string;
  country: string;
  ownershipDirectPct: number;
  ownershipIndirectPct: number;
  /** derived by the service: direct + indirect */
  ownershipTotalPct: number;
  nciPct: number | null;
  consolidationPct: number | null;
  consolidationMethod: string;
  consolidationStructure: string | null;
  localCurrency: string;
  functionalCurrency: string;
  reportingCurrency: string;
  classification: string | null;
  fiscalYearEnd: string;
  primaryGaap: string;
  secondaryGaap: string | null;
  /** ISO yyyy-mm-dd */
  acquisitionDate: string | null;
  disposalDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LegalEntityInput = Omit<
  LegalEntity,
  'id' | 'engagementId' | 'ownershipTotalPct' | 'createdAt' | 'updatedAt'
>;

export type LegalEntityPatch = Partial<Omit<LegalEntityInput, 'code'>>;

export type ImportResult = {
  inserted: LegalEntity[];
  skipped: { code: string; reason: string }[];
  /** parents that were not found; those entities were imported as roots */
  orphaned: { code: string; parentCode: string }[];
};

/** Engagement Configuration answers, keyed by the `key` of each form field (SECTIONS in EngagementSetup.tsx). */
export type EngagementConfigValues = Record<string, string>;

/** One saved configuration: the answers for a single legal entity (LE Name) of an engagement. */
export type EngagementConfigRecord = {
  engagementId: string;
  /** the LE Name from legal_entity_master this row belongs to */
  entityName: string;
  /** all answers; `entity_name` is always this row's single entity */
  values: EngagementConfigValues;
  /** bumped each time the row is saved again */
  version: number;
  createdAt: string;
  updatedAt: string;
};

/** Save request: one row is written per entity picked in field A1. */
export type SaveEngagementConfigInput = {
  entityNames: string[];
  values: EngagementConfigValues;
};

export type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown };
};
