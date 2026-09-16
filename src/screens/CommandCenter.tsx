import React from 'react';
import Icon from '../components/Icon';
import { useApp } from '../state/AppContext';
import { RouteKey, routes } from '../routes';

const CHIPS = [
  { label: 'TB Loaded',        value: '18 / 20', tone: 'good' },
  { label: 'Blockers',         value: '3',       tone: 'danger' },
  { label: 'Days to Close',    value: '5',       tone: 'brand' },
  { label: 'Open Comments',    value: '12',      tone: 'warn' },
] as const;

const QUICK: { label: string; route: RouteKey; glyph: string }[] = [
  { label: 'Upload TB',        route: 'upload', glyph: 'M12 3v14M6 9l6-6 6 6' },
  { label: 'Run FX',           route: 'fx',     glyph: 'M4 8h16M4 16h16' },
  { label: 'Consolidate',      route: 'consol', glyph: 'M12 2v20M2 12h20' },
];

const WORKSPACES: { label: string; route: RouteKey; desc: string }[] = [
  { label: 'Consolidation',  route: 'consol',    desc: 'Cycle 07 · Q3 FY25' },
  { label: 'Upload & TB',    route: 'upload',    desc: '18 entities loaded' },
  { label: 'FX Translation', route: 'fx',        desc: '52 currencies live' },
  { label: 'Reporting Hub',  route: 'reporting', desc: '9 packs in progress' },
];

const ACTIVITY = [
  { who: 'Amara Mensah', what: 'posted an adjustment to ATB',       when: '2m ago' },
  { who: 'John D.',      what: 'uploaded a new TB for Entity 07',   when: '11m ago' },
  { who: 'Sarah K.',     what: 'reviewed Working Note WN-014',      when: '38m ago' },
  { who: 'Priya N.',     what: 'commented on IC mismatch batch',    when: '1h ago' },
  { who: 'System',       what: 'refreshed FX rates (USD, EUR, INR)', when: '2h ago' },
];

export default function CommandCenter() {
  const { navTo, currentUser } = useApp();

  const chipColor = (t: string) =>
    t === 'good' ? 'text-good' :
    t === 'danger' ? 'text-danger' :
    t === 'warn' ? 'text-warn' : 'text-brand-500';

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">
            Good day, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="text-ink-500 mt-1">Here's what's happening across your close.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <div key={c.label} className="px-4 py-2 rounded-xl bg-surface-card shadow-neu-sm">
              <div className="text-[11px] uppercase tracking-wider text-ink-400">{c.label}</div>
              <div className={`text-lg font-semibold ${chipColor(c.tone)}`}>{c.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-3 gap-3">
        {QUICK.map((q) => (
          <button
            key={q.route}
            onClick={() => navTo(q.route)}
            className="p-4 rounded-2xl bg-surface-card shadow-neu-sm hover:shadow-neu text-left flex items-center gap-3"
          >
            <span className="w-10 h-10 rounded-xl bg-brand-500 text-white grid place-items-center shadow-primary">
              <Icon path={q.glyph} size={16} />
            </span>
            <div>
              <div className="text-sm font-medium text-ink-900">{q.label}</div>
              <div className="text-[11px] text-ink-500">Jump to workspace</div>
            </div>
          </button>
        ))}
      </div>

      {/* Workspaces + activity */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="grid sm:grid-cols-2 gap-4">
          {WORKSPACES.map((w) => (
            <button
              key={w.route}
              onClick={() => navTo(w.route)}
              className="p-5 rounded-2xl bg-surface-card shadow-neu text-left hover:-translate-y-0.5 transition"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="w-9 h-9 rounded-xl bg-surface-card shadow-neu-in-sm grid place-items-center text-ink-600">
                  <Icon path={routes[w.route].glyph} size={16} />
                </span>
                <div className="text-sm font-semibold text-ink-900">{w.label}</div>
              </div>
              <div className="text-xs text-ink-500">{w.desc}</div>
              <div className="mt-4 text-[11px] text-brand-500 font-medium">Open →</div>
            </button>
          ))}
        </div>

        <div className="p-5 rounded-2xl bg-surface-card shadow-neu">
          <div className="text-xs font-semibold text-ink-500 mb-3">Live activity</div>
          <ul className="space-y-3">
            {ACTIVITY.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-500" />
                <div className="flex-1">
                  <div className="text-ink-900">
                    <span className="font-medium">{a.who}</span>{' '}
                    <span className="text-ink-500">{a.what}</span>
                  </div>
                  <div className="text-[11px] text-ink-400">{a.when}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
