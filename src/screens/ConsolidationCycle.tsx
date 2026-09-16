import React, { useState } from 'react';
import Icon from '../components/Icon';
import { useApp } from '../state/AppContext';

const STEPS = [
  { k: 'validate', label: 'Validate TBs',          status: 'done' as const,   desc: 'All 18 entities loaded and balanced.' },
  { k: 'fx',       label: 'FX Translation',        status: 'done' as const,   desc: '7 currencies translated to USD.' },
  { k: 'ic',       label: 'IC Elimination',        status: 'active' as const, desc: '1 mismatch above tolerance — review needed.' },
  { k: 'invest',   label: 'Investment Elimination', status: 'todo' as const,   desc: 'Cost method → equity method rollforward.' },
  { k: 'minority', label: 'Minority Interest',     status: 'todo' as const,   desc: 'NCI computation for FC-021 (75%) and FC-050 (80%).' },
  { k: 'group',    label: 'Group Adjustments',     status: 'todo' as const,   desc: 'Manual JEs, reclassifications.' },
  { k: 'publish',  label: 'Publish Consol Pack',   status: 'todo' as const,   desc: 'Freeze balances, generate reports.' },
];

const STATUS: Record<'done' | 'active' | 'todo', string> = {
  done:   'bg-good text-white',
  active: 'bg-brand-500 text-white shadow-primary',
  todo:   'bg-surface-card text-ink-500 shadow-neu-in-sm',
};

export default function ConsolidationCycle() {
  const { navTo } = useApp();
  const [active, setActive] = useState(2);

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-400">Consolidation</div>
          <h1 className="text-2xl font-semibold text-ink-900">Consolidation Cycle</h1>
          <p className="text-ink-500 mt-1">Cycle 07 · Q3 FY25 · presentation currency USD</p>
        </div>
        <div className="flex gap-2">
          <button className="h-10 px-3 rounded-xl bg-surface-card shadow-neu-sm text-xs text-ink-700">
            Cycle history
          </button>
          <button className="h-10 px-4 rounded-xl bg-brand-500 text-white text-sm shadow-primary">
            Run next step
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="rounded-2xl bg-surface-card shadow-neu p-2">
          <ul className="space-y-1">
            {STEPS.map((s, i) => {
              const isActive = i === active;
              return (
                <li key={s.k}>
                  <button
                    onClick={() => setActive(i)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition ${
                      isActive ? 'bg-surface-soft' : 'hover:bg-surface-soft/60'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg grid place-items-center text-xs font-semibold ${STATUS[s.status]}`}>
                      {s.status === 'done' ? '✓' : i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-ink-900">{s.label}</div>
                      <div className="text-[11px] text-ink-500">{s.desc}</div>
                    </div>
                    <Icon path="M9 6l6 6-6 6" size={14} className="text-ink-400" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="p-5 rounded-2xl bg-surface-card shadow-neu space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-ink-400">Selected step</div>
          <div className="text-lg font-semibold text-ink-900">{STEPS[active].label}</div>
          <p className="text-sm text-ink-500">{STEPS[active].desc}</p>

          <div className="pt-2 space-y-2">
            <button
              onClick={() => navTo('ice')}
              className="w-full h-10 rounded-xl bg-brand-500 text-white text-sm shadow-primary"
            >
              Open Intercompany
            </button>
            <button
              onClick={() => navTo('reporting')}
              className="w-full h-10 rounded-xl bg-surface-card shadow-neu-sm text-sm text-ink-700"
            >
              Preview consol pack
            </button>
          </div>

          <div className="pt-3 border-t border-surface-line/60">
            <div className="text-[11px] uppercase tracking-wider text-ink-400 mb-2">Blockers</div>
            <ul className="space-y-1 text-xs text-ink-600">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-danger" /> IC-004: variance INR 2,000</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-warn" /> FC-020 FSLI: 14 unmapped</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
