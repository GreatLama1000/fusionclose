import React, { useMemo, useState } from 'react';
import Icon from '../components/Icon';

type MapRow = {
  entity: string;
  account: string;
  name: string;
  suggested: string;
  assigned: string | null;
  confidence: number;
};

const INITIAL: MapRow[] = [
  { entity: 'FC-020', account: '2100', name: 'Trade payables DE',        suggested: 'Trade payables',       assigned: null,               confidence: 0.94 },
  { entity: 'FC-020', account: '2110', name: 'Accrued expenses',         suggested: 'Accrued liabilities',  assigned: null,               confidence: 0.88 },
  { entity: 'FC-020', account: '2200', name: 'Deferred revenue',         suggested: 'Contract liabilities', assigned: null,               confidence: 0.91 },
  { entity: 'FC-020', account: '2300', name: 'Tax provision',            suggested: 'Tax liabilities',      assigned: null,               confidence: 0.83 },
  { entity: 'FC-020', account: '2400', name: 'Employee bonus provision', suggested: 'Employee benefits',    assigned: null,               confidence: 0.76 },
  { entity: 'FC-020', account: '2500', name: 'Warranty provision',       suggested: 'Provisions',           assigned: null,               confidence: 0.72 },
  { entity: 'FC-020', account: '4300', name: 'Other operating income',   suggested: 'Other income',         assigned: null,               confidence: 0.68 },
  { entity: 'FC-010', account: '1000', name: 'Cash - Operating',         suggested: 'Cash & equivalents',   assigned: 'Cash & equivalents', confidence: 0.99 },
  { entity: 'FC-010', account: '4000', name: 'Revenue',                  suggested: 'Revenue',              assigned: 'Revenue',            confidence: 0.99 },
];

const FSLI_OPTIONS = [
  'Cash & equivalents', 'Trade receivables', 'Inventory', 'PP&E',
  'Trade payables', 'Accrued liabilities', 'Contract liabilities',
  'Tax liabilities', 'Employee benefits', 'Provisions',
  'Equity', 'Revenue', 'Other income', 'Cost of sales',
  'Selling & admin', 'D&A', 'Finance costs', 'Tax expense',
];

export default function FsliMapping() {
  const [rows, setRows] = useState(INITIAL);
  const [filter, setFilter] = useState<'all' | 'pending' | 'mapped'>('pending');

  const filtered = useMemo(() => rows.filter((r) =>
    filter === 'all' ? true : filter === 'pending' ? !r.assigned : !!r.assigned,
  ), [rows, filter]);

  const stats = useMemo(() => ({
    total: rows.length,
    mapped: rows.filter((r) => r.assigned).length,
    pending: rows.filter((r) => !r.assigned).length,
  }), [rows]);

  const assign = (account: string, value: string) => {
    setRows((rs) => rs.map((r) => r.account === account ? { ...r, assigned: value } : r));
  };
  const acceptSuggested = (account: string) => {
    setRows((rs) => rs.map((r) => r.account === account ? { ...r, assigned: r.suggested } : r));
  };
  const acceptAll = () => {
    setRows((rs) => rs.map((r) => r.assigned ? r : { ...r, assigned: r.suggested }));
  };

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-400">Data</div>
          <h1 className="text-2xl font-semibold text-ink-900">FSLI Mapping</h1>
          <p className="text-ink-500 mt-1">Account → FSLI mapping · AI suggestions with human review.</p>
        </div>
        <button
          onClick={acceptAll}
          className="h-10 px-4 rounded-xl bg-brand-500 text-white text-sm shadow-primary"
        >
          Accept all suggestions
        </button>
      </header>

      <div className="grid md:grid-cols-3 gap-3">
        <Kpi label="Total accounts" value={stats.total} tone="ink" />
        <Kpi label="Mapped"         value={stats.mapped} tone="good" />
        <Kpi label="Pending"        value={stats.pending} tone="warn" />
      </div>

      <div className="flex gap-2">
        {(['pending', 'mapped', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-9 px-4 rounded-xl text-sm ${
              filter === f
                ? 'bg-brand-500 text-white shadow-primary'
                : 'bg-surface-card shadow-neu-sm text-ink-700'
            }`}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-surface-card shadow-neu overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-ink-400 bg-surface-card2">
              <th className="text-left px-4 py-2">Entity</th>
              <th className="text-left px-4 py-2">Account</th>
              <th className="text-left px-4 py-2">Local name</th>
              <th className="text-left px-4 py-2">AI suggestion</th>
              <th className="text-left px-4 py-2">Assigned FSLI</th>
              <th className="text-left px-4 py-2 w-40">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.entity + r.account} className="border-t border-surface-line/40">
                <td className="px-4 py-2 font-mono text-[12px] text-ink-500">{r.entity}</td>
                <td className="px-4 py-2 font-mono text-[12px] text-ink-700">{r.account}</td>
                <td className="px-4 py-2 text-ink-900">{r.name}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-ink-700">{r.suggested}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-500 tabular-nums">
                      {Math.round(r.confidence * 100)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={r.assigned ?? ''}
                    onChange={(e) => assign(r.account, e.target.value)}
                    className="w-full h-8 px-2 rounded-lg bg-surface-card shadow-neu-in-sm text-sm text-ink-800"
                  >
                    <option value="">— unmapped —</option>
                    {FSLI_OPTIONS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  {!r.assigned && (
                    <button
                      onClick={() => acceptSuggested(r.account)}
                      className="h-8 px-3 rounded-lg bg-brand-500 text-white text-xs shadow-primary"
                    >
                      Accept ✓
                    </button>
                  )}
                  {r.assigned && (
                    <span className="text-xs text-good flex items-center gap-1">
                      <Icon path="M5 12l5 5L20 7" size={14} /> Mapped
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

function Kpi({ label, value, tone }: { label: string; value: number; tone: 'ink' | 'good' | 'warn' }) {
  const color = tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : 'text-ink-900';
  return (
    <div className="p-4 rounded-2xl bg-surface-card shadow-neu-sm">
      <div className="text-[11px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${color}`}>{value}</div>
    </div>
  );
}
