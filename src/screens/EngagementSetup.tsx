import React, { useState } from 'react';
import Icon from '../components/Icon';
import { useApp } from '../state/AppContext';

const STEPS = [
  { k: 'entity',  label: 'Legal Entity Master', desc: '30 entities · 4 sub-groups' },
  { k: 'chart',   label: 'Chart of Accounts',   desc: 'Group + local COAs' },
  { k: 'map',     label: 'FSLI Mapping',        desc: '14 unmapped in DE' },
  { k: 'gaap',    label: 'GAAP Policy',         desc: 'IFRS presentation' },
  { k: 'team',    label: 'Team & Access',       desc: '12 users' },
];

const CARDS = [
  { title: 'Legal Entity Master', badge: '30 entities · 4 sub-groups', status: 'Validated', tone: 'good' as const },
  { title: 'FSLI Mapping',        badge: '14 unmapped in Germany',     status: 'Needs attention', tone: 'warn' as const },
  { title: 'GAAP Policy',         badge: 'IFRS · Presentation currency USD', status: 'Configured', tone: 'good' as const },
  { title: 'Access Controls',     badge: '12 users · 5 roles',         status: 'Configured', tone: 'good' as const },
];

export default function EngagementSetup() {
  const { navTo } = useApp();
  const [step, setStep] = useState(0);

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-400">Setup</div>
          <h1 className="text-2xl font-semibold text-ink-900">Engagement Setup</h1>
          <p className="text-ink-500 mt-1">Legal Entity Master, chart of accounts and engagement configuration.</p>
        </div>
        <button
          onClick={() => navTo('entities')}
          className="h-10 px-4 rounded-xl bg-brand-500 text-white text-sm shadow-primary"
        >
          Open Legal Entity Master →
        </button>
      </header>

      {/* Stepper */}
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s.k}>
            <button
              onClick={() => setStep(i)}
              className={`px-3 h-10 rounded-xl text-xs font-medium flex items-center gap-2 ${
                step === i
                  ? 'bg-brand-500 text-white shadow-primary'
                  : 'bg-surface-card text-ink-600 shadow-neu-sm'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/25 grid place-items-center text-[10px]">
                {i + 1}
              </span>
              <span>{s.label}</span>
            </button>
          </li>
        ))}
      </ol>

      {/* Detail cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {CARDS.map((c) => (
          <div key={c.title} className="p-5 rounded-2xl bg-surface-card shadow-neu">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink-900">{c.title}</div>
                <div className="text-xs text-ink-500 mt-1">{c.badge}</div>
              </div>
              <span
                className={`text-[11px] font-medium px-2 py-1 rounded-lg ${
                  c.tone === 'good' ? 'bg-good/10 text-good' : 'bg-warn/10 text-warn'
                }`}
              >
                {c.status}
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="h-9 px-3 rounded-lg bg-surface-card shadow-neu-sm text-xs text-ink-700">
                Review
              </button>
              <button className="h-9 px-3 rounded-lg bg-surface-card shadow-neu-in-sm text-xs text-ink-600">
                History
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Right-side callout */}
      <div className="p-5 rounded-2xl bg-surface-card shadow-neu flex items-center gap-4">
        <span className="w-10 h-10 rounded-xl bg-brand-500 text-white grid place-items-center shadow-primary">
          <Icon path="M12 8v4l3 2" size={16} />
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-ink-900">You're 80% ready to start the close</div>
          <div className="text-xs text-ink-500">Finish FSLI mapping for Germany to unlock consolidation.</div>
        </div>
        <button
          onClick={() => navTo('fslimap')}
          className="h-9 px-3 rounded-lg bg-brand-500 text-white text-xs shadow-primary"
        >
          Fix mapping
        </button>
      </div>
    </div>
  );
}
