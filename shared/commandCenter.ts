/**
 * Contract for the Command Center summary, shared by the browser (src/services) and the server (server/).
 * Everything here is derived from legal_entity_master and engagement_config — nothing is stored separately.
 */

export type SetupPartStatus = 'Not started' | 'In progress' | 'Complete';

export type EngagementSetupSummary = {
  engagementId: string;
  /** LE Name of the ultimate parent (the single top-level entity), or null when there is none / several */
  tenantName: string | null;
  entities: {
    total: number;
    /** entities still in the group (not deconsolidated / disposed) */
    active: number;
    deconsolidated: number;
  };
  config: {
    /** entities of the master that have a saved Engagement Configuration */
    configured: number;
    /** entities that need one — every entity in the master */
    total: number;
    status: SetupPartStatus;
  };
  orgChart: {
    /** top-level entities; a finished structure has exactly one (the ultimate parent) */
    roots: number;
    /** depth of the hierarchy, 1 = only top-level entities */
    levels: number;
    status: 'Not started' | 'Generated' | 'Needs review';
  };
  /** 0–100: master loaded, configuration coverage and org chart, one third each */
  completionPct: number;
  status: 'Not started' | 'In progress' | 'Done';
  /** latest change to either table, ISO timestamp */
  lastUpdatedAt: string | null;
};
