import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Bar, FileBadge, fmtBytes } from '../../components/TbUpload';
import {
  BRIDGE_LABELS, BU_OPTS, COA_REF, DEFAULT_PERIOD, ENTITIES, GCOA_OPTS, JE_SEED, JE_TYPES, NET_PROFIT, PERIODS,
  Je, JeLine, JeLock, JeStatus, blankLine, byGcoa, byLcoa, covers, fmtAmt, fmtSigned, leCanon, leLabel, leNameOf,
  nextJeId, parkIssues, parseAmt, postIssues, stamp, sysCloseJe, tidyAmt,
} from './model';
import { ParsedEntry, downloadTemplate, parseJeFile } from './bulk';
import { PanelFooter, SidePanel } from '../../components/SidePanel';
import { Clip, GridCol, GridHead, GrowText, useGrid } from '../../components/grid/Grid';

/**
 * Journal Entries — the Financial Data Layer's top-side adjustment register.
 * Ported from docs/design/Fusion Close.dc.html: markup 1241–1430,
 * `buildTopside()` 7926, `buildJeLocks()` 8099, the column menu (`tblMenu`,
 * markup 1532) and `startColResize()` 5714.
 *
 *  - the 15 design columns; period, type, LCOA, GCOA and BU are picked from
 *    lists, the LE code is keyed, the GCOA description and LE name follow
 *  - Draft → Park → Post, with Retire; posting checks the entry balances and
 *    every line is complete; a posted entry can be unposted while its period
 *    is open
 *  - period locks by legal entity / BU / scope, refused while entries in scope
 *    are open, released by a reason-stated reopen request and sign-offs
 *  - bulk upload from the input template (.xlsx / .csv), validated per entry
 */

/* ============================== store ============================== */

/** held by the screen so entries and locks survive switching tabs */
export function useJournal() {
  const [jes, setJes] = useState<Je[]>(JE_SEED);
  const [locks, setLocks] = useState<JeLock[]>([]);
  return { jes, setJes, locks, setLocks };
}
export type JournalStore = ReturnType<typeof useJournal>;

/* ============================== look ============================== */

const C = {
  ink: '#232C42', ink2: '#414B62', mute: '#65708C', faint: '#9AA3BA', line: '#E1E5EF',
  blue: '#3B5BDB', green: '#15803D', amber: '#B45309', red: '#B42318',
};

const BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '7px', height: '34px', padding: '0 14px', borderRadius: '9px',
  fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', border: '1px solid #CBD2E0', background: 'rgba(255,255,255,.6)', color: C.ink2,
};
const PRIMARY: React.CSSProperties = {
  ...BTN, border: 0, color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', boxShadow: '0 3px 10px rgba(37,99,235,.3)',
};
const IN: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', height: '26px', background: '#fff', border: '1px solid #D6DBE8', borderRadius: '6px',
  fontFamily: 'inherit', fontSize: '10.5px', color: '#333D55', padding: '0 6px', outline: 'none',
};
const VIEW: React.CSSProperties = { fontSize: '10.5px', color: C.mute };

const ST_PILL: Record<string, [string, string]> = {
  Draft: ['#3B5BDB', 'rgba(59,91,219,.1)'],
  Parked: ['#B45309', 'rgba(245,158,11,.14)'],
  Posted: ['#15803D', 'rgba(34,197,94,.12)'],
  Retired: ['#54607A', 'rgba(148,163,184,.28)'],
};

const Ico = ({ d, s = 13, w = 2 }: { d: string; s?: number; w?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d={d} /></svg>
);
const I = {
  plus: 'M12 5v14M5 12h14', up: 'M12 16V4M7 9l5-5 5 5M5 20h14', lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  unlock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2', x: 'M6 6l12 12M18 6 6 18', check: 'M20 6L9 17l-5-5',
  full: 'M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5', exit: 'M4 9h5V4M20 9h-5V4M20 15h-5v5M4 15h5v5',
  dl: 'M12 4v12M7 11l5 5 5-5M5 20h14', alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
};

/* ============================== columns ============================== */

type ColKey = 'je' | 'period' | 'jtype' | 'lcoa' | 'gcoa' | 'gdesc' | 'le' | 'leName' | 'bu' | 'debit' | 'credit' | 'net' | 'narr' | 'label' | 'status';

/** design `buildTopside()` cols, line 7928 — the most recent column set */
const COLS: { key: ColKey; label: string; w: number; right?: boolean; num?: boolean }[] = [
  { key: 'je', label: 'JE #', w: 92 },
  { key: 'period', label: 'Period', w: 118 },
  { key: 'jtype', label: 'Type', w: 92 },
  { key: 'lcoa', label: 'LCOA', w: 96, num: true },
  { key: 'gcoa', label: 'GCOA', w: 96, num: true },
  { key: 'gdesc', label: 'GCOA Description', w: 200 },
  { key: 'le', label: 'LE Code', w: 96 },
  { key: 'leName', label: 'LE Name', w: 170 },
  { key: 'bu', label: 'BU', w: 128 },
  { key: 'debit', label: 'Debit', w: 112, right: true, num: true },
  { key: 'credit', label: 'Credit', w: 112, right: true, num: true },
  { key: 'net', label: 'Net Amount', w: 116, right: true, num: true },
  { key: 'narr', label: 'Narration', w: 240 },
  { key: 'label', label: 'Bridge Label', w: 124 },
  { key: 'status', label: 'Status', w: 214 },
];

const netOf = (l: JeLine) => (!l.debit && !l.credit ? null : parseAmt(l.debit) - parseAmt(l.credit));

const valOf = (j: Je, l: JeLine, k: ColKey): string => {
  if (k === 'je') return j.id;
  if (k === 'period') return j.period;
  if (k === 'jtype') return j.jtype;
  if (k === 'status') return j.status;
  if (k === 'net') { const n = netOf(l); return n == null ? '' : fmtSigned(n); }
  return l[k] ?? '';
};

/** the same columns, as the shared grid takes them */
const GRID_COLS: GridCol[] = COLS.map((c) => ({
  key: c.key, label: c.label, w: c.w, align: c.right ? 'right' : 'left', num: c.num,
}));

/** read-only text that may run long — one line with an ellipsis, a click shows it in full */
const CLIP = new Set<ColKey>(['period', 'gdesc', 'le', 'leName', 'bu', 'narr', 'label', 'lcoa', 'gcoa']);

/* ============================== the tab ============================== */

export function JournalEntriesTab({ store }: { store: JournalStore }) {
  const { jes, setJes, locks, setLocks } = store;
  const { users, currentUser } = useApp();
  const [full, setFull] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [lockOpen, setLockOpen] = useState(false);
  const [upOpen, setUpOpen] = useState(false);
  const [toast, setToast] = useState<{ tone: 'ok' | 'bad'; msg: string; list?: string[] } | null>(null);
  const toastT = useRef<number | undefined>(undefined);

  /* column state: filter, sort, rename, width — design `tblGet('ts')` */
  const tableRef = useRef<HTMLTableElement | null>(null);

  const say = (tone: 'ok' | 'bad', msg: string, list?: string[]) => {
    setToast({ tone, msg, list });
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(null), tone === 'bad' ? 7000 : 3600);
  };

  /* every entity locked for a period → the automated closing entry (design 7949) */
  const allLocked = locks.some((k) => k.les.includes('ALL'));
  const data = useMemo(() => {
    if (!allLocked) return jes;
    const per = locks.find((k) => k.les.includes('ALL'))?.period ?? DEFAULT_PERIOD;
    return [sysCloseJe(per), ...jes];
  }, [jes, locks, allLocked]);

  const lineLocked = (j: Je, l: JeLine) => locks.some((k) => covers(k, j, l));
  const jeLocked = (j: Je) => j.lines.some((l) => lineLocked(j, l));
  const editable = (j: Je, l: JeLine) => !j.sys && (j.status === 'Draft' || j.status === 'Parked') && !lineLocked(j, l);

  /* ---- mutations ---- */
  const mutJe = (id: string, fn: (j: Je) => Je) => setJes((all) => all.map((j) => (j.id === id ? fn(j) : j)));
  const mutLine = (lid: string, patch: Partial<JeLine>) =>
    setJes((all) => all.map((j) => ({ ...j, lines: j.lines.map((l) => (l.lid === lid ? { ...l, ...patch } : l)) })));

  const setStatus = (j: Je, st: JeStatus) => {
    if (st === 'Posted') {
      const iss = postIssues(j);
      if (iss.length) { say('bad', `JE ${j.id} can’t be posted yet`, iss); return; }
    }
    if (st === 'Parked' && j.status === 'Draft') {
      const iss = parkIssues(j);
      if (iss.length) { say('bad', `JE ${j.id} can’t be parked yet`, iss); return; }
    }
    mutJe(j.id, (x) => ({ ...x, status: st, open: st === 'Draft' ? x.open : false }));
    const verb = { Posted: 'posted', Parked: j.status === 'Posted' ? 'unposted — parked again' : j.status === 'Retired' ? 'restored as parked' : 'parked', Retired: 'retired — dropped from the close', Draft: '' }[st];
    say('ok', `JE ${j.id} ${verb}.`);
  };

  /** design `tsAddPair()` — a new entry, or another pair on the one still open */
  const addEntry = () => {
    const open = jes.find((j) => j.open && j.status === 'Draft');
    if (open) {
      mutJe(open.id, (j) => ({ ...j, lines: [...j.lines, blankLine(), blankLine()] }));
      say('ok', `Added a debit / credit pair to JE ${open.id}.`);
      return;
    }
    const id = nextJeId(jes);
    setJes((all) => [{ id, period: DEFAULT_PERIOD, status: 'Draft', jtype: '', open: true, source: 'Manual', lines: [blankLine(), blankLine()] }, ...all]);
    g.setFilters({});
    say('ok', `JE ${id} started as a draft — fill it in, then Park or Post.`);
  };

  const dropJe = (id: string) => setJes((all) => all.filter((j) => j.id !== id));
  const delSel = () => {
    setJes((all) => all.map((j) => (editable(j, j.lines[0]) ? { ...j, lines: j.lines.filter((l) => !sel.includes(l.lid)) } : j)).filter((j) => j.lines.length));
    setSel([]);
  };

  const pickLcoa = (lid: string, v: string) => { const r = byLcoa(v); mutLine(lid, { lcoa: v, gcoa: r?.gcoa ?? '', gdesc: r?.gdesc ?? '' }); };
  const pickGcoa = (lid: string, cur: JeLine, v: string) => {
    const rs = byGcoa(v);
    // keep the local account if it already rolls up here; else take the only one that does
    const keep = rs.find((r) => r.lcoa === cur.lcoa) ?? (rs.length === 1 ? rs[0] : undefined);
    mutLine(lid, { gcoa: v, gdesc: rs[0]?.gdesc ?? '', lcoa: keep?.lcoa ?? '' });
  };

  /* ---- rows: the shared grid filters, sorts (keeping an entry's lines together) and lays out columns ---- */
  type Ln = { j: Je; l: JeLine };
  const lines = useMemo<Ln[]>(() => data.flatMap((j) => j.lines.map((l) => ({ j, l }))), [data]);
  const g = useGrid<Ln>('fdl-je', GRID_COLS, lines, (e, k) => valOf(e.j, e.l, k as ColKey), {
    lead: 34, defFreeze: 'je', rowKey: (e) => e.l.lid, groupOf: (e) => e.j.id,
  });
  const flat = g.rows;

  const sumD = flat.reduce((s, e) => s + parseAmt(e.l.debit), 0);
  const sumC = flat.reduce((s, e) => s + parseAmt(e.l.credit), 0);
  const balanced = Math.round(sumD) === Math.round(sumC);
  const visLids = flat.filter((e) => !e.j.sys).map((e) => e.l.lid);
  const allChecked = visLids.length > 0 && visLids.every((x) => sel.includes(x));
  const hasFilters = g.hasFilters;

  /* Enter commits a field and moves to the next — design `tsKeyNav` */
  const onKeyNav = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const t = e.target as HTMLElement;
    if (!tableRef.current || !(t instanceof HTMLInputElement || t instanceof HTMLSelectElement) || (t as HTMLInputElement).type === 'checkbox') return;
    e.preventDefault();
    const els = [...tableRef.current.querySelectorAll<HTMLElement>('input:not([type=checkbox]), select')].filter((x) => !(x as HTMLInputElement).disabled && x.offsetParent !== null);
    const nx = els[els.indexOf(t) + 1];
    if (nx) { nx.focus(); (nx as HTMLInputElement).select?.(); } else t.blur();
  };

  /* ---- cells ---- */
  const seen = new Set<string>();
  const renderCell = (j: Je, l: JeLine, k: ColKey, first: boolean, ed: boolean) => {
    if (k === 'je') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden' }}>
          {first && ed && (
            <button type="button" className="fc-btn" onClick={() => dropJe(j.id)} title="Delete the entire journal entry" aria-label={`Delete JE ${j.id}`} style={{ color: C.red, fontSize: '12px', lineHeight: 1 }}>✕</button>
          )}
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: first ? C.ink : '#B9C0D0' }}>{first ? j.id : '〃'}</span>
          {first && j.source && j.source !== 'Manual' && !j.sys && (
            <span title={`From ${j.source}`} style={{ fontSize: '8.5px', fontWeight: 700, color: '#0F766E', background: 'rgba(15,118,110,.1)', padding: '1px 4px', borderRadius: '4px' }}>{j.source === 'ICE' ? 'ICE' : 'BULK'}</span>
          )}
        </span>
      );
    }
    if (k === 'period') {
      if (!first) return null;
      if (!ed) return <span style={VIEW}>{j.period}</span>;
      return (
        <select value={j.period} onChange={(e) => mutJe(j.id, (x) => ({ ...x, period: e.target.value }))} style={{ ...IN, cursor: 'pointer' }} aria-label={`Period of JE ${j.id}`}>
          {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      );
    }
    if (k === 'jtype') {
      if (!first) return null;
      if (!ed) return <span style={{ ...VIEW, fontWeight: 700, color: j.sys ? C.blue : C.ink2 }}>{j.jtype || '—'}</span>;
      return (
        <select value={j.jtype} onChange={(e) => mutJe(j.id, (x) => ({ ...x, jtype: e.target.value }))} style={{ ...IN, cursor: 'pointer', ...(j.jtype ? null : { color: C.faint }) }} aria-label={`Type of JE ${j.id}`}
          title="Type 1 = adjustments known to management beforehand; Type 2 = items management was unaware of">
          <option value="">Select…</option>
          {JE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      );
    }
    if (k === 'lcoa') {
      if (!ed) return <span style={{ ...VIEW, fontWeight: 600, color: l.lcoa ? C.ink2 : '#B9C0D0', fontVariantNumeric: 'tabular-nums' }}>{l.lcoa || '—'}</span>;
      return (
        <select value={l.lcoa} onChange={(e) => pickLcoa(l.lid, e.target.value)} style={{ ...IN, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }} aria-label="Local account">
          <option value="">—</option>
          {COA_REF.map((r) => <option key={r.lcoa} value={r.lcoa}>{r.lcoa} · {r.gdesc}</option>)}
        </select>
      );
    }
    if (k === 'gcoa') {
      if (!ed) return <span style={{ ...VIEW, fontWeight: 600, color: l.gcoa ? C.ink2 : '#B9C0D0', fontVariantNumeric: 'tabular-nums' }}>{l.gcoa || '—'}</span>;
      return (
        <select value={l.gcoa} onChange={(e) => pickGcoa(l.lid, l, e.target.value)} style={{ ...IN, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }} aria-label="Group account">
          <option value="">—</option>
          {GCOA_OPTS.map((g) => <option key={g.gcoa} value={g.gcoa}>{g.gcoa} · {g.gdesc}</option>)}
        </select>
      );
    }
    if (k === 'gdesc') {
      return <span title="Follows the account picked" style={{ ...VIEW, color: l.gdesc ? '#333D55' : '#B9C0D0' }}>{l.gdesc || (ed ? 'Pick an LCOA or GCOA' : '—')}</span>;
    }
    if (k === 'le') {
      if (!ed) return <span style={{ ...VIEW, fontWeight: 700, color: C.ink2 }}>{l.le || '—'}</span>;
      const bad = !!l.le && !leNameOf(l.le);
      return (
        <input
          value={l.le} list="je-le-codes" placeholder="LE code" aria-label="LE code"
          onChange={(e) => mutLine(l.lid, { le: e.target.value, leName: leNameOf(e.target.value) })}
          onBlur={(e) => { if (leNameOf(e.target.value)) mutLine(l.lid, { le: leCanon(e.target.value) }); }}
          title={bad ? `“${l.le}” is not a legal entity in the master` : 'Type the legal-entity code — the name fills in'}
          style={{ ...IN, textTransform: 'uppercase', fontWeight: 700, ...(bad ? { border: `1px solid ${C.red}`, background: 'rgba(180,35,24,.05)', color: C.red } : null) }}
        />
      );
    }
    if (k === 'leName') {
      const bad = !!l.le && !l.leName;
      return <span style={{ ...VIEW, color: bad ? C.red : l.leName ? C.mute : '#B9C0D0' }}>{bad ? 'Unknown entity' : l.leName || '—'}</span>;
    }
    if (k === 'bu') {
      if (!ed) return <span style={VIEW}>{l.bu || '—'}</span>;
      return (
        <select value={l.bu} onChange={(e) => mutLine(l.lid, { bu: e.target.value })} style={{ ...IN, cursor: 'pointer' }} aria-label="Business unit">
          <option value="">—</option>
          {BU_OPTS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      );
    }
    if (k === 'debit' || k === 'credit') {
      if (!ed) return <span style={{ ...VIEW, color: '#333D55', fontVariantNumeric: 'tabular-nums' }}>{l[k]}</span>;
      return (
        <input
          value={l[k]} placeholder="0" inputMode="decimal" aria-label={k === 'debit' ? 'Debit' : 'Credit'}
          onChange={(e) => mutLine(l.lid, { [k]: e.target.value })}
          onBlur={(e) => mutLine(l.lid, { [k]: tidyAmt(e.target.value) })}
          style={{ ...IN, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
        />
      );
    }
    if (k === 'net') {
      const n = netOf(l);
      return <span style={{ fontSize: '10.5px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: n != null && n < 0 ? C.red : C.ink }}>{n == null ? '' : fmtSigned(n)}</span>;
    }
    if (k === 'narr' || k === 'label') {
      if (!ed) return <span style={{ ...VIEW, ...(k === 'label' && l.label ? { fontWeight: 700, color: C.amber } : null) }}>{l[k] || '—'}</span>;
      // remarks wrap and grow while being written, and fold back to one line after
      if (k === 'narr') return <GrowText value={l.narr} onChange={(v) => mutLine(l.lid, { narr: v })} placeholder="Narration" label="Narration" />;
      return (
        <input value={l.label} list="je-labels" placeholder="Label" aria-label="Bridge label"
          onChange={(e) => mutLine(l.lid, { label: e.target.value })} style={{ ...IN, textOverflow: 'ellipsis' }} />
      );
    }
    // status + actions, on the entry's first line
    const [fg, bg] = ST_PILL[j.status] ?? ST_PILL.Draft;
    const locked = jeLocked(j);
    const act = (label: string, st: JeStatus, tone: string, title: string) => (
      <button type="button" className="fc-h fc-btn" onClick={() => setStatus(j, st)} title={title}
        style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', color: tone, background: '#fff', border: `1px solid ${tone}55` }}>
        {label}
      </button>
    );
    return first ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: fg, background: bg, padding: '2px 8px', borderRadius: '6px' }}>{j.status}</span>
        {locked || j.sys ? (
          <span title={j.sys ? 'Raised by the period lock' : 'Period locked — request a reopen to change it'} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 700, color: C.blue }}>
            <Ico d={I.lock} s={11} /> Locked
          </span>
        ) : (
          <span style={{ display: 'inline-flex', gap: '4px' }}>
            {j.status === 'Draft' && act('Park', 'Parked', C.amber, 'Park — save for review without affecting balances')}
            {(j.status === 'Draft' || j.status === 'Parked') && act('Post', 'Posted', C.green, 'Post — the entry must balance and every line be complete')}
            {j.status === 'Parked' && act('Retire', 'Retired', '#54607A', 'Retire — dropped from the close, kept for the audit trail')}
            {j.status === 'Posted' && act('Unpost', 'Parked', C.amber, 'Unpost — back to parked for correction')}
            {j.status === 'Retired' && act('Restore', 'Parked', C.amber, 'Restore as parked')}
          </span>
        )}
      </span>
    ) : null;
  };

  const FOOT: React.CSSProperties = {
    padding: '6px 8px', whiteSpace: 'nowrap', fontSize: '10.5px', fontWeight: 700, color: C.ink, borderTop: '2px solid #9AA3BA',
    background: '#DBE0EB', position: 'sticky', bottom: 0, zIndex: 3, fontVariantNumeric: 'tabular-nums',
  };

  return (
    <section
      style={{
        background: '#ECEFF6', border: '1px solid rgba(255,255,255,.75)', display: 'flex', flexDirection: 'column',
        ...(full
          ? { position: 'fixed', top: 0, right: 0, bottom: 0, left: '68px', zIndex: 400, borderRadius: 0, padding: '16px 20px' }
          : { flex: 1, minHeight: 0, borderRadius: '18px', boxShadow: '9px 9px 22px rgba(166,175,195,.5),-9px -9px 22px rgba(255,255,255,.95)', padding: '18px 20px' }),
      }}
    >
      {/* ---- toolbar ---- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: C.mute }}>Top-side adjustments</span>
        <span style={{ fontSize: '11px', color: C.faint }}>{data.length} {data.length === 1 ? 'entry' : 'entries'}</span>
        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 10px', borderRadius: '7px', color: balanced ? C.green : C.red, background: balanced ? 'rgba(34,197,94,.12)' : 'rgba(180,35,24,.1)' }}>
          {balanced ? 'Balanced' : `Out of balance ${fmtAmt(Math.abs(sumD - sumC))}`}
        </span>
        <div style={{ flex: 1 }} />
        {hasFilters && (
          <button type="button" className="fc-h fc-btn" onClick={g.clearAll} style={{ ...BTN, height: '30px', color: C.blue }}>Clear filters</button>
        )}
        {sel.length > 0 && (
          <button type="button" className="fc-h fc-btn" onClick={delSel} style={{ ...BTN, height: '30px', color: C.red, border: '1px solid rgba(180,35,24,.4)', background: 'rgba(180,35,24,.07)' }}>
            Delete {sel.length} selected
          </button>
        )}
        {!allLocked && (
          <>
            <button type="button" className="fc-h fc-btn" onClick={addEntry} style={PRIMARY}
              title="Starts a balanced debit / credit draft. Click again while the draft is open to add another pair for a compound entry.">
              <Ico d={I.plus} s={14} w={2.4} /> Add manual entry
            </button>
            <button type="button" className="fc-h fc-btn" onClick={() => setUpOpen(true)} style={BTN} title="Bulk-load entries from the input template (.xlsx / .csv)">
              <Ico d={I.up} s={14} /> Upload JE
            </button>
          </>
        )}
        <button type="button" className="fc-h fc-btn" onClick={() => setLockOpen((v) => !v)} title="Lock or reopen a period by legal entity" aria-expanded={lockOpen}
          style={{ ...BTN, ...(locks.length ? { border: '1px solid rgba(59,130,246,.45)', background: 'rgba(59,130,246,.1)', color: C.blue } : null) }}>
          <Ico d={I.lock} s={13} /> {locks.length ? `Locks · ${locks.length}` : 'Lock period'}
        </button>
        <button type="button" className="fc-h fc-btn" onClick={() => setFull((v) => !v)} title={full ? 'Exit full screen' : 'View table full screen'}
          style={{ ...BTN, width: '34px', padding: 0, justifyContent: 'center', color: full ? C.blue : C.ink2 }}>
          <Ico d={full ? I.exit : I.full} s={15} />
        </button>
      </div>

      {lockOpen && (
        <LockPanel jes={jes} locks={locks} setLocks={setLocks} onClose={() => setLockOpen(false)} users={users} me={currentUser}
          onPost={(j) => setStatus(j, 'Posted')} onRetire={(j) => setStatus(j, 'Retired')} />
      )}

      {allLocked && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px', padding: '10px 14px', borderRadius: '11px', background: 'rgba(59,91,219,.08)', border: '1px solid rgba(59,91,219,.25)', color: '#33427A' }}>
          <Ico d={I.lock} s={15} />
          <span style={{ fontSize: '11.5px', lineHeight: 1.5 }}>
            Period locked. The system posted an automated closing entry (<b>JE SYS-CL</b>) transferring the net result of <b>{fmtAmt(NET_PROFIT)}</b> to retained earnings.
            This adjustment recomputes on each lock; reopen the period to edit entries.
          </span>
        </div>
      )}

      {/* ---- grid ---- */}
      <div style={{ overflow: 'auto', border: '1px solid #DCE0EB', borderRadius: '12px', flex: 1, minHeight: 0, background: '#F3F5FA' }}>
        <table ref={tableRef} onKeyDown={onKeyNav} style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%', font: 'inherit', tableLayout: 'fixed' }}>
          <thead>
            <GridHead
              g={g}
              lead={(
                <input type="checkbox" checked={allChecked} aria-label="Select all lines"
                  onChange={() => setSel((s) => (allChecked ? s.filter((x) => !visLids.includes(x)) : [...new Set([...s, ...visLids])]))}
                  style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: C.blue }} />
              )}
            />
          </thead>
          <tbody>
            {flat.map(({ j, l }) => {
              const first = !seen.has(j.id);
              seen.add(j.id);
              const ed = editable(j, l);
              const on = sel.includes(l.lid);
              // an entry's first line carries the divider, drawn inside the cell so every row keeps the same height
              const top = first ? { boxShadow: 'inset 0 2px 0 #D3D9E6' } : undefined;
              const rowBg = on ? '#EEF3FE' : j.sys ? '#F1F3FB' : j.status === 'Retired' ? '#F4F5F8' : '#fff';
              return (
                <tr key={l.lid} style={{ background: rowBg, ...(j.status === 'Retired' ? { color: '#8A93AB' } : null) }}>
                  <td style={g.leadStyle(rowBg, top)}>
                    {!j.sys && (
                      <input type="checkbox" checked={on} aria-label="Select line"
                        onChange={() => setSel((s) => (s.includes(l.lid) ? s.filter((x) => x !== l.lid) : [...s, l.lid]))}
                        style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: C.blue }} />
                    )}
                  </td>
                  {g.cols.map((c) => {
                    const k = c.key as ColKey;
                    const inner = renderCell(j, l, k, first, ed);
                    // read-only text keeps to one line with an ellipsis; a click shows it in full
                    const clip = CLIP.has(k) && (!ed || k === 'gdesc' || k === 'leName');
                    return (
                      <td key={k} style={g.td(c, rowBg, top)}>
                        {clip ? <Clip g={g} rk={l.lid} ck={k}>{inner}</Clip> : inner}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {flat.length === 0 && (
              <tr><td colSpan={g.cols.length + 1} style={{ padding: '28px', textAlign: 'center', fontSize: '11.5px', color: C.faint, fontStyle: 'italic' }}>No lines match the filters.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...g.leadStyle('#DBE0EB'), ...FOOT }} />
              {g.cols.map((c) => (
                <td key={c.key} style={{ ...g.td(c, '#DBE0EB'), ...FOOT, ...(c.key === 'net' ? { color: balanced ? C.green : C.red } : null) }}>
                  {c.key === 'bu' ? 'Totals' : c.key === 'debit' ? fmtAmt(sumD) : c.key === 'credit' ? fmtAmt(sumC) : c.key === 'net' ? fmtSigned(sumD - sumC) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
        <datalist id="je-le-codes">{ENTITIES.map((e) => <option key={e.code} value={e.code}>{e.name}</option>)}</datalist>
        <datalist id="je-labels">{BRIDGE_LABELS.map((b) => <option key={b} value={b} />)}</datalist>
      </div>
      <div style={{ marginTop: '9px', fontSize: '11px', color: '#7A84A0', fontStyle: 'italic' }}>
        New entries start as drafts; Park saves them for review, Post commits them once they balance. Parked and draft entries are excluded from posted balances.
        Type 1 = adjustments known to management beforehand; Type 2 = items management was unaware of. Pick the LCOA or GCOA from the list — the description follows;
        key the LE code — the name follows. Press Enter to commit a field and jump to the next. Use a column’s ⋮ to sort, filter or freeze panes; drag a header to move it.
      </div>

      {upOpen && (
        <JeUploadModal
          locks={locks} onClose={() => setUpOpen(false)}
          onImport={(entries, file) => {
            const taken = new Set(jes.map((j) => j.id));
            let n = parseInt(nextJeId(jes), 10);
            const fresh = entries.map((e) => {
              const id = taken.has(e.je.id) ? String(n++) : e.je.id;
              taken.add(id);
              return { ...e.je, id, status: 'Parked' as JeStatus, source: file };
            });
            setJes((all) => [...fresh, ...all]);
            g.setFilters({});
            say('ok', `${fresh.length} entr${fresh.length === 1 ? 'y' : 'ies'} imported from ${file} as parked.`);
          }}
        />
      )}

      {toast && (
        <div role="status" style={{ position: 'fixed', right: '26px', bottom: '26px', zIndex: 900, maxWidth: '380px', padding: '12px 16px', borderRadius: '12px', background: '#232C42', color: '#EEF2FA', boxShadow: '0 14px 34px rgba(35,44,66,.4)', animation: 'fcPop .18s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 700 }}>
            <span style={{ color: toast.tone === 'ok' ? '#4ADE80' : '#FBBF24' }}><Ico d={toast.tone === 'ok' ? I.check : I.alert} s={14} w={2.4} /></span>
            {toast.msg}
          </div>
          {toast.list && (
            <ul style={{ margin: '7px 0 0', paddingLeft: '20px', fontSize: '11.5px', lineHeight: 1.55, color: '#C9D1E3' }}>
              {toast.list.slice(0, 6).map((x) => <li key={x}>{x}</li>)}
              {toast.list.length > 6 && <li>…and {toast.list.length - 6} more</li>}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/* ============================== period locks ============================== */

type U = { email: string; name: string; role: string };

function LockPanel({ jes, locks, setLocks, onClose, users, me, onPost, onRetire }: {
  jes: Je[]; locks: JeLock[]; setLocks: React.Dispatch<React.SetStateAction<JeLock[]>>; onClose: () => void;
  users: U[]; me: U; onPost: (j: Je) => void; onRetire: (j: Je) => void;
}) {
  const periods = [...new Set([...jes.map((j) => j.period).filter(Boolean), "June '26", "July '26", "August '26"])];
  const draft0 = { period: periods[0], les: ['ALL'], bu: '', scope: 'je' as 'je' | 'all' };
  const [d, setD] = useState(draft0);
  const [req, setReq] = useState<{ lockId: string; reason: string; emails: string[] } | null>(null);
  const [note, setNote] = useState('A period can only be locked once every entry in scope is posted or retired.');

  const blockers = jes.filter((j) => j.period === d.period && (j.status === 'Draft' || j.status === 'Parked')
    && j.lines.some((l) => (d.les.includes('ALL') || d.les.includes(l.le)) && (!d.bu || l.bu === d.bu)));
  const dup = locks.some((k) => k.period === d.period && k.bu === d.bu && leLabel(k.les) === leLabel(d.les));
  const canLock = d.les.length > 0 && blockers.length === 0 && !dup;
  const defaultApprovers = users.filter((u) => /super|review|partner|controller/i.test(u.role)).map((u) => u.email).slice(0, 3);

  const chip = (on: boolean): React.CSSProperties => ({
    height: '26px', padding: '0 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
    ...(on ? { background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff' } : { background: '#fff', border: '1px solid #D6DBE8', color: '#54607A' }),
  });
  const seg = (on: boolean): React.CSSProperties => ({ height: '26px', padding: '0 12px', borderRadius: '7px', fontSize: '11px', fontWeight: 700, ...(on ? { background: '#F3F5FA', boxShadow: '1px 1px 3px rgba(166,175,195,.5)', color: C.blue } : { color: '#7A84A0' }) });
  const lab: React.CSSProperties = { fontSize: '10px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: C.mute };
  const sel: React.CSSProperties = { height: '30px', borderRadius: '8px', border: '1px solid #CBD2E0', background: '#fff', padding: '0 8px', fontSize: '12px', fontWeight: 600, color: '#333D55', fontFamily: 'inherit' };

  const createLock = () => {
    if (!canLock) return;
    const count = jes.filter((j) => j.period === d.period && j.lines.some((l) => (d.les.includes('ALL') || d.les.includes(l.le)) && (!d.bu || l.bu === d.bu))).length;
    setLocks((a) => [...a, { id: `LK${Date.now()}`, period: d.period, les: [...d.les], bu: d.bu, scope: d.scope, by: me.name, at: stamp(), count, req: null }]);
    setNote(`Locked ${leLabel(d.les)} for ${d.period}. Entries in scope are read-only until a reopen is approved.`);
  };

  const submitReq = () => {
    if (!req || !req.reason.trim() || !req.emails.length) return;
    setLocks((a) => a.map((k) => (k.id === req.lockId ? { ...k, req: { by: me.name, at: stamp(), reason: req.reason.trim(), signs: req.emails.map((email) => ({ email, status: 'Awaiting' as const, at: '' })) } } : k)));
    setNote(`Reopen request sent to ${req.emails.length} approver${req.emails.length === 1 ? '' : 's'}. The period stays locked until every sign-off is in.`);
    setReq(null);
  };

  const sign = (lockId: string, email: string) => {
    const k = locks.find((x) => x.id === lockId);
    if (!k?.req) return;
    const signs = k.req.signs.map((s) => (s.email === email ? { ...s, status: 'Signed' as const, at: stamp() } : s));
    if (signs.every((s) => s.status === 'Signed')) {
      setLocks((a) => a.filter((x) => x.id !== lockId));
      setNote(`Period reopened — ${k.period} · ${leLabel(k.les)}. All sign-offs received at ${stamp()}.`);
    } else {
      setLocks((a) => a.map((x) => (x.id === lockId && x.req ? { ...x, req: { ...x.req, signs } } : x)));
      setNote(`${me.name} signed off at ${stamp()}. Awaiting remaining approvers.`);
    }
  };

  const nameFor = (em: string) => users.find((u) => u.email === em)?.name ?? em;
  const roleFor = (em: string) => users.find((u) => u.email === em)?.role ?? 'External approver';
  const init = (n: string) => n.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ marginBottom: '12px', padding: '14px 16px', borderRadius: '14px', background: '#F1F3F9', border: '1px solid #D3D9E6', boxShadow: '0 6px 18px rgba(45,54,80,.12)', animation: 'fcPop .16s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: C.ink }}>Period locks</span>
        <span style={{ fontSize: '10.5px', color: C.faint }}>Locks apply by legal entity, period, business unit and data scope</span>
        <div style={{ flex: 1 }} />
        <button type="button" className="fc-btn" onClick={() => { setD(draft0); setReq(null); }} style={{ fontSize: '11px', fontWeight: 700, color: C.blue }}>Clear form</button>
        <button type="button" className="fc-h fc-btn" onClick={onClose} title="Close" aria-label="Close period locks" style={{ width: '24px', height: '24px', borderRadius: '7px', display: 'grid', placeItems: 'center', color: '#7A84A0', background: '#E4E8F0' }}><Ico d={I.x} s={12} w={2.4} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(280px,1fr)', gap: '16px' }}>
        {/* active locks */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <span style={lab}>Active locks</span>
            <span style={{ fontSize: '10.5px', color: C.faint }}>{locks.length ? `${locks.length} lock${locks.length === 1 ? '' : 's'}` : ''}</span>
          </div>
          {locks.length === 0 && (
            <div style={{ padding: '14px', borderRadius: '11px', border: '1px dashed #CBD2E0', fontSize: '11.5px', color: C.faint, fontStyle: 'italic' }}>
              No period is locked. Locks apply per legal entity and period, so one entity can close while others stay open.
            </div>
          )}
          {locks.map((k) => {
            const drafting = req?.lockId === k.id;
            const signs = k.req?.signs ?? [];
            const done = signs.filter((s) => s.status === 'Signed').length;
            const mine = signs.some((s) => s.status !== 'Signed' && s.email === me.email);
            return (
              <div key={k.id} style={{ padding: '11px 12px', borderRadius: '11px', background: '#EDF0F7', border: '1px solid #D3D9E6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
                  <span style={{ color: C.blue }}><Ico d={I.lock} s={13} /></span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: C.ink }}>{k.period}</span>
                  <span style={{ fontSize: '11.5px', color: C.ink2 }}>{leLabel(k.les)}</span>
                  <span style={{ fontSize: '9.5px', fontWeight: 700, color: C.blue, background: 'rgba(59,91,219,.1)', padding: '2px 7px', borderRadius: '6px' }}>{k.scope === 'all' ? 'TB + JE' : 'Top-side JE'}</span>
                  <div style={{ flex: 1 }} />
                  {!k.req && !drafting && (
                    <button type="button" className="fc-h fc-btn" onClick={() => setReq({ lockId: k.id, reason: '', emails: defaultApprovers })}
                      style={{ fontSize: '10.5px', fontWeight: 700, color: C.amber, padding: '3px 9px', borderRadius: '7px', border: '1px solid rgba(217,119,6,.4)', background: '#fff' }}>
                      Request reopen
                    </button>
                  )}
                </div>
                <div style={{ marginTop: '5px', fontSize: '10.5px', color: '#7A84A0' }}>
                  Locked by {k.by} · {k.at}{k.bu ? ` · BU ${k.bu}` : ''} · {k.count} entr{k.count === 1 ? 'y' : 'ies'} fixed
                </div>

                {drafting && req && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '7px', padding: '10px', borderRadius: '10px', background: '#fff', border: '1px solid #D6DBE8' }}>
                    <span style={lab}>Reopen request</span>
                    <textarea value={req.reason} onChange={(e) => setReq({ ...req, reason: e.target.value })} placeholder="Reason for reopening — audit trail entry, required"
                      style={{ minHeight: '54px', resize: 'vertical', borderRadius: '8px', border: '1px solid #CBD2E0', padding: '7px 9px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' }} />
                    <span style={lab}>Required sign-offs</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {users.map((u) => {
                        const on = req.emails.includes(u.email);
                        return (
                          <button key={u.email} type="button" className="fc-h fc-btn" style={chip(on)}
                            onClick={() => setReq({ ...req, emails: on ? req.emails.filter((x) => x !== u.email) : [...req.emails, u.email] })}>
                            {u.name.split(' ')[0]} · {u.role}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button" className="fc-h fc-btn" onClick={submitReq} disabled={!req.reason.trim() || !req.emails.length}
                        style={{ height: '30px', padding: '0 13px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, ...(req.reason.trim() && req.emails.length ? { background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff' } : { background: '#DDE1EB', color: '#9AA3BA', cursor: 'not-allowed' }) }}>
                        Send for sign-off
                      </button>
                      <button type="button" className="fc-btn" onClick={() => setReq(null)} style={{ fontSize: '11.5px', fontWeight: 700, color: C.mute }}>Cancel</button>
                      <span style={{ fontSize: '10.5px', color: '#7A84A0', fontStyle: 'italic' }}>
                        {req.emails.length ? `${req.emails.length} approver${req.emails.length === 1 ? '' : 's'} will be notified by email` : 'Select at least one approver'}
                      </span>
                    </div>
                  </div>
                )}

                {k.req && (
                  <div style={{ marginTop: '10px', padding: '10px', borderRadius: '10px', background: 'rgba(245,158,11,.07)', border: '1px solid rgba(217,119,6,.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: C.amber }}>Reopen pending · {done} of {signs.length} sign-offs</span>
                      <div style={{ flex: 1 }} />
                      <button type="button" className="fc-btn" onClick={() => setLocks((a) => a.map((x) => (x.id === k.id ? { ...x, req: null } : x)))} style={{ fontSize: '10.5px', fontWeight: 700, color: C.mute }}>Withdraw</button>
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '11px', color: C.ink2 }}>Requested by {k.req.by} · {k.req.at} — “{k.req.reason}”</div>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {signs.map((s) => (
                        <div key={s.email} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 8px', borderRadius: '9px', background: '#fff', border: '1px solid #E1E5EE' }}>
                          <span style={{ flex: 'none', width: '24px', height: '24px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '9.5px', fontWeight: 700, color: '#E8EEF7', background: 'linear-gradient(145deg,#5B6B94,#3D4A6B)' }}>{init(nameFor(s.email))}</span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: C.ink }}>{nameFor(s.email)}</span>
                            <span style={{ display: 'block', fontSize: '10px', color: '#7A84A0' }}>{s.email} · {roleFor(s.email)}</span>
                          </span>
                          <span style={{ flex: 'none', fontSize: '9.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', ...(s.status === 'Signed' ? { color: C.green, background: 'rgba(34,197,94,.14)' } : { color: C.amber, background: 'rgba(245,158,11,.16)' }) }}>
                            {s.status === 'Signed' ? `Signed ${s.at}` : 'Awaiting'}
                          </span>
                          {s.status !== 'Signed' && s.email === me.email && (
                            <button type="button" className="fc-h fc-btn" onClick={() => sign(k.id, s.email)} style={{ fontSize: '10.5px', fontWeight: 700, color: '#fff', background: C.green, padding: '3px 9px', borderRadius: '7px' }}>Sign off</button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '7px', fontSize: '10.5px', color: '#7A84A0', fontStyle: 'italic' }}>
                      {mine ? 'You are a required approver. The lock releases automatically once every approver has signed.' : 'Switch user from the account menu to sign as another approver. Approvers are maintained in Manage Teams.'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* lock a period */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: '12px', background: '#EDF0F7', border: '1px solid #D3D9E6' }}>
          <span style={lab}>Lock a period</span>
          <label style={{ ...lab, textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>Period</label>
          <select value={d.period} onChange={(e) => setD({ ...d, period: e.target.value })} style={sel}>{periods.map((p) => <option key={p} value={p}>{p}</option>)}</select>
          <label style={{ ...lab, textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>Legal entities</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {[{ code: 'ALL', label: 'All entities' }, ...ENTITIES.map((e) => ({ code: e.code, label: e.code }))].map((x) => (
              <button key={x.code} type="button" className="fc-h fc-btn" style={chip(d.les.includes(x.code))} title={x.code === 'ALL' ? '' : leNameOf(x.code)}
                onClick={() => {
                  if (x.code === 'ALL') { setD({ ...d, les: ['ALL'] }); return; }
                  const cur = d.les.filter((c) => c !== 'ALL');
                  const next = cur.includes(x.code) ? cur.filter((c) => c !== x.code) : [...cur, x.code];
                  setD({ ...d, les: next.length ? next : ['ALL'] });
                }}>
                {x.label}
              </button>
            ))}
          </div>
          <label style={{ ...lab, textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>Business unit</label>
          <select value={d.bu} onChange={(e) => setD({ ...d, bu: e.target.value })} style={sel}>
            <option value="">All business units</option>
            {BU_OPTS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <label style={{ ...lab, textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>Scope</label>
          <div style={{ display: 'inline-flex', gap: '3px', padding: '3px', borderRadius: '9px', background: '#E4E8F0', alignSelf: 'flex-start' }}>
            <button type="button" className="fc-btn" onClick={() => setD({ ...d, scope: 'je' })} style={seg(d.scope === 'je')}>Top-side JE</button>
            <button type="button" className="fc-btn" onClick={() => setD({ ...d, scope: 'all' })} style={seg(d.scope === 'all')}>TB + JE</button>
          </div>

          {blockers.length > 0 && (
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(180,35,24,.05)', border: '1px solid rgba(180,35,24,.25)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.red }}>{blockers.length} {blockers.length === 1 ? 'entry is' : 'entries are'} still open</div>
              <div style={{ marginTop: '3px', fontSize: '10.5px', color: C.mute }}>Post the entry to include it in the locked balances, or retire it to drop it from the close.</div>
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {blockers.map((j) => (
                  <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 7px', borderRadius: '8px', background: '#fff', border: '1px solid #E1E5EE' }}>
                    <span style={{ flex: 'none', fontSize: '10.5px', fontWeight: 700, color: C.ink }}>JE {j.id}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '10.5px', color: C.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.lines[0]?.narr || '—'}</span>
                    <span style={{ flex: 'none', fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', color: C.amber, background: 'rgba(245,158,11,.16)' }}>{j.status}</span>
                    <button type="button" className="fc-h fc-btn" onClick={() => onPost(j)} style={{ fontSize: '10px', fontWeight: 700, color: C.green }}>Post</button>
                    <button type="button" className="fc-h fc-btn" onClick={() => onRetire(j)} style={{ fontSize: '10px', fontWeight: 700, color: '#54607A' }}>Retire</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button type="button" className="fc-h fc-btn" onClick={createLock} disabled={!canLock}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', height: '34px', padding: '0 14px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, ...(canLock ? { background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff', boxShadow: '0 3px 10px rgba(37,99,235,.32)' } : { background: '#DDE1EB', color: '#9AA3BA', cursor: 'not-allowed' }) }}>
            <Ico d={I.lock} s={13} />
            {blockers.length ? `Lock blocked · ${blockers.length} open` : dup ? 'Already locked' : `Lock ${leLabel(d.les)} · ${d.period}`}
          </button>
          <span style={{ fontSize: '10.5px', color: '#7A84A0', fontStyle: 'italic' }}>{note}</span>
        </div>
      </div>
    </div>
  );
}

/* ============================== bulk upload ============================== */

type UpFile = { id: string; name: string; size: number; ext: string; pct: number; state: 'reading' | 'checked' | 'failed' | 'imported'; error?: string; entries: ParsedEntry[]; rows: number };

function JeUploadModal({ locks, onClose, onImport }: {
  locks: JeLock[]; onClose: () => void; onImport: (entries: ParsedEntry[], file: string) => void;
}) {
  const [files, setFiles] = useState<UpFile[]>([]);
  const [over, setOver] = useState(false);
  const [tplBusy, setTplBusy] = useState(false);
  const depth = useRef(0);
  const uid = useRef(0);

  /** an entry landing in a locked period is refused, like a manual one */
  const lockIssue = (je: Je) => (je.lines.some((l) => locks.some((k) => covers(k, je, l))) ? [`${je.period} is locked for this entity — request a reopen first`] : []);

  const add = (list: File[]) => {
    list.forEach((f) => {
      const id = `jf${(uid.current += 1)}`;
      const ext = (f.name.split('.').pop() ?? '').toLowerCase();
      const ok = ext === 'xlsx' || ext === 'csv';
      setFiles((all) => [{ id, name: f.name, size: f.size, ext, pct: 0, state: ok ? 'reading' : 'failed', error: ok ? undefined : `.${ext} is not accepted — use the .xlsx template or a .csv export`, entries: [], rows: 0 }, ...all]);
      if (!ok) return;
      // the transfer bar runs while the file is read and checked
      let pct = 0;
      const t = window.setInterval(() => {
        pct = Math.min(92, pct + 9);
        setFiles((all) => all.map((x) => (x.id === id && x.state === 'reading' ? { ...x, pct } : x)));
      }, 90);
      Promise.all([parseJeFile(f), new Promise((r) => setTimeout(r, 900))]).then(([res]) => {
        window.clearInterval(t);
        const entries = res.entries.map((e) => ({ ...e, issues: [...e.issues, ...lockIssue(e.je)] }));
        setFiles((all) => all.map((x) => (x.id === id ? { ...x, pct: 100, state: res.error ? 'failed' : 'checked', error: res.error, entries, rows: res.rowCount } : x)));
      });
    });
  };

  const pick = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.xlsx,.csv'; inp.multiple = true;
    inp.onchange = () => add(inp.files ? [...inp.files] : []);
    inp.click();
  };

  const tpl = async () => { setTplBusy(true); try { await downloadTemplate(); } finally { setTplBusy(false); } };


  return (
    <SidePanel
      id="upload-je" title="Upload journal entries" onClose={onClose} width={560}
      subtitle="Bulk-load top-side entries from the input template — each entry is checked before it is imported as parked."
    >
          {/* step 1 — template */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: '#F5F7FC', border: '1px solid #DCE0EB' }}>
            <span style={{ flex: 'none', width: '26px', height: '26px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700, color: C.blue, background: 'rgba(59,91,219,.1)' }}>1</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: C.ink }}>Fill in the JE input template</div>
              <div style={{ fontSize: '11px', color: '#7A84A0' }}>JE #, Period, Type, LCOA, GCOA, LE Code, BU, Debit, Credit, Narration, Bridge Label — with a Reference sheet of valid codes.</div>
            </div>
            <button type="button" className="fc-h fc-btn" onClick={tpl} disabled={tplBusy} style={{ ...BTN, height: '32px', color: '#0F766E', border: '1px solid rgba(15,118,110,.4)', background: 'rgba(15,118,110,.07)' }}>
              <Ico d={I.dl} s={13} /> {tplBusy ? 'Preparing…' : 'Download template'}
            </button>
          </div>

          {/* step 2 — drop */}
          <div
            role="button" tabIndex={0} aria-label="Choose filled templates, or drop them here" onClick={pick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}
            onDragEnter={(e) => { e.preventDefault(); depth.current += 1; setOver(true); }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDragLeave={(e) => { e.preventDefault(); depth.current -= 1; if (depth.current <= 0) { depth.current = 0; setOver(false); } }}
            onDrop={(e) => { e.preventDefault(); depth.current = 0; setOver(false); add([...e.dataTransfer.files]); }}
            style={{
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', padding: files.length ? '16px 18px' : '26px 18px', borderRadius: '14px', transition: 'all .16s ease',
              border: `2px dashed ${over ? '#3B82F6' : '#C3CADB'}`, background: over ? 'rgba(59,130,246,.08)' : 'linear-gradient(180deg,#F5F7FC,#EEF1F8)',
              boxShadow: over ? '0 0 0 5px rgba(59,130,246,.12)' : 'none',
            }}>
            <span style={{ flex: 'none', width: '26px', height: '26px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700, color: C.blue, background: 'rgba(59,91,219,.1)' }}>2</span>
            <span style={{ flex: 'none', width: '46px', height: '46px', borderRadius: '50%', display: 'grid', placeItems: 'center', color: over ? '#fff' : '#2563EB', background: over ? 'linear-gradient(150deg,#3B82F6,#2563EB)' : 'rgba(59,130,246,.1)', transition: 'all .16s ease' }}><Ico d={I.up} s={20} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: C.ink }}>{over ? 'Release to check the entries' : <>Drop filled templates here, or <span style={{ color: C.blue, textDecoration: 'underline', textUnderlineOffset: '3px' }}>browse</span></>}</div>
              <div style={{ fontSize: '11px', color: C.faint, marginTop: '3px' }}>.xlsx or .csv · several files at once · nothing is imported until you confirm</div>
            </div>
          </div>

          {files.map((f) => {
            const good = f.entries.filter((e) => !e.issues.length);
            const bad = f.entries.filter((e) => e.issues.length);
            const lines = good.reduce((s, e) => s + e.je.lines.length, 0);
            const amt = good.reduce((s, e) => s + e.je.lines.reduce((t, l) => t + parseAmt(l.debit), 0), 0);
            const tone = f.state === 'failed' ? C.red : f.state === 'imported' ? C.green : bad.length ? C.amber : '#2563EB';
            return (
              <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 14px', borderRadius: '13px', background: '#fff', border: `1px solid ${f.state === 'failed' ? 'rgba(180,35,24,.3)' : '#E1E5EE'}`, boxShadow: '0 1px 4px rgba(40,50,80,.06)', animation: 'fcPop .2s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileBadge ext={f.ext} color={tone} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                    <div style={{ fontSize: '11.5px', color: '#7A84A0', marginTop: '2px' }}>
                      {fmtBytes(f.size)} · <span style={{ fontWeight: 700, color: tone }}>
                        {f.state === 'reading' ? 'Uploading and checking…' : f.state === 'failed' ? 'Could not be read' : f.state === 'imported' ? `Imported ${good.length} entr${good.length === 1 ? 'y' : 'ies'}` : `${f.rows} rows · ${f.entries.length} entr${f.entries.length === 1 ? 'y' : 'ies'} found`}
                      </span>
                    </div>
                  </div>
                  {f.state === 'checked' && good.length > 0 && (
                    <button type="button" className="fc-h fc-btn" style={PRIMARY}
                      onClick={() => { onImport(good, f.name); setFiles((all) => all.map((x) => (x.id === f.id ? { ...x, state: 'imported' } : x))); }}>
                      <Ico d={I.check} s={13} w={2.6} /> Import {good.length} as parked
                    </button>
                  )}
                  <button type="button" className="fc-h fc-btn" onClick={() => setFiles((all) => all.filter((x) => x.id !== f.id))} aria-label={`Remove ${f.name}`}
                    style={{ flex: 'none', width: '28px', height: '28px', borderRadius: '8px', display: 'grid', placeItems: 'center', color: C.faint, background: '#F1F3F9' }}><Ico d={I.x} s={13} w={2.2} /></button>
                </div>
                {f.state === 'reading' && <Bar pct={f.pct} color="#3B82F6" />}
                {f.state === 'failed' && <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', fontWeight: 600, color: C.red }}><Ico d={I.alert} s={13} /> {f.error}</div>}
                {(f.state === 'checked' || f.state === 'imported') && (
                  <>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, color: C.green, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', padding: '2px 9px', borderRadius: '999px' }}>
                        ✓ {good.length} ready · {lines} lines · {fmtAmt(amt)} each side
                      </span>
                      {bad.length > 0 && (
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: C.amber, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(217,119,6,.3)', padding: '2px 9px', borderRadius: '999px' }}>
                          ⚠ {bad.length} held back — fix and re-upload
                        </span>
                      )}
                    </div>
                    {bad.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '9px 11px', borderRadius: '10px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(217,119,6,.22)' }}>
                        {bad.slice(0, 5).map((e) => (
                          <div key={e.je.id} style={{ fontSize: '11px', color: C.ink2 }}>
                            <b style={{ color: C.ink }}>JE {e.je.id}</b> <span style={{ color: C.faint }}>(rows {e.rows.join(', ')})</span> — {e.issues.slice(0, 3).join('; ')}{e.issues.length > 3 ? `; +${e.issues.length - 3} more` : ''}
                          </div>
                        ))}
                        {bad.length > 5 && <div style={{ fontSize: '11px', color: C.faint }}>…and {bad.length - 5} more entries</div>}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        <PanelFooter>
          <span style={{ flex: 1, fontSize: '11px', color: C.faint, fontStyle: 'italic' }}>Imported entries arrive parked — a reviewer posts them from the register. Entries in a locked period are refused.</span>
          <button type="button" className="fc-h fc-btn" onClick={onClose} style={{ ...BTN, height: '34px' }}>Done</button>
        </PanelFooter>
    </SidePanel>
  );
}
