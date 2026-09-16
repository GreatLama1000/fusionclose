import React, { useMemo, useState } from 'react';
import Icon from '../components/Icon';

type Pair = {
  id: string;
  a: string;
  b: string;
  category: 'sales' | 'loan' | 'services' | 'dividend';
  a_val: number;
  b_val: number;
  ccy: string;
};

const PAIRS: Pair[] = [
  { id: 'IC-001', a: 'FC-010', b: 'FC-020', category: 'sales',    a_val: 240000, b_val: 240000, ccy: 'USD' },
  { id: 'IC-002', a: 'FC-010', b: 'FC-030', category: 'services', a_val: 85000,  b_val: 84500,  ccy: 'USD' },
  { id: 'IC-003', a: 'FC-020', b: 'FC-021', category: 'loan',     a_val: 500000, b_val: 500000, ccy: 'EUR' },
  { id: 'IC-004', a: 'FC-030', b: 'FC-031', category: 'services', a_val: 62000,  b_val: 60000,  ccy: 'INR' },
  { id: 'IC-005', a: 'FC-040', b: 'FC-000', category: 'dividend', a_val: 150000, b_val: 150000, ccy: 'SGD' },
  { id: 'IC-006', a: 'FC-050', b: 'FC-000', category: 'sales',    a_val: 78000,  b_val: 77800,  ccy: 'BRL' },
];

const catColor: Record<Pair['category'], string> = {
  sales:    'bg-brand-500/10 text-brand-500',
  loan:     'bg-warn/10 text-warn',
  services: 'bg-good/10 text-good',
  dividend: 'bg-ink-500/10 text-ink-600',
};

export default function Intercompany() {
  const [tolerance, setTolerance] = useState(1000);

  const flagged = useMemo(
    () => PAIRS.map((p) => ({ ...p, diff: p.a_val - p.b_val, matched: Math.abs(p.a_val - p.b_val) <= tolerance })),
    [tolerance],
  );

  const total = flagged.length;
  const matched = flagged.filter((f) => f.matched).length;
  const mismatched = total - matched;

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-400">Consolidation</div>
          <h1 className="text-2xl font-semibold text-ink-900">Intercompany</h1>
          <p className="text-ink-500 mt-1">Match, reconcile and eliminate intercompany balances.</p>
        </div>
        <button className="h-10 px-4 rounded-xl bg-brand-500 text-white text-sm shadow-primary">
          Run elimination
        </button>
      </header>

      <div className="grid md:grid-cols-4 gap-3">
        <Kpi label="Pairs"       value={total} />
        <Kpi label="Matched"     value={matched} tone="good" />
        <Kpi label="Mismatched"  value={mismatched} tone="danger" />
        <div className="p-4 rounded-2xl bg-surface-card shadow-neu-sm">
          <div className="text-[11px] uppercase tracking-wider text-ink-400">Tolerance</div>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="range"
              min={0}
              max={5000}
              step={100}
              value={tolerance}
              onChange={(e) => setTolerance(+e.target.value)}
              className="flex-1"
            />
            <span className="text-sm font-semibold text-ink-900 tabular-nums w-16 text-right">
              {tolerance.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-surface-card shadow-neu overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-ink-400 bg-surface-card2">
              <th className="text-left px-4 py-2">ID</th>
              <th className="text-left px-4 py-2">Party A</th>
              <th className="text-left px-4 py-2">Party B</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-right px-4 py-2">A value</th>
              <th className="text-right px-4 py-2">B value</th>
              <th className="text-right px-4 py-2">Diff</th>
              <th className="text-left px-4 py-2">CCY</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {flagged.map((p) => (
              <tr key={p.id} className="border-t border-surface-line/40 hover:bg-surface-soft">
                <td className="px-4 py-2 font-mono text-[12px] text-ink-700">{p.id}</td>
                <td className="px-4 py-2 font-mono text-[12px] text-ink-600">{p.a}</td>
                <td className="px-4 py-2 font-mono text-[12px] text-ink-600">{p.b}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${catColor[p.category]}`}>
                    {p.category}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{p.a_val.toLocaleString()}</td>
                <td className="px-4 py-2 text-right tabular-nums">{p.b_val.toLocaleString()}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${p.diff === 0 ? 'text-ink-400' : 'text-danger'}`}>
                  {p.diff.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-ink-600">{p.ccy}</td>
                <td className="px-4 py-2">
                  {p.matched ? (
                    <span className="inline-flex items-center gap-1 text-xs text-good">
                      <Icon path="M5 12l5 5L20 7" size={14} /> matched
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-danger">
                      <Icon path="M12 8v5M12 17h.01M12 3l10 18H2z" size={14} /> mismatch
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'danger' }) {
  const color = tone === 'good' ? 'text-good' : tone === 'danger' ? 'text-danger' : 'text-ink-900';
  return (
    <div className="p-4 rounded-2xl bg-surface-card shadow-neu-sm">
      <div className="text-[11px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${color}`}>{value}</div>
    </div>
  );
}
