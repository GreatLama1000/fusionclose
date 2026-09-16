import React, { useState } from 'react';
import Icon from '../components/Icon';
import { useApp } from '../state/AppContext';

type FileRow = {
  name: string;
  entity: string;
  period: string;
  size: string;
  rows: number;
  status: 'validated' | 'processing' | 'error';
  uploadedBy: string;
  when: string;
};

const FILES: FileRow[] = [
  { name: 'TB_FC-000_Q3-25.xlsx', entity: 'FC-000', period: 'Q3 FY25', size: '1.4 MB', rows: 4213, status: 'validated', uploadedBy: 'Amara Mensah', when: '2m ago' },
  { name: 'TB_FC-010_Q3-25.csv',  entity: 'FC-010', period: 'Q3 FY25', size: '820 KB',  rows: 2841, status: 'validated', uploadedBy: 'John D.',      when: '11m ago' },
  { name: 'TB_FC-020_Q3-25.xlsx', entity: 'FC-020', period: 'Q3 FY25', size: '1.1 MB', rows: 3520, status: 'error',     uploadedBy: 'John D.',      when: '18m ago' },
  { name: 'TB_FC-030_Q3-25.csv',  entity: 'FC-030', period: 'Q3 FY25', size: '640 KB',  rows: 2100, status: 'validated', uploadedBy: 'Priya N.',     when: '32m ago' },
  { name: 'TB_FC-040_Q3-25.xlsx', entity: 'FC-040', period: 'Q3 FY25', size: '760 KB',  rows: 2260, status: 'processing', uploadedBy: 'Sarah K.',    when: '1h ago' },
];

const STATUS_TONE: Record<FileRow['status'], string> = {
  validated:  'bg-good/10 text-good',
  processing: 'bg-brand-500/10 text-brand-500',
  error:      'bg-danger/10 text-danger',
};

export default function FinancialDataLayer() {
  const { navTo } = useApp();
  const [drag, setDrag] = useState(false);
  const [tab, setTab] = useState<'tb' | 'je' | 'files'>('files');

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-400">Data</div>
          <h1 className="text-2xl font-semibold text-ink-900">Financial Data Layer</h1>
          <p className="text-ink-500 mt-1">Trial balances, journal entries and source files for the close.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navTo('tb')} className="h-10 px-3 rounded-xl bg-surface-card shadow-neu-sm text-xs text-ink-700">
            View Trial Balance
          </button>
          <button onClick={() => navTo('fslimap')} className="h-10 px-3 rounded-xl bg-warn/10 text-warn text-xs font-medium border border-warn/30">
            FSLI mapping · 14 pending →
          </button>
        </div>
      </header>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); }}
        className={`p-8 rounded-2xl border-2 border-dashed transition ${
          drag ? 'border-brand-500 bg-brand-500/5' : 'border-surface-line bg-surface-card shadow-neu-in-sm'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-card shadow-neu grid place-items-center text-brand-500">
            <Icon path="M12 3v14M6 9l6-6 6 6M4 21h16" size={22} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-ink-900">Drop TB files here or click to upload</div>
            <div className="text-xs text-ink-500 mt-1">Excel · CSV · Netsuite export · SAP DATEV — up to 20MB per file</div>
          </div>
          <button className="h-10 px-4 rounded-xl bg-brand-500 text-white text-sm shadow-primary">
            Browse files
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['files', 'tb', 'je'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-9 px-4 rounded-xl text-sm ${
              tab === t
                ? 'bg-brand-500 text-white shadow-primary'
                : 'bg-surface-card shadow-neu-sm text-ink-700'
            }`}
          >
            {t === 'files' ? 'Uploaded files' : t === 'tb' ? 'Trial balance' : 'Journal entries'}
          </button>
        ))}
      </div>

      {/* Files table */}
      {tab === 'files' && (
        <div className="rounded-2xl bg-surface-card shadow-neu overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-400 bg-surface-card2">
                <th className="text-left px-4 py-2">File</th>
                <th className="text-left px-4 py-2">Entity</th>
                <th className="text-left px-4 py-2">Period</th>
                <th className="text-right px-4 py-2">Size</th>
                <th className="text-right px-4 py-2">Rows</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {FILES.map((f) => (
                <tr key={f.name} className="border-t border-surface-line/40 hover:bg-surface-soft">
                  <td className="px-4 py-2 text-ink-900 font-medium">{f.name}</td>
                  <td className="px-4 py-2 text-ink-600 font-mono text-[12px]">{f.entity}</td>
                  <td className="px-4 py-2 text-ink-600">{f.period}</td>
                  <td className="px-4 py-2 text-ink-600 text-right tabular-nums">{f.size}</td>
                  <td className="px-4 py-2 text-ink-600 text-right tabular-nums">{f.rows.toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_TONE[f.status]}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink-500">{f.uploadedBy} · {f.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'tb' && (
        <div className="p-6 rounded-2xl bg-surface-card shadow-neu text-sm text-ink-500">
          Trial Balance grid preview — <button onClick={() => navTo('tb')} className="text-brand-500 font-medium">open the full workspace →</button>
        </div>
      )}
      {tab === 'je' && (
        <div className="p-6 rounded-2xl bg-surface-card shadow-neu text-sm text-ink-500">
          Journal entries queue — auto-adjustments, IC eliminations and manual JEs will appear here.
        </div>
      )}
    </div>
  );
}
