import React, { useMemo, useState } from 'react';
import Icon from '../components/Icon';

type Row = {
  entity: string;
  account: string;
  name: string;
  fsli: string;
  debit: number;
  credit: number;
};

const ROWS: Row[] = [
  { entity: 'FC-010', account: '1000', name: 'Cash - Operating',       fsli: 'Cash & equivalents', debit:  1250000, credit:       0 },
  { entity: 'FC-010', account: '1100', name: 'Accounts Receivable',    fsli: 'Trade receivables',  debit:   840000, credit:       0 },
  { entity: 'FC-010', account: '1500', name: 'Inventory',              fsli: 'Inventory',          debit:   612000, credit:       0 },
  { entity: 'FC-010', account: '2000', name: 'Accounts Payable',       fsli: 'Trade payables',     debit:        0, credit:  478000 },
  { entity: 'FC-010', account: '3000', name: 'Share Capital',          fsli: 'Equity',             debit:        0, credit: 2000000 },
  { entity: 'FC-010', account: '4000', name: 'Revenue',                fsli: 'Revenue',            debit:        0, credit: 4820000 },
  { entity: 'FC-010', account: '5000', name: 'Cost of Sales',          fsli: 'Cost of sales',     debit:  2610000, credit:       0 },
  { entity: 'FC-010', account: '6100', name: 'Salaries & Wages',       fsli: 'Employee benefits',  debit:   980000, credit:       0 },
  { entity: 'FC-010', account: '6200', name: 'Marketing',              fsli: 'Selling & admin',    debit:   240000, credit:       0 },
  { entity: 'FC-010', account: '7100', name: 'Depreciation',           fsli: 'D&A',                debit:   132000, credit:       0 },
  { entity: 'FC-010', account: '8000', name: 'Interest Expense',       fsli: 'Finance costs',      debit:    48000, credit:       0 },
  { entity: 'FC-010', account: '9000', name: 'Income Tax',             fsli: 'Tax expense',        debit:   186000, credit:       0 },
];

const fmt = (n: number) => n === 0 ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function TrialBalance() {
  const [entity, setEntity] = useState('FC-010');
  const [q, setQ] = useState('');

  const filtered = useMemo(
    () => ROWS.filter((r) =>
      r.entity === entity &&
      (r.account + r.name + r.fsli).toLowerCase().includes(q.toLowerCase()),
    ),
    [entity, q],
  );

  const totals = useMemo(() => filtered.reduce(
    (a, r) => ({ debit: a.debit + r.debit, credit: a.credit + r.credit }),
    { debit: 0, credit: 0 },
  ), [filtered]);

  const diff = totals.debit - totals.credit;

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-400">Data</div>
          <h1 className="text-2xl font-semibold text-ink-900">Trial Balance</h1>
          <p className="text-ink-500 mt-1">Raw TB · {entity} · Q3 FY25 · USD</p>
        </div>
        <div className="flex gap-2">
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="h-10 px-3 rounded-xl bg-surface-card shadow-neu-in-sm text-sm text-ink-800"
          >
            {['FC-000', 'FC-010', 'FC-020', 'FC-030', 'FC-040'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="h-10 px-4 rounded-xl bg-brand-500 text-white text-sm shadow-primary">
            Export
          </button>
        </div>
      </header>

      {/* Summary */}
      <div className="grid md:grid-cols-4 gap-3">
        <Kpi label="Debits"   value={fmt(totals.debit)} />
        <Kpi label="Credits"  value={fmt(totals.credit)} />
        <Kpi label="Difference" value={fmt(Math.abs(diff))} tone={diff === 0 ? 'good' : 'danger'} />
        <Kpi label="Accounts" value={filtered.length.toString()} />
      </div>

      {/* Search */}
      <div className="p-2 rounded-xl bg-surface-card shadow-neu-in-sm flex items-center gap-2">
        <Icon path="M11 4a7 7 0 105 12l4 4" size={14} className="text-ink-400 ml-2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter accounts, names, FSLI..."
          className="bg-transparent flex-1 h-8 text-sm focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-surface-card shadow-neu overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-ink-400 bg-surface-card2">
              <th className="text-left px-4 py-2">Account</th>
              <th className="text-left px-4 py-2">Description</th>
              <th className="text-left px-4 py-2">FSLI</th>
              <th className="text-right px-4 py-2">Debit</th>
              <th className="text-right px-4 py-2">Credit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.account} className="border-t border-surface-line/40 hover:bg-surface-soft">
                <td className="px-4 py-2 font-mono text-[12px] text-ink-700">{r.account}</td>
                <td className="px-4 py-2 text-ink-900">{r.name}</td>
                <td className="px-4 py-2 text-ink-600">{r.fsli}</td>
                <td className="px-4 py-2 text-right tabular-nums text-ink-900">{fmt(r.debit)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-ink-900">{fmt(r.credit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink-200 bg-surface-card2 font-semibold">
              <td className="px-4 py-2 text-ink-900" colSpan={3}>Totals</td>
              <td className="px-4 py-2 text-right tabular-nums text-ink-900">{fmt(totals.debit)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-ink-900">{fmt(totals.credit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'danger' }) {
  const color = tone === 'good' ? 'text-good' : tone === 'danger' ? 'text-danger' : 'text-ink-900';
  return (
    <div className="p-4 rounded-2xl bg-surface-card shadow-neu-sm">
      <div className="text-[11px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className={`text-lg font-semibold tabular-nums mt-1 ${color}`}>{value}</div>
    </div>
  );
}
