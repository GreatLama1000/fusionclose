import type {
  ApiErrorBody, EngagementConfigRecord, ImportResult, LegalEntity, LegalEntityInput, LegalEntityPatch,
  SaveEngagementConfigInput,
} from '../../shared/engagementSetup';

/**
 * Browser-side client for the Engagement Setup API (server/). The browser never talks to Postgres;
 * it calls these functions, which call the service layer over HTTP. /api is proxied by vite.config.ts.
 */

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
  }
}

const BASE = '/api/v1';

/** shared fetch wrapper for every /api/v1 client — JSON in/out, ApiError on a non-2xx */
export async function request<T>(path: string, init?: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init?.signal,
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (json as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return json as T;
}

const eng = (id: string) => `/engagements/${encodeURIComponent(id)}`;

export const engagementSetupApi = {
  /* Legal Entity Master */
  listEntities: (engagementId: string, signal?: AbortSignal) =>
    request<LegalEntity[]>(`${eng(engagementId)}/entities`, { signal }),
  createEntity: (engagementId: string, entity: LegalEntityInput) =>
    request<LegalEntity>(`${eng(engagementId)}/entities`, { method: 'POST', body: entity }),
  updateEntity: (engagementId: string, code: string, patch: LegalEntityPatch) =>
    request<LegalEntity>(`${eng(engagementId)}/entities/${encodeURIComponent(code)}`, { method: 'PATCH', body: patch }),
  deleteEntity: (engagementId: string, code: string) =>
    request<void>(`${eng(engagementId)}/entities/${encodeURIComponent(code)}`, { method: 'DELETE' }),
  importEntities: (engagementId: string, entities: LegalEntityInput[]) =>
    request<ImportResult>(`${eng(engagementId)}/entities/import`, { method: 'POST', body: { entities } }),

  /* Engagement Configuration */
  listConfigs: (engagementId: string, signal?: AbortSignal) =>
    request<EngagementConfigRecord[]>(`${eng(engagementId)}/configs`, { signal }),
  deleteConfig: (engagementId: string, entityName: string) =>
    request<void>(`${eng(engagementId)}/configs/${encodeURIComponent(entityName)}`, { method: 'DELETE' }),
  /** one row is written per entity in `input.entityNames`; resolves to the rows written */
  saveConfigs: (engagementId: string, input: SaveEngagementConfigInput) =>
    request<EngagementConfigRecord[]>(`${eng(engagementId)}/configs`, { method: 'PUT', body: input }),
};
