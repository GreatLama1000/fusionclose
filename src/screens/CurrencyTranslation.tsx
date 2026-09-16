import React, { useState } from 'react';
import Icon from '../components/Icon';

type Rate = { ccy: string; name: string; spot: number; avg: number; closing: number; source: string };

const RATES: Rate[] = [
  { ccy: 'EUR', name: 'Euro',              spot: 1.0812, avg: 1.0765, closing: 1.0791, source: 'ECB' },
  { ccy: 'GBP', name: 'British Pound',     spot: 1.2694, avg: 1.2610, closing: 1.2688, source: 'BoE' },
  { ccy: 'INR', name: 'Indian Rupee',      spot: 0.0120, avg: 0.0121, closing: 0.0120, source: 'RBI' },
  { ccy: 'SGD', name: 'Singapore Dollar',  spot: 0.7420, avg: 0.7381, closing: 0.7398, source: 'MAS' },
  { ccy: 'BRL', name: 'Brazilian Real',    spot: 0.1855, avg: 0.1843, closing: 0.1861, source: 'BCB' },
  { ccy: 'JPY', name: 'Japanese Yen',      spot: 0.0067, avg: 0.0068, closing: 0.0067, source: 'BoJ' },
  { ccy: 'AUD', name: 'Australian Dollar', spot: 0.6620, avg: 0.6591, closing: 0.6612, source: 'RBA' },
];

const RUNS = [
  { period: 'Q3 FY25', triggered: 'Amara Mensah', when: '2m ago',  status: 'success', cta: 8, err: 0 },
  { period: 'Q2 FY25', triggered: 'System',        when: '2h ago',  status: 'success', cta: 12, err: 0 },
  { period: 'Q1 FY25', triggered: 'John D.',       when: '3d ago',  status: 'warning', cta: 6,  err: 1 },
];

export default function CurrencyTranslation() {
  const [presentation, setPresentation] = useState('USD');

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-400">Consolidation</div>
          <h1 className="text-2xl font-semibold text-ink-900">Currency Translation</h1>
          <p className="text-ink-500 mt-1">FX rates and translation runs to presentation currency.</p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-xs text-ink-500">Presentation</label>
          <select
            value={presentation}
            onChange={(e) => setPresentation(e.target.value)}
            className="h-10 px-3 rounded-xl bg-surface-card shadow-neu-in-sm text-sm"
          >
            {['USD', 'EUR', 'GBP', 'INR'].map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="h-10 px-4 rounded-xl bg-brand-500 text-white text-sm shadow-primary flex items-center gap-2">
            <Icon path="M4 12a8 8 0 018-8v4l4-4-4-4v4M20 12a8 8 0 01-8 8v-4l-4 4 4 4v-4" size={14} />
            Run translation
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Rates */}
        <div className="rounded-2xl bg-surface-card shadow-neu overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-line/60 flex items-center justify-between">
            <div className="text-sm font-semibold text-ink-900">FX rate master → {presentation}</div>
            <div className="text-[11px] text-ink-400">7 currencies · updated 12 min ago</div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-400 bg-surface-card2">
                <th className="text-left px-4 py-2">CCY</th>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-right px-4 py-2">Spot</th>
                <th className="text-right px-4 py-2">Average</th>
                <th className="text-right px-4 py-2">Closing</th>
                <th className="text-left px-4 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {RATES.map((r) => (
                <tr key={r.ccy} className="border-t border-surface-line/40 hover:bg-surface-soft">
                  <td className="px-4 py-2 font-mono text-[12px] text-ink-700">{r.ccy}</td>
                  <td className="px-4 py-2 text-ink-900">{r.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.spot.toFixed(4)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.avg.toFixed(4)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.closing.toFixed(4)}</td>
                  <td className="px-4 py-2 text-ink-500">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Runs */}
        <aside className="p-5 rounded-2xl bg-surface-card shadow-neu">
          <div className="text-xs font-semibold text-ink-500 mb-3">Recent translation runs</div>
          <ul className="space-y-3">
            {RUNS.map((r, i) => (
              <li key={i} className="p-3 rounded-xl bg-surface-card shadow-neu-in-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-ink-900">{r.period}</div>
                  <span
                    className={`text-[10px] uppercase font-medium px-2 py-0.5 rounded ${
                      r.status === 'success' ? 'bg-good/10 text-good' : 'bg-warn/10 text-warn'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="text-[11px] text-ink-500 mt-1">
                  {r.triggered} · {r.when}
                </div>
                <div className="text-[11px] text-ink-500 mt-1">
                  {r.cta} CTA postings · {r.err} exceptions
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
