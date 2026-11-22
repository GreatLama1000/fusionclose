import type { EngagementSetupSummary } from '../../shared/commandCenter';
import { request } from './engagementSetupClient';

/** HTTP client for the Command Center read model (server/services/commandCenterService.ts). */
export const commandCenterApi = {
  getSetupSummary: (engagementId: string, signal?: AbortSignal) =>
    request<EngagementSetupSummary>(`/engagements/${encodeURIComponent(engagementId)}/summary`, { signal }),
};
