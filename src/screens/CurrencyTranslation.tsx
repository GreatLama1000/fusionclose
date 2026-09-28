import React, { useMemo, useState } from 'react';

/**
 * Currency Translation — ported from docs/design/Fusion Close.dc.html,
 * block `<sc-if value="{{ is.fx }}">` lines 1589–1763.
 *
 * Data and maths: fxEnts 8457, fxTbSpec 8475, fxScan 8495, column defs 8547,
 * fxRmSeed 9434, engines 9385.
 *
 * Two engines run in sequence: A remeasures the recording currency into the
 * functional currency (monetary / non-monetary method, difference is RMGL to
 * profit or loss); B translates functional into reporting currency (closing /
 * average method, difference is CTA to OCI, split parent / NCI).
 */

/* ============================== data ============================== */

type Ent = {
  k: string; name: string; code: string; lc: string; fc: string; rcfc: boolean;
  nci: number; bus: string[]; scale: number;
  lcClose: number; lcHist: number; lcAvg: number; lcTxn: number;
  fcClose: number; fcAvg: number; fcOpen: number;
};

const ENTS: Ent[] = [
  { k: 'uk', name: 'UK Entity Ltd.', code: 'UK01', lc: 'GBP', fc: 'EUR', rcfc: true, nci: 0, bus: ['Industrial', 'Services'], scale: 42800,
    lcClose: 1.1720, lcHist: 1.1540, lcAvg: 1.1655, lcTxn: 1.1580, fcClose: 1.0871, fcAvg: 1.0812, fcOpen: 1.0744 },
  { k: 'de', name: 'Germany GmbH', code: 'DE01', lc: 'EUR', fc: 'EUR', rcfc: false, nci: 0.20, bus: ['Industrial', 'Consumer'], scale: 61500,
    lcClose: 1, lcHist: 1, lcAvg: 1, lcTxn: 1, fcClose: 1.0871, fcAvg: 1.0812, fcOpen: 1.0744 },
  { k: 'jp', name: 'Japan KK', code: 'JP01', lc: 'JPY', fc: 'JPY', rcfc: false, nci: 0.35, bus: ['Consumer'], scale: 1860000,
    lcClose: 1, lcHist: 1, lcAvg: 1, lcTxn: 1, fcClose: 0.00672, fcAvg: 0.00668, fcOpen: 0.00681 },
  { k: 'in', name: 'India Pvt Ltd', code: 'IN01', lc: 'INR', fc: 'USD', rcfc: true, nci: 0.26, bus: ['Services', 'Industrial'], scale: 1240000,
    lcClose: 0.01193, lcHist: 0.01210, lcAvg: 0.01188, lcTxn: 0.01196, fcClose: 1, fcAvg: 1, fcOpen: 1 },
];

type Spec = { code: string; name: string; cls: 'mon' | 'non' | 'pl'; tb: number; m: number; a: number };

const TB_SPEC: Spec[] = [
  { code: '1010', name: 'Cash and bank balances', cls: 'mon', tb: 0.180, m: 0, a: 0 },
  { code: '1200', name: 'Trade receivables — third party', cls: 'mon', tb: 0.310, m: 0.0120, a: -0.0040 },
  { code: '1350', name: 'Receivable from group companies', cls: 'mon', tb: 0.150, m: 0, a: 0.0060 },
  { code: '1400', name: 'Finished goods and raw material', cls: 'non', tb: 0.220, m: -0.0080, a: 0 },
  { code: '1600', name: 'Land, buildings and equipment', cls: 'non', tb: 0.460, m: 0, a: 0.0210 },
  { code: '2010', name: 'Trade payables — third party', cls: 'mon', tb: -0.240, m: -0.0090, a: 0 },
  { code: '2300', name: 'Bank borrowings', cls: 'mon', tb: -0.350, m: 0, a: 0 },
  { code: '2400', name: 'Deferred tax liability', cls: 'non', tb: -0.050, m: 0, a: -0.0030 },
  { code: '4000', name: 'Revenue from contracts', cls: 'pl', tb: -0.520, m: 0, a: 0 },
  { code: '5000', name: 'Cost of goods sold', cls: 'pl', tb: 0.330, m: 0, a: 0.0040 },
  { code: '6100', name: 'Administrative overheads', cls: 'pl', tb: 0.084, m: 0.0030, a: 0 },
  { code: '7100', name: 'Interest on borrowings', cls: 'pl', tb: 0.019, m: 0, a: 0 },
];

const BORROW_CODES = ['2300'];
const defDest = (sp: Spec) => (BORROW_CODES.includes(sp.code) ? 'Finance cost' : 'Other income');

const PL_LINES = ['Other income', 'Finance cost', 'Cost of goods sold', 'Administrative overheads', 'Revenue from contracts'];

type Rate = { id: string; type: string; pair: string; basis: string; date: string; event: string; src: string; rate: string };

const RM_SEED: Rate[] = [
  { id: 'r1', type: 'Average', pair: 'GBP/USD', basis: 'Quarterly', date: '2026-09-30', event: 'Q3 2026 period average', src: 'OANDA', rate: '1.2740' },
  { id: 'r2', type: 'Average', pair: 'EUR/USD', basis: 'Quarterly', date: '2026-09-30', event: 'Q3 2026 period average', src: 'OANDA', rate: '1.0812' },
  { id: 'r3', type: 'Average', pair: 'JPY/USD', basis: 'Quarterly', date: '2026-09-30', event: 'Q3 2026 period average', src: 'OANDA', rate: '0.00668' },
  { id: 'r4', type: 'Average', pair: 'INR/USD', basis: 'Quarterly', date: '2026-09-30', event: 'Q3 2026 period average', src: 'OANDA', rate: '0.01188' },
  { id: 'r5', type: 'Spot (closing)', pair: 'GBP/USD', basis: 'Quarterly', date: '2026-09-30', event: 'Quarter-end closing rate', src: 'OANDA', rate: '1.2812' },
  { id: 'r6', type: 'Spot (closing)', pair: 'EUR/USD', basis: 'Quarterly', date: '2026-09-30', event: 'Quarter-end closing rate', src: 'OANDA', rate: '1.0871' },
  { id: 'r7', type: 'Spot (opening)', pair: 'GBP/USD', basis: 'Quarterly', date: '2026-07-01', event: 'Quarter opening rate', src: 'OANDA', rate: '1.2680' },
  { id: 'r8', type: 'Spot (opening)', pair: 'EUR/USD', basis: 'Quarterly', date: '2026-07-01', event: 'Quarter opening rate', src: 'OANDA', rate: '1.0744' },
  { id: 'r9', type: 'Historical', pair: 'EUR/USD', basis: 'Quarterly', date: '2019-02-12', event: 'Equity issued — share capital', src: 'Manual entry', rate: '1.1285' },
  { id: 'r10', type: 'Historical', pair: 'GBP/USD', basis: 'Quarterly', date: '2026-08-18', event: 'Equity redeemed — buy-back of shares', src: 'Manual entry', rate: '1.2798' },
  { id: 'r11', type: 'Average', pair: 'GBP/EUR', basis: 'Quarterly', date: '2026-09-30', event: 'Q3 2026 average — remeasurement', src: 'OANDA', rate: '1.1655' },
  { id: 'r12', type: 'Spot (closing)', pair: 'GBP/EUR', basis: 'Quarterly', date: '2026-09-30', event: 'Quarter-end closing — monetary items', src: 'OANDA', rate: '1.1720' },
  { id: 'r13', type: 'Historical', pair: 'GBP/EUR', basis: 'Quarterly', date: '2022-06-30', event: 'Non-monetary assets at acquisition', src: 'Data input template', rate: '1.1442' },
];

const TYPE_OPTS = ['Average', 'Spot (closing)', 'Spot (opening)', 'Historical'];
const PAIR_OPTS = ['GBP/USD', 'EUR/USD', 'JPY/USD', 'INR/USD', 'GBP/EUR', 'INR/EUR'];
const BASIS_OPTS = ['Monthly', 'Quarterly', 'Annual'];
const SRC_OPTS = ['OANDA', 'RBI reference', 'Manual entry', 'Data input template'];

/** identifier: A / SC / SO / H plus the period number on the effective date */
const identOf = (r: Rate) => {
  const p = r.type === 'Average' ? 'A' : r.type === 'Spot (closing)' ? 'SC' : r.type === 'Spot (opening)' ? 'SO' : 'H';
  const m = Number(r.date.slice(5, 7)) || 0;
  return `${p}${m}`;
};
const pairLeg = (pair: string) => (pair.endsWith('/USD') ? 'FC → RC' : 'LC → FC');

/* ============================== helpers ============================== */

const N = (v: number, d = 0) => {
  const x = v / 1000;
  const s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  return x < 0 ? `(${s})` : s;
};
const rateFmt = (v: number) => (v >= 0.01 ? v.toFixed(4) : v.toFixed(5));
const money = (v: number) => `USD ${N(v, 1)}k`;

const CARD_INSET: React.CSSProperties = {
  background: '#E7EAF2', border: '1px solid rgba(255,255,255,.7)', borderRadius: '14px',
  boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.35),inset -2px -2px 6px rgba(255,255,255,.9)',
  padding: '14px 16px',
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#65708C',
};

const TH: React.CSSProperties = {
  padding: '7px 10px', textAlign: 'left', verticalAlign: 'top', color: '#1B3A5C',
  borderBottom: '1px solid #CBD2E0', borderTop: '2px solid #1B3A5C', fontSize: '9px',
  letterSpacing: '.4px', textTransform: 'uppercase', fontWeight: 700, background: '#E4E8F0',
  position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'normal', lineHeight: 1.25,
};

const TD: React.CSSProperties = {
  padding: '5px 10px', borderBottom: '1px solid #E7EAF2', fontSize: '10.5px',
  color: '#65708C', whiteSpace: 'nowrap',
};

/* ============================== screen ============================== */

export default function CurrencyTranslation() {
  const [scope, setScope] = useState('all');
  const [cls, setCls] = useState<Record<string, 'mon' | 'non'>>({});
  const [dest, setDest] = useState<Record<string, string>>({});
  const [engOpen, setEngOpen] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'a' | 'b' | 'done'>('done');
  const [rmOpen, setRmOpen] = useState(false);
  const [rates, setRates] = useState<Rate[]>(RM_SEED);
  const [rmDirty, setRmDirty] = useState(false);
  const [rmLeg, setRmLeg] = useState<'all' | 'LC → FC' | 'FC → RC'>('all');
  const [rmSync, setRmSync] = useState('Synced 08:42');
  const [full, setFull] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; key: string; label: string } | null>(null);
  const [toast, setToast] = useState('');
  const [cal, setCal] = useState<{ id: string; month: string } | null>(null);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3200); };

  /* ---- fxScan: the translation maths, design line 8495 ---- */
  const recs = useMemo(() => {
    const ents = scope === 'all' ? ENTS : ENTS.filter((x) => x.k === scope);
    const out: {
      key: string; e: Ent; sp: Spec; si: number; cls: 'mon' | 'non' | 'pl'; isPl: boolean;
      net: number; rLc: number; lcBasis: string; fcAmt: number; rFc: number; fcBasis: string;
      rcAmt: number; rmgl: number; cta: number; dest: string; clickable: boolean;
    }[] = [];
    ents.forEach((e) => {
      TB_SPEC.forEach((sp, si) => {
        const key = `${e.k}-${sp.code}`;
        const c = e.rcfc ? (cls[key] ?? sp.cls) : sp.cls;
        const isPl = sp.cls === 'pl';
        const net = (sp.tb + sp.m + sp.a) * e.scale;
        const rLc = !e.rcfc ? 1 : isPl ? e.lcAvg : c === 'non' ? e.lcHist : e.lcClose;
        const lcBasis = !e.rcfc ? 'Recording currency is the functional currency — no remeasurement'
          : isPl ? 'Period average rate' : c === 'non' ? 'Historic rate' : 'Closing rate';
        const fcAmt = net * rLc;
        const rFc = isPl ? e.fcAvg : e.fcClose;
        const fcBasis = e.fc === 'USD' ? 'Functional currency is the reporting currency' : isPl ? 'Period average rate' : 'Closing rate';
        const rcAmt = fcAmt * rFc;
        const rmgl = e.rcfc && !isPl && c === 'mon' ? net * (e.lcClose - e.lcTxn) * rFc : 0;
        const cta = fcAmt * (e.fcClose - (isPl ? e.fcAvg : e.fcOpen));
        out.push({ key, e, sp, si, cls: c, isPl, net, rLc, lcBasis, fcAmt, rFc, fcBasis, rcAmt, rmgl, cta,
          dest: dest[key] ?? defDest(sp), clickable: e.rcfc && !isPl });
      });
    });
    return out;
  }, [scope, cls, dest]);

  const tot = recs.reduce((a, r) => ({
    rc: a.rc + r.rcAmt, rmgl: a.rmgl + r.rmgl, cta: a.cta + r.cta,
    par: a.par + r.cta * (1 - r.e.nci), nci: a.nci + r.cta * r.e.nci,
  }), { rc: 0, rmgl: 0, cta: 0, par: 0, nci: 0 });

  const rcfcLines = recs.filter((r) => r.rmgl).length;

  /* ---- engines ---- */
  const ENGINES = [
    {
      tag: 'A', name: 'Remeasurement · LC → FC', subtitle: 'Engine A · monetary / non-monetary method',
      detail: 'Runs on RCFC entities only. Monetary items at the closing rate, non-monetary items at the historic rate, income statement at the period average. The difference is RMGL and is recognised in profit or loss.',
      result: `RMGL ${money(tot.rmgl)} across ${rcfcLines} monetary lines`,
      pct: phase === 'idle' ? 0 : phase === 'a' ? 55 : 100,
      status: phase === 'idle' ? 'Queued' : phase === 'a' ? 'Running' : 'Settled',
      color: '#B45309', bg: 'rgba(245,158,11,.14)', bd: 'rgba(245,158,11,.42)',
    },
    {
      tag: 'B', name: 'Translation · FC → RC', subtitle: 'Engine B · closing and average rate method',
      detail: 'Runs on all entities once Engine A has settled the functional currency balances. Balance sheet at the closing rate, income statement at the period average, opening equity at the opening rate. The difference is CTA and is taken to other comprehensive income.',
      result: `CTA ${money(tot.cta)} to the translation reserve`,
      pct: phase === 'done' ? 100 : phase === 'b' ? 40 : 0,
      status: phase === 'done' ? 'Settled' : phase === 'b' ? 'Running' : 'Queued',
      color: '#2563EB', bg: 'rgba(59,130,246,.12)', bd: 'rgba(59,130,246,.34)',
    },
  ];

  const runEngines = () => {
    setPhase('a');
    setTimeout(() => setPhase('b'), 700);
    setTimeout(() => { setPhase('done'); say('Translation complete — RMGL to profit or loss, CTA to the translation reserve.'); }, 1500);
  };

  const rmList = rates.filter((r) => rmLeg === 'all' || pairLeg(r.pair) === rmLeg);

  const pullSource = (label: string, types: string[], src: string) => {
    setRates((all) => all.map((r) => (types.includes(r.type) ? { ...r, src } : r)));
    setRmSync(`${label} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
    setRmDirty(true);
    say(`${src} rates pulled for ${types.join(', ').toLowerCase()}.`);
  };

  const downloadTemplate = () => {
    const head = ['Rate type', 'Currency pair', 'Leg', 'Period basis', 'Effective date', 'Identifier', 'Event / basis', 'Rate', 'Source'];
    const body = rates.map((r) => [r.type, r.pair, pairLeg(r.pair), r.basis, r.date, identOf(r), r.event, r.rate, r.src]);
    const csv = [head, ...body].map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'fx-rate-input-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const patchRate = (id: string, k: keyof Rate, v: string) => {
    setRates((all) => all.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
    setRmDirty(true);
  };

  const COLS = [
    { label: 'Legal entity' }, { label: 'Business unit' },
    { label: 'COA', info: 'Local chart of account code' }, { label: 'Account name' },
    { label: 'LE type', align: 'center' as const, info: 'RCFC — recording currency differs from the functional currency. LCFC — the local recording currency is the functional currency.' },
    { label: 'Class', info: 'Monetary or non-monetary. Shown for RCFC entities only, where the classification drives the remeasurement rate. Click a value to switch it.' },
    { label: 'LC', align: 'center' as const, info: 'Recording currency of the entity' },
    { label: 'Net amount (LC)', align: 'right' as const, strong: true, info: 'Adjusted trial balance in the recording currency, 000s' },
    { label: 'LC → FC rate', align: 'right' as const },
    { label: 'Amount (FC)', align: 'right' as const, info: 'Remeasured into the functional currency' },
    { label: 'RMGL', align: 'right' as const, info: 'Remeasurement gain or loss on monetary items of RCFC entities, recognised in profit or loss. Right-click to route it to a line item.' },
    { label: 'P&L destination', info: 'RMGL goes to Other income by default; RMGL arising on borrowings goes to Finance cost. Right-click the amount or the destination to route it elsewhere.' },
    { label: 'FC → RC rate', align: 'right' as const },
    { label: 'Amount (RC)', align: 'right' as const, strong: true, info: 'Translated into the reporting currency, USD 000s' },
    { label: 'CTA', align: 'right' as const, info: 'Currency translation adjustment taken to other comprehensive income' },
    { label: 'Parent share', align: 'right' as const, info: 'Parent’s share of the CTA only' },
    { label: 'NCI share', align: 'right' as const, info: 'Non-controlling interests’ share of the CTA only' },
  ];

  const scopeLabel = scope === 'all'
    ? `${ENTS.length} entities · ${ENTS.filter((e) => e.rcfc).length} RCFC · reporting currency USD`
    : `${ENTS.find((e) => e.k === scope)?.name} · reporting currency USD`;

  return (
    <div style={{ padding: '24px 28px 26px', animation: 'fcFade .25s ease' }} onClick={() => setMenu(null)}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: '#7A84A0' }}>
          Module · Step 3
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: '24px', fontWeight: 700, color: '#232C42' }}>Currency Translation</h1>
        <div style={{ marginTop: '5px', fontSize: '12.5px', color: '#7A84A0', maxWidth: '900px' }}>
          Translation runs on the adjusted trial balance. Balances are carried from the recording currency to the functional
          currency, then from the functional currency to the reporting currency, and the resulting differences are split
          between profit or loss and other comprehensive income.
        </div>
      </div>

      {toast && (
        <div style={{ marginBottom: '16px', padding: '9px 12px', borderRadius: '9px', fontSize: '12px', color: '#0B5A54', background: 'rgba(15,118,110,.09)', border: '1px solid rgba(15,118,110,.26)' }}>
          {toast}
        </div>
      )}

      {/* ---- engines + rate master ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'stretch', marginBottom: '16px' }}>
        <div style={CARD_INSET}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '11px' }}>
            <span style={{ flex: 1, minWidth: 0, ...SECTION_LABEL }}>Translation engines</span>
            <button
              type="button" className="fc-h fc-btn" onClick={runEngines}
              style={{
                flex: 'none', height: '28px', padding: '0 13px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                ...(phase === 'done'
                  ? { color: '#3B5BDB', background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.32)' }
                  : { color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)' }),
              }}
            >
              {phase === 'done' ? 'Re-run' : 'Running…'}
            </button>
            <button
              type="button" className="fc-h fc-btn" onClick={() => setEngOpen((v) => !v)}
              title={engOpen ? 'Hide the engine detail' : 'Show how each engine works'}
              style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '28px', width: '28px', borderRadius: '8px', color: '#65708C', background: '#ECEFF6', border: '1px solid #D6DBE7' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d={engOpen ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} /></svg>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
            {ENGINES.map((g) => (
              <div key={g.tag} style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                <span style={{ flex: 'none', width: '22px', height: '22px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: g.color, background: g.bg, border: `1px solid ${g.bd}` }}>
                  {g.tag}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11.5px', fontWeight: 700, color: '#333D55', whiteSpace: 'nowrap' }}>{g.name}</span>
                    <span style={{ flex: 'none', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: g.status === 'Settled' ? '#15803D' : g.status === 'Running' ? g.color : '#9AA3BA' }}>
                      {g.status}
                    </span>
                  </div>
                  <div style={{ marginTop: '5px', height: '5px', borderRadius: '99px', background: '#D6DBE7', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${g.pct}%`, borderRadius: '99px', background: `linear-gradient(90deg,${g.color},${g.color}bb)`, transition: 'width .4s ease' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {engOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '13px', paddingTop: '12px', borderTop: '1px solid #D6DBE7', animation: 'fcFade .2s ease' }}>
              {ENGINES.map((g) => (
                <div key={g.tag}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9AA3BA' }}>{g.subtitle}</div>
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#65708C', lineHeight: 1.5 }}>{g.detail}</div>
                  <div style={{ marginTop: '6px', fontSize: '11.5px', fontWeight: 700, color: '#414B62' }}>{g.result}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={CARD_INSET}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '11px' }}>
            <span style={{ flex: 1, minWidth: 0, ...SECTION_LABEL }}>Exchange rate master</span>
            <button
              type="button" className="fc-h fc-btn" onClick={() => setRmOpen(true)}
              style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', height: '28px', padding: '0 13px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)' }}
            >
              Open rate master
            </button>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {([
              ['Pull OANDA', () => pullSource('OANDA sync', ['Average', 'Spot (closing)', 'Spot (opening)'], 'OANDA'), 'Pull average, closing and opening rates from OANDA'],
              ['Pull RBI reference', () => pullSource('RBI sync', ['Spot (closing)'], 'RBI reference'), 'Pull closing rates from the RBI reference feed'],
              ['Upload template', () => { setRmSync(`Template upload ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`); say('Data input template accepted — historical rates updated.'); }, 'Upload the filled data input template'],
              ['Download template', downloadTemplate, 'Download the blank data input template'],
            ] as const).map(([label, fn, tip]) => (
              <button
                key={label} type="button" className="fc-h fc-btn" onClick={fn} title={tip}
                style={{ height: '26px', padding: '0 11px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: '#414B62', background: '#ECEFF6', border: '1px solid #D6DBE7' }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10.5px', color: '#7A84A0' }}>
            <span style={{ flex: 'none', fontWeight: 700, color: '#65708C', background: '#ECEFF6', border: '1px solid #D6DBE7', padding: '2px 8px', borderRadius: '999px' }}>{rmSync}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {rates.length} rates · {new Set(rates.map((r) => r.pair)).size} pairs · average, spot and historical
            </span>
          </div>
        </div>
      </div>

      {/* ---- translated ATB ---- */}
      <section
        style={{
          display: 'flex', flexDirection: 'column', background: '#ECEFF6',
          border: '1px solid rgba(255,255,255,.75)',
          boxShadow: '9px 9px 22px rgba(166,175,195,.5),-9px -9px 22px rgba(255,255,255,.95)',
          padding: '20px',
          ...(full ? { position: 'fixed', top: 0, right: 0, bottom: 0, left: '68px', zIndex: 400, borderRadius: 0, margin: 0 } : { borderRadius: '16px' }),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <span style={SECTION_LABEL}>Adjusted trial balance — translated</span>
          <span style={{ fontSize: '11px', color: '#9AA3BA' }}>{recs.length} lines</span>
          <select
            value={scope} onChange={(e) => setScope(e.target.value)} title="Filter by legal entity"
            style={{ height: '30px', background: '#E4E8F0', border: '1px solid #CBD2E0', boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.4),inset -2px -2px 5px rgba(255,255,255,.9)', borderRadius: '9px', color: '#333D55', font: 'inherit', fontSize: '11.5px', fontWeight: 700, padding: '0 9px', cursor: 'pointer' }}
          >
            <option value="all">All entities</option>
            {ENTS.map((e) => (
              <option key={e.k} value={e.k}>{e.name} · {e.lc}{e.rcfc ? ` → ${e.fc}` : ''}</option>
            ))}
          </select>
          {(scope !== 'all' || Object.keys(cls).length > 0 || Object.keys(dest).length > 0) && (
            <button
              type="button" className="fc-h fc-btn"
              onClick={() => { setScope('all'); setCls({}); setDest({}); }}
              style={{ display: 'inline-flex', alignItems: 'center', height: '26px', padding: '0 11px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: '#3B5BDB', background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.32)' }}
            >
              Clear filters and overrides
            </button>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: '11.5px', color: '#7A84A0' }}>{scopeLabel}</div>
          <button
            type="button" className="fc-h fc-btn" onClick={() => setFull((v) => !v)}
            title={full ? 'Exit full screen — fit to window' : 'View table full screen'}
            style={{ height: '28px', width: '30px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#65708C', background: '#E4E8F0', border: '1px solid #D6DBE7' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={full ? 'M4 9h5V4M20 9h-5V4M20 15h-5v5M4 15h5v5' : 'M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5'} />
            </svg>
          </button>
        </div>

        <div style={{ overflow: 'auto', border: '1px solid #DCE0EB', borderRadius: '12px', flex: 1, minHeight: 0, background: '#ECEFF6' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%', font: 'inherit' }}>
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.label} style={{ ...TH, textAlign: c.align ?? 'left' }} title={c.info}>
                    <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '4px' }}>
                      {c.label}
                      {c.info && (
                        <span style={{ flex: 'none', cursor: 'help', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '12px', height: '12px', borderRadius: '50%', background: '#3B5BDB', color: '#fff', fontSize: '8px', fontWeight: 700, fontStyle: 'italic', lineHeight: 1 }}>i</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recs.map((r) => (
                <tr key={r.key} className="fc-h">
                  <td style={{ ...TD, fontWeight: 700, color: '#232C42' }}>{r.e.code} · {r.e.name}</td>
                  <td style={TD}>{r.e.bus[r.si % r.e.bus.length]}</td>
                  <td style={{ ...TD, color: '#0F766E', fontWeight: 700 }}>{r.sp.code}</td>
                  <td style={{ ...TD, color: '#333D55' }}>{r.sp.name}</td>
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '17px', padding: '0 7px', borderRadius: '5px', fontSize: '9px', fontWeight: 700, letterSpacing: '.3px', color: r.e.rcfc ? '#B45309' : '#65708C', background: r.e.rcfc ? 'rgba(245,158,11,.14)' : 'rgba(148,163,184,.16)' }}>
                      {r.e.rcfc ? 'RCFC' : 'LCFC'}
                    </span>
                  </td>
                  <td style={TD}>
                    {r.e.rcfc ? (
                      <button
                        type="button" className="fc-btn"
                        onClick={() => { if (r.clickable) setCls((m) => ({ ...m, [r.key]: (m[r.key] ?? r.sp.cls) === 'mon' ? 'non' : 'mon' })); }}
                        title={r.clickable ? `${r.lcBasis} — click to switch classification` : r.lcBasis}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '17px', padding: '0 7px',
                          borderRadius: '5px', fontSize: '9px', fontWeight: 700, letterSpacing: '.3px',
                          cursor: r.clickable ? 'pointer' : 'default',
                          color: r.cls === 'mon' ? '#2C4BD1' : r.cls === 'non' ? '#B42318' : '#65708C',
                          background: r.cls === 'mon' ? 'rgba(44,75,209,.12)' : r.cls === 'non' ? 'rgba(180,35,24,.1)' : 'rgba(148,163,184,.16)',
                        }}
                      >
                        {r.isPl ? 'P&L' : r.cls === 'mon' ? 'Monetary' : 'Non-monetary'}
                      </button>
                    ) : '—'}
                  </td>
                  <td style={{ ...TD, textAlign: 'center' }}>{r.e.lc}</td>
                  <td style={{ ...TD, textAlign: 'right', background: 'rgba(255,255,255,.5)', color: '#232C42', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{N(r.net)}</td>
                  <td style={{ ...TD, textAlign: 'right', color: '#7A84A0', fontVariantNumeric: 'tabular-nums' }} title={r.lcBasis}>{rateFmt(r.rLc)}</td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{N(r.fcAmt)}</td>
                  <td
                    onContextMenu={(e) => { if (r.rmgl) { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, key: r.key, label: `${r.sp.name} · ${r.e.code}` }); } }}
                    style={{ ...TD, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: !r.rmgl ? '#B8BFCF' : N(r.rmgl, 1).charAt(0) === '(' ? '#B42318' : '#15803D', cursor: r.rmgl ? 'context-menu' : 'default' }}
                    title={r.rmgl ? 'Right-click to route this RMGL to another line item' : undefined}
                  >
                    {r.rmgl ? N(r.rmgl, 1) : '—'}
                  </td>
                  <td
                    onContextMenu={(e) => { if (r.rmgl) { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, key: r.key, label: `${r.sp.name} · ${r.e.code}` }); } }}
                    style={{ ...TD, color: r.rmgl ? '#414B62' : '#B8BFCF', cursor: r.rmgl ? 'context-menu' : 'default' }}
                  >
                    {r.rmgl ? r.dest : '—'}
                  </td>
                  <td style={{ ...TD, textAlign: 'right', color: '#7A84A0', fontVariantNumeric: 'tabular-nums' }} title={r.fcBasis}>{rateFmt(r.rFc)}</td>
                  <td style={{ ...TD, textAlign: 'right', background: 'rgba(255,255,255,.5)', color: '#232C42', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{N(r.rcAmt)}</td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: !r.cta ? '#B8BFCF' : N(r.cta, 1).charAt(0) === '(' ? '#B42318' : '#15803D' }}>{r.cta ? N(r.cta, 1) : '—'}</td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.cta ? N(r.cta * (1 - r.e.nci), 1) : '—'}</td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.cta && r.e.nci ? N(r.cta * r.e.nci, 1) : '—'}</td>
                </tr>
              ))}
              <tr>
                {['Total', '', '', '', '', '', '', '', '', ''].map((v, i) => (
                  <td key={i} style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0', fontWeight: 700, color: '#232C42' }}>{v}</td>
                ))}
                <td style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: N(tot.rmgl, 1).charAt(0) === '(' ? '#B42318' : '#15803D' }}>{N(tot.rmgl, 1)}</td>
                <td style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0' }} />
                <td style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0' }} />
                <td style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0', textAlign: 'right', fontWeight: 700, color: '#232C42', fontVariantNumeric: 'tabular-nums' }}>{N(tot.rc)}</td>
                <td style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: N(tot.cta, 1).charAt(0) === '(' ? '#B42318' : '#15803D' }}>{N(tot.cta, 1)}</td>
                <td style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{N(tot.par, 1)}</td>
                <td style={{ ...TD, background: '#E4E8F0', borderTop: '2px solid #CBD2E0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{N(tot.nci, 1)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '11px', fontSize: '11.5px', fontStyle: 'italic', color: '#7A84A0' }}>
          Monetary and non-monetary classification is shown only for RCFC entities, where the recording currency differs
          from the functional currency; click a classification to switch it. RMGL is recognised in Other income as a
          general rule and in Finance cost where it arises on borrowings — right-click an amount to route it elsewhere.
          CTA is taken to other comprehensive income and split between the parent and non-controlling interests.
        </div>
      </section>

      {/* ---- route RMGL context menu ---- */}
      {menu && (
        <div
          style={{ position: 'fixed', left: `${Math.min(menu.x, window.innerWidth - 240)}px`, top: `${menu.y}px`, zIndex: 61, width: '230px', background: '#ECEFF6', border: '1px solid #D9DEE9', borderRadius: '11px', boxShadow: '0 18px 40px -14px rgba(50,60,90,.45)', padding: '6px' }}
        >
          <div style={{ padding: '5px 9px 2px', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#9AA3BA' }}>Route RMGL to</div>
          <div style={{ padding: '0 9px 7px', fontSize: '11.5px', fontWeight: 700, color: '#232C42', borderBottom: '1px solid #DCE0EB', marginBottom: '5px' }}>{menu.label}</div>
          {PL_LINES.map((l) => (
            <button
              key={l} type="button" className="fc-btn"
              onClick={() => { setDest((d) => ({ ...d, [menu.key]: l })); setMenu(null); say(`RMGL routed to ${l}.`); }}
              style={{ display: 'flex', width: '100%', padding: '7px 9px', borderRadius: '7px', fontSize: '12px', color: '#333D55', textAlign: 'left' }}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {/* ---- rate master modal ---- */}
      {rmOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(35,44,66,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px', animation: 'fcFade .18s ease' }}>
          <div style={{ width: '100%', maxWidth: '1360px', maxHeight: '100%', display: 'flex', flexDirection: 'column', background: '#ECEFF6', border: '1px solid rgba(255,255,255,.8)', borderRadius: '18px', boxShadow: '0 30px 70px rgba(35,44,66,.4)', padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#7A84A0' }}>Exchange rate master</div>
                <h2 style={{ margin: '5px 0 0', fontSize: '19px', fontWeight: 700, color: '#232C42' }}>Rates by type, currency pair and effective date</h2>
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#7A84A0' }}>
                  Average and spot rates drive the period translation. Historical rates carry an identifier so each equity
                  or non-monetary event is translated at the rate that applied on its own date.
                </div>
              </div>
              <button
                type="button" className="fc-h fc-btn" onClick={() => setRmOpen(false)} title="Close"
                style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '32px', width: '32px', borderRadius: '9px', color: '#65708C', background: '#E4E8F0', border: '1px solid #CBD2E0' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {(['all', 'LC → FC', 'FC → RC'] as const).map((t) => (
                <button
                  key={t} type="button" className="fc-h fc-btn" onClick={() => setRmLeg(t)}
                  style={{
                    height: '28px', padding: '0 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                    ...(rmLeg === t
                      ? { color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)' }
                      : { color: '#65708C', background: '#E4E8F0', border: '1px solid #D6DBE7' }),
                  }}
                >
                  {t === 'all' ? 'All legs' : t}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: '11px', color: '#9AA3BA' }}>{rmList.length} of {rates.length} rates</span>
              <button
                type="button" className="fc-h fc-btn"
                onClick={() => { setRates((a) => [...a, { id: `r${Date.now() % 100000}`, type: 'Average', pair: 'EUR/USD', basis: 'Quarterly', date: '2026-09-30', event: '', src: 'Manual entry', rate: '' }]); setRmDirty(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', height: '30px', padding: '0 13px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 700, color: '#3B5BDB', background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.32)' }}
              >
                + Add rate
              </button>
              <button
                type="button" className="fc-h fc-btn"
                onClick={() => { setRmDirty(false); setRmOpen(false); say('Rate master applied — translation will use the updated rates on the next run.'); }}
                style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', height: '30px', padding: '0 14px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 700, color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', boxShadow: '0 3px 10px rgba(37,99,235,.3)' }}
              >
                Apply rates
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #DCE0EB', borderRadius: '12px', background: '#ECEFF6' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%', font: 'inherit' }}>
                <thead>
                  <tr>
                    {[['Rate type', ''], ['Currency pair', ''], ['Leg', 'derived'], ['Period basis', ''], ['Effective date', ''], ['Identifier', 'derived'], ['Event / basis', ''], ['Rate', ''], ['Source', ''], ['Status', '']].map(([h, sub]) => (
                      <th key={h} style={TH}>
                        {h}
                        {sub && <span style={{ display: 'block', marginTop: '2px', fontSize: '8.5px', fontWeight: 600, letterSpacing: '.3px', color: '#9AA3BA', textTransform: 'none' }}>{sub}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rmList.map((r) => {
                    const leg = pairLeg(r.pair);
                    const complete = !!r.rate && !!r.event;
                    const SEL: React.CSSProperties = { height: '26px', borderRadius: '7px', border: '1px solid #CBD2E0', background: '#fff', font: 'inherit', fontSize: '11px', color: '#333D55', padding: '0 6px', cursor: 'pointer' };
                    const INP: React.CSSProperties = { height: '26px', width: '100%', boxSizing: 'border-box', borderRadius: '7px', border: '1px solid #CBD2E0', background: '#fff', font: 'inherit', fontSize: '11px', color: '#333D55', padding: '0 7px', outline: 'none' };
                    return (
                      <tr key={r.id} className="fc-h">
                        <td style={TD}><select value={r.type} onChange={(e) => patchRate(r.id, 'type', e.target.value)} style={SEL}>{TYPE_OPTS.map((o) => <option key={o}>{o}</option>)}</select></td>
                        <td style={TD}><select value={r.pair} onChange={(e) => patchRate(r.id, 'pair', e.target.value)} style={SEL}>{PAIR_OPTS.map((o) => <option key={o}>{o}</option>)}</select></td>
                        <td style={TD}>
                          <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', color: leg === 'LC → FC' ? '#B45309' : '#2563EB', background: leg === 'LC → FC' ? 'rgba(245,158,11,.14)' : 'rgba(59,130,246,.12)' }}>{leg}</span>
                        </td>
                        <td style={TD}><select value={r.basis} onChange={(e) => patchRate(r.id, 'basis', e.target.value)} style={SEL}>{BASIS_OPTS.map((o) => <option key={o}>{o}</option>)}</select></td>
                        <td style={TD}>
                          <button
                            type="button" className="fc-h fc-btn" onClick={() => setCal({ id: r.id, month: r.date.slice(0, 7) })}
                            title="Pick effective date"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '26px', padding: '0 9px', borderRadius: '7px', border: '1px solid #CBD2E0', background: '#fff', fontSize: '11px', color: '#333D55' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                            {r.date}
                          </button>
                        </td>
                        <td style={TD}>
                          <span style={{ fontFamily: 'ui-sans-serif,system-ui,sans-serif', fontSize: '10px', fontWeight: 700, color: '#0F766E', background: 'rgba(15,118,110,.1)', border: '1px solid rgba(15,118,110,.26)', borderRadius: '5px', padding: '2px 6px' }}>{identOf(r)}</span>
                        </td>
                        <td style={{ ...TD, minWidth: '230px' }}><input value={r.event} onChange={(e) => patchRate(r.id, 'event', e.target.value)} placeholder="Event or basis" style={INP} /></td>
                        <td style={{ ...TD, width: '110px' }}><input value={r.rate} onChange={(e) => patchRate(r.id, 'rate', e.target.value)} placeholder="0.0000" style={{ ...INP, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} /></td>
                        <td style={TD}><select value={r.src} onChange={(e) => patchRate(r.id, 'src', e.target.value)} style={SEL}>{SRC_OPTS.map((o) => <option key={o}>{o}</option>)}</select></td>
                        <td style={TD}>
                          <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', color: complete ? '#15803D' : '#B45309', background: complete ? 'rgba(34,197,94,.14)' : 'rgba(245,158,11,.14)' }}>
                            {complete ? 'Ready' : 'Incomplete'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginTop: '12px' }}>
              <div style={{ flex: 1, minWidth: '260px', fontSize: '11.5px', fontStyle: 'italic', color: '#7A84A0' }}>
                The identifier is built from the rate type and the period: A for average, SC for spot closing, SO for spot
                opening and H for historical, followed by the period number on the effective date (1–12 for months).
              </div>
              {rmDirty && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#B45309', background: 'rgba(245,158,11,.14)', border: '1px solid rgba(245,158,11,.4)', padding: '4px 10px', borderRadius: '999px' }}>
                  Unsaved changes
                </span>
              )}
            </div>
          </div>

          {/* date picker */}
          {cal && (
            <DatePicker
              month={cal.month}
              value={rates.find((r) => r.id === cal.id)?.date ?? ''}
              onPick={(d) => { patchRate(cal.id, 'date', d); setCal(null); }}
              onMonth={(m) => setCal({ ...cal, month: m })}
              onClose={() => setCal(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------- effective-date calendar ---------------------- */

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function DatePicker({
  month, value, onPick, onMonth, onClose,
}: { month: string; value: string; onPick: (d: string) => void; onMonth: (m: string) => void; onClose: () => void }) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const label = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const shift = (d: number) => {
    const nm = new Date(y, m - 1 + d, 1);
    onMonth(`${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, '0')}`);
  };
  const iso = (d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 520, background: 'rgba(35,44,66,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '360px', background: '#fff', borderRadius: '18px', boxShadow: '0 30px 70px rgba(35,44,66,.4)', padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: '19px', fontWeight: 700, color: '#232C42' }}>{label}</div>
          <button type="button" className="fc-btn" onClick={() => shift(-1)} title="Previous month" style={{ height: '28px', width: '28px', borderRadius: '999px', color: '#7A84A0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <button type="button" className="fc-btn" onClick={() => shift(1)} title="Next month" style={{ height: '28px', width: '28px', borderRadius: '999px', color: '#7A84A0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <button type="button" className="fc-h fc-btn" onClick={() => { onMonth('2026-09'); }} title="Jump to period end"
            style={{ display: 'inline-flex', alignItems: 'center', height: '30px', padding: '0 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, color: '#3B5BDB', background: '#F2F5FC', border: '1px solid rgba(59,130,246,.3)' }}>
            Period end
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: '#F2F4F8', borderRadius: '14px', padding: '8px 4px', marginBottom: '6px' }}>
          {WEEK.map((w) => (
            <div key={w} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: '#9AA3BA' }}>{w}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
          {Array.from({ length: startPad }).map((_, i) => <span key={`p${i}`} />)}
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
            const on = iso(d) === value;
            return (
              <button
                key={d} type="button" className="fc-btn" onClick={() => onPick(iso(d))}
                style={{
                  height: '36px', borderRadius: '10px', fontSize: '12.5px', fontWeight: on ? 700 : 400,
                  ...(on ? { background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff' } : { color: '#414B62' }),
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #EEF1F6' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: '12px', color: '#7A84A0' }}>{value || 'No date selected'}</span>
          <button type="button" className="fc-h fc-btn" onClick={onClose}
            style={{ display: 'inline-flex', alignItems: 'center', height: '30px', padding: '0 15px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
