import React from 'react';
import Icon from '../components/Icon';
import { useApp } from '../state/AppContext';
import { RouteKey } from '../routes';

const PACKS: { title: string; desc: string; status: string; tone: 'good' | 'warn' | 'brand'; route?: RouteKey }[] = [
  { title: 'Consolidated FS',      desc: 'BS · IS · CF · SoCE',           status: 'Draft',      tone: 'brand' },
  { title: 'Single-Entity FS',     desc: 'Per legal entity',              status: '18 ready',   tone: 'good', route: 'fs' },
  { title: 'Bridge Reports',       desc: 'PY vs CY · budget vs actual',   status: 'Draft',      tone: 'brand', route: 'bridges' },
  { title: 'Disclosure Sentinel',  desc: 'Rule-based disclosure check',   status: '3 alerts',   tone: 'warn', route: 'disclosure' },
  { title: 'Notes & Disclosures',  desc: 'IFRS narrative + tables',       status: 'In review',  tone: 'brand', route: 'notes' },
  { title: 'Disclosure Library',   desc: 'Reusable disclosure content',   status: '180+ items', tone: 'good', route: 'library' },
];

const OUTPUTS = [
  { title: 'Word · Full report',     size: '2.1 MB', updated: '4m ago' },
  { title: 'Excel · TB pack',        size: '860 KB', updated: '12m ago' },
  { title: 'PDF · Board summary',    size: '410 KB', updated: '38m ago' },
];

const toneCls: Record<'good' | 'warn' | 'brand', string> = {
  good:  'bg-good/10 text-good',
  warn:  'bg-warn/10 text-warn',
  brand: 'bg-brand-500/10 text-brand-500',
};

export default function ReportingHub() {
  const { navTo } = useApp();

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-400">Reporting</div>
          <h1 className="text-2xl font-semibold text-ink-900">Reporting Hub</h1>
          <p className="text-ink-500 mt-1">Consolidated pack, entity reports and disclosures.</p>
        </div>
        <button className="h-10 px-4 rounded-xl bg-brand-500 text-white text-sm shadow-primary flex items-center gap-2">
          <Icon path="M4 4h16v16H4z" size={14} /> Generate all
        </button>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PACKS.map((p) => (
          <button
            key={p.title}
            onClick={() => p.route && navTo(p.route)}
            className="text-left p-5 rounded-2xl bg-surface-card shadow-neu hover:-translate-y-0.5 transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-ink-900">{p.title}</div>
                <div className="text-xs text-ink-500 mt-1">{p.desc}</div>
              </div>
              <span className={`text-[11px] font-medium px-2 py-1 rounded-lg ${toneCls[p.tone]}`}>{p.status}</span>
            </div>
            <div className="mt-4 text-[11px] text-brand-500 font-medium">Open →</div>
          </button>
        ))}
      </div>

      <div className="p-5 rounded-2xl bg-surface-card shadow-neu">
        <div className="text-xs font-semibold text-ink-500 mb-3">Latest outputs</div>
        <ul className="divide-y divide-surface-line/60">
          {OUTPUTS.map((o) => (
            <li key={o.title} className="py-3 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-surface-card shadow-neu-in-sm grid place-items-center text-ink-600">
                <Icon path="M6 3h9l5 5v13H6z" size={14} />
              </span>
              <div className="flex-1">
                <div className="text-sm text-ink-900">{o.title}</div>
                <div className="text-[11px] text-ink-500">{o.size} · updated {o.updated}</div>
              </div>
              <button className="h-8 px-3 rounded-lg bg-surface-card shadow-neu-sm text-xs text-ink-700">Download</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
