import React, { useMemo, useState } from 'react';
import { NotesPanel, NotesDocument, ndInitial, ndItems, ndBodyText, NdSources } from './NotesDisclosures';
import { WordPreview, WorkingNote, WnLink, wnLinkSources, SEED_SHEETS, Sheet } from './Deliverables';

/**
 * Reporting & Analytics — ported from docs/design/Fusion Close.dc.html,
 * block `<sc-if value="{{ is.repanalytics }}">` lines 2072–2687,
 * data `faceData` line 4128, slice logic line 7401.
 *
 * Reached from the Command Center's "Financial Reporting" tile (raTab
 * 'reporting') and "Data Analytics" tile (raTab 'analytics').
 */

/* ============================== data ============================== */

type Face = { id: string; label: string; vals?: number[]; kids?: Face[] };

/** entity columns, in order: US Holdings · UK Entity · Germany · France */
const ENTITIES = ['US Holdings Inc.', 'UK Entity Ltd.', 'Germany GmbH', 'France SAS'];

const FACE_DATA: Record<'bs' | 'is' | 'cf', Face[]> = {
  bs: [
    { id: 'a', label: 'Assets', kids: [
      { id: 'a1', label: 'Non-current assets', kids: [
        { id: 'a11', label: 'Property, plant & equipment', vals: [18420, 9200, 7400, 4100] },
        { id: 'a12', label: 'Right-of-use assets', vals: [4310, 2100, 1600, 900] },
        { id: 'a13', label: 'Goodwill & intangibles', vals: [52000, 8400, 6200, 2300] },
      ] },
      { id: 'a2', label: 'Current assets', kids: [
        { id: 'a21', label: 'Inventories', vals: [6100, 3200, 4800, 2100] },
        { id: 'a22', label: 'Trade receivables', vals: [9876, 4200, 5100, 2800] },
        { id: 'a23', label: 'Cash & equivalents', vals: [6204, 3900, 2700, 1900] },
      ] },
    ] },
    { id: 'e', label: 'Equity and liabilities', kids: [
      { id: 'e1', label: 'Equity', kids: [
        { id: 'e11', label: 'Share capital', vals: [12000, 5000, 4000, 2000] },
        { id: 'e12', label: 'Other reserves', vals: [3100, 1400, 1100, 600] },
        { id: 'e13', label: 'Retained earnings', kids: [
          { id: 'e131', label: 'Profit/loss carry-forward', vals: [16480, 7020, 7550, 3680] },
          { id: 'e132', label: 'Profit or loss (from P&L)', vals: [4070, 2680, 2150, 1120] },
        ] },
      ] },
      { id: 'e2', label: 'Non-current liabilities', kids: [
        { id: 'e21', label: 'Borrowings', vals: [42000, 6000, 4500, 2000] },
        { id: 'e22', label: 'Lease liabilities', vals: [4580, 2200, 1700, 950] },
      ] },
      { id: 'e3', label: 'Current liabilities', kids: [
        { id: 'e31', label: 'Trade & other payables', vals: [12580, 5800, 6100, 3300] },
        { id: 'e32', label: 'Current tax liabilities', vals: [2100, 900, 700, 450] },
      ] },
    ] },
  ],
  is: [
    { id: 'p', label: 'Profit for the period', kids: [
      { id: 'p1', label: 'Operating profit', kids: [
        { id: 'p11', label: 'Gross profit', kids: [
          { id: 'p111', label: 'Revenue', vals: [48200, 21400, 18700, 9800] },
          { id: 'p112', label: 'Cost of sales', vals: [-29100, -12800, -11500, -5900] },
        ] },
        { id: 'p12', label: 'Operating expenses', kids: [
          { id: 'p121', label: 'Selling & distribution', vals: [-6200, -2900, -2400, -1300] },
          { id: 'p122', label: 'Administrative expenses', vals: [-4800, -2100, -1900, -1000] },
          { id: 'p123', label: 'Amortization of intangibles', vals: [-1700, -400, -300, -150] },
        ] },
      ] },
      { id: 'p2', label: 'Net finance costs', kids: [
        { id: 'p21', label: 'Finance income', vals: [320, 140, 90, 60] },
        { id: 'p22', label: 'Finance costs', vals: [-2100, -500, -380, -190] },
      ] },
      { id: 'p3', label: 'Income tax expense', vals: [-1150, -700, -580, -330] },
    ] },
  ],
  cf: [
    { id: 'c', label: 'Net change in cash', kids: [
      { id: 'c1', label: 'Cash from operating activities', kids: [
        { id: 'c11', label: 'Profit before tax', vals: [4620, 2840, 2310, 1290] },
        { id: 'c12', label: 'Depreciation & amortization', vals: [2900, 1100, 900, 500] },
        { id: 'c13', label: 'Working capital movements', vals: [-1200, 400, -600, 200] },
        { id: 'c14', label: 'Income tax paid', vals: [-1000, -600, -500, -300] },
      ] },
      { id: 'c2', label: 'Cash used in investing', kids: [
        { id: 'c21', label: 'Capital expenditure', vals: [-2400, -800, -700, -350] },
        { id: 'c22', label: 'Acquisition of Nordica AB', vals: [-18600, 0, 0, 0] },
      ] },
      { id: 'c3', label: 'Cash from financing', kids: [
        { id: 'c31', label: 'Proceeds from borrowings', vals: [15000, 0, 0, 0] },
        { id: 'c32', label: 'Lease payments', vals: [-600, -280, -240, -120] },
        { id: 'c33', label: 'Dividends paid', vals: [-2500, 0, 0, 0] },
      ] },
    ] },
  ],
};

/* slice factors, design line 7409 */
const LE_LIST = ['Group consolidated', ...ENTITIES];
const BU_LIST = ['All business units', 'Manufacturing', 'Services', 'Corporate'];
const PER_LIST = ['Q3 2026', 'Q2 2026', 'Q1 2026', 'FY 2025'];
const BASIS_LIST = ['IFRS', 'US GAAP', 'Local GAAP'];
const BU_W: Record<string, number> = { 'All business units': 1, Manufacturing: 0.52, Services: 0.31, Corporate: 0.17 };
const PER_F: Record<string, number> = { 'Q3 2026': 1, 'Q2 2026': 0.94, 'Q1 2026': 0.88, 'FY 2025': 3.62 };
/** an interim period is compared against the prior full year */
const CMP_OF: Record<string, string> = { 'Q3 2026': 'FY 2025', 'Q2 2026': 'FY 2025', 'Q1 2026': 'FY 2025', 'FY 2025': 'FY 2024' };
const CMP_F: Record<string, number> = { 'Q3 2026': 3.62, 'Q2 2026': 3.62, 'Q1 2026': 3.62, 'FY 2025': 3.31 };
const BASIS_F: Record<string, number> = { IFRS: 1, 'US GAAP': 0.982, 'Local GAAP': 0.971 };


const VIEWS = [
  ['cmp', 'Comparative'],
  ['le', 'By legal entity'],
  ['bu', 'By business unit'],
  ['per', 'By period'],
] as const;

/** note references, keyed by face id */
const NOTE_NUM: Record<string, [string, string]> = {
  a11: ['4', 'Property, plant & equipment'],
  a13: ['5', 'Goodwill and intangible assets'],
  a22: ['7', 'Trade and other receivables'],
  e21: ['12', 'Borrowings'],
  e31: ['14', 'Trade and other payables'],
  p111: ['2', 'Revenue from contracts with customers'],
  p3: ['9', 'Income tax'],
};

/* ---- drill-down source, design raDrillTb / raDrillJe ---- */
const DRILL_TB: Record<string, { code: string; name: string; ent: string; v: number }[]> = {
  a11: [
    { code: '1400', name: 'PP&E: Manufacturing Equipment', ent: 'US01', v: 11200 },
    { code: '1420', name: 'PP&E: Computer Equipment', ent: 'US01', v: 4100 },
    { code: '1450', name: 'PP&E: Leasehold Improvements', ent: 'DE01', v: 3120 },
  ],
  p111: [
    { code: '4010', name: 'Revenue - Goods', ent: 'UK01', v: 31800 },
    { code: '4020', name: 'Revenue - Services', ent: 'UK01', v: 16400 },
  ],
  a22: [
    { code: '1100', name: 'Accounts Receivable - Trade', ent: 'UK01', v: 8100 },
    { code: '1190', name: 'AR Doubtful Allowance', ent: 'UK01', v: -1224 },
  ],
};
const DRILL_JE: Record<string, { id: string; narr: string; v: number }[]> = {
  a11: [{ id: 'JE-458', narr: 'UK reclass — asset category realignment', v: 1200 }],
  p111: [{ id: 'JE-ICE-0141', narr: 'IC elimination — management fees', v: -380 }],
};

/* ============================== styles ============================== */

const CARD: React.CSSProperties = {
  background: '#ECEFF6',
  border: '1px solid rgba(255,255,255,.75)',
  borderRadius: '18px',
  boxShadow: '9px 9px 22px rgba(166,175,195,.5),-9px -9px 22px rgba(255,255,255,.95)',
  padding: '20px 22px',
};

const ICON_BTN: React.CSSProperties = {
  flex: 'none', width: '38px', height: '38px', borderRadius: '11px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid #CBD2E0', background: 'rgba(255,255,255,.55)', color: '#414B62',
};

const SELECT: React.CSSProperties = {
  height: '32px', minWidth: '146px', background: '#fff', border: '1px solid #CBD2E0',
  borderRadius: '8px', font: 'inherit', fontSize: '12px', fontWeight: 600, color: '#333D55',
  padding: '0 8px', cursor: 'pointer',
};

const TH: React.CSSProperties = {
  padding: '7px 10px', textAlign: 'left', fontSize: '9.5px', letterSpacing: '.4px',
  textTransform: 'uppercase', fontWeight: 700, color: '#7A84A0', background: '#F3F5FA',
  borderBottom: '1px solid #CBD2E0',
};

/* ============================== screen ============================== */

/* ---- chart-of-account source for teal ± expansion (design srcTb, 7447) ---- */
const ENT_NAME: Record<string, string> = { US01: 'US Holdings Inc.', UK01: 'UK Entity Ltd.', DE01: 'Germany GmbH', FR01: 'France SAS' };

/** [entity, code, name, FSLI label it maps to, amount] */
const SRC_TB: [string, string, string, string, number][] = [
  ['US01', '1400', 'PP&E: Manufacturing Equipment', 'property, plant & equipment', 11200],
  ['US01', '1420', 'PP&E: Computer Equipment', 'property, plant & equipment', 4100],
  ['DE01', '1450', 'PP&E: Leasehold Improvements', 'property, plant & equipment', 3120],
  ['US01', '1600', 'Goodwill - Acquired', 'goodwill & intangibles', 41000],
  ['US01', '1650', 'Intangibles - Customer Lists', 'goodwill & intangibles', 11000],
  ['UK01', '1100', 'Accounts Receivable - Trade', 'trade receivables', 8100],
  ['UK01', '1190', 'AR Doubtful Allowance', 'trade receivables', -1224],
  ['DE01', '1110', 'AR - Intercompany Trade', 'trade receivables', 3000],
  ['UK01', '1010', 'Cash at bank', 'cash & equivalents', 6204],
  ['UK01', '4010', 'Revenue - Goods', 'revenue', 31800],
  ['UK01', '4020', 'Revenue - Services', 'revenue', 16400],
  ['UK01', '5010', 'Cost of Sales - Materials', 'cost of sales', -19100],
  ['UK01', '5020', 'Cost of Sales - Labor', 'cost of sales', -10000],
  ['UK01', '2010', 'Trade Payables', 'trade & other payables', -12580],
  ['UK01', '2500', 'Long-term Borrowings', 'borrowings', -42000],
];

const PYQ = 0.91;
const SHORT_ENT = (x: string) => x.replace(/ (Inc\.|Ltd\.|GmbH|SAS)$/, '');
const PY_LAB = (p: string) => (p.charAt(0) === 'Q' ? p.slice(0, 2) + ' ' + (Number(p.slice(-4)) - 1) : 'FY ' + (Number(p.slice(-4)) - 1));

const ST_TITLES: Record<string, [string, string]> = {
  bs: ['Consolidated Statement of Financial Position', 'As at 30 June 2026'],
  is: ['Consolidated Statement of Profit or Loss', 'For the three months ended 30 June 2026'],
  cf: ['Consolidated Cash Flow Statement', 'For the three months ended 30 June 2026'],
  soce: ['Consolidated Statement of Changes in Equity', 'For the three months ended 30 June 2026'],
};

const STMT_TABS = [
  ['bs', 'Balance Sheet'],
  ['is', 'Income Statement'],
  ['cf', 'Cash Flow Statement'],
  ['soce', 'SOCIE'],
] as const;

type Col = { k: string; label: string; sub: string; ent: number | 'all' | 'slice'; f: number; py?: boolean; total?: boolean };
type Row = {
  id: string; label: string; depth: number; blank?: boolean; vals: number[];
  weight: string; color: string; fs: string; bg?: string; topBorder?: boolean;
  hasKids?: boolean; collSign?: string; canCoa?: boolean; coaOn?: boolean;
  isAcct?: boolean; code?: string; ent?: string; node?: Face;
  note?: [string, string];
};

const COLL_BTN: React.CSSProperties = {
  flex: 'none', width: '15px', height: '15px', borderRadius: '4px', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center', fontFamily: 'ui-sans-serif,system-ui,sans-serif',
  fontSize: '11px', fontWeight: 700, lineHeight: 1, color: '#3B5BDB', background: 'rgba(59,91,219,.12)',
};
const COA_BTN: React.CSSProperties = { ...COLL_BTN, fontSize: '10px', color: '#0F766E', background: 'rgba(15,118,110,.12)' };

export default function ReportingAnalytics() {
  const [tab, setTab] = useState<'reporting' | 'analytics'>('reporting');
  const [stmt, setStmt] = useState<'bs' | 'is' | 'cf' | 'soce'>('bs');
  const [view, setView] = useState<(typeof VIEWS)[number][0]>('cmp');
  const [per, setPer] = useState('Q3 2026');
  const [le, setLe] = useState('Group consolidated');
  const [bu, setBu] = useState('All business units');
  const [basis, setBasis] = useState('IFRS');
  const [round, setRound] = useState<'k' | 'm'>('k');
  const [showPy, setShowPy] = useState(true);
  const [fsOpen, setFsOpen] = useState(true);
  const [coll, setColl] = useState<Record<string, boolean>>({});
  const [coa, setCoa] = useState<Record<string, boolean>>({});
  const [drill, setDrill] = useState<Face | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; label: string } | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [nd, setNd] = useState(ndInitial);
  const [wnSheets, setWnSheets] = useState<Sheet[]>(SEED_SHEETS);
  const [wdOpen, setWdOpen] = useState(false);
  const [wnOpen, setWnOpen] = useState(false);
  const [wnLinks, setWnLinks] = useState<WnLink[]>([]);
  const [packOpen, setPackOpen] = useState(false);
  const [packFmt, setPackFmt] = useState('excel');
  const [packStatus, setPackStatus] = useState<string | null>(null);
  const [colLab, setColLab] = useState<Record<string, string>>({});

  const leIdx = LE_LIST.indexOf(le) - 1;
  const gf = BASIS_F[basis];
  const buOf = BU_W[bu];
  const sliceF = buOf * PER_F[per] * gf;
  const cmpSliceF = buOf * CMP_F[per] * gf;

  const sumSel = (n: Face): number =>
    n.vals ? (leIdx >= 0 ? n.vals[leIdx] : n.vals.reduce((a, b) => a + b, 0))
      : (n.kids ?? []).reduce((s, k) => s + sumSel(k), 0);
  const sumIdx = (n: Face, i: number): number =>
    n.vals ? (n.vals[i] ?? 0) : (n.kids ?? []).reduce((s, k) => s + sumIdx(k, i), 0);
  const baseAll = (n: Face): number =>
    n.vals ? n.vals.reduce((a, b) => a + b, 0) : (n.kids ?? []).reduce((s, k) => s + baseAll(k), 0);

  const fmt = (v: number) => {
    if (round === 'm') {
      const x = v / 1000;
      const s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      return x < 0 ? '(' + s + ')' : s;
    }
    const r = Math.round(v);
    const s = Math.abs(r).toLocaleString('en-US');
    return r < 0 ? '(' + s + ')' : s;
  };
  const unit = round === 'm' ? 'USD millions' : 'USD thousands';

  /* ---- columns come in current/prior PAIRS (design pushPair, 7467) ---- */
  const cols = useMemo(() => {
    const out: Col[] = [];
    const pushPair = (k: string, label: string, sub: string, ent: Col['ent'], f: number, total?: boolean) => {
      out.push({ k, label, sub, ent, f, total });
      if (showPy) out.push({ k: k + 'p', label, sub: sub === per ? PY_LAB(per) : 'Prior year', ent, f: f * PYQ, py: true, total });
    };
    if (view === 'le') {
      ENTITIES.forEach((e, i) => pushPair('le' + i, SHORT_ENT(e), per, i, PER_F[per] * buOf * gf));
      pushPair('letot', 'Total', per, 'all', PER_F[per] * buOf * gf, true);
    } else if (view === 'bu') {
      ['Manufacturing', 'Services', 'Corporate'].forEach((b) => pushPair('bu' + b, b, per, 'slice', PER_F[per] * BU_W[b] * gf));
      pushPair('butot', 'Total', per, 'slice', PER_F[per] * gf, true);
    } else if (view === 'per') {
      PER_LIST.forEach((p) => {
        out.push({ k: 'p' + p, label: p, sub: p.charAt(0) === 'Q' ? 'Quarter' : 'Full year', ent: 'slice', f: PER_F[p] * buOf * gf });
        if (showPy) out.push({ k: 'p' + p + 'p', label: PY_LAB(p), sub: 'Prior year', ent: 'slice', f: PER_F[p] * PYQ * buOf * gf, py: true });
      });
    }
    if (!out.length) {
      out.push({ k: 'cur', label: per, sub: per.charAt(0) === 'Q' ? 'Quarter to date · unaudited' : 'Full year · audited', ent: 'slice', f: sliceF });
      if (showPy) out.push({ k: 'cmp', label: CMP_OF[per], sub: 'Prior year · full year · audited', ent: 'slice', f: cmpSliceF, py: true });
    }
    return out;
  }, [view, per, bu, basis, showPy, leIdx, sliceF, cmpSliceF, buOf, gf]);

  const colBase = (c: Col, n: Face) =>
    c.ent === 'slice' ? sumSel(n) : c.ent === 'all' ? baseAll(n) : sumIdx(n, c.ent);
  const colVals = (n: Face) => cols.map((c) => colBase(c, n) * c.f);

  /**
   * Figures a footnote-table cell can be bound to — the design's `ndFigIndex()`
   * (6143), `ndTbIndex()` (6152) and the working-note walk in `ndTblLinkOpts()`.
   * Rebuilt whenever the slice changes, so linked cells move with the period.
   */
  const ndSources: NdSources = useMemo(() => {
    const ST_LAB: Record<string, string> = { bs: 'Balance Sheet', is: 'Income Statement', cf: 'Cash Flow' };
    const fsli: NdSources['fsli'] = [];
    (['bs', 'is', 'cf'] as const).forEach((k) => {
      const walk = (ns: Face[]) => ns.forEach((n) => {
        const v = sumSel(n) * sliceF;
        fsli.push({ id: `${k}:${n.id}`, label: `${n.label} (${ST_LAB[k]})`, value: fmt(v), tip: `${n.label} · ${ST_LAB[k]} · ${per} (live)` });
        if (n.kids) walk(n.kids);
      });
      walk(FACE_DATA[k]);
    });

    /* trial balance, aggregated per account and per account-within-entity */
    const agg = new Map<string, { label: string; total: number; byEnt: Map<string, number> }>();
    SRC_TB.forEach(([ent, code, name, , v]) => {
      const a = agg.get(code) ?? { label: name, total: 0, byEnt: new Map<string, number>() };
      a.total += v;
      a.byEnt.set(ent, (a.byEnt.get(ent) ?? 0) + v);
      agg.set(code, a);
    });
    const tb: NdSources['tb'] = [];
    agg.forEach((a, code) => {
      tb.push({ id: `${code}`, label: `a/c ${code} · ${a.label} — all entities`, value: fmt(a.total * PER_F[per]), tip: `Trial balance · a/c ${code} · all entities · ${per} (live)` });
      a.byEnt.forEach((v, ent) => {
        tb.push({ id: `${code}|${ent}`, label: `a/c ${code} · ${a.label} — ${ENT_NAME[ent] ?? ent}`, value: fmt(v * PER_F[per]), tip: `Trial balance · a/c ${code} · ${ENT_NAME[ent] ?? ent} · ${per} (live)` });
      });
    });

    return { fsli, tb, wn: wnLinkSources(wnSheets) };
  }, [per, leIdx, buOf, gf, round, sliceF, wnSheets]);

  /* ---- rows: section caption blank on top, subtotal at the FOOT ---- */
  const rows = useMemo(() => {
    if (stmt === 'soce') return [];
    const out: Row[] = [];

    const pushCoa = (n: Face, depth: number, lineVals: number[]) => {
      const lab = String(n.label).toLowerCase();
      const agg: Record<string, { code: string; name: string; ent: string; v: number }> = {};
      SRC_TB.forEach(([e, code, name, fsli, amt]) => {
        if (String(fsli).toLowerCase() !== lab) return;
        if (leIdx >= 0 && (ENT_NAME[e] ?? e) !== le) return;
        const k = code + '|' + e;
        agg[k] = { code, name, ent: ENT_NAME[e] ?? e, v: (agg[k] ? agg[k].v : 0) + amt };
      });
      const keys = Object.keys(agg);
      if (!keys.length) {
        out.push({ id: n.id + '-coa-none', label: 'No chart-of-account detail mapped in this cut', depth: depth + 1, blank: true, vals: [], weight: '400', color: '#9AA3BA', fs: '11px' });
        return;
      }
      const raw = keys.reduce((s, k) => s + agg[k].v, 0);
      keys.forEach((k) => {
        const a = agg[k];
        const share = raw ? a.v / raw : 0;
        out.push({
          id: n.id + '-' + k, label: a.name, depth: depth + 1, vals: lineVals.map((v) => v * share),
          weight: '400', color: '#4A5471', fs: '11.5px', bg: 'rgba(15,118,110,.035)',
          isAcct: true, code: a.code, ent: a.ent,
        });
      });
    };

    const walk = (nodes: Face[], depth: number) => nodes.forEach((n) => {
      const vals = colVals(n);
      const hasKids = !!(n.kids && n.kids.length);
      const open = hasKids && !coll[n.id];
      const bold = depth === 0;
      const note = NOTE_NUM[n.id];

      if (open) {
        // section caption carries no figures — the total is reported at the foot
        out.push({
          id: n.id, label: n.label, depth, blank: true, vals: [], node: n, note,
          weight: bold ? '700' : '600', color: bold ? '#232C42' : '#34406B',
          fs: bold ? '12.5px' : '12px', hasKids: true, collSign: '−',
        });
        walk(n.kids as Face[], depth + 1);
        out.push({
          id: n.id + '-tot',
          label: 'Total ' + String(n.label).charAt(0).toLowerCase() + String(n.label).slice(1),
          depth, vals, node: n, weight: '700', color: bold ? '#232C42' : '#34406B',
          fs: bold ? '12.5px' : '12px', topBorder: true,
          bg: bold ? 'rgba(59,91,219,.06)' : 'rgba(59,91,219,.03)',
        });
        return;
      }
      out.push({
        id: n.id, label: n.label, depth, vals, node: n, note,
        weight: bold ? '700' : depth === 1 ? '600' : '400',
        color: bold ? '#232C42' : '#4A5471', fs: bold ? '12.5px' : '12px',
        hasKids, collSign: '+', canCoa: !hasKids, coaOn: !!coa[n.id],
      });
      if (!hasKids && coa[n.id]) pushCoa(n, depth, vals);
    });

    walk(FACE_DATA[stmt], 0);
    return out;
  }, [stmt, coll, coa, cols, leIdx, le]);

  const exportPack = () => {
    setPackStatus('Preparing ' + (packFmt === 'both' ? 'Excel and Word' : packFmt === 'word' ? 'Word' : 'Excel') + ' pack…');
    setTimeout(() => setPackStatus('Reporting pack ready · ' + ST_TITLES[stmt][0] + ' · ' + per + ' · ' + unit), 700);
  };
  const resetFilters = () => {
    setPer('Q3 2026'); setLe('Group consolidated'); setBu('All business units');
    setBasis('IFRS'); setView('cmp'); setShowPy(true);
  };


  const title = tab === 'reporting' ? 'Financial Reporting' : 'Data Analytics';
  const sub = tab === 'reporting'
    ? 'Statement faces, policies and notes — sliced by period, entity, business unit and basis.'
    : 'KPIs, variance and ratio analysis drawn from the same consolidated figures.';

  return (
    <div style={{ padding: '24px 28px 26px', animation: 'fcFade .25s ease' }} onClick={() => setCtx(null)}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#232C42' }}>{title}</h1>
          <p style={{ margin: '5px 0 0', fontSize: '12.5px', color: '#65708C', fontStyle: 'italic' }}>{sub}</p>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {tab === 'reporting' && (
            <>
              {/* eye — the Word deliverable */}
              <button
                type="button" className="fc-h fc-btn" onClick={() => setWdOpen(true)}
                title="Preview the Word financial statements — faces first, then the notes to the consolidated financial statements"
                aria-label="Preview Word financial statements"
                style={ICON_BTN}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
              {/* embedded Excel working note */}
              <button
                type="button" className="fc-h fc-btn" onClick={() => setWnOpen(true)}
                title="Add Working Note (WN) — opens the embedded MS Excel workbook"
                aria-label="Add Working Note"
                style={{ ...ICON_BTN, ...(wnLinks.length ? { borderColor: '#0F766E', background: 'rgba(15,118,110,.12)', color: '#0B5A54' } : null) }}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
                  <path d="M3.5 9.5h17M9.5 9.5v11" />
                </svg>
              </button>
              <button
                type="button" className="fc-h fc-btn" onClick={() => setNotesOpen((v) => !v)} title="Notes and Disclosures"
                style={{ ...ICON_BTN, ...(notesOpen ? { borderColor: '#7C3AED', background: 'rgba(124,58,237,.12)', color: '#6D28D9' } : null) }}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h6M9 16h4" />
                </svg>
              </button>
              <button
                type="button" className="fc-h fc-btn" onClick={() => setPackOpen((v) => !v)} title="Export Reporting Pack"
                style={{ ...ICON_BTN, ...(packOpen ? { borderColor: '#3B82F6', background: 'rgba(59,130,246,.12)', color: '#2563EB' } : null) }}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3.5v10M8.25 9.75L12 13.5l3.75-3.75M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
                </svg>
              </button>
              {packOpen && (
                <div style={{ position: 'absolute', top: '48px', right: 0, zIndex: 60, width: '340px', background: '#ECEFF6', border: '1px solid rgba(255,255,255,.8)', borderRadius: '16px', boxShadow: '0 22px 48px rgba(30,40,70,.28),9px 9px 22px rgba(166,175,195,.4),-6px -6px 16px rgba(255,255,255,.9)', padding: '16px', textAlign: 'left', animation: 'fcFade .16s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
                    <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 700, color: '#232C42' }}>Export Reporting Pack</span>
                    <button type="button" className="fc-btn" onClick={() => setPackOpen(false)} style={{ width: '24px', height: '24px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A84A0', background: '#E4E8F0' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                    </button>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#7A84A0', fontStyle: 'italic', lineHeight: 1.55 }}>
                    Statements, policies and notes exactly as set on this page. The file downloads here — no page change.
                  </div>
                  <div style={{ display: 'flex', gap: '9px', marginTop: '12px' }}>
                    <select value={packFmt} onChange={(e) => setPackFmt(e.target.value)} style={{ flex: 1, height: '38px', padding: '0 10px', borderRadius: '10px', border: '1px solid rgba(154,163,186,.4)', background: '#E4E8F0', boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.4),inset -2px -2px 6px rgba(255,255,255,.9)', font: 'inherit', fontSize: '12.5px', color: '#333D55' }}>
                      <option value="excel">Excel format</option>
                      <option value="word">Word format</option>
                      <option value="both">Both formats</option>
                    </select>
                    <button type="button" className="fc-h fc-btn" onClick={exportPack} style={{ flex: 'none', height: '38px', padding: '0 18px', borderRadius: '10px', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', fontSize: '12.5px', fontWeight: 700, color: '#fff', boxShadow: '0 3px 12px rgba(37,99,235,.4)' }}>Export</button>
                  </div>
                  {packStatus && (
                    <div style={{ marginTop: '12px', paddingTop: '11px', borderTop: '1px solid #DCE0EB', display: 'flex', gap: '9px', alignItems: 'flex-start' }}>
                      <span style={{ flex: 'none', width: '7px', height: '7px', borderRadius: '50%', marginTop: '5px', background: '#16A34A' }} />
                      <span style={{ flex: 1, fontSize: '11.5px', color: '#65708C', lineHeight: 1.5 }}>{packStatus}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {tab === 'analytics' ? (
        <AnalyticsTab sliceF={sliceF} cmpSliceF={cmpSliceF} per={per} fmt={fmt} unit={unit} sumSel={sumSel} />
      ) : (
        <>
          <section style={{ ...CARD, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <button type="button" className="fc-h fc-btn" onClick={() => setFsOpen((v) => !v)} style={COLL_BTN} title="Collapse the statement">
                {fsOpen ? '−' : '+'}
              </button>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {STMT_TABS.map(([k, label]) => (
                  <button
                    key={k} type="button" className="fc-h fc-btn" onClick={() => setStmt(k)}
                    style={{
                      padding: '6px 11px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap',
                      ...(stmt === k ? { background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff', boxShadow: '0 2px 8px rgba(37,99,235,.32)' } : { color: '#65708C' }),
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '3px', borderRadius: '9px', background: '#E4E8F0', boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.4),inset -2px -2px 5px rgba(255,255,255,.9)' }}>
                {(['k', 'm'] as const).map((r) => (
                  <button
                    key={r} type="button" className="fc-btn" onClick={() => setRound(r)}
                    style={{
                      height: '24px', padding: '0 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 700,
                      ...(round === r ? { background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff' } : { color: '#65708C' }),
                    }}
                  >
                    {r === 'k' ? '000s' : 'Millions'}
                  </button>
                ))}
              </div>
            </div>

            {fsOpen && (
              <>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#232C42' }}>{ST_TITLES[stmt][0]}</div>
                <div style={{ fontSize: '11.5px', color: '#7A84A0', marginBottom: '12px' }}>{ST_TITLES[stmt][1]} · {unit}</div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '10px', padding: '11px 12px', marginBottom: '11px', borderRadius: '12px', background: '#E4E8F0', border: '1px solid rgba(255,255,255,.7)', boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.4),inset -2px -2px 6px rgba(255,255,255,.9)' }}>
                  <span style={{ alignSelf: 'center', fontSize: '9.5px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#9AA3BA', marginRight: '2px' }}>Slice</span>
                  {([
                    ['Period', per, PER_LIST, setPer, 'Reporting period the statements are drawn for'],
                    ['Legal entity', le, LE_LIST, setLe, 'Filter to a single legal entity or keep the group consolidation'],
                    ['Business unit', bu, BU_LIST, setBu, 'Filter to a single business unit'],
                    ['Reporting basis', basis, BASIS_LIST, setBasis, 'Accounting framework applied to the figures'],
                  ] as const).map(([label, value, options, setter, tip]) => (
                    <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7A84A0' }}>{label}</span>
                      <select value={value} onChange={(e) => setter(e.target.value)} title={tip} style={SELECT}>
                        {options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                  ))}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7A84A0' }}>Columns</span>
                    <select value={view} onChange={(e) => setView(e.target.value as typeof view)} title="How the amount columns are laid out" style={SELECT}>
                      {VIEWS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </label>
                  <button
                    type="button" className="fc-h fc-btn" onClick={() => setShowPy((v) => !v)}
                    title={showPy ? 'Hide the prior-year column beside each period' : 'Show a prior-year column beside each period'}
                    style={{
                      height: '32px', padding: '0 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', fontWeight: 700,
                      ...(showPy ? { color: '#15803D', background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.4)' } : { color: '#7A84A0', background: 'rgba(255,255,255,.7)', border: '1px solid #CBD2E0' }),
                    }}
                  >
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: showPy ? '#16A34A' : '#9AA3BA' }} />
                    Prior year
                  </button>
                  <div style={{ flex: 1, minWidth: '8px' }} />
                  <button type="button" className="fc-h fc-btn" onClick={resetFilters} style={{ height: '32px', padding: '0 13px', borderRadius: '8px', border: '1px solid #CBD2E0', background: 'rgba(255,255,255,.7)', fontSize: '11.5px', fontWeight: 700, color: '#414B62' }}>
                    Reset
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px', marginBottom: '10px', fontSize: '11px', color: '#7A84A0', fontStyle: 'italic' }}>
                  <span>{le} · {bu} · {basis} basis · {unit}</span>
                  <span style={{ color: '#CBD2E0' }}>|</span>
                  <span>
                    {view === 'le' ? 'One column per legal entity, consolidated total at the right.'
                      : view === 'bu' ? 'One column per business unit, total at the right.'
                        : view === 'per' ? 'One column per period.'
                          : 'Current period against its comparative.'}
                  </span>
                  <span style={{ color: '#CBD2E0' }}>|</span>
                  <span style={{ color: '#3B5BDB' }}>
                    Totals sit at the foot of each group · teal ± expands a line to chart-of-account level ·
                    blue ± groups and ungroups a section · left-click an amount to drill through, right-click a line to comment.
                  </span>
                </div>

                {stmt === 'soce' ? (
                  <SoceTable fmt={fmt} sliceF={sliceF} sumSel={sumSel} />
                ) : (
                  <div style={{ border: '1px solid #E4E8F2', borderRadius: '12px', overflowX: 'auto', background: '#fff' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'max-content', font: 'inherit' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '300px', padding: '7px 10px', textAlign: 'left', background: '#F3F5FA', borderBottom: '1px solid #CBD2E0', position: 'sticky', left: 0, zIndex: 3, boxShadow: '8px 0 10px -8px rgba(45,54,80,.3)' }}>
                            <input
                              value={colLab.lab ?? 'Line item'}
                              onChange={(e) => setColLab((l) => ({ ...l, lab: e.target.value }))}
                              title="Edit this column label"
                              style={{ width: '100%', background: 'transparent', border: 0, font: 'inherit', fontSize: '9.5px', letterSpacing: '.4px', textTransform: 'uppercase', fontWeight: 700, color: '#7A84A0', outline: 'none' }}
                            />
                          </th>
                          <th style={{ width: '52px', padding: '7px 6px', textAlign: 'center', background: '#F3F5FA', borderBottom: '1px solid #CBD2E0' }}>
                            <input
                              value={colLab.note ?? 'Note'}
                              onChange={(e) => setColLab((l) => ({ ...l, note: e.target.value }))}
                              title="Edit this column label"
                              style={{ width: '100%', background: 'transparent', border: 0, font: 'inherit', fontSize: '9.5px', letterSpacing: '.4px', textTransform: 'uppercase', fontWeight: 700, color: '#7A84A0', textAlign: 'center', outline: 'none' }}
                            />
                          </th>
                          {cols.map((c) => (
                            <th key={c.k} style={{ minWidth: '120px', padding: '7px 12px', textAlign: 'right', background: c.total ? '#EDF0FA' : '#F3F5FA', borderBottom: '1px solid #CBD2E0' }}>
                              <input
                                value={colLab[c.k] ?? c.label}
                                onChange={(e) => setColLab((l) => ({ ...l, [c.k]: e.target.value }))}
                                title="Edit this column label"
                                style={{ width: '100%', background: 'transparent', border: 0, font: 'inherit', fontSize: '9.5px', letterSpacing: '.4px', textTransform: 'uppercase', fontWeight: 700, color: c.py ? '#9AA3BA' : '#7A84A0', textAlign: 'right', outline: 'none' }}
                              />
                              <span style={{ display: 'block', marginTop: '2px', fontSize: '8.5px', fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#A6AEC2' }}>{c.sub}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr
                            key={r.id}
                            className="fc-h"
                            onContextMenu={(e) => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, label: r.label }); }}
                            style={{ cursor: 'pointer' }}
                          >
                            <td style={{ overflow: 'hidden', padding: (r.topBorder ? '7px' : '6px') + ' 10px', paddingLeft: (10 + r.depth * 17) + 'px', fontSize: r.fs, color: r.color, fontWeight: Number(r.weight), borderBottom: '1px solid #E4E8F2', borderTop: r.topBorder ? '1.5px solid #B9C2D6' : undefined, background: r.bg ?? '#fff', position: 'sticky', left: 0, zIndex: 2, boxShadow: '8px 0 10px -8px rgba(45,54,80,.3)' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                                {r.hasKids && (
                                  <button type="button" className="fc-btn" onClick={(e) => { e.stopPropagation(); setColl((c) => ({ ...c, [r.id]: !c[r.id] })); }} title="Group / ungroup this section" style={COLL_BTN}>
                                    {r.collSign}
                                  </button>
                                )}
                                {r.canCoa && (
                                  <button type="button" className="fc-btn" onClick={(e) => { e.stopPropagation(); setCoa((c) => ({ ...c, [r.id]: !c[r.id] })); }} title={r.coaOn ? 'Hide the chart-of-account detail' : 'Expand to chart-of-account level'} style={COA_BTN}>
                                    {r.coaOn ? '−' : '+'}
                                  </button>
                                )}
                                {r.isAcct && (
                                  <>
                                    <span style={{ flex: 'none', fontFamily: 'ui-sans-serif,system-ui,sans-serif', fontSize: '10px', fontWeight: 700, color: '#0F766E', background: 'rgba(15,118,110,.1)', border: '1px solid rgba(15,118,110,.26)', borderRadius: '5px', padding: '1px 5px' }}>{r.code}</span>
                                    <span style={{ flex: 'none', fontSize: '10px', color: '#9AA3BA' }}>{r.ent}</span>
                                  </>
                                )}
                                {r.label}
                              </span>
                            </td>
                            <td style={{ padding: '6px 6px', textAlign: 'center', borderBottom: '1px solid #E4E8F2', borderTop: r.topBorder ? '1.5px solid #B9C2D6' : undefined, background: r.bg ?? '#fff' }}>
                              {r.note && (
                                <button type="button" className="fc-btn" onClick={(e) => { e.stopPropagation(); setNotesOpen(true); }} title={'Note ' + r.note[0] + ' — ' + r.note[1]} style={{ fontSize: '10.5px', fontWeight: 700, color: '#3B5BDB', padding: '1px 6px', borderRadius: '5px', background: 'rgba(59,91,219,.1)' }}>
                                  {r.note[0]}
                                </button>
                              )}
                            </td>
                            {cols.map((c, i) => {
                              const v = r.vals[i];
                              return (
                                <td
                                  key={c.k}
                                  onClick={() => r.node && setDrill(r.node)}
                                  title={r.label + ' · ' + c.label + ' · ' + c.sub}
                                  style={{
                                    padding: (r.topBorder ? '7px' : '6px') + ' 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                                    fontSize: r.fs, borderBottom: '1px solid #E4E8F2',
                                    borderTop: r.topBorder ? '1.5px solid #B9C2D6' : undefined,
                                    fontWeight: c.py ? (r.weight === '700' ? 600 : 400) : Number(r.weight),
                                    color: r.blank ? 'transparent' : v < 0 ? (c.py ? '#C4756C' : '#B42318') : c.py ? '#8A93A8' : r.color,
                                    background: c.total ? 'rgba(59,91,219,.055)' : r.bg ?? '#fff',
                                  }}
                                >
                                  {r.blank ? '' : fmt(v)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          {ctx && (
            <div style={{ position: 'fixed', left: Math.min(ctx.x, window.innerWidth - 230) + 'px', top: ctx.y + 'px', zIndex: 400, width: '220px', background: '#ECEFF6', border: '1px solid #D9DEE9', borderRadius: '11px', boxShadow: '0 18px 40px -14px rgba(50,60,90,.45)', padding: '6px' }}>
              <div style={{ padding: '6px 9px 7px', borderBottom: '1px solid #D9DEE9', marginBottom: '3px', fontSize: '11.5px', fontWeight: 700, color: '#232C42', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctx.label}</div>
              {['Add a comment', 'Attach a working note', 'Link to a disclosure note', 'Copy figure'].map((a) => (
                <button key={a} type="button" className="fc-btn" onClick={() => setCtx(null)} style={{ display: 'flex', width: '100%', padding: '7px 9px', borderRadius: '7px', fontSize: '12px', color: '#333D55', textAlign: 'left' }}>
                  {a}
                </button>
              ))}
            </div>
          )}

          {wdOpen && (
            <WordPreview
              onClose={() => setWdOpen(false)}
              doc={{
                title: 'ClientCo Industries Group',
                meta: `${ST_TITLES[stmt][1]} · ${le} · ${basis} basis · ${unit}`,
                statement: {
                  title: ST_TITLES[stmt][0],
                  sub: `${ST_TITLES[stmt][1]} · ${unit}`,
                  cols: cols.map((c) => `${colLab[c.k] ?? c.label}${c.sub ? ` (${c.sub})` : ''}`),
                  rows: rows.map((r) => ({
                    label: r.label, depth: r.depth, blank: r.blank,
                    strong: r.weight === '700',
                    vals: r.vals.map((v) => fmt(v)),
                  })),
                },
                notes: [
                  { heading: nd.titles.secA ?? 'Statement of Significant Accounting Policies',
                    items: ndItems(nd, 'sosap').filter((x) => nd.sel[x.id]).map((x) => ({ title: nd.titles[x.id] ?? x.title, body: ndBodyText(nd, x, ndSources) })) },
                  { heading: nd.titles.secB ?? 'Notes to the consolidated financial statements',
                    items: ndItems(nd, 'notes').filter((x) => nd.sel[x.id]).map((x) => ({ title: nd.titles[x.id] ?? x.title, body: ndBodyText(nd, x, ndSources) })) },
                ],
              }}
            />
          )}

          {wnOpen && (
            <WorkingNote
              onClose={() => setWnOpen(false)}
              links={wnLinks}
              setLinks={setWnLinks}
              sheets={wnSheets}
              setSheets={setWnSheets}
              noteTargets={[
                ...ndItems(nd, 'notes').filter((x) => nd.sel[x.id]).map((x) => `Note · ${nd.titles[x.id] ?? x.title}`),
                ...rows.filter((r) => !r.blank).map((r) => `Line · ${r.label}`),
              ]}
            />
          )}

          {drill && <DrillPanel node={drill} fmt={fmt} sliceF={sliceF} unit={unit} onClose={() => setDrill(null)} />}
          <section style={{ ...CARD, marginTop: '16px' }}>
            <NotesDocument st={nd} setSt={setNd} tenant="ClientCo Industries Group" period={per} sources={ndSources} onOpenWn={() => setWnOpen(true)} />
          </section>
          {notesOpen && <NotesPanel st={nd} setSt={setNd} onClose={() => setNotesOpen(false)} />}
        </>
      )}
    </div>
  );
}

/* ========================== SOCE ========================== */

const SOCE_HEADS = ['Share capital', 'Other reserves', 'Retained earnings', 'Total equity'];

function SoceTable({ fmt, sliceF, sumSel }: { fmt: (v: number) => string; sliceF: number; sumSel: (n: Face) => number }) {
  const [heads, setHeads] = useState(SOCE_HEADS);
  const eq = FACE_DATA.bs[1].kids![0];
  const sc = sumSel(eq.kids![0]) * sliceF;
  const or = sumSel(eq.kids![1]) * sliceF;
  const re = sumSel(eq.kids![2]) * sliceF;
  const profit = sumSel(FACE_DATA.bs[1].kids![0].kids![2].kids![1]) * sliceF;

  const ROWS: [string, number, number, number, boolean][] = [
    ['Balance at start of period', sc, or, re - profit, true],
    ['Profit for the period', 0, 0, profit, false],
    ['Other comprehensive income', 0, or * 0.08, 0, false],
    ['Dividends paid', 0, 0, -2500 * sliceF, false],
    ['Balance at end of period', sc, or * 1.08, re - 2500 * sliceF, true],
  ];

  return (
    <div style={{ border: '1px solid #E4E8F2', borderRadius: '12px', overflowX: 'auto', background: '#fff' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', font: 'inherit' }}>
        <thead>
          <tr>
            <th style={TH} />
            {SOCE_HEADS.map((h, i) => (
              <th key={h} style={{ ...TH, textAlign: 'right' }}>
                <input
                  value={heads[i]}
                  onChange={(e) => { const v = e.target.value; setHeads((x) => x.map((y, j) => (j === i ? v : y))); }}
                  onBlur={() => setHeads((x) => x.map((y, j) => (j === i && !y.trim() ? SOCE_HEADS[i] : y)))}
                  title="Edit this column label"
                  aria-label={`Column label — ${SOCE_HEADS[i]}`}
                  style={{ width: '100%', minWidth: '96px', background: 'transparent', border: 0, font: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', fontWeight: 'inherit', color: 'inherit', textAlign: 'right', outline: 'none' }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, a, b, c, strong]) => (
            <tr key={label} style={{ borderBottom: '1px solid #EEF1F7' }}>
              <td style={{ padding: '7px 10px', fontSize: '12px', fontWeight: strong ? 700 : 400, color: strong ? '#232C42' : '#414B62' }}>{label}</td>
              {[a, b, c, a + b + c].map((v, i) => (
                <td
                  key={i}
                  style={{
                    padding: '7px 12px', textAlign: 'right', fontSize: '12px', fontVariantNumeric: 'tabular-nums',
                    fontWeight: strong || i === 3 ? 700 : 400, color: v < 0 ? '#B42318' : '#414B62',
                  }}
                >
                  {v === 0 ? '—' : fmt(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ========================== drill-down ========================== */

function DrillPanel({
  node, fmt, sliceF, unit, onClose,
}: { node: Face; fmt: (v: number) => string; sliceF: number; unit: string; onClose: () => void }) {
  const tb = DRILL_TB[node.id] ?? [];
  const je = DRILL_JE[node.id] ?? [];
  const kids = node.kids ?? [];

  return (
    <section style={{ ...CARD, marginTop: '16px', borderLeft: '3px solid #3B5BDB' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9AA3BA' }}>Drill-down</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#232C42', marginTop: '2px' }}>{node.label}</div>
          <div style={{ fontSize: '11px', color: '#7A84A0', fontStyle: 'italic', marginTop: '2px' }}>
            {kids.length
              ? 'A grouped line — its composition is below.'
              : tb.length || je.length
                ? 'A posting-level line — its detail sits in the source accounts and journal entries below.'
                : 'A posting-level line with no account-level detail mapped in the current cut.'}
          </div>
        </div>
        <button
          type="button" className="fc-h fc-btn" onClick={onClose} aria-label="Close drill-down"
          style={{ flex: 'none', width: '26px', height: '26px', borderRadius: '7px', color: '#7A84A0', background: '#E0E4EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '14px' }}>
        {kids.length > 0 && (
          <DrillBlock title="Composition">
            {kids.map((k) => (
              <DrillRow key={k.id} left={k.label} right={fmt((k.vals ? k.vals.reduce((a, b) => a + b, 0) : 0) * sliceF)} />
            ))}
          </DrillBlock>
        )}
        {tb.length > 0 && (
          <DrillBlock title={`Trial balance accounts · ${unit}`}>
            {tb.map((r) => (
              <DrillRow key={r.code} left={`${r.code} · ${r.name}`} tag={r.ent} right={fmt(r.v * sliceF)} />
            ))}
          </DrillBlock>
        )}
        {je.length > 0 && (
          <DrillBlock title="Journal entries">
            {je.map((j) => <DrillRow key={j.id} left={j.narr} tag={j.id} right={fmt(j.v * sliceF)} />)}
          </DrillBlock>
        )}
      </div>
    </section>
  );
}

function DrillBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#E4E8F0', borderRadius: '12px', boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.4),inset -2px -2px 6px rgba(255,255,255,.9)', padding: '12px 14px' }}>
      <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9AA3BA', marginBottom: '7px' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{children}</div>
    </div>
  );
}

function DrillRow({ left, right, tag }: { left: string; right: string; tag?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
      {tag && <span style={{ flex: 'none', fontSize: '9.5px', fontWeight: 700, color: '#0F766E' }}>{tag}</span>}
      <span style={{ flex: 1, minWidth: 0, fontSize: '11.5px', color: '#65708C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{left}</span>
      <span style={{ flex: 'none', fontSize: '11.5px', fontWeight: 700, color: '#232C42', fontVariantNumeric: 'tabular-nums' }}>{right}</span>
    </div>
  );
}

/* ========================== analytics ========================== */

function AnalyticsTab({
  sliceF, cmpSliceF, per, fmt, unit, sumSel,
}: {
  sliceF: number; cmpSliceF: number; per: string;
  fmt: (v: number) => string; unit: string; sumSel: (n: Face) => number;
}) {
  const byId = (nodes: Face[], id: string): Face | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.kids) { const r = byId(n.kids, id); if (r) return r; }
    }
    return null;
  };
  const v = (id: string, f: number) => {
    const n = byId([...FACE_DATA.bs, ...FACE_DATA.is, ...FACE_DATA.cf], id);
    return n ? sumSel(n) * f : 0;
  };

  const rev = v('p111', sliceF), revPy = v('p111', cmpSliceF);
  const cos = Math.abs(v('p112', sliceF));
  const assets = v('a', sliceF);
  const equity = v('e1', sliceF);
  const cash = v('a23', sliceF);
  const ca = v('a2', sliceF), cl = v('e3', sliceF);
  const debt = v('e21', sliceF) + v('e22', sliceF);

  const KPIS = [
    { label: 'Revenue', value: fmt(rev), delta: ((rev - revPy) / Math.abs(revPy || 1)) * 100 },
    { label: 'Gross margin', value: `${(((rev - cos) / (rev || 1)) * 100).toFixed(1)}%`, delta: 1.4 },
    { label: 'Total assets', value: fmt(assets), delta: 3.2 },
    { label: 'Cash & equivalents', value: fmt(cash), delta: -2.1 },
  ];

  const RATIOS = [
    ['Current ratio', (ca / (cl || 1)).toFixed(2), 'Current assets ÷ current liabilities'],
    ['Debt to equity', (debt / (equity || 1)).toFixed(2), 'Borrowings and leases ÷ total equity'],
    ['Return on equity', `${((v('p', sliceF) / (equity || 1)) * 100).toFixed(1)}%`, 'Profit for the period ÷ total equity'],
    ['Asset turnover', (rev / (assets || 1)).toFixed(2), 'Revenue ÷ total assets'],
  ];

  return (
    <>
      <section style={{ ...CARD, marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#65708C', marginBottom: '14px' }}>
          Key indicators · {per} · {unit}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
          {KPIS.map((k) => (
            <div key={k.label} style={{ background: '#E4E8F0', borderRadius: '12px', boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.4),inset -2px -2px 6px rgba(255,255,255,.9)', padding: '13px 15px' }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9AA3BA' }}>{k.label}</div>
              <div style={{ fontSize: '19px', fontWeight: 700, color: '#232C42', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, marginTop: '3px', color: k.delta >= 0 ? '#15803D' : '#B42318' }}>
                {k.delta >= 0 ? '▲' : '▼'} {Math.abs(k.delta).toFixed(1)}% vs comparative
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={CARD}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#65708C', marginBottom: '14px' }}>
          Ratio analysis
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '12px' }}>
          {RATIOS.map(([label, value, basis]) => (
            <div key={label} style={{ padding: '13px 15px', borderRadius: '12px', background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.85)', boxShadow: '3px 3px 10px rgba(166,175,195,.3)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#232C42' }}>{label}</div>
              <div style={{ fontSize: '21px', fontWeight: 700, color: '#3B5BDB', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: '10px', color: '#8A93A8', fontStyle: 'italic', marginTop: '3px' }}>{basis}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
