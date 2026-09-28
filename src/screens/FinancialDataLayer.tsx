import React, { useMemo, useState } from 'react';

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

const TH: React.CSSProperties = {
  padding: '7px 10px',
  textAlign: 'left',
  verticalAlign: 'top',
  color: '#1B3A5C',
  borderBottom: '1px solid #CBD2E0',
  borderTop: '2px solid #1B3A5C',
  fontSize: '9px',
  letterSpacing: '.4px',
  textTransform: 'uppercase',
  fontWeight: 700,
  background: '#E4E8F0',
  position: 'sticky',
  top: 0,
  zIndex: 5,
  whiteSpace: 'normal',
  lineHeight: 1.25,
};

const TD: React.CSSProperties = {
  padding: '5px 10px',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid #E7EAF2',
  fontSize: '10.5px',
  color: '#65708C',
};

const fieldKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

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

function TrialBalanceTab({
  onOpenFsli,
  unmapped,
}: {
  onOpenFsli: () => void;
  unmapped: number;
}) {
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
  const rows = TB_ACCOUNTS.map((a, ai) => {
    const vals = buckets.map((b, bi) => {
      const v = b.months.reduce((s, mi) => s + monthNet(ai, mi), 0);
      bucketTotals[bi] += v;
      return v;
    });
    const rowTot = vals.reduce((x, y) => x + y, 0);
    grand += rowTot;
    return { head: [a[0], a[1], a[2], a[3]], vals, rowTot };
  });
  const balanced = bucketTotals.every((t) => t === 0);

  const cols = [
    { label: 'Legal Entity Code', align: 'left' as const },
    { label: 'Local Chart of Accounts (LCOA)', align: 'left' as const },
    { label: 'Local Account Description', align: 'left' as const },
    { label: 'Business Unit (BU)', align: 'left' as const },
    ...buckets.map((b) => ({ label: b.label, align: 'right' as const })),
    ...(showTotal ? [{ label: 'Total', align: 'right' as const }] : []),
  ];

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
        <button type="button" className="fc-h fc-btn" style={PRIMARY_BTN}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
          </svg>
          Upload TB
        </button>
      </div>

      <div style={{ overflow: 'auto', border: '1px solid #DCE0EB', borderRadius: '12px', flex: 1, minHeight: 0 }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%', font: 'inherit' }}>
          <thead>
            <tr>
              {cols.map((c, ci) => (
                <th key={c.label} style={{ ...TH, textAlign: c.align, ...(ci === 0 ? { position: 'sticky', left: 0, zIndex: 6 } : null) }}>
                  {c.label}
                  <span style={{ display: 'block', marginTop: '2px', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: '8.5px', fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#8A93AB' }}>
                    {fieldKey(c.label)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                <td style={{ ...TD, position: 'sticky', left: 0, zIndex: 1, background: '#ECEFF6', fontWeight: 700, color: '#232C42' }}>{r.head[0]}</td>
                <td style={{ ...TD, color: '#333D55', fontWeight: 600 }}>{r.head[1]}</td>
                <td style={TD}>{r.head[2]}</td>
                <td style={TD}>{r.head[3]}</td>
                {r.vals.map((v, i) => (
                  <td key={i} style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: v < 0 ? '#B42318' : '#333D55' }}>{fmtNet(v)}</td>
                ))}
                {showTotal && (
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r.rowTot < 0 ? '#B42318' : '#232C42' }}>{fmtNet(r.rowTot)}</td>
                )}
              </tr>
            ))}
            <tr>
              <td style={{ ...TD, position: 'sticky', left: 0, zIndex: 1, background: '#E4E8F0', fontWeight: 700, color: '#232C42', borderTop: '2px solid #CBD2E0' }}>Total</td>
              {[1, 2, 3].map((i) => <td key={i} style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0' }} />)}
              {bucketTotals.map((t, i) => (
                <td key={i} style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: t === 0 ? '#15803D' : '#B42318' }}>
                  {fmtNet(t)}
                </td>
              ))}
              {showTotal && (
                <td style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: grand === 0 ? '#15803D' : '#B42318' }}>
                  {fmtNet(grand)}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* =========================== journal entries =========================== */

type JeLine = {
  lid: string; lcoa: string; gcoa: string; gdesc: string; le: string; leName: string;
  bu: string; debit: string; credit: string; narr: string; label: string;
};
type Je = { id: string; period: string; status: string; jtype: string; lines: JeLine[] };

const JE_SEED: Je[] = [
  {
    id: 'JE-ICE-0141', period: "June '26", status: 'Posted', jtype: 'Type 1',
    lines: [
      { lid: 'ice141a', lcoa: '2010', gcoa: 'G2000', gdesc: 'Trade & other payables', le: 'LK-OPCO', leName: 'Lanka Operations (Pvt) Ltd', bu: 'Distribution', debit: '2,500', credit: '', narr: 'ICE TJE-0001 — residual current-account difference on ICB-0005', label: 'ICE → Elim' },
      { lid: 'ice141b', lcoa: '6300', gcoa: 'G6300', gdesc: 'Finance costs', le: 'LK-OPCO', leName: 'Lanka Operations (Pvt) Ltd', bu: 'Distribution', debit: '', credit: '2,500', narr: 'ICE TJE-0001 — residual current-account difference on ICB-0005', label: 'ICE → Elim' },
    ],
  },
  {
    id: 'JE-ICE-0142', period: "June '26", status: 'Parked', jtype: 'Type 1',
    lines: [
      { lid: 'ice142a', lcoa: '5010', gcoa: 'G5000', gdesc: 'Cost of sales', le: 'LK-OPCO', leName: 'Lanka Operations (Pvt) Ltd', bu: 'Distribution', debit: '18,400', credit: '', narr: 'ICE TJE-0002 — Colombo closing stock aligned to the physical count, URP recomputed', label: 'ICE → Elim' },
      { lid: 'ice142b', lcoa: '1500', gcoa: 'G1500', gdesc: 'Property, plant & equipment', le: 'LK-OPCO', leName: 'Lanka Operations (Pvt) Ltd', bu: 'Distribution', debit: '', credit: '18,400', narr: 'ICE TJE-0002 — Colombo closing stock aligned to the physical count, URP recomputed', label: 'ICE → Elim' },
    ],
  },
  {
    id: 'JE-ICE-0143', period: "June '26", status: 'Posted', jtype: 'Type 1',
    lines: [
      { lid: 'ice143a', lcoa: '2500', gcoa: 'G2500', gdesc: 'Borrowings', le: 'IN-MFG', leName: 'Bharat Manufacturing Pvt Ltd', bu: 'Manufacturing', debit: '142,000', credit: '', narr: 'ICE TJE-0003 — deferred tax on building URP restated at the enacted 25.17% rate', label: 'ICE → Elim' },
      { lid: 'ice143b', lcoa: '6100', gcoa: 'G6100', gdesc: 'Administrative expenses', le: 'IN-MFG', leName: 'Bharat Manufacturing Pvt Ltd', bu: 'Manufacturing', debit: '', credit: '142,000', narr: 'ICE TJE-0003 — deferred tax on building URP restated at the enacted 25.17% rate', label: 'ICE → Elim' },
    ],
  },
];

const ST_COLORS: Record<string, string> = {
  Posted: '#15803D', Parked: '#65708C', Draft: '#65708C', 'In review': '#3B5BDB',
};

const num = (s: string) => Number(s.replace(/,/g, '')) || 0;

function JournalEntriesTab() {
  const [full, setFull] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const lines = JE_SEED.flatMap((j) => j.lines.map((l) => ({ ...l, je: j })));
  const totalDr = lines.reduce((s, l) => s + num(l.debit), 0);
  const totalCr = lines.reduce((s, l) => s + num(l.credit), 0);
  const balanced = totalDr === totalCr;

  const JE_COLS = ['Entry', 'Status', 'LCOA', 'GCOA', 'Group Description', 'Legal Entity', 'BU', 'Debit', 'Credit', 'Narration', 'Label'];

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#65708C' }}>
          Top-side adjustments
        </span>
        <span style={{ fontSize: '11px', color: '#9AA3BA' }}>{JE_SEED.length} entries · {lines.length} lines</span>
        <span
          style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase',
            padding: '3px 9px', borderRadius: '6px',
            color: balanced ? '#15803D' : '#B42318',
            background: balanced ? 'rgba(34,197,94,.14)' : 'rgba(180,35,24,.1)',
          }}
        >
          {balanced ? 'Balanced' : 'Out of balance'}
        </span>
        <div style={{ flex: 1 }} />
        {sel.length > 0 && (
          <button
            type="button" className="fc-h fc-btn" onClick={() => setSel([])}
            style={{ ...SOFT_BTN, border: '1px solid rgba(180,35,24,.4)', background: 'rgba(180,35,24,.08)', color: '#B42318' }}
          >
            Delete {sel.length} line{sel.length === 1 ? '' : 's'}
          </button>
        )}
        <button type="button" className="fc-h fc-btn" style={{ ...SOFT_BTN, color: '#414B62', border: '1px solid #CBD2E0', background: 'rgba(255,255,255,.6)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
          </svg>
          Upload JE
        </button>
        <button type="button" className="fc-h fc-btn" style={PRIMARY_BTN} title="Adds a balanced debit and credit line. Entries are parked until a reviewer posts them.">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add pair
        </button>
        <button
          type="button" className="fc-h fc-btn" onClick={() => setFull((v) => !v)}
          title={full ? 'Exit full screen' : 'View table full screen'}
          style={{ ...SOFT_BTN, width: '34px', padding: 0, justifyContent: 'center' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={full ? 'M4 9h5V4M20 9h-5V4M20 15h-5v5M4 15h5v5' : 'M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5'} />
          </svg>
        </button>
      </div>

      <div style={{ overflow: 'auto', border: '1px solid #DCE0EB', borderRadius: '12px', flex: 1, minHeight: 0 }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%', font: 'inherit' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: '34px', textAlign: 'center' }} />
              {JE_COLS.map((c) => (
                <th key={c} style={{ ...TH, textAlign: c === 'Debit' || c === 'Credit' ? 'right' : 'left' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const on = sel.includes(l.lid);
              return (
                <tr key={l.lid} style={on ? { background: 'rgba(59,130,246,.06)' } : undefined}>
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setSel((s) => (s.includes(l.lid) ? s.filter((x) => x !== l.lid) : [...s, l.lid]))}
                      style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#3B5BDB' }}
                    />
                  </td>
                  <td style={{ ...TD, fontWeight: 700, color: '#232C42' }}>{l.je.id}</td>
                  <td style={{ ...TD, fontWeight: 700, color: ST_COLORS[l.je.status] ?? '#65708C' }}>{l.je.status}</td>
                  <td style={{ ...TD, color: '#0F766E', fontWeight: 700 }}>{l.lcoa}</td>
                  <td style={{ ...TD, color: '#0F766E', fontWeight: 700 }}>{l.gcoa}</td>
                  <td style={{ ...TD, color: '#333D55' }}>{l.gdesc}</td>
                  <td style={TD} title={l.leName}>{l.le}</td>
                  <td style={TD}>{l.bu}</td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#232C42', fontWeight: l.debit ? 700 : 400 }}>{l.debit || '—'}</td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#232C42', fontWeight: l.credit ? 700 : 400 }}>{l.credit || '—'}</td>
                  <td style={{ ...TD, whiteSpace: 'normal', maxWidth: '320px', lineHeight: 1.4 }}>{l.narr}</td>
                  <td style={{ ...TD }}>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', color: '#B45309', background: 'rgba(245,158,11,.14)' }}>
                      {l.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0' }} />
              <td colSpan={7} style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0', fontWeight: 700, color: '#232C42' }}>Total</td>
              <td style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: balanced ? '#15803D' : '#B42318' }}>
                {totalDr.toLocaleString('en-US')}
              </td>
              <td style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: balanced ? '#15803D' : '#B42318' }}>
                {totalCr.toLocaleString('en-US')}
              </td>
              <td colSpan={2} style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0' }} />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ============================ FSLI mapping ============================ */

type Node =
  | { kind: 'grp'; key: string; label: string; kids: Node[] }
  | { kind: 'leaf'; key: string; label: string }
  | { kind: 'sub'; label: string };

const T = {
  grp: (key: string, label: string, kids: Node[]): Node => ({ kind: 'grp', key, label, kids }),
  leaf: (key: string, label: string): Node => ({ kind: 'leaf', key, label }),
  sub: (label: string): Node => ({ kind: 'sub', label }),
};

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
        T.sub('Total current assets'),
      ]),
      T.grp('nca', 'Non-current assets', [
        T.leaf('ppe', 'Property, plant & equipment, net'),
        T.leaf('intang', 'Intangible assets'),
        T.leaf('gw', 'Goodwill'),
        T.leaf('rou', 'Right-of-use assets'),
        T.leaf('dta', 'Deferred tax assets'),
        T.sub('Total non-current assets'),
      ]),
      T.sub('Total assets'),
    ]),
    T.grp('liab', 'Liabilities and stockholders’ equity', [
      T.grp('cl', 'Current liabilities', [
        T.leaf('ap', 'Trade and other payables'),
        T.leaf('accr', 'Accrued liabilities'),
        T.leaf('stb', 'Short-term borrowings'),
        T.sub('Total current liabilities'),
      ]),
      T.grp('ncl', 'Non-current liabilities', [
        T.leaf('ltb', 'Long-term borrowings'),
        T.leaf('dtl', 'Deferred tax liabilities'),
        T.leaf('lease', 'Lease liabilities'),
        T.sub('Total non-current liabilities'),
      ]),
      T.grp('eq', 'Stockholders’ equity', [
        T.leaf('sc', 'Share capital & reserves'),
        T.leaf('re', 'Retained earnings'),
        T.sub('Total equity'),
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

function FsliMapping({ onBack, map, setMap }: { onBack: () => void; map: Record<string, string[]>; setMap: (m: Record<string, string[]>) => void }) {
  const [framework, setFramework] = useState<'usgaap' | 'ifrs'>('usgaap');
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

  const order = (nodes: Node[]): Node[] =>
    framework === 'ifrs'
      ? [...nodes].reverse().map((n) => (n.kind === 'grp' ? { ...n, kids: order(n.kids) } : n))
      : nodes.map((n) => (n.kind === 'grp' ? { ...n, kids: order(n.kids) } : n));

  const renderNodes = (nodes: Node[], depth: number): React.ReactNode =>
    nodes.map((n, i) => {
      if (n.kind === 'sub') {
        return (
          <div
            key={`${n.label}-${i}`}
            style={{
              padding: `6px 12px 6px ${12 + depth * 18}px`, fontSize: '11px', fontWeight: 700,
              color: '#414B62', borderTop: '1px solid #DFE3EC', background: 'rgba(255,255,255,.35)',
            }}
          >
            {n.label}
          </div>
        );
      }
      if (n.kind === 'grp') {
        const isCol = collapsed[n.key] === true;
        return (
          <div key={n.key}>
            <button
              type="button"
              className="fc-btn"
              onClick={() => setCollapsed((c) => ({ ...c, [n.key]: !isCol }))}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px', width: '100%',
                padding: `7px 12px 7px ${12 + depth * 18}px`,
                fontSize: depth === 0 ? '12px' : '11.5px', fontWeight: 700,
                color: depth === 0 ? '#232C42' : '#414B62',
                background: depth === 0 ? 'rgba(59,130,246,.07)' : 'transparent',
                borderBottom: '1px solid #E7EAF2',
              }}
            >
              <svg
                width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"
                style={{ flex: 'none', transition: 'transform .18s', transform: `rotate(${isCol ? 0 : 90}deg)` }}
              >
                <path d="M7 5l7 7-7 7" />
              </svg>
              {n.label}
            </button>
            {!isCol && renderNodes(n.kids, depth + 1)}
          </div>
        );
      }
      const ids = map[n.key] ?? [];
      const isOver = over === n.key;
      const leafCls: 'mon' | 'non' = mon[n.key] === 'non' ? 'non' : 'mon';
      const LM = MON_META[leafCls];
      return (
        <div
          key={n.key}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '9px',
            padding: `7px 12px 7px ${12 + depth * 18}px`,
            borderBottom: '1px solid #E7EAF2',
          }}
        >
          {/* line-item monetary class */}
          <button
            type="button"
            className="fc-btn"
            onClick={() => setMon((x) => ({ ...x, [n.key]: MON_NEXT[leafCls] }))}
            title={LM[2]}
            aria-label={LM[0]}
            style={{
              flex: 'none', marginTop: '3px', width: '11px', height: '11px', borderRadius: '50%',
              background: LM[1], boxShadow: 'inset 0 1px 1px rgba(255,255,255,.5)',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11.5px', color: '#333D55' }}>{n.label}</div>

            {/* drop zone — holds the mapped account chips */}
            <div
              onDragOver={(e) => { e.preventDefault(); setOver(n.key); }}
              onDragLeave={() => setOver((o) => (o === n.key ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOver(null); if (drag) assignMany(dragPayload(drag), n.key); setDrag(null); }}
              style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px',
                minHeight: '26px', marginTop: '5px', padding: '3px 5px', borderRadius: '9px',
                border: `1px dashed ${isOver ? '#3B82F6' : 'transparent'}`,
                background: isOver ? 'rgba(59,130,246,.12)' : 'rgba(228,232,240,.4)',
                transition: 'background .12s, border-color .12s',
              }}
            >
              {ids.map((id) => {
                const cur: 'mon' | 'non' = coaMon[id] ?? leafCls;
                const CM = MON_META[cur];
                const ovr = !!coaMon[id] && coaMon[id] !== leafCls;
                return (
                  <span
                    key={id}
                    draggable
                    onDragStart={() => setDrag(id)}
                    onDragEnd={() => { setDrag(null); setOver(null); }}
                    title={`${id}  ·  ${CATALOG_NAME[id]}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '7px', cursor: 'grab', maxWidth: '100%',
                      overflow: 'hidden', padding: '4px 5px 4px 8px', borderRadius: '8px', background: '#ECEFF6',
                      border: `1px solid ${ovr ? `${CM[1]}66` : '#CBD6E8'}`,
                      boxShadow: '1px 1px 3px rgba(166,175,195,.4),-1px -1px 3px rgba(255,255,255,.85)',
                      fontSize: '11px', fontWeight: 600,
                    }}
                  >
                    <button
                      type="button"
                      className="fc-btn"
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
                        flex: 'none', boxSizing: 'border-box', width: '11px', height: '11px', borderRadius: '50%',
                        background: CM[1],
                        ...(ovr
                          ? { boxShadow: `0 0 0 2px #fff,0 0 0 3.5px ${CM[1]}`, marginRight: '2px' }
                          : { boxShadow: 'inset 0 1px 1px rgba(255,255,255,.5)' }),
                      }}
                    />
                    <b style={{ flex: 'none', fontWeight: 700, color: '#232C42' }}>{id}</b>
                    <span
                      style={{
                        flex: 1, minWidth: 0, color: '#65708C', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {CATALOG_NAME[id]}
                    </span>
                    <button
                      type="button"
                      className="fc-btn"
                      onClick={(e) => { e.stopPropagation(); assign(id, null); }}
                      title="Unmap this account"
                      style={{
                        flex: 'none', width: '16px', height: '16px', borderRadius: '5px', color: '#9AA3BA',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              {ids.length === 0 && (
                <span style={{ fontSize: '10.5px', color: '#A6AEC2', fontStyle: 'italic', pointerEvents: 'none' }}>
                  Drag COAs here
                </span>
              )}
            </div>
          </div>
        </div>
      );
    });

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '12px' }}>
      {/* hierarchy */}
      <section style={{ ...SECTION, flex: 1, minWidth: 0, borderRadius: '18px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '16px 18px 14px' }}>
          <button type="button" className="fc-h fc-btn" onClick={onBack} style={{ ...SOFT_BTN, color: '#3B5BDB' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Back
          </button>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#232C42' }}>FSLI Hierarchy</span>
          <span style={{ fontSize: '11.5px', color: '#7A84A0', fontStyle: 'italic' }}>{mapped.size} accounts mapped</span>
          <span
            title="Line items and individual accounts classified as monetary or non-monetary for IAS 21 / ASC 830 translation. Click the dot on a line item to switch it; click the dot on an account chip to override that account."
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '9px', height: '24px', padding: '0 11px',
              borderRadius: '9px', background: '#E4E8F0',
              boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.45),inset -2px -2px 5px rgba(255,255,255,.9)',
              fontSize: '10px', fontWeight: 700, color: '#65708C',
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
            {Object.keys(coaMon).length > 0 && (
              <span style={{ color: '#3B5BDB' }}>{Object.keys(coaMon).length} account overrides</span>
            )}
          </span>
          <div style={{ flex: 1 }} />
          <div
            title="Presentation order follows the selected reporting framework"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px', borderRadius: '9px', background: '#E4E8F0', boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.45),inset -2px -2px 5px rgba(255,255,255,.9)' }}
          >
            {(['usgaap', 'ifrs'] as const).map((fw) => (
              <button
                key={fw}
                type="button"
                className="fc-h fc-btn"
                onClick={() => setFramework(fw)}
                style={{
                  height: '24px', padding: '0 11px', borderRadius: '7px', fontSize: '11px', fontWeight: 700,
                  ...(framework === fw
                    ? { background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff' }
                    : { color: '#7A84A0' }),
                }}
              >
                {fw === 'usgaap' ? 'US GAAP' : 'IFRS'}
              </button>
            ))}
          </div>
          <button type="button" className="fc-h fc-btn" onClick={() => setCollapsed({})} style={{ ...SOFT_BTN, height: '28px', color: '#3B5BDB' }}>Expand all</button>
          <button
            type="button" className="fc-h fc-btn"
            onClick={() => {
              const all: Record<string, boolean> = {};
              const walk = (ns: Node[]) => ns.forEach((n) => { if (n.kind === 'grp') { all[n.key] = true; walk(n.kids); } });
              walk(FSLI_TREE);
              setCollapsed(all);
            }}
            style={{ ...SOFT_BTN, height: '28px', color: '#3B5BDB' }}
          >
            Collapse all
          </button>
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'stretch', borderTop: '1px solid #DFE3EC',
            borderBottom: '1px solid #CBD2E0', background: '#E4E8F0',
            padding: '7px 12px', fontSize: '9px', fontWeight: 700, letterSpacing: '.4px',
            textTransform: 'uppercase', color: '#1B3A5C',
          }}
        >
          Financial Statement Line Item
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{renderNodes(order(FSLI_TREE), 0)}</div>
      </section>

      {/* unmapped pool */}
      <section style={{ ...SECTION, width: '272px', flex: 'none', borderRadius: '18px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #DCE0EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: '#232C42' }}>Unmapped COAs</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#B45309', background: 'rgba(245,158,11,.15)', padding: '2px 8px', borderRadius: '6px' }}>
              {pool.length}
            </span>
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
      </section>
    </div>
  );
}

/* ============================== screen ============================== */

export default function FinancialDataLayer() {
  const [tab, setTab] = useState<'tb' | 'je' | 'fsli'>('tb');
  const [map, setMap] = useState<Record<string, string[]>>(DEFAULT_MAP);

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

      {tab === 'tb' && <TrialBalanceTab onOpenFsli={() => setTab('fsli')} unmapped={unmapped} />}
      {tab === 'je' && <JournalEntriesTab />}
      {tab === 'fsli' && <FsliMapping onBack={() => setTab('tb')} map={map} setMap={setMap} />}
    </div>
  );
}
