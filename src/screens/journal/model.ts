/**
 * Top-side journal entries — the data behind the Financial Data Layer's
 * "Journal Entries" tab. Ported from docs/design/Fusion Close.dc.html:
 * `tsSeed()` 6000, `tsEntities()` 6025, `tsBuOpts()` / `tsCoaRef()` 6029–6030,
 * the column set in `buildTopside()` 7928 and the lock rules in
 * `buildJeLocks()` 8099.
 */

export type JeStatus = 'Draft' | 'Parked' | 'Posted' | 'Retired';

export type JeLine = {
  lid: string;
  lcoa: string;
  gcoa: string;
  /** GCOA description — always derived from the chart, never typed */
  gdesc: string;
  le: string;
  /** derived from the LE code */
  leName: string;
  bu: string;
  debit: string;
  credit: string;
  narr: string;
  label: string;
};

export type Je = {
  id: string;
  period: string;
  status: JeStatus;
  jtype: string;
  lines: JeLine[];
  /** the entry still taking pairs from "Add manual entry" (design `_open`) */
  open?: boolean;
  /** the automated closing entry raised by a period lock (design `_sys`) */
  sys?: boolean;
  /** where it came from — "Manual", or the uploaded file name */
  source?: string;
};

export type JeLock = {
  id: string;
  period: string;
  /** legal-entity codes, or ['ALL'] */
  les: string[];
  /** '' = every business unit */
  bu: string;
  scope: 'je' | 'all';
  by: string;
  at: string;
  count: number;
  req: null | {
    by: string;
    at: string;
    reason: string;
    signs: { email: string; status: 'Awaiting' | 'Signed'; at: string }[];
  };
};

/* ---------------- reference data ---------------- */

/** design `tsEntities()` — the LE code is keyed, the name follows from it */
export const ENTITIES: { code: string; name: string }[] = [
  { code: 'US01', name: 'US Holdings Inc.' },
  { code: 'DE01', name: 'Germany GmbH' },
  { code: 'FR01', name: 'France SAS' },
  { code: 'UK01', name: 'UK Entity Ltd.' },
  { code: 'IN01', name: 'Bharat Services Pvt Ltd' },
  { code: 'IN-HOLD', name: 'Bharat Holdings Ltd' },
  { code: 'US-OPCO', name: 'US Operating Co. Inc.' },
  { code: 'SG-OPCO', name: 'Singapore Operations Pte Ltd' },
  { code: 'AE-DIST', name: 'Gulf Distribution FZE' },
  { code: 'IN-MFG', name: 'Bharat Manufacturing Pvt Ltd' },
  { code: 'LK-OPCO', name: 'Lanka Operations (Pvt) Ltd' },
];
export const leNameOf = (code: string) => ENTITIES.find((e) => e.code.toLowerCase() === code.trim().toLowerCase())?.name ?? '';
export const leCanon = (code: string) => ENTITIES.find((e) => e.code.toLowerCase() === code.trim().toLowerCase())?.code ?? code.trim().toUpperCase();

export const BU_OPTS = ['Corporate', 'Manufacturing', 'Distribution', 'R&D', 'Services'];

/** design `tsCoaRef()` — local account → group account → group description */
export const COA_REF: { lcoa: string; gcoa: string; gdesc: string }[] = [
  { lcoa: '1010', gcoa: 'G1000', gdesc: 'Cash & cash equivalents' },
  { lcoa: '1210', gcoa: 'G1200', gdesc: 'Trade receivables' },
  { lcoa: '1500', gcoa: 'G1500', gdesc: 'Property, plant & equipment' },
  { lcoa: '1610', gcoa: 'G1600', gdesc: 'Right-of-use assets' },
  { lcoa: '2010', gcoa: 'G2000', gdesc: 'Trade & other payables' },
  { lcoa: '2200', gcoa: 'G2200', gdesc: 'Deferred revenue' },
  { lcoa: '2500', gcoa: 'G2500', gdesc: 'Borrowings' },
  { lcoa: '2620', gcoa: 'G2600', gdesc: 'Lease liabilities' },
  { lcoa: '3000', gcoa: 'G3000', gdesc: 'Share capital & reserves' },
  { lcoa: '3900', gcoa: 'G3900', gdesc: 'Retained earnings' },
  { lcoa: '4010', gcoa: 'G4000', gdesc: 'Revenue' },
  { lcoa: '5010', gcoa: 'G5000', gdesc: 'Cost of sales' },
  { lcoa: '6100', gcoa: 'G6100', gdesc: 'Administrative expenses' },
  { lcoa: '6300', gcoa: 'G6300', gdesc: 'Finance costs' },
];
export const GCOA_OPTS = [...new Map(COA_REF.map((r) => [r.gcoa, r.gdesc])).entries()].map(([gcoa, gdesc]) => ({ gcoa, gdesc }));
export const byLcoa = (lcoa: string) => COA_REF.find((r) => r.lcoa === lcoa.trim());
export const byGcoa = (gcoa: string) => COA_REF.filter((r) => r.gcoa === gcoa.trim().toUpperCase());

export const JE_TYPES = ['Type 1', 'Type 2'];

const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** the design writes periods as "June '26" */
export const PERIODS = MONTH_FULL.map((m) => `${m} '26`);
export const DEFAULT_PERIOD = "June '26";

/** any reasonable spelling of a period → the design's "June '26"; '' if it is not one */
export const normPeriod = (raw: unknown): string => {
  if (raw instanceof Date) return `${MONTH_FULL[raw.getMonth()]} '${String(raw.getFullYear()).slice(2)}`;
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return '';
  const idx = MONTH_FULL.findIndex((m) => s.startsWith(m.slice(0, 3).toLowerCase()));
  const yr = s.match(/(?:20)?(\d\d)\s*$/);
  if (idx >= 0 && yr) return `${MONTH_FULL[idx]} '${yr[1]}`;
  const iso = s.match(/^(20\d\d)[-/.](\d{1,2})/) ?? null;
  if (iso && +iso[2] >= 1 && +iso[2] <= 12) return `${MONTH_FULL[+iso[2] - 1]} '${iso[1].slice(2)}`;
  const rev = s.match(/^(\d{1,2})[-/.](20\d\d)/) ?? null;
  if (rev && +rev[1] >= 1 && +rev[1] <= 12) return `${MONTH_FULL[+rev[1] - 1]} '${rev[2].slice(2)}`;
  return '';
};

/* ---------------- numbers ---------------- */

export const parseAmt = (s: unknown): number => {
  if (typeof s === 'number') return s;
  const t = String(s ?? '').trim();
  if (!t) return 0;
  const neg = t.includes('(') || t.startsWith('-');
  const n = parseFloat(t.replace(/[^0-9.]/g, '')) || 0;
  return neg ? -n : n;
};
export const fmtAmt = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmtSigned = (n: number) => (n < 0 ? `(${fmtAmt(-n)})` : fmtAmt(n));
/** what a debit / credit field shows once it loses focus */
export const tidyAmt = (s: string) => { const v = parseAmt(s); return v ? Math.abs(v).toLocaleString('en-US') : ''; };

/* ---------------- seed (design `tsSeed()` 6000) ---------------- */

const L = (lid: string, lcoa: string, le: string, bu: string, debit: string, credit: string, narr: string, label: string): JeLine => {
  const r = byLcoa(lcoa);
  return { lid, lcoa, gcoa: r?.gcoa ?? '', gdesc: r?.gdesc ?? '', le, leName: leNameOf(le), bu, debit, credit, narr, label };
};

export const JE_SEED: Je[] = [
  { id: 'JE-ICE-0141', period: DEFAULT_PERIOD, status: 'Posted', jtype: 'Type 1', source: 'ICE', lines: [
    L('ice141a', '2010', 'LK-OPCO', 'Distribution', '2,500', '', 'ICE TJE-0001 — residual current-account difference on ICB-0005', 'ICE → Elim'),
    L('ice141b', '6300', 'LK-OPCO', 'Distribution', '', '2,500', 'ICE TJE-0001 — residual current-account difference on ICB-0005', 'ICE → Elim'),
  ] },
  { id: 'JE-ICE-0142', period: DEFAULT_PERIOD, status: 'Parked', jtype: 'Type 1', source: 'ICE', lines: [
    L('ice142a', '5010', 'LK-OPCO', 'Distribution', '18,400', '', 'ICE TJE-0002 — Colombo closing stock aligned to the physical count, URP recomputed', 'ICE → Elim'),
    L('ice142b', '1500', 'LK-OPCO', 'Distribution', '', '18,400', 'ICE TJE-0002 — Colombo closing stock aligned to the physical count, URP recomputed', 'ICE → Elim'),
  ] },
  { id: 'JE-ICE-0143', period: DEFAULT_PERIOD, status: 'Posted', jtype: 'Type 1', source: 'ICE', lines: [
    L('ice143a', '2500', 'IN-MFG', 'Manufacturing', '142,000', '', 'ICE TJE-0003 — deferred tax on building URP restated at the enacted 25.17% rate', 'ICE → Elim'),
    L('ice143b', '6100', 'IN-MFG', 'Manufacturing', '', '142,000', 'ICE TJE-0003 — deferred tax on building URP restated at the enacted 25.17% rate', 'ICE → Elim'),
  ] },
  { id: '458', period: DEFAULT_PERIOD, status: 'Parked', jtype: 'Type 2', source: 'Manual', lines: [
    L('458a', '2200', 'UK01', 'Services', '1,240,000', '', 'Reclass deferred revenue to current portion', 'TB → Adj'),
    L('458b', '4010', 'UK01', 'Services', '', '1,240,000', 'Reclass deferred revenue to current portion', 'TB → Adj'),
  ] },
  { id: '457', period: DEFAULT_PERIOD, status: 'Posted', jtype: 'Type 1', source: 'Manual', lines: [
    L('457a', '6100', 'US01', 'Corporate', '380,500', '', 'IC elimination — management fees', 'Adj → Elim'),
    L('457b', '4010', 'DE01', 'Corporate', '', '380,500', 'IC elimination — management fees', 'Adj → Elim'),
  ] },
  { id: '456', period: DEFAULT_PERIOD, status: 'Posted', jtype: 'Type 1', source: 'Manual', lines: [
    L('456a', '1610', 'DE01', 'Manufacturing', '2,105,300', '', 'GAAP adj — lease capitalization', 'GAAP'),
    L('456b', '2620', 'DE01', 'Manufacturing', '', '2,105,300', 'GAAP adj — lease capitalization', 'GAAP'),
  ] },
];

export const BRIDGE_LABELS = ['TB → Adj', 'Adj → Elim', 'ICE → Elim', 'GAAP', 'Reclass', 'FX'];

export const newLid = () => `M${Math.random().toString(36).slice(2, 8)}`;
export const blankLine = (): JeLine => ({ lid: newLid(), lcoa: '', gcoa: '', gdesc: '', le: '', leName: '', bu: '', debit: '', credit: '', narr: '', label: '' });

/** next manual JE number — design `tsAddPair()` numbers from the highest numeric id */
export const nextJeId = (jes: Je[]) => {
  const ids = jes.map((j) => parseInt(j.id, 10)).filter((n) => !Number.isNaN(n));
  return String((ids.length ? Math.max(...ids) : 450) + 1);
};

/* ---------------- rules ---------------- */

/** what stops an entry being posted; [] means it can post */
export const postIssues = (j: Je): string[] => {
  const out: string[] = [];
  if (!j.period) out.push('Choose a period');
  if (!j.jtype) out.push('Choose the JE type');
  const live = j.lines.filter((l) => l.lcoa || l.gcoa || l.le || l.debit || l.credit);
  if (live.length < 2) out.push('An entry needs at least one debit and one credit line');
  live.forEach((l) => {
    const n = `line ${j.lines.indexOf(l) + 1}`;
    if (!l.lcoa || !l.gcoa) out.push(`Pick the account on ${n}`);
    if (!l.le) out.push(`Enter the LE code on ${n}`);
    else if (!leNameOf(l.le)) out.push(`“${l.le}” on ${n} is not a known legal entity`);
    const d = parseAmt(l.debit);
    const c = parseAmt(l.credit);
    if (!d && !c) out.push(`Enter a debit or a credit on ${n}`);
    if (d && c) out.push(`${n[0].toUpperCase()}${n.slice(1)} has both a debit and a credit`);
  });
  const dr = j.lines.reduce((s, l) => s + parseAmt(l.debit), 0);
  const cr = j.lines.reduce((s, l) => s + parseAmt(l.credit), 0);
  if (Math.round(dr * 100) !== Math.round(cr * 100)) out.push(`Debits ${fmtAmt(dr)} ≠ credits ${fmtAmt(cr)}`);
  return out;
};

/** what stops an entry being parked — it only has to say something */
export const parkIssues = (j: Je): string[] => {
  const out: string[] = [];
  if (!j.period) out.push('Choose a period');
  if (!j.lines.some((l) => l.lcoa || l.debit || l.credit || l.narr)) out.push('The entry is empty');
  return out;
};

/** does a lock cover this line of this entry — design `covers` */
export const covers = (k: JeLock, j: Je, l: JeLine) =>
  k.period === j.period && (k.les.includes('ALL') || k.les.includes(l.le)) && (!k.bu || k.bu === l.bu);

export const leLabel = (les: string[]) => (les.includes('ALL') ? 'All entities' : les.join(' · '));

/**
 * The group result the automated closing entry moves to retained earnings when
 * every entity is locked — design `tsNetProfit()`, which reads the "Profit or
 * loss" line (e132) of the balance-sheet face, in thousands.
 */
export const NET_PROFIT = (4070 + 2680 + 2150 + 1120) * 1000;

export const sysCloseJe = (period: string): Je => {
  const v = fmtAmt(NET_PROFIT);
  const narr = 'Period lock — transfer of net result to reserves';
  return {
    id: 'SYS-CL', period, status: 'Posted', jtype: 'System', sys: true, source: 'System', lines: [
      { lid: '_sysA', lcoa: '3910', gcoa: 'G3910', gdesc: 'Profit or loss for the year', le: 'GRP', leName: 'Group consolidated', bu: 'Corporate', debit: v, credit: '', narr, label: 'Auto → RE' },
      { lid: '_sysB', lcoa: '3900', gcoa: 'G3900', gdesc: 'Retained earnings', le: 'GRP', leName: 'Group consolidated', bu: 'Corporate', debit: '', credit: v, narr, label: 'Auto → RE' },
    ],
  };
};

export const stamp = () => {
  const d = new Date();
  const h = d.getHours();
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getDate()}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/* ---------------- bulk template ---------------- */

/** the columns of the bulk-upload template, in order */
export const TEMPLATE_COLS = ['JE #', 'Period', 'Type', 'LCOA', 'GCOA', 'LE Code', 'BU', 'Debit', 'Credit', 'Narration', 'Bridge Label'] as const;
