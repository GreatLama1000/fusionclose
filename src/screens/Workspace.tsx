import { useState } from 'react';
import Icon from '../components/Icon';
import { useApp } from '../state/AppContext';

type Period = { label: string; lock: string; note: string };
type Tenant = {
  key: string;
  name: string;
  meta: string;
  logoColor: string;
  logoInit: string;
  status: 'active' | 'locked' | 'onboarding';
  periods: Period[];
};

const TENANTS: Tenant[] = [
  {
    key: 'clientco',
    name: 'ClientCo Industries Group',
    meta: '30 entities · Q3 2026 open',
    logoColor: '#2563EB',
    logoInit: 'CC',
    status: 'active',
    periods: [
      { label: 'Q2 2026', lock: 'Locked 24 Apr 2026', note: 'Signed · IFRS · 30 entities' },
      { label: 'Q1 2026', lock: 'Locked 22 Jan 2026', note: 'Signed · IFRS · 29 entities' },
      { label: 'FY 2025', lock: 'Locked 18 Mar 2026', note: 'Audited · IFRS · 29 entities' },
      { label: 'Q3 2025', lock: 'Locked 19 Oct 2025', note: 'Signed · IFRS · 27 entities' },
    ],
  },
  {
    key: 'meridian',
    name: 'Meridian Capital Partners',
    meta: '12 entities · Q2 2026 locked',
    logoColor: '#7C3AED',
    logoInit: 'MC',
    status: 'locked',
    periods: [
      { label: 'Q1 2026', lock: 'Locked 23 Jan 2026', note: 'Signed · IFRS · 12 entities' },
      { label: 'FY 2025', lock: 'Locked 27 Feb 2026', note: 'Audited · IFRS · 11 entities' },
    ],
  },
  {
    key: 'halcyon',
    name: 'Halcyon Foods Holding',
    meta: '8 entities · onboarding',
    logoColor: '#059669',
    logoInit: 'HF',
    status: 'onboarding',
    periods: [],
  },
];

const RADAR = [
  { kind: 'Blocker',    name: 'FX rate variance — INR', sub: 'ClientCo Industries · Q3 2026 · +0.42% vs. RBI' },
  { kind: 'Review due', name: 'Working Note WN-014',    sub: 'ClientCo Industries · Reviewer: Sarah K.' },
];

const STATUS_META: Record<Tenant['status'], { label: string; cls: string; dot: string }> = {
  active:     { label: 'Active',     cls: 'bg-good/12 text-good border-good/30',           dot: 'bg-good' },
  locked:     { label: 'Locked',     cls: 'bg-ink-500/10 text-ink-600 border-ink-200',      dot: 'bg-ink-400' },
  onboarding: { label: 'Onboarding', cls: 'bg-warn/12 text-warn border-warn/30',            dot: 'bg-warn' },
};

export default function Workspace() {
  const { navTo } = useApp();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [fav, setFav] = useState<Record<string, boolean>>({ clientco: true });

  return (
    <div className="p-8 space-y-5 animate-fcFade">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-ink-900">My Workspace</h1>
        <button
          onClick={() => navTo('intake')}
          className="h-9 px-3.5 rounded-xl text-[12.5px] font-bold text-white flex items-center gap-1.5 shadow-primary"
          style={{ background: 'linear-gradient(145deg,#3B82F6,#2563EB)' }}
          title="Start a new engagement"
        >
          <Icon path="M12 5v14M5 12h14" size={13} strokeWidth={2.6} />
          New Project
        </button>
      </div>

      {/* On My Radar */}
      <section className="p-5 rounded-2xl bg-surface-card shadow-neu">
        <div className="flex items-center gap-2 mb-3">
          <Icon path="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7z" size={14} className="text-warn" strokeWidth={2} />
          <span className="text-[11px] font-bold tracking-wider uppercase text-ink-500">On My Radar</span>
          <span className="text-[11px] text-ink-300">{RADAR.length}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {RADAR.map((r) => (
            <div
              key={r.name}
              className="flex items-center gap-3 p-3 rounded-xl border border-warn/30"
              style={{ background: 'linear-gradient(155deg,rgba(245,158,11,.10),rgba(255,255,255,.34))' }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[9.5px] font-bold tracking-wider uppercase text-warn">{r.kind}</div>
                <div className="text-[12.5px] font-bold text-ink-900 mt-1">{r.name}</div>
                <div className="text-[10.5px] text-ink-400 mt-0.5">{r.sub}</div>
              </div>
              <button className="text-[11px] font-bold text-brand-accent">Open ›</button>
              <button
                title="Remove from radar"
                className="w-6 h-6 rounded-lg text-warn bg-warn/15 grid place-items-center"
              >
                <Icon path="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7z" size={12} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Client Tenants */}
      <section className="p-6 rounded-2xl bg-surface-card shadow-neu">
        <div className="text-[11px] font-bold tracking-wider uppercase text-ink-500 mb-4">Client Tenants</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          {TENANTS.map((t) => {
            const isOpen = expanded[t.key] ?? false;
            const s = STATUS_META[t.status];
            const starred = !!fav[t.key];
            return (
              <div key={t.key} className="flex flex-col p-4 rounded-2xl bg-surface-card2 shadow-neu-sm border border-surface-line/60">
                <div className="flex items-start gap-3">
                  {/* Logo (with replace/edit hover) */}
                  <div className="relative group flex-none">
                    <div
                      className="w-14 h-14 rounded-xl grid place-items-center text-white font-bold text-sm shadow-neu-in-sm"
                      style={{ backgroundColor: t.logoColor }}
                    >
                      {t.logoInit}
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-ink-900/70 opacity-0 group-hover:opacity-100 transition flex flex-col justify-center items-center gap-0.5 text-[9px] text-white font-semibold">
                      <button className="hover:underline">Replace</button>
                      <button className="hover:underline">Edit</button>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-ink-900">{t.name}</div>
                    <div className="text-[11px] text-ink-500 mt-0.5">{t.meta}</div>
                    <div className={`mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10.5px] font-semibold ${s.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </div>
                    <div className="mt-1.5">
                      {t.status === 'active' && (
                        <button onClick={() => navTo('command')} className="text-[11.5px] font-bold text-brand-accent">
                          Open Command Center ›
                        </button>
                      )}
                      {t.status === 'locked' && (
                        <button className="text-[11.5px] font-bold text-brand-accent">Switch ›</button>
                      )}
                      {t.status === 'onboarding' && (
                        <button className="text-[11.5px] font-bold text-warn">Continue onboarding ›</button>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setFav((f) => ({ ...f, [t.key]: !f[t.key] }))}
                    title={starred ? 'Unpin from favorites' : 'Pin as favorite'}
                    className={`w-[26px] h-[26px] rounded-lg grid place-items-center border ${
                      starred
                        ? 'text-warn bg-warn/16 border-warn/40'
                        : 'text-ink-300 bg-white/55 border-ink-200/50'
                    }`}
                  >
                    <svg
                      width="13" height="13" viewBox="0 0 24 24"
                      fill={starred ? 'currentColor' : 'none'}
                      stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
                    >
                      <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7z" />
                    </svg>
                  </button>
                </div>

                {/* Periods */}
                <div className="mt-3 pt-3 border-t border-surface-line/60">
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [t.key]: !e[t.key] }))}
                    disabled={t.periods.length === 0}
                    className="w-full flex items-center gap-1.5 text-[11px] font-semibold text-ink-500 disabled:opacity-40"
                  >
                    <Icon
                      path="M7 5l7 7-7 7"
                      size={11}
                      strokeWidth={2.6}
                      className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    />
                    {t.periods.length === 0
                      ? 'No closed periods yet'
                      : isOpen
                        ? `Hide closed periods (${t.periods.length})`
                        : `Show closed periods (${t.periods.length})`}
                  </button>

                  {isOpen && t.periods.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2">
                      {t.periods.map((pd) => (
                        <div
                          key={pd.label}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/60 border border-white/80"
                        >
                          <Icon
                            path="M8 10V7a4 4 0 0 1 8 0v3M4 10h16v10H4z"
                            size={12}
                            strokeWidth={2.2}
                            className="text-ink-400 flex-none"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[11.5px] font-bold text-ink-900">{pd.label}</div>
                            <div className="text-[10px] text-ink-400 mt-0.5">{pd.lock} · {pd.note}</div>
                          </div>
                          <button
                            title="Open this closed period read-only"
                            className="text-[10.5px] font-bold text-brand-accent"
                          >
                            Open ›
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
