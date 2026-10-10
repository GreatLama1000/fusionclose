import React, { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { useTbUploads, TbUploads, TbUploadModal, TbStatusButton, TbSettingsPanel } from '../components/TbUpload';
import { JournalEntriesTab, useJournal } from './journal/JournalEntries';
import { Clip, GridCol, GridHead, useGrid } from '../components/grid/Grid';

/**
 * Financial Data Layer — ported from docs/design/Fusion Close.dc.html,
 * block `<sc-if value="{{ is.upload }}">` lines 1183–1552.
 *
 * One screen, two visible tabs (Trial Balance / Journal Entries) plus the FSLI
 * mapping sub-view, which is reached from the TB tab's mapping button and hides
 * the header while open (`fdlHeaderOn`, line 10583).
 *
 * Data: tbAccounts 10191, tbMonthDefs 10204, tsSeed 6000,
 * fsliTree 5927, fsliCatalog 5893, fsliDefaultMap 5916, fsliMonDefault 5922.
 */

/* ============================== shared ============================== */

const SECTION: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: '#ECEFF6',
  border: '1px solid rgba(255,255,255,.75)',
  boxShadow: '9px 9px 22px rgba(166,175,195,.5),-9px -9px 22px rgba(255,255,255,.95)',
};

const INSET: React.CSSProperties = {
  background: '#E4E8F0',
  border: '1px solid #CBD2E0',
  boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.4),inset -2px -2px 5px rgba(255,255,255,.9)',
  borderRadius: '9px',
  color: '#333D55',
  font: 'inherit',
  outline: 'none',
};

const SOFT_BTN: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  height: '32px',
  padding: '0 12px',
  borderRadius: '9px',
  background: '#E4E8F0',
  boxShadow: '1px 1px 3px rgba(166,175,195,.5),-1px -1px 3px rgba(255,255,255,.9)',
  fontSize: '11.5px',
  fontWeight: 700,
  color: '#65708C',
};

const PRIMARY_BTN: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  height: '32px',
  padding: '0 15px',
  borderRadius: '9px',
  background: 'linear-gradient(145deg,#3B82F6,#2563EB)',
  fontSize: '12px',
  fontWeight: 700,
  color: '#fff',
};


/* =========================== trial balance =========================== */

const TB_ACCOUNTS: [string, string, string, string, number][] = [
  ['UK01', '1010', 'Cash at bank', 'Treasury', 6204000],
  ['UK01', '1210', 'Trade receivables — third party', 'Sales', 9876000],
  ['UK01', '1500', 'Property, plant & equipment', 'Operations', 18420000],
  ['UK01', '5010', 'Cost of sales', 'Operations', 42600000],
  ['UK01', '6010', 'Operating expenses', 'Corporate', 15900000],
  ['UK01', '2010', 'Trade payables', 'Procurement', -12580000],
  ['UK01', '2500', 'Bank borrowings', 'Treasury', -14200000],
  ['UK01', '3000', 'Share capital', 'Corporate', -5000000],
  ['UK01', '3100', 'Retained earnings b/f', 'Corporate', -3320000],
  ['UK01', '4010', 'Revenue — goods', 'Sales', -57900000],
];

const TB_MONTHS = [
  { key: '2026-07', label: "Jul '26", q: 'Q3 2026', fy: 'FY 2026', f: 0.9 },
  { key: '2026-08', label: "Aug '26", q: 'Q3 2026', fy: 'FY 2026', f: 0.95 },
  { key: '2026-09', label: "Sep '26", q: 'Q3 2026', fy: 'FY 2026', f: 1.0 },
];

/** last account is the plug, so every period column sums to nil */
const monthNet = (ai: number, mi: number) => {
  const f = TB_MONTHS[mi].f;
  if (ai < TB_ACCOUNTS.length - 1) return Math.round(TB_ACCOUNTS[ai][4] * f);
  let s = 0;
  for (let k = 0; k < TB_ACCOUNTS.length - 1; k++) s += Math.round(TB_ACCOUNTS[k][4] * f);
  return -s;
};

const fmtNet = (n: number) =>
  n === 0 ? '—' : n < 0 ? `(${Math.abs(n).toLocaleString('en-US')})` : n.toLocaleString('en-US');

type Gran = 'monthly' | 'quarterly' | 'annually' | 'custom';

/** one trial-balance account, its value per period bucket and its total */
type TbRow = { key: string; head: [string, string, string, string]; vals: number[]; rowTot: number };

function TrialBalanceTab({
  onOpenFsli,
  unmapped,
  up,
}: {
  onOpenFsli: () => void;
  unmapped: number;
  /** the TB upload queue — held by the screen so uploads outlive this tab */
  up: TbUploads;
}) {
  const [upOpen, setUpOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [gran, setGran] = useState<Gran>('monthly');
  const [custOpen, setCustOpen] = useState(false);
  const [custFrom, setCustFrom] = useState(0);
  const [custTo, setCustTo] = useState(2);
  const [full, setFull] = useState(false);
  const [valOpen, setValOpen] = useState(false);

  const buckets = useMemo(() => {
    if (gran === 'quarterly' || gran === 'annually') {
      const field = gran === 'quarterly' ? 'q' : 'fy';
      const map: Record<string, { label: string; months: number[] }> = {};
      TB_MONTHS.forEach((m, mi) => {
        const k = m[field as 'q' | 'fy'];
        (map[k] = map[k] ?? { label: k, months: [] }).months.push(mi);
      });
      return Object.values(map);
    }
    if (gran === 'custom') {
      const fi = Math.min(custFrom, custTo);
      const ti = Math.max(custFrom, custTo);
      const months: number[] = [];
      for (let i = fi; i <= ti; i++) months.push(i);
      return [{ label: `Custom · ${TB_MONTHS[fi].label}–${TB_MONTHS[ti].label}`, months }];
    }
    return TB_MONTHS.map((m, mi) => ({ label: m.label, months: [mi] }));
  }, [gran, custFrom, custTo]);

  const showTotal = buckets.length > 1;
  const bucketTotals = buckets.map(() => 0);
  let grand = 0;
  const rows: TbRow[] = TB_ACCOUNTS.map((a, ai) => {
    const vals = buckets.map((b, bi) => {
      const v = b.months.reduce((s, mi) => s + monthNet(ai, mi), 0);
      bucketTotals[bi] += v;
      return v;
    });
    const rowTot = vals.reduce((x, y) => x + y, 0);
    grand += rowTot;
    return { key: `${a[0]}|${a[1]}|${ai}`, head: [a[0], a[1], a[2], a[3]], vals, rowTot };
  });
  const balanced = bucketTotals.every((t) => t === 0);

  /* stable keys — the period buckets change with the granularity */
  const gridCols = useMemo<GridCol[]>(() => [
    { key: 'le', label: 'Legal Entity Code', w: 130 },
    { key: 'lcoa', label: 'Local Chart of Accounts (LCOA)', w: 150 },
    { key: 'desc', label: 'Local Account Description', w: 240 },
    { key: 'bu', label: 'Business Unit (BU)', w: 150 },
    ...buckets.map((b) => ({ key: `b:${b.label}`, label: b.label, w: 130, align: 'right' as const, num: true })),
    ...(showTotal ? [{ key: 'total', label: 'Total', w: 140, align: 'right' as const, num: true }] : []),
  ], [buckets, showTotal]);
  const bIdx: Record<string, number> = Object.fromEntries(buckets.map((b, i) => [`b:${b.label}`, i]));
  const g = useGrid<TbRow>('fdl-tb', gridCols, rows, (r, k) => {
    if (k === 'le') return r.head[0];
    if (k === 'lcoa') return r.head[1];
    if (k === 'desc') return r.head[2];
    if (k === 'bu') return r.head[3];
    if (k === 'total') return r.rowTot;
    return bIdx[k] !== undefined ? r.vals[bIdx[k]] : '';
  }, { defFreeze: 'le', rowKey: (r) => r.key });
  const footOf = (k: string) => (k === 'total' ? grand : bIdx[k] !== undefined ? bucketTotals[bIdx[k]] : null);

  const checks = [
    { ok: balanced, text: balanced ? 'Debits equal credits — both sides tie out.' : 'Debits do not equal credits.' },
    { ok: balanced, text: 'Net Amount column sums to nil across the trial balance.' },
    { ok: unmapped === 0, text: unmapped > 0 ? `${unmapped} account${unmapped === 1 ? '' : 's'} await FSLI mapping.` : 'All accounts mapped to a Financial Statement Line Item.' },
    { ok: true, text: 'Period Q3 2026 is open for posting.' },
  ];
  const issues = checks.filter((c) => !c.ok).length;

  return (
    <section
      style={{
        ...SECTION,
        padding: '22px',
        ...(full
          ? { position: 'fixed', top: 0, right: 0, bottom: 0, left: '68px', zIndex: 400, borderRadius: 0 }
          : { flex: 1, minHeight: 0, borderRadius: '18px' }),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {/* FSLI mapping status */}
        <button
          type="button"
          className="fc-h fc-btn"
          onClick={onOpenFsli}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', height: '32px', padding: '0 13px',
            borderRadius: '9px', fontSize: '11.5px', fontWeight: 700,
            ...(unmapped > 0
              ? { background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.5)', color: '#B45309' }
              : { background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.45)', color: '#15803D' }),
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: unmapped > 0 ? '#F59E0B' : '#16A34A' }} />
          {unmapped > 0 ? `FSLI mapping · ${unmapped} pending` : 'FSLI mapping · all mapped'}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>

        {/* validations */}
        <div style={{ position: 'relative' }}>
          <button
            type="button" className="fc-h fc-btn" onClick={() => setValOpen((v) => !v)}
            title="View trial-balance validations"
            style={{
              ...SOFT_BTN,
              color: issues ? '#B45309' : '#15803D',
              border: `1px solid ${issues ? 'rgba(245,158,11,.45)' : 'rgba(34,197,94,.4)'}`,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" />
            </svg>
            Validations
            {issues > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '15px', height: '15px', padding: '0 3px', borderRadius: '999px', background: '#F59E0B', color: '#fff', fontSize: '9px', fontWeight: 700 }}>
                {issues}
              </span>
            )}
          </button>
          {valOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 119 }} onClick={() => setValOpen(false)} />
              <div
                style={{
                  position: 'absolute', top: '38px', left: 0, zIndex: 120, width: '330px',
                  background: '#F1F3F9', border: '1px solid #D3D9E6', borderRadius: '12px',
                  boxShadow: '0 16px 36px rgba(45,54,80,.26)', padding: '12px',
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9AA3BA', marginBottom: '8px' }}>
                  Trial balance validations
                </div>
                {checks.map((c) => (
                  <div key={c.text} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '5px 0' }}>
                    <span style={{ flex: 'none', marginTop: '5px', width: '8px', height: '8px', borderRadius: '50%', background: c.ok ? '#16A34A' : '#F59E0B' }} />
                    <span style={{ flex: 1, fontSize: '11.5px', color: '#333D55', lineHeight: 1.4 }}>{c.text}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* granularity */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
          <select
            value={gran}
            onChange={(e) => setGran(e.target.value as Gran)}
            style={{ ...INSET, height: '32px', fontSize: '12px', fontWeight: 700, padding: '0 10px' }}
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
            <option value="custom">Custom</option>
          </select>
          {gran === 'custom' && (
            <>
              <button
                type="button" className="fc-h fc-btn" onClick={() => setCustOpen((v) => !v)}
                title="Set custom period range"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '32px', width: '34px', borderRadius: '9px', background: '#E4E8F0', border: '1px solid #3B5BDB', color: '#3B5BDB' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M3 10h18M8 3v4M16 3v4" />
                </svg>
              </button>
              {custOpen && (
                <div
                  style={{
                    position: 'absolute', top: '38px', left: 0, zIndex: 120, background: '#F1F3F9',
                    border: '1px solid #D3D9E6', borderRadius: '12px', boxShadow: '0 16px 36px rgba(45,54,80,.26)',
                    padding: '12px', width: '232px', display: 'flex', flexDirection: 'column', gap: '9px',
                  }}
                >
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9AA3BA' }}>
                    Custom period
                  </div>
                  {([['From period', custFrom, setCustFrom], ['To period', custTo, setCustTo]] as const).map(([label, val, setter]) => (
                    <label key={label} style={{ fontSize: '11px', fontWeight: 700, color: '#65708C', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {label}
                      <select
                        value={val}
                        onChange={(e) => setter(Number(e.target.value))}
                        style={{ ...INSET, height: '32px', borderRadius: '8px', fontSize: '12px', padding: '0 9px', boxShadow: 'none' }}
                      >
                        {TB_MONTHS.map((m, i) => <option key={m.key} value={i}>{m.label}</option>)}
                      </select>
                    </label>
                  ))}
                  <button
                    type="button" className="fc-h fc-btn" onClick={() => setCustOpen(false)}
                    style={{ textAlign: 'center', height: '32px', lineHeight: '32px', borderRadius: '8px', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff', fontSize: '12px', fontWeight: 700 }}
                  >
                    Apply range
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '11px', color: '#9AA3BA' }}>{TB_ACCOUNTS.length} accounts</span>
        <button
          type="button" className="fc-h fc-btn" onClick={() => setFull((v) => !v)}
          title={full ? 'Exit full screen' : 'View table full screen'}
          style={{ ...SOFT_BTN, width: '34px', padding: 0, justifyContent: 'center' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={full ? 'M4 9h5V4M20 9h-5V4M20 15h-5v5M4 15h5v5' : 'M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5'} />
          </svg>
        </button>
        {/* ingestion cadence */}
        <div style={{ position: 'relative' }}>
          <button
            type="button" className="fc-h fc-btn" onClick={() => setSetOpen((v) => !v)}
            title={`TB upload settings — ${up.settings.freq.toLowerCase()} ingestion`} aria-label="TB upload settings" aria-expanded={setOpen}
            style={{ ...SOFT_BTN, width: '34px', padding: 0, justifyContent: 'center', ...(setOpen ? { color: '#2563EB', border: '1px solid rgba(59,130,246,.45)' } : null) }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
          {setOpen && <TbSettingsPanel up={up} onClose={() => setSetOpen(false)} />}
        </div>
        {/* upload status — progress ring and activity list */}
        <TbStatusButton up={up} onOpen={() => setUpOpen(true)} />
        <button type="button" className="fc-h fc-btn" onClick={() => setUpOpen(true)} style={PRIMARY_BTN}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
          </svg>
          Upload TB
        </button>
      </div>

      {upOpen && (
        <TbUploadModal up={up} onClose={() => setUpOpen(false)} onSettings={() => { setUpOpen(false); setSetOpen(true); }} />
      )}

      <div style={{ overflow: 'auto', border: '1px solid #DCE0EB', borderRadius: '12px', flex: 1, minHeight: 0 }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%', font: 'inherit', tableLayout: 'fixed' }}>
          <thead>
            <GridHead g={g} />
          </thead>
          <tbody>
            {g.rows.map((r) => (
              <tr key={r.key}>
                {g.cols.map((c) => {
                  const bg = '#ECEFF6';
                  if (c.key === 'le') return <td key={c.key} style={g.td(c, bg, { fontWeight: 700, color: '#232C42', fontSize: '10.5px' })}><Clip g={g} rk={r.key} ck={c.key}>{r.head[0]}</Clip></td>;
                  if (c.key === 'lcoa') return <td key={c.key} style={g.td(c, bg, { color: '#333D55', fontWeight: 600, fontSize: '10.5px' })}><Clip g={g} rk={r.key} ck={c.key}>{r.head[1]}</Clip></td>;
                  if (c.key === 'desc' || c.key === 'bu') {
                    return <td key={c.key} style={g.td(c, bg, { color: '#65708C', fontSize: '10.5px' })}><Clip g={g} rk={r.key} ck={c.key}>{r.head[c.key === 'desc' ? 2 : 3]}</Clip></td>;
                  }
                  const v = c.key === 'total' ? r.rowTot : r.vals[bIdx[c.key]];
                  return (
                    <td key={c.key} style={g.td(c, bg, { fontSize: '10.5px', fontVariantNumeric: 'tabular-nums', fontWeight: c.key === 'total' ? 700 : 400, color: v < 0 ? '#B42318' : c.key === 'total' ? '#232C42' : '#333D55' })}>
                      {fmtNet(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              {g.cols.map((c, i) => {
                const t = footOf(c.key);
                return (
                  <td key={c.key} style={g.td(c, '#E4E8F0', { position: 'sticky', bottom: 0, zIndex: g.freeze && i <= g.cols.findIndex((x) => x.key === g.freeze) ? 4 : 3, background: '#E4E8F0', borderTop: '2px solid #CBD2E0', fontSize: '10.5px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: t === null ? '#232C42' : t === 0 ? '#15803D' : '#B42318' })}>
                    {t === null ? (i === 0 ? 'Total' : '') : fmtNet(t)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/* ============================ FSLI mapping ============================ */

type Node =
  | { kind: 'grp'; key: string; label: string; kids: Node[] }
  | { kind: 'leaf'; key: string; label: string }
  | { kind: 'sub'; key: string; label: string };

const T = {
  grp: (key: string, label: string, kids: Node[]): Node => ({ kind: 'grp', key, label, kids }),
  leaf: (key: string, label: string): Node => ({ kind: 'leaf', key, label }),
  /** subtotals are keyed so their captions can be renamed like any other label */
  sub: (key: string, label: string): Node => ({ kind: 'sub', key, label }),
};

/**
 * How the hierarchy is presented — framework, any manual re-ordering, renamed
 * labels and the confirmation stamp. Held by the screen so it survives leaving
 * the mapping view.
 */
export type FsliLayout = {
  fw: 'usgaap' | 'ifrs';
  /** parent key → child keys, once the user has promoted / demoted something */
  order: Record<string, string[]>;
  labels: Record<string, string>;
  confirmed: { by: string; at: string } | null;
};

export const FSLI_LAYOUT0: FsliLayout = { fw: 'usgaap', order: {}, labels: {}, confirmed: null };

/**
 * The standard order for a framework (design `fwOrder`, line 8251). The Balance
 * Sheet always leads and the Income Statement follows; the framework only
 * decides whether current or non-current items come first.
 */
const fwOrder = (fw: FsliLayout['fw']): Record<string, string[]> => ({
  root: ['bs', 'is'],
  assets: fw === 'ifrs' ? ['nca', 'ca'] : ['ca', 'nca'],
  liab: fw === 'ifrs' ? ['ncl', 'cl', 'eq'] : ['cl', 'ncl', 'eq'],
});

const FSLI_TREE: Node[] = [
  T.grp('bs', 'Balance Sheet', [
    T.grp('assets', 'Assets', [
      T.grp('ca', 'Current assets', [
        T.leaf('cash', 'Cash and cash equivalents'),
        T.leaf('sti', 'Short-term investments'),
        T.leaf('ar', 'Accounts receivable, net'),
        T.leaf('inv', 'Inventories, net'),
        T.leaf('cca', 'Contract cost assets'),
        T.leaf('ppd', 'Prepaid expenses and other current assets'),
        T.leaf('ahs', 'Assets held for sale'),
        T.sub('tca', 'Total current assets'),
      ]),
      T.grp('nca', 'Non-current assets', [
        T.leaf('ppe', 'Property, plant & equipment, net'),
        T.leaf('intang', 'Intangible assets'),
        T.leaf('gw', 'Goodwill'),
        T.leaf('rou', 'Right-of-use assets'),
        T.leaf('dta', 'Deferred tax assets'),
        T.sub('tnca', 'Total non-current assets'),
      ]),
      T.sub('ta', 'Total assets'),
    ]),
    T.grp('liab', 'Liabilities and stockholders’ equity', [
      T.grp('cl', 'Current liabilities', [
        T.leaf('ap', 'Trade and other payables'),
        T.leaf('accr', 'Accrued liabilities'),
        T.leaf('stb', 'Short-term borrowings'),
        T.sub('tcl', 'Total current liabilities'),
      ]),
      T.grp('ncl', 'Non-current liabilities', [
        T.leaf('ltb', 'Long-term borrowings'),
        T.leaf('dtl', 'Deferred tax liabilities'),
        T.leaf('lease', 'Lease liabilities'),
        T.sub('tncl', 'Total non-current liabilities'),
      ]),
      T.grp('eq', 'Stockholders’ equity', [
        T.leaf('sc', 'Share capital & reserves'),
        T.leaf('re', 'Retained earnings'),
        T.sub('teq', 'Total equity'),
      ]),
    ]),
  ]),
  T.grp('is', 'Income Statement', [
    T.leaf('rev', 'Revenue'),
    T.leaf('cos', 'Cost of sales'),
    T.leaf('opex', 'Operating expenses'),
    T.leaf('fin', 'Finance costs'),
    T.leaf('tax', 'Income tax expense'),
  ]),
];

const CATALOG: [string, string][] = [
  ['1000', 'Operating Account'], ['1015', 'Secondary Account'], ['1025', 'Operating Account - Prior'],
  ['1030', 'Money Market Account'], ['1115', 'Accounts Receivable - Other'], ['1116', 'Accounts Receivable - Related Party'],
  ['1210', 'Raw Materials'], ['1220', 'Packaging'], ['1230', 'Interim Sales'], ['1240', 'WIP'], ['1290', 'Inventory Reserve'],
  ['1205', 'Inventory in Transit'], ['1100', 'Accounts Receivable - Trade'], ['1110', 'Accounts Receivable - Intercompany Trade'],
  ['1190', 'AR Doubtful Allowance'], ['1280', 'Inventory Adjustments'], ['1295', 'Inventory - Other'],
  ['1296', 'Inventory - Tariff Costs'], ['1299', 'Inventory-Contra'], ['1305', 'Accrued Taxes Receivable'],
  ['1309', 'Vendor Prepayments'], ['1310', 'Prepaid Insurance'], ['1311', 'Prepaid Marketing'],
  ['1313', 'Prepaid Licenses & Subscriptions'], ['1330', 'Other Prepaids'], ['1390', 'Derivative Contract - Short Term'],
  ['1400', 'PP&E: Manufacturing Equipment'], ['1410', 'PP&E: Vehicles'], ['1420', 'PP&E: Computer Equipment'],
  ['1430', 'PP&E: Marketing Equipment'], ['1440', 'PP&E: Furniture and Fixtures'], ['1450', 'PP&E: Leasehold Improvements'],
  ['1460', 'PP&E: Software'], ['1480', 'Construction in Progress'], ['1490', 'ROU Finance Lease'],
  ['1500', 'PP&E: Manufacturing Equipment - Accum Depr'], ['1510', 'PP&E: Vehicles - Accum Depr'],
  ['1520', 'PP&E: Computer Equipment - Accum Depr'], ['1600', 'Goodwill - Acquired'], ['1650', 'Intangibles - Customer Lists'],
  ['1700', 'Deferred Tax Asset'], ['2010', 'Trade Payables'], ['2020', 'Accrued Payroll'], ['2100', 'Short-term Borrowings'],
  ['2200', 'Accrued Interest Payable'], ['2500', 'Long-term Borrowings'], ['2600', 'Deferred Tax Liability'],
  ['2700', 'Lease Liability - Non-current'], ['3000', 'Share Capital'], ['3100', 'Additional Paid-in Capital'],
  ['3200', 'Retained Earnings'], ['4010', 'Revenue - Goods'], ['4020', 'Revenue - Services'],
  ['5010', 'Cost of Sales - Materials'], ['5020', 'Cost of Sales - Labor'], ['6100', 'Selling Expenses'],
  ['6200', 'General & Administrative'], ['6240', 'Restructuring Costs'], ['6250', 'Cloud Subscription Costs'],
  ['7100', 'Interest Expense'], ['8100', 'Income Tax Expense'],
];

const CATALOG_NAME = Object.fromEntries(CATALOG);

const DEFAULT_MAP: Record<string, string[]> = {
  cash: ['1000', '1015', '1025'],
  sti: ['1030'],
  ar: ['1115', '1116'],
  inv: ['1210', '1220', '1230', '1240', '1290'],
  cca: ['1205'],
};

const MON_DEFAULT: Record<string, 'mon' | 'non'> = {
  cash: 'mon', sti: 'mon', ar: 'mon', dta: 'mon', inv: 'non', cca: 'non', ahs: 'non', ppe: 'non',
  intang: 'non', gw: 'non', rou: 'non', ap: 'mon', accr: 'mon', stb: 'mon', ltb: 'mon', dtl: 'mon',
  lease: 'mon', sc: 'non', re: 'non', rev: 'non', cos: 'non', opex: 'non', fin: 'non', tax: 'non',
};

/** MON_META, design line 8299 */
const MON_META = {
  mon: ['Monetary', '#2C4BD1', 'Monetary — retranslated at the closing rate. Click to switch to non-monetary.'],
  non: ['Non-monetary', '#B42318', 'Non-monetary — translated at the rate on the measurement date. Click to switch to monetary.'],
} as const;
const MON_NEXT = { mon: 'non', non: 'mon' } as const;

/** the unmapped-COA panel's fold toggle — same button as the side navigation's (Sidebar.tsx) */
const POOL_TOGGLE: React.CSSProperties = {
  flex: 'none', width: '24px', height: '24px', borderRadius: '7px', display: 'grid', placeItems: 'center',
  color: '#65708C', background: '#E4E8F0',
  boxShadow: 'inset 1px 1px 3px rgba(166,175,195,.5),inset -1px -1px 3px rgba(255,255,255,.9)',
};

function FsliMapping({
  onBack, map, setMap, layout, setLayout,
}: {
  onBack: () => void;
  map: Record<string, string[]>;
  setMap: (m: Record<string, string[]>) => void;
  layout: FsliLayout;
  setLayout: (l: FsliLayout) => void;
}) {
  const { currentUser } = useApp();
  const confirmBy = currentUser.name;
  const [poolOpen, setPoolOpen] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [mon, setMon] = useState<Record<string, 'mon' | 'non'>>(MON_DEFAULT);
  /** per-account overrides of the line item's classification (design: coaMon) */
  const [coaMon, setCoaMon] = useState<Record<string, 'mon' | 'non'>>({});
  const [poolQ, setPoolQ] = useState('');
  const [over, setOver] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);

  const mapped = new Set(Object.values(map).flat());
  const pool = CATALOG.filter(([code, name]) =>
    !mapped.has(code) && (code + ' ' + name).toLowerCase().includes(poolQ.trim().toLowerCase()),
  );
  const displayCodes = pool.map(([c]) => c);

  /** move one or many accounts at once (design: fsliMoveMany, line 5980) */
  const assignMany = (codes: string[], target: string | null) => {
    const next: Record<string, string[]> = {};
    Object.keys(map).forEach((k) => { next[k] = map[k].filter((x) => !codes.includes(x)); });
    if (target) next[target] = [...(next[target] ?? []), ...codes];
    setMap(next);
    if (layout.confirmed) setLayout({ ...layout, confirmed: null });
    setSel([]);
    setAnchor(null);
  };
  const assign = (code: string, target: string | null) => assignMany([code], target);

  /** click / shift-click range / ctrl-click toggle (design: onTileClick, line 8404) */
  const onTileClick = (code: string) => (e: React.MouseEvent) => {
    if (e.shiftKey && anchor) {
      const a = displayCodes.indexOf(anchor);
      const b = displayCodes.indexOf(code);
      if (a >= 0 && b >= 0) {
        setSel(displayCodes.slice(Math.min(a, b), Math.max(a, b) + 1));
        return;
      }
    }
    if (e.metaKey || e.ctrlKey) {
      setSel((cur) => (cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code]));
      setAnchor(code);
      return;
    }
    setSel([code]);
    setAnchor(code);
  };

  /** dragging a selected tile carries the whole selection */
  const dragPayload = (code: string) => (sel.includes(code) && sel.length > 1 ? sel : [code]);

  /* ---- presentation order (design `buildFsli()` fwOrder / orderChildren, line 8257) ---- */
  const { fw, order: orderOv, labels } = layout;
  /** any change to the hierarchy or the mapping re-opens it for confirmation */
  const patchLayout = (p: Partial<FsliLayout>) => setLayout({ ...layout, ...p, confirmed: null });

  const orderChildren = (nodes: Node[], parentKey: string) => {
    const movable = nodes.filter((n): n is Exclude<Node, { kind: 'sub' }> => n.kind !== 'sub');
    const subs = nodes.filter((n) => n.kind === 'sub');
    const byKey = Object.fromEntries(movable.map((n) => [n.key, n]));
    const want = orderOv[parentKey] ?? fwOrder(fw)[parentKey] ?? movable.map((n) => n.key);
    const list = want.map((k) => byKey[k]).filter(Boolean);
    movable.forEach((n) => { if (!list.includes(n)) list.push(n); });
    return { list, subs, keys: list.map((n) => n.key) };
  };

  /** promote / demote within the parent — swaps with the sibling above or below */
  const move = (parentKey: string, keys: string[], key: string, dir: -1 | 1) => () => {
    const i = keys.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= keys.length) return;
    const nk = [...keys];
    [nk[i], nk[j]] = [nk[j], nk[i]];
    patchLayout({ order: { ...orderOv, [parentKey]: nk } });
  };

  /* ---- renaming: double-click a label, or its pencil ---- */
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const labelOf = (key: string, base: string) => labels[key] ?? base;
  const startEdit = (key: string, cur: string) => { setEditKey(key); setEditVal(cur); };
  const commitEdit = () => {
    if (!editKey) return;
    const v = editVal.replace(/\s+/g, ' ').trim();
    if (v && v !== labels[editKey]) patchLayout({ labels: { ...labels, [editKey]: v } });
    setEditKey(null);
  };

  /* ---- the two-column grid: FSLI | mapped COAs, divider resizable ---- */
  const [colW, setColW] = useState(300);
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = colW;
    const mv = (ev: MouseEvent) => setColW(Math.max(200, Math.min(560, w0 + ev.clientX - x0)));
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
  };
  const [mapQ, setMapQ] = useState('');
  const mf = mapQ.trim().toLowerCase();
  const chipMatch = (id: string) => !mf || `${id} ${CATALOG_NAME[id] ?? ''}`.toLowerCase().includes(mf);
  const visible = (n: Node): boolean =>
    !mf ? true : n.kind === 'sub' ? false : n.kind === 'leaf' ? (map[n.key] ?? []).some(chipMatch) : n.kids.some(visible);

  const DIVIDER = '#3B82F6';
  const pad = (depth: number) => 14 + depth * 18;

  const editBox = (
    <input
      value={editVal} autoFocus
      onChange={(e) => setEditVal(e.target.value)}
      onBlur={commitEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
        else if (e.key === 'Escape') setEditKey(null);
      }}
      style={{ ...INSET, flex: 1, minWidth: 0, height: '26px', padding: '0 8px', fontSize: '12px', fontWeight: 700, border: `1px solid ${DIVIDER}` }}
    />
  );

  const label = (key: string, text: string, style: React.CSSProperties) =>
    editKey === key ? editBox : (
      <>
        <span onDoubleClick={() => startEdit(key, text)} title="Double-click to rename" style={{ flex: 1, minWidth: 0, cursor: 'text', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...style }}>
          {text}
        </span>
        <button
          type="button" className="fc-btn" onClick={() => startEdit(key, text)} title="Rename" aria-label={`Rename ${text}`}
          style={{ flex: 'none', width: '18px', height: '18px', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#9AA3BA' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>
        </button>
      </>
    );

  const arrows = (parentKey: string, keys: string[], key: string, text: string, stacked: boolean) => {
    const i = keys.indexOf(key);
    const up = i > 0;
    const dn = i >= 0 && i < keys.length - 1;
    const btn = (on: boolean, dir: -1 | 1) => (
      <button
        type="button" className="fc-btn" disabled={!on} onClick={move(parentKey, keys, key, dir)}
        title={dir < 0 ? `Promote — move “${text}” up` : `Demote — move “${text}” down`}
        aria-label={dir < 0 ? `Move ${text} up` : `Move ${text} down`}
        style={{
          width: '20px', height: stacked ? '13px' : '20px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '8.5px', lineHeight: 1, color: on ? '#4055C8' : '#C7CCD9', background: on ? '#E4E8F0' : 'transparent',
          cursor: on ? 'pointer' : 'default',
        }}
      >
        {dir < 0 ? '▲' : '▼'}
      </button>
    );
    return (
      <span style={{ flex: 'none', display: 'inline-flex', flexDirection: stacked ? 'column' : 'row', gap: stacked ? '1px' : '3px' }}>
        {btn(up, -1)}{btn(dn, 1)}
      </span>
    );
  };

  const rows: React.ReactNode[] = [];
  const walk = (nodes: Node[], depth: number, parentKey: string) => {
    const { list, subs, keys } = orderChildren(nodes, parentKey);
    [...list, ...subs].forEach((n) => {
      if (!visible(n)) return;

      if (n.kind === 'sub') {
        const text = labelOf(n.key, n.label);
        rows.push(
          <div key={n.key} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #DFE3EC', background: 'rgba(219,224,235,.45)' }}>
            <div style={{ flex: 'none', width: `${colW}px`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '6px', padding: `8px 8px 8px ${pad(depth)}px` }}>
              {label(n.key, text, { fontSize: '11.5px', fontWeight: 700, color: '#414B62' })}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', padding: '8px 14px', borderLeft: `3px solid ${DIVIDER}40`, fontSize: '11px', color: '#9AA3BA', fontStyle: 'italic' }}>
              Subtotal — derived
            </div>
          </div>,
        );
        return;
      }

      const text = labelOf(n.key, n.label);

      if (n.kind === 'grp') {
        const isCol = !mf && collapsed[n.key] === true;
        rows.push(
          <div key={n.key} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #DFE3EC', background: depth === 0 ? 'rgba(59,130,246,.07)' : 'rgba(228,232,240,.5)' }}>
            <div style={{ flex: 'none', width: `${colW}px`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '7px', padding: `${depth === 0 ? 11 : 9}px 8px ${depth === 0 ? 11 : 9}px ${pad(depth)}px` }}>
              <button
                type="button" className="fc-btn" onClick={() => setCollapsed((c) => ({ ...c, [n.key]: !isCol }))}
                title={isCol ? 'Expand' : 'Collapse'} aria-expanded={!isCol}
                style={{ flex: 'none', width: '18px', height: '18px', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#E4E8F0', boxShadow: '1px 1px 2px rgba(166,175,195,.55),-1px -1px 2px rgba(255,255,255,.95)', color: '#4055C8', fontSize: '12px', fontWeight: 700, lineHeight: 1 }}
              >
                {isCol ? '＋' : '－'}
              </button>
              {label(n.key, text, { fontSize: depth === 0 ? '13.5px' : '12.5px', fontWeight: 700, color: '#232C42' })}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 12px', borderLeft: `3px solid ${DIVIDER}40` }}>
              {arrows(parentKey, keys, n.key, text, false)}
            </div>
          </div>,
        );
        if (!isCol) walk(n.kids, depth + 1, n.key);
        return;
      }

      /* ---- leaf: FSLI on the left, its mapped COAs on the right ---- */
      const ids = map[n.key] ?? [];
      const shown = mf ? ids.filter(chipMatch) : ids;
      const isOver = over === n.key;
      const leafCls: 'mon' | 'non' = mon[n.key] === 'non' ? 'non' : 'mon';
      const LM = MON_META[leafCls];
      rows.push(
        <div key={n.key} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #DFE3EC', ...(isOver ? { background: 'rgba(59,130,246,.08)' } : null) }}>
          <div style={{ flex: 'none', width: `${colW}px`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '6px', padding: `8px 8px 8px ${pad(depth)}px` }}>
            <button
              type="button" className="fc-btn" onClick={() => setMon((x) => ({ ...x, [n.key]: MON_NEXT[leafCls] }))}
              title={LM[2]} aria-label={LM[0]}
              style={{ flex: 'none', width: '11px', height: '11px', borderRadius: '50%', background: LM[1], boxShadow: `inset 0 1px 1px rgba(255,255,255,.5),0 0 0 3px ${LM[1]}1F` }}
            />
            {label(n.key, text, { fontSize: '12px', fontWeight: 600, color: '#414B62' })}
            {arrows(parentKey, keys, n.key, text, true)}
          </div>

          {/* drop zone — the mapped COAs column */}
          <div
            onDragOver={(e) => { e.preventDefault(); setOver(n.key); }}
            onDragLeave={() => setOver((o) => (o === n.key ? null : o))}
            onDrop={(e) => { e.preventDefault(); setOver(null); if (drag) assignMany(dragPayload(drag), n.key); setDrag(null); }}
            style={{
              flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '7px', padding: '8px 14px',
              borderLeft: `3px solid ${isOver || ids.length ? DIVIDER : `${DIVIDER}40`}`,
              background: isOver ? 'rgba(59,130,246,.1)' : ids.length ? 'transparent' : 'rgba(228,232,240,.35)',
              transition: 'background .12s, border-color .12s',
            }}
          >
            {shown.map((id) => {
              const cur: 'mon' | 'non' = coaMon[id] ?? leafCls;
              const CM = MON_META[cur];
              const ovr = !!coaMon[id] && coaMon[id] !== leafCls;
              return (
                <span
                  key={id} draggable
                  onDragStart={() => setDrag(id)}
                  onDragEnd={() => { setDrag(null); setOver(null); }}
                  title={`${id}  ·  ${CATALOG_NAME[id]}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px', cursor: 'grab', maxWidth: '100%', overflow: 'hidden',
                    padding: '4px 5px 4px 8px', borderRadius: '8px', background: '#ECEFF6',
                    border: `1px solid ${ovr ? `${CM[1]}66` : '#CBD6E8'}`,
                    boxShadow: '1px 1px 3px rgba(166,175,195,.4),-1px -1px 3px rgba(255,255,255,.85)',
                    fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
                  }}
                >
                  <button
                    type="button" className="fc-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      const nx = MON_NEXT[cur];
                      setCoaMon((m2) => {
                        const next = { ...m2 };
                        if (nx === leafCls) delete next[id];
                        else next[id] = nx;
                        return next;
                      });
                    }}
                    title={`${CM[0]} — ${CATALOG_NAME[id]}. Click to switch to ${MON_META[MON_NEXT[cur]][0].toLowerCase()}.${ovr ? ' Overrides the line item classification.' : ''}`}
                    style={{
                      flex: 'none', boxSizing: 'border-box', width: '11px', height: '11px', borderRadius: '50%', background: CM[1],
                      ...(ovr ? { boxShadow: `0 0 0 2px #fff,0 0 0 3.5px ${CM[1]}`, marginRight: '2px' } : { boxShadow: 'inset 0 1px 1px rgba(255,255,255,.5)' }),
                    }}
                  />
                  <b style={{ flex: 'none', fontWeight: 700, color: '#232C42' }}>{id}</b>
                  <span style={{ flex: 1, minWidth: 0, color: '#65708C', overflow: 'hidden', textOverflow: 'ellipsis' }}>{CATALOG_NAME[id]}</span>
                  <button
                    type="button" className="fc-btn" onClick={(e) => { e.stopPropagation(); assign(id, null); }} title="Unmap this account"
                    style={{ flex: 'none', width: '16px', height: '16px', borderRadius: '5px', color: '#9AA3BA', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              );
            })}
            {ids.length === 0 && (
              <span style={{ fontSize: '10.5px', color: '#A6AEC2', fontStyle: 'italic', pointerEvents: 'none' }}>Drag COAs here</span>
            )}
          </div>
        </div>,
      );
    });
  };
  walk(FSLI_TREE, 0, 'root');

  /* ---- confirm mappings — every account must sit under a line item first ---- */
  const unmappedCount = CATALOG.length - mapped.size;
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const confirm = () => {
    if (unmappedCount > 0) {
      setConfirmMsg(`${unmappedCount} account${unmappedCount === 1 ? ' is' : 's are'} still unmapped — map every COA before confirming.`);
      return;
    }
    setConfirmMsg(null);
    setLayout({ ...layout, confirmed: { by: confirmBy, at: new Date().toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } });
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '12px' }}>
      {/* hierarchy */}
      <section style={{ ...SECTION, flex: 1, minWidth: 0, borderRadius: '18px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '16px 18px 14px' }}>
          <button
            type="button" className="fc-h fc-btn" onClick={onBack}
            title="Back to the Financial Data Layer — trial balance and journal entries"
            style={{ ...SOFT_BTN, color: '#3B5BDB' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Financial Data Layer
          </button>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#232C42' }}>FSLI Hierarchy</span>
          <span
            title="Every local account must be mapped to a Financial Statement Line Item before it flows to the consolidated faces. Drag accounts from Unmapped COAs onto a line to map them; drag a chip back to unmap. Double-click any label to rename it; ▲ ▼ promote or demote it within its group."
            style={{ flex: 'none', cursor: 'help', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '15px', height: '15px', borderRadius: '50%', background: '#3B5BDB', color: '#fff', fontSize: '9px', fontWeight: 700, fontStyle: 'italic', lineHeight: 1 }}
          >
            i
          </span>
          <span style={{ fontSize: '11.5px', color: '#7A84A0', fontStyle: 'italic' }}>{mapped.size} accounts mapped</span>
          <span
            title="Line items and individual accounts classified as monetary or non-monetary for IAS 21 / ASC 830 translation. Click the dot on a line item to switch it; click the dot on an account chip to override that account."
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '9px', height: '24px', padding: '0 11px', borderRadius: '9px', background: '#E4E8F0',
              boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.45),inset -2px -2px 5px rgba(255,255,255,.9)', fontSize: '10px', fontWeight: 700, color: '#65708C',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: MON_META.mon[1] }} />
              Monetary
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: MON_META.non[1] }} />
              Non-monetary
            </span>
            {Object.keys(coaMon).length > 0 && <span style={{ color: '#3B5BDB' }}>{Object.keys(coaMon).length} account overrides</span>}
          </span>
          <div style={{ flex: 1 }} />
          <div
            title="Balance Sheet always leads and the Income Statement follows. IFRS presents non-current before current; US GAAP presents current first."
            style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px', borderRadius: '9px', background: '#E4E8F0', boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.45),inset -2px -2px 5px rgba(255,255,255,.9)' }}
          >
            {(['usgaap', 'ifrs'] as const).map((k) => (
              <button
                key={k} type="button" className="fc-h fc-btn" aria-pressed={fw === k}
                // a framework switch restores its standard order — BS first, IS second
                onClick={() => { if (fw !== k) patchLayout({ fw: k, order: {} }); }}
                style={{
                  height: '24px', padding: '0 11px', borderRadius: '7px', fontSize: '11px', fontWeight: 700,
                  ...(fw === k ? { background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff' } : { color: '#7A84A0' }),
                }}
              >
                {k === 'usgaap' ? 'US GAAP' : 'IFRS'}
              </button>
            ))}
          </div>
          <button type="button" className="fc-h fc-btn" onClick={() => setCollapsed({})} style={{ ...SOFT_BTN, height: '28px', color: '#3B5BDB' }}>＋ Expand</button>
          <button
            type="button" className="fc-h fc-btn"
            onClick={() => {
              const all: Record<string, boolean> = {};
              const w = (ns: Node[]) => ns.forEach((n) => { if (n.kind === 'grp') { all[n.key] = true; w(n.kids); } });
              w(FSLI_TREE);
              setCollapsed(all);
            }}
            style={{ ...SOFT_BTN, height: '28px', color: '#3B5BDB' }}
          >
            － Collapse
          </button>
          {layout.confirmed ? (
            <span
              title={`Confirmed by ${layout.confirmed.by} · ${layout.confirmed.at}. Any change to the mapping or hierarchy re-opens it.`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '32px', padding: '0 14px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, color: '#15803D', background: 'rgba(21,128,61,.1)', border: '1px solid rgba(21,128,61,.3)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              Mappings confirmed · {layout.confirmed.at}
            </span>
          ) : (
            <button
              type="button" className="fc-h fc-btn" onClick={confirm}
              title="Lock in the mapping so it flows to the consolidated faces"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '32px', padding: '0 16px', borderRadius: '9px', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', fontSize: '12px', fontWeight: 700, color: '#fff', boxShadow: '2px 2px 8px rgba(37,99,235,.3)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              Confirm mappings
            </button>
          )}
        </div>

        {confirmMsg && !layout.confirmed && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 18px 12px', padding: '8px 12px', borderRadius: '10px', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(217,119,6,.35)', fontSize: '11.5px', fontWeight: 600, color: '#92400E' }}>
            <span style={{ flex: 1 }}>{confirmMsg}</span>
            <button type="button" className="fc-btn" onClick={() => setConfirmMsg(null)} style={{ fontSize: '11px', fontWeight: 700, color: '#B45309' }}>Dismiss</button>
          </div>
        )}

        {/* column heads — FSLI | blue divider | mapped COAs */}
        <div style={{ display: 'flex', alignItems: 'stretch', borderTop: '1px solid #DFE3EC', borderBottom: '1px solid #CBD2E0', background: '#E4E8F0' }}>
          <span style={{ flex: 'none', boxSizing: 'border-box', width: `${colW}px`, padding: '8px 14px', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#7A84A0', display: 'flex', alignItems: 'center' }}>
            Financial Statement Line Item
          </span>
          <span onMouseDown={startResize} title="Drag to resize the column" style={{ flex: 'none', width: '9px', marginLeft: '-4px', marginRight: '-5px', cursor: 'col-resize', zIndex: 2 }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 12px', borderLeft: `3px solid ${DIVIDER}` }}>
            <span style={{ flex: 'none', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#7A84A0' }}>Mapped COAs</span>
            <div style={{ position: 'relative', flex: 'none', width: '210px', maxWidth: '100%' }}>
              <input
                value={mapQ} onChange={(e) => setMapQ(e.target.value)} placeholder="Filter mapped accounts…"
                style={{ ...INSET, width: '100%', boxSizing: 'border-box', height: '26px', fontSize: '11px', padding: '0 24px 0 9px' }}
              />
              {mf && (
                <button type="button" className="fc-btn" onClick={() => setMapQ('')} aria-label="Clear filter" style={{ position: 'absolute', right: '6px', top: '5px', fontSize: '13px', lineHeight: 1, color: '#9AA3BA' }}>×</button>
              )}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          {rows}
          {mf && rows.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '11.5px', color: '#7A84A0', fontStyle: 'italic' }}>No mapped account matches “{mapQ}”.</div>
          )}
        </div>
      </section>

      {/*
        * dropping a mapped chip back here unmaps it (design `onFsliPoolDrop`, line 8454);
        * the panel folds to a strip with the same toggle as the side navigation
        * (design `onPoolCollapse` / `poolCollapsed`, line 1523)
        */}
      <section
        onDragOver={(e) => { if (drag && mapped.has(drag)) e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); if (drag) assign(drag, null); setDrag(null); setOver(null); }}
        style={{
          ...SECTION, width: poolOpen ? '272px' : '52px', flex: 'none', borderRadius: '18px', overflow: 'hidden',
          transition: 'width .22s ease',
        }}
      >
        {!poolOpen ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '14px 0' }}>
            <button
              type="button" className="fc-btn" onClick={() => setPoolOpen(true)}
              title="Show unmapped COAs" aria-label="Expand unmapped COAs panel" aria-expanded={false}
              style={POOL_TOGGLE}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#B45309', background: 'rgba(245,158,11,.15)', padding: '2px 6px', borderRadius: '6px' }}>
              {pool.length}
            </span>
            <span
              onClick={() => setPoolOpen(true)}
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', cursor: 'pointer', fontSize: '11px', fontWeight: 700, letterSpacing: '.5px', color: '#65708C', whiteSpace: 'nowrap' }}
            >
              Unmapped COAs
            </span>
          </div>
        ) : (
        <>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #DCE0EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: '#232C42', whiteSpace: 'nowrap' }}>Unmapped COAs</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#B45309', background: 'rgba(245,158,11,.15)', padding: '2px 8px', borderRadius: '6px' }}>
              {pool.length}
            </span>
            <button
              type="button" className="fc-btn" onClick={() => setPoolOpen(false)}
              title="Collapse panel" aria-label="Collapse unmapped COAs panel" aria-expanded
              style={POOL_TOGGLE}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
          <input
            value={poolQ}
            onChange={(e) => setPoolQ(e.target.value)}
            placeholder="Search accounts…"
            style={{ ...INSET, width: '100%', boxSizing: 'border-box', height: '30px', fontSize: '11.5px', padding: '0 10px', marginTop: '9px' }}
          />
          {sel.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '9px' }}>
              <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: '#3B5BDB' }}>
                {sel.length} selected — drag any one to map them together
              </span>
              <button
                type="button" className="fc-btn"
                onClick={() => { setSel([]); setAnchor(null); }}
                style={{ fontSize: '10.5px', fontWeight: 700, color: '#7A84A0' }}
              >
                Clear
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '10px', color: '#8A93A8', fontStyle: 'italic', marginTop: '8px', lineHeight: 1.4 }}>
              Click to select, shift-click for a range, ⌘/Ctrl-click to add. Drag onto a line item to map.
            </div>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '10px 12px 16px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {pool.map(([code, name]) => {
            const selected = sel.includes(code);
            return (
              <div
                key={code}
                draggable
                onClick={onTileClick(code)}
                onDragStart={() => { if (!selected) { setSel([code]); setAnchor(code); } setDrag(code); }}
                onDragEnd={() => { setDrag(null); setOver(null); }}
                style={{
                  userSelect: 'none', cursor: 'grab', display: 'flex', alignItems: 'baseline', gap: '8px',
                  padding: '8px 11px', borderRadius: '9px',
                  ...(selected
                    ? { background: '#DCE7FB', border: '1px solid #3B82F6', boxShadow: '0 0 0 1px rgba(59,130,246,.4)' }
                    : {
                        background: '#E9ECF3', border: '1px solid #D6DBE8',
                        boxShadow: '1px 1px 3px rgba(166,175,195,.35),-1px -1px 3px rgba(255,255,255,.9)',
                      }),
                }}
              >
                <span style={{ flex: 'none', fontSize: '10px', fontWeight: 700, color: selected ? '#1D4ED8' : '#0F766E' }}>{code}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: '10.5px', color: '#65708C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </span>
              </div>
            );
          })}
          {pool.length === 0 && (
            <div style={{ padding: '30px 8px', textAlign: 'center', fontSize: '11.5px', color: '#15803D', fontStyle: 'italic' }}>
              Every account is mapped.
            </div>
          )}
        </div>
        </>
        )}
      </section>
    </div>
  );
}

/* ============================== screen ============================== */

export default function FinancialDataLayer() {
  const [tab, setTab] = useState<'tb' | 'je' | 'fsli'>('tb');
  const [map, setMap] = useState<Record<string, string[]>>(DEFAULT_MAP);
  const [fsliLayout, setFsliLayout] = useState<FsliLayout>(FSLI_LAYOUT0);
  const tbUp = useTbUploads();
  const journal = useJournal();

  const mappedCount = new Set(Object.values(map).flat()).size;
  const unmapped = CATALOG.length - mappedCount;

  const seg = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 18px', borderRadius: '10px',
    fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', transition: 'all .16s',
    ...(active
      ? { background: 'linear-gradient(180deg,#3B82F6,#2563EB)', color: '#fff', boxShadow: '0 3px 10px rgba(37,99,235,.45)' }
      : { color: '#8A93A8', background: 'transparent' }),
  });

  return (
    <div
      style={{
        padding: '18px 20px 20px',
        animation: 'fcFade .25s ease',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {tab !== 'fsli' && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#232C42', marginBottom: '9px' }}>Financial Data Layer</div>
          <div
            style={{
              display: 'inline-flex', gap: '5px', padding: '5px', borderRadius: '14px', background: '#EDF0F7',
              boxShadow: '3px 3px 9px rgba(166,175,195,.42),-3px -3px 9px rgba(255,255,255,.92)',
            }}
          >
            <button type="button" className="fc-h fc-btn" onClick={() => setTab('tb')} style={seg(tab === 'tb')}>Trial Balance</button>
            <button type="button" className="fc-h fc-btn" onClick={() => setTab('je')} style={seg(tab === 'je')}>Journal Entries</button>
          </div>
        </div>
      )}

      {tab === 'tb' && <TrialBalanceTab onOpenFsli={() => setTab('fsli')} unmapped={unmapped} up={tbUp} />}
      {tab === 'je' && <JournalEntriesTab store={journal} />}
      {tab === 'fsli' && <FsliMapping onBack={() => setTab('tb')} map={map} setMap={setMap} layout={fsliLayout} setLayout={setFsliLayout} />}
    </div>
  );
}
