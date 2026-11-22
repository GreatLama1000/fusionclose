import React from 'react';
import Icon from '../components/Icon';
import { useApp } from '../state/AppContext';

const FACTS = [
  { title: '70% faster close',        desc: 'One pipeline from TB load to reviewed statement faces.',    glyph: 'M13 2 4 14h6l-1 8 9-12h-6z' },
  { title: 'Single data spine',       desc: "TB, FSLI map and JE's drive every face and bridge.",       glyph: 'M12 3c-4.4 0-8 1.4-8 3.2v11.6C4 19.6 7.6 21 12 21s8-1.4 8-3.2V6.2C20 4.4 16.4 3 12 3zM4 6.2C4 8 7.6 9.4 12 9.4s8-1.4 8-3.2' },
  { title: 'Audit-ready lineage',     desc: 'Every figure traces to its source — linked or delinked.',   glyph: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4' },
  { title: 'Real-time recalculation', desc: 'Change a rate or JE and every face updates instantly.',     glyph: 'M12 3a9 9 0 1 0 9 9M12 3v9h9' },
  { title: 'One team, one thread',    desc: 'Comments, roles and the close plan beside the numbers.',    glyph: 'M4 4h16v12H9l-5 5z' },
  { title: 'Standards built in',      desc: 'IFRS 18, ASC 805 and Proforma configured per project.',     glyph: 'M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5' },
  { title: 'Bank-grade security',     desc: '256-bit encryption, SOC 2 Type II, full audit trail.',      glyph: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z' },
  { title: 'FX & IC handled',         desc: 'Automated translation; eliminations tie to zero.',          glyph: 'M4 7h14l-3.5-3.5M20 17H6l3.5 3.5' },
  { title: 'One-click Data Book',     desc: 'Export the linked or delinked workbook in a click.',        glyph: 'M12 3v10M8 9l4 4 4-4M4 17v4h16v-4' },
];

const DELAYS = ['0s', '-3.4s', '-1.6s', '-2.4s', '-5.6s', '-4.8s', '-1.0s', '-4.2s', '-2.9s'];

export default function Home() {
  const { navTo, currentUser } = useApp();

  return (
    <div className="p-4 lg:p-6 min-h-full animate-fcFade">
      <div className="rounded-3xl bg-surface-card shadow-neu p-6 lg:p-8 relative overflow-hidden">
        {/* soft radial background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 48%,rgba(236,239,246,.82) 0%,rgba(236,239,246,.55) 45%,rgba(236,239,246,.1) 100%)',
          }}
        />
        <div className="relative flex flex-wrap gap-6 lg:gap-8 items-stretch">
          {/* Left · headline + fact cloud */}
          <div className="flex-1 min-w-0 flex flex-col justify-between gap-3 py-1">
            <div className="max-w-xl">
              <div className="text-[11px] font-bold tracking-[2.4px] uppercase text-ink-400">
                Get started with Fusion Close
              </div>
              <h1 className="mt-3 text-3xl lg:text-[32px] font-bold text-ink-900 leading-tight">
                From trial balance to signed statements — one place.
              </h1>
              <p className="mt-3 text-sm lg:text-[14px] italic text-ink-500 leading-relaxed">
                Open a new engagement from <b className="not-italic font-bold text-ink-700">+ New Project</b> up top,
                or pick up where you left off in <b className="not-italic font-bold text-ink-700">My Workspace</b>.
                Fusion Close carries the numbers all the way through.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 max-w-[640px] content-end">
              {FACTS.map((f, i) => (
                <div
                  key={f.title}
                  className="flex-1 min-w-[178px] max-w-[210px] p-3 rounded-2xl bg-white/85 border border-brand-400/25 backdrop-blur animate-fcFloat"
                  style={{
                    boxShadow: '0 14px 30px rgba(37,99,235,.14)',
                    animationDelay: DELAYS[i],
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex-none w-[30px] h-[30px] rounded-lg bg-brand-400/10 border border-brand-400/30 grid place-items-center text-brand-500">
                      <Icon path={f.glyph} size={14} strokeWidth={1.8} />
                    </span>
                    <span className="text-xs font-bold text-ink-900">{f.title}</span>
                  </div>
                  <div className="mt-1.5 text-[10px] italic text-ink-500 leading-relaxed">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right · welcome card (sign-in now lives on the Login screen) */}
          <div className="w-full max-w-[340px] lg:w-[340px] p-7 rounded-3xl bg-surface-card shadow-neu flex flex-col justify-center self-stretch">
            <div className="flex flex-col items-center text-center">
              <div className="w-[70px] h-[70px] rounded-full bg-surface-card shadow-neu grid place-items-center">
                <span
                  className="w-12 h-12 rounded-full grid place-items-center shadow-primary text-[15px] font-bold text-white"
                  style={{ background: 'linear-gradient(145deg,#3B82F6,#1E40AF)' }}
                >
                  {currentUser.initials}
                </span>
              </div>
              <div className="mt-4 text-xl font-bold text-ink-900">Welcome, {currentUser.name}</div>
              <div className="mt-1 text-[10.5px] uppercase tracking-[1px] text-ink-300">
                Fusion Close · Powered by <span className="text-brand-accent font-bold">SUVI Corp</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3.5">
              <button
                onClick={() => navTo('command')}
                className="h-[52px] rounded-xl text-white text-[14.5px] font-bold flex items-center justify-center gap-2 shadow-primary"
                style={{ background: 'linear-gradient(145deg,#3B82F6,#2563EB)' }}
              >
                <Icon path="M12 15l4-6M4 15a8 8 0 0 1 16 0M3 20h18" size={16} strokeWidth={1.9} />
                Open Command Center
              </button>
              <button
                onClick={() => navTo('workspace')}
                className="h-[46px] rounded-xl bg-surface-bg border border-surface-line shadow-neu-in-sm text-[12.5px] font-bold text-ink-700 flex items-center justify-center gap-2"
              >
                <Icon path="M4 4.5h6.5V11H4zM13.5 4.5H20v4h-6.5zM13.5 12H20v7.5h-6.5zM4 14.5h6.5v5H4z" size={15} strokeWidth={1.8} />
                My Workspace
              </button>
            </div>

            <div className="mt-5 flex items-center justify-center gap-1.5 text-[10.5px] text-ink-300">
              <Icon path="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z" size={12} className="text-good" strokeWidth={2} />
              256-bit encrypted · SOC 2 Type II
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
