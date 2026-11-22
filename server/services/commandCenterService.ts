import type { EngagementSetupSummary, SetupPartStatus } from '../../shared/commandCenter';
import { pool } from '../db/pool';
import { translateDbError } from '../errors';
import { CommandCenterRepository, SetupFacts } from '../repositories/commandCenterRepository';

/**
 * Business logic for the Command Center. All database access goes through CommandCenterRepository,
 * which returns raw facts; this service turns them into statuses, completion % and the summary contract.
 */

/** Engagement Configuration is complete once every entity in the master has one */
function configStatus(configured: number, total: number): SetupPartStatus {
  if (total === 0 || configured === 0) return 'Not started';
  return configured >= total ? 'Complete' : 'In progress';
}

/** a finished structure has exactly one top-level entity — the ultimate parent */
function orgChartStatus(total: number, roots: number): EngagementSetupSummary['orgChart']['status'] {
  if (total === 0) return 'Not started';
  return roots === 1 ? 'Generated' : 'Needs review';
}

/** master loaded, configuration coverage and org chart count one third each */
function completion(f: SetupFacts, org: EngagementSetupSummary['orgChart']['status']): number {
  const parts = [
    f.entityCount > 0 ? 1 : 0,
    f.entityCount ? Math.min(1, f.configuredCount / f.entityCount) : 0,
    org === 'Generated' ? 1 : 0,
  ];
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}

export function toSetupSummary(engagementId: string, f: SetupFacts): EngagementSetupSummary {
  const org = orgChartStatus(f.entityCount, f.rootCount);
  const completionPct = completion(f, org);
  return {
    engagementId,
    tenantName: f.rootCount === 1 ? f.rootNames[0] ?? null : null,
    entities: {
      total: f.entityCount,
      active: f.entityCount - f.deconsolidatedCount,
      deconsolidated: f.deconsolidatedCount,
    },
    config: {
      configured: f.configuredCount,
      total: f.entityCount,
      status: configStatus(f.configuredCount, f.entityCount),
    },
    orgChart: { roots: f.rootCount, levels: f.levels, status: org },
    completionPct,
    status: completionPct >= 100 ? 'Done' : completionPct === 0 ? 'Not started' : 'In progress',
    lastUpdatedAt: f.lastUpdatedAt,
  };
}

export class CommandCenterService {
  constructor(private readonly repo = new CommandCenterRepository()) {}

  async setupSummary(engagementId: string): Promise<EngagementSetupSummary> {
    try {
      return toSetupSummary(engagementId, await this.repo.setupFacts(pool, engagementId));
    } catch (e) {
      throw translateDbError(e);
    }
  }
}
