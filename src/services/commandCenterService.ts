import { useEffect, useState } from 'react';
import type { EngagementSetupSummary } from '../../shared/commandCenter';
import { commandCenterApi } from '../api/commandCenterClient';
import { ACTIVE_ENGAGEMENT_ID } from '../api/engagement';

/**
 * Service layer for the Command Center screen. The screen asks this module for what to show;
 * this module talks to the API client (src/api) and turns raw data into display values.
 */

/* ---------------------------- welcome message ---------------------------- */

export type DayPart = 'morning' | 'afternoon' | 'evening';

/** 05:00–11:59 morning, 12:00–16:59 afternoon, otherwise evening */
export function dayPart(now: Date = new Date()): DayPart {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  return 'evening';
}

/** first name of the signed-in user, capitalised — "Amara Mensah" → "Amara", "admin" → "Admin" */
export function displayName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'there';
}

export function welcomeMessage(fullName: string, now: Date = new Date()): string {
  return `Good ${dayPart(now)}, ${displayName(fullName)}`;
}

/** welcome line that re-renders when the clock crosses into the next part of the day */
export function useWelcomeMessage(fullName: string): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return welcomeMessage(fullName, now);
}

/* ------------------------- engagement setup stage ------------------------- */

export type SetupSummaryState = {
  summary: EngagementSetupSummary | null;
  loading: boolean;
  error: string | null;
};

/** loads the Stage 1 summary for the active engagement once per mount */
export function useEngagementSetupSummary(engagementId: string = ACTIVE_ENGAGEMENT_ID): SetupSummaryState {
  const [state, setState] = useState<SetupSummaryState>({ summary: null, loading: true, error: null });
  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    commandCenterApi
      .getSetupSummary(engagementId, ctrl.signal)
      .then((summary) => setState({ summary, loading: false, error: null }))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({ summary: null, loading: false, error: e instanceof Error ? e.message : 'Could not load engagement setup' });
      });
    return () => ctrl.abort();
  }, [engagementId]);
  return state;
}

export type SetupRowView = { label: string; value: string; tone: 'good' | 'warn' | 'idle' | 'bad' };

/** display rows for the Engagement Setup card */
export function setupRows(s: EngagementSetupSummary): SetupRowView[] {
  const { entities, config, orgChart } = s;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [
    {
      label: 'Legal Entity Master',
      value: entities.total ? plural(entities.total, 'entity', 'entities') : 'No entities',
      tone: entities.total ? 'good' : 'idle',
    },
    {
      label: 'Engagement Config',
      value: config.status === 'Complete' ? 'Complete' : config.total ? `${config.configured} / ${config.total} configured` : 'Not started',
      tone: config.status === 'Complete' ? 'good' : config.status === 'In progress' ? 'warn' : 'idle',
    },
    {
      label: 'Org chart',
      value: orgChart.status === 'Needs review' ? `${orgChart.roots} top-level entities` : orgChart.status,
      tone: orgChart.status === 'Generated' ? 'good' : orgChart.status === 'Needs review' ? 'warn' : 'idle',
    },
  ];
}

/** "8 entities" for the tenant card; active count is called out when some are deconsolidated */
export function entityCountLabel(s: EngagementSetupSummary): string {
  const { total, active } = s.entities;
  const base = `${total} entit${total === 1 ? 'y' : 'ies'}`;
  return active < total ? `${base} (${active} active)` : base;
}
