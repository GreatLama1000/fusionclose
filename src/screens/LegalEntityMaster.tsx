import React, { useState } from 'react';
import Icon from '../components/Icon';
import { Clip, GridCol, GridHead, useGrid } from '../components/grid/Grid';

type Entity = {
  code: string;
  name: string;
  country: string;
  currency: string;
  parent: string;
  ownership: number;
  gaap: string;
  status: 'active' | 'dormant' | 'acquired';
};

const ENTITIES: Entity[] = [
  { code: 'FC-000', name: 'Fusion Close Holdings PLC', country: 'GB', currency: 'GBP', parent: '—',      ownership: 100, gaap: 'IFRS',    status: 'active' },
  { code: 'FC-010', name: 'Fusion Close US Inc.',      country: 'US', currency: 'USD', parent: 'FC-000', ownership: 100, gaap: 'US GAAP', status: 'active' },
  { code: 'FC-011', name: 'Fusion Close US Services',  country: 'US', currency: 'USD', parent: 'FC-010', ownership: 100, gaap: 'US GAAP', status: 'active' },
  { code: 'FC-020', name: 'Fusion Close DE GmbH',      country: 'DE', currency: 'EUR', parent: 'FC-000', ownership: 100, gaap: 'IFRS',    status: 'active' },
  { code: 'FC-021', name: 'Fusion Close DE Solutions', country: 'DE', currency: 'EUR', parent: 'FC-020', ownership:  75, gaap: 'IFRS',    status: 'active' },
  { code: 'FC-030', name: 'Fusion Close IN Pvt Ltd',   country: 'IN', currency: 'INR', parent: 'FC-000', ownership: 100, gaap: 'Ind AS',  status: 'active' },
  { code: 'FC-031', name: 'Fusion Close IN Tech',      country: 'IN', currency: 'INR', parent: 'FC-030', ownership: 100, gaap: 'Ind AS',  status: 'active' },
  { code: 'FC-040', name: 'Fusion Close SG Pte Ltd',   country: 'SG', currency: 'SGD', parent: 'FC-000', ownership: 100, gaap: 'IFRS',    status: 'active' },
  { code: 'FC-050', name: 'Fusion Close BR SA',        country: 'BR', currency: 'BRL', parent: 'FC-000', ownership:  80, gaap: 'IFRS',    status: 'active' },
  { code: 'FC-060', name: 'FC Legacy Systems (UK)',    country: 'GB', currency: 'GBP', parent: 'FC-000', ownership: 100, gaap: 'IFRS',    status: 'dormant' },
  { code: 'FC-070', name: 'ClosePro Analytics',        country: 'US', currency: 'USD', parent: 'FC-010', ownership:  60, gaap: 'US GAAP', status: 'acquired' },
];

const STATUS_TONE: Record<Entity['status'], string> = {
  active:   'bg-good/10 text-good',
  dormant:  'bg-surface-soft text-ink-500',
  acquired: 'bg-brand-500/10 text-brand-500',
};

/** register columns — every one sorts, filters, moves and freezes through the shared grid */
const COLS: GridCol[] = [
  { key: 'code', label: 'Code', w: 100 },
  { key: 'name', label: 'Legal name', w: 230 },
  { key: 'country', label: 'Country', w: 96 },
  { key: 'currency', label: 'CCY', w: 80 },
  { key: 'parent', label: 'Parent', w: 100 },
  { key: 'ownership', label: 'Own %', w: 92, num: true, align: 'right' },
  { key: 'gaap', label: 'GAAP', w: 104 },
  { key: 'status', label: 'Status', w: 112 },
];

export default function LegalEntityMaster() {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>('FC-020');

  const filtered = ENTITIES.filter((e) =>
    (e.code + e.name + e.country + e.currency).toLowerCase().includes(q.toLowerCase()),
  );
  const selected = ENTITIES.find((e) => e.code === sel) ?? filtered[0];
  const g = useGrid<Entity>('le-master', COLS, filtered, (e, k) => e[k as keyof Entity], { defFreeze: 'code', rowKey: (e) => e.code });

  return (
    <div className="p-8 grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-4">
        <header className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-400">Setup</div>
            <h1 className="text-2xl font-semibold text-ink-900">Legal Entity Master</h1>
            <p className="text-ink-500 mt-1">30 entities · 4 sub-groups · presentation currency USD</p>
          </div>
          <div className="flex gap-2">
            <button className="h-10 px-3 rounded-xl bg-surface-card shadow-neu-sm text-xs text-ink-700 flex items-center gap-2">
              <Icon path="M12 3v14M6 9l6-6 6 6" size={14} /> Import CSV
            </button>
            <button className="h-10 px-3 rounded-xl bg-brand-500 text-white text-xs shadow-primary flex items-center gap-2">
              <Icon path="M12 5v14M5 12h14" size={14} /> Add entity
            </button>
          </div>
        </header>

        <div className="p-2 rounded-xl bg-surface-card shadow-neu-in-sm flex items-center gap-2">
          <Icon path="M11 4a7 7 0 105 12l4 4" size={14} className="text-ink-400 ml-2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search entities, currencies, countries..."
            className="bg-transparent flex-1 h-8 text-sm focus:outline-none"
          />
          <span className="text-[11px] text-ink-400 pr-2">{filtered.length} results</span>
        </div>

        <div className="rounded-2xl bg-surface-card shadow-neu overflow-auto">
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%', font: 'inherit', tableLayout: 'fixed' }}>
            <thead>
              <GridHead g={g} />
            </thead>
            <tbody>
              {g.rows.map((e) => {
                const bg = sel === e.code ? '#EEF3FE' : '#fff';
                return (
                  <tr key={e.code} onClick={() => setSel(e.code)} style={{ cursor: 'pointer', fontSize: '12.5px' }}>
                    {g.cols.map((c) => (
                      <td key={c.key} style={g.td(c, bg)}>
                        {c.key === 'status' ? (
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_TONE[e.status]}`}>{e.status}</span>
                        ) : c.key === 'ownership' ? (
                          <span className="text-ink-700 tabular-nums">{e.ownership.toFixed(0)}%</span>
                        ) : (
                          <Clip g={g} rk={e.code} ck={c.key} style={c.key === 'code' || c.key === 'parent' ? { fontFamily: 'ui-monospace,Menlo,monospace', fontSize: '12px' } : undefined}>
                            {String(e[c.key as keyof Entity])}
                          </Clip>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail rail */}
      {selected && (
        <aside className="lg:sticky lg:top-6 self-start p-5 rounded-2xl bg-surface-card shadow-neu space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-ink-400">Entity detail</div>
          <div className="text-lg font-semibold text-ink-900">{selected.name}</div>
          <div className="font-mono text-xs text-ink-500">{selected.code}</div>

          <dl className="grid grid-cols-2 gap-3 pt-2">
            <Detail label="Country"  value={selected.country} />
            <Detail label="Currency" value={selected.currency} />
            <Detail label="Parent"   value={selected.parent} />
            <Detail label="Ownership" value={`${selected.ownership}%`} />
            <Detail label="GAAP"     value={selected.gaap} />
            <Detail label="Status"   value={selected.status} />
          </dl>

          <div className="pt-3 space-y-2">
            <button className="w-full h-10 rounded-xl bg-brand-500 text-white text-sm shadow-primary">
              Edit entity
            </button>
            <button className="w-full h-10 rounded-xl bg-surface-card shadow-neu-sm text-sm text-ink-700">
              View ownership tree
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className="text-sm text-ink-900 mt-0.5">{value}</div>
    </div>
  );
}
