import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import type { FcMenuEvent } from '../components/CommentMenu';

/**
 * Notes & Disclosures — ported from docs/design/Fusion Close.dc.html.
 *
 *  - the floating, draggable selection panel   (markup 2280–2340)
 *  - the notes document that renders whatever is ticked, in order (2415+)
 *  - item seed `ndItemSeed()` line 6095 — 13 policies, 18 notes
 *
 * Ticking an item in the panel makes it appear in the document below the
 * statement faces; the panel can be dragged anywhere by its header.
 */

export type NdItem = { id: string; title: string; desc: string };

export const ND_SEED: { sosap: NdItem[]; notes: NdItem[] } = {
  sosap: [
    { id: 'p1', title: 'Basis of preparation', desc: 'Prepared under IFRS on a going-concern basis under the historical cost convention, except where fair value is required.' },
    { id: 'p2', title: 'Basis of consolidation', desc: 'Subsidiaries are consolidated from the date control is obtained until control ceases; intragroup balances are eliminated.' },
    { id: 'p3', title: 'Foreign currency translation', desc: 'Transactions are recorded in functional currency; results and position are translated into the presentation currency at closing and average rates.' },
    { id: 'p4', title: 'Revenue recognition', desc: 'Revenue is recognised when control of goods or services transfers to the customer, applying the five-step model.' },
    { id: 'p5', title: 'Property, plant & equipment', desc: 'Stated at cost less accumulated depreciation and impairment; depreciated on a straight-line basis over useful lives.' },
    { id: 'p6', title: 'Intangible assets & goodwill', desc: 'Finite-life intangibles are amortised; goodwill and indefinite-life assets are tested for impairment annually.' },
    { id: 'p7', title: 'Leases', desc: 'Right-of-use assets and lease liabilities are recognised at commencement for substantially all leases.' },
    { id: 'p8', title: 'Financial instruments', desc: 'Classified and measured at amortised cost, FVOCI or FVTPL; expected credit losses are recognised on financial assets.' },
    { id: 'p9', title: 'Inventories', desc: 'Measured at the lower of cost and net realisable value, cost determined on a weighted-average basis.' },
    { id: 'p10', title: 'Income taxes', desc: 'Comprises current tax and deferred tax recognised on temporary differences using enacted or substantively enacted rates.' },
    { id: 'p11', title: 'Employee benefits', desc: 'Short-term benefits are expensed as incurred; post-employment obligations are measured on an actuarial basis.' },
    { id: 'p12', title: 'Provisions & contingencies', desc: 'Provisions are recognised where a present obligation exists and can be reliably estimated; contingencies are disclosed.' },
    { id: 'p13', title: 'Critical estimates & judgements', desc: 'Discloses key sources of estimation uncertainty and judgements with a significant effect on the amounts recognised.' },
  ],
  notes: [
    { id: 'x1', title: 'Segment information', desc: 'Operating segments are reported consistently with information reviewed by the chief operating decision maker.' },
    { id: 'x2', title: 'Disaggregation of revenue', desc: 'Revenue disaggregated by product line, geography and timing of transfer.' },
    { id: 'x3', title: 'Business combinations', desc: 'Consideration, identifiable assets acquired, liabilities assumed and goodwill arising on acquisitions in the period.' },
    { id: 'x4', title: 'Goodwill & impairment testing', desc: 'Carrying amount by cash-generating unit and the key assumptions used in recoverable-amount testing.' },
    { id: 'x5', title: 'Property, plant & equipment', desc: 'Movement in cost and accumulated depreciation, additions, disposals and capital commitments.' },
    { id: 'x6', title: 'Intangible assets', desc: 'Movement in cost and amortisation by class of intangible asset.' },
    { id: 'x7', title: 'Leases', desc: 'Right-of-use assets by class, lease liability maturities and amounts recognised in profit or loss.' },
    { id: 'x8', title: 'Inventories', desc: 'Carrying amount by category and write-downs recognised in the period.' },
    { id: 'x9', title: 'Trade & other receivables', desc: 'Ageing analysis and the loss allowance under the expected credit loss model.' },
    { id: 'x10', title: 'Cash & cash equivalents', desc: 'Composition of cash and short-term deposits and any restricted balances.' },
    { id: 'x11', title: 'Borrowings & liquidity', desc: 'Terms, maturities and covenants of interest-bearing borrowings and undrawn facilities.' },
    { id: 'x12', title: 'Financial risk management', desc: 'Exposure to credit, liquidity and market risk and the policies for managing each.' },
    { id: 'x13', title: 'Fair value measurement', desc: 'Fair value hierarchy and valuation techniques for assets and liabilities measured at fair value.' },
    { id: 'x14', title: 'Related party transactions', desc: 'Transactions and balances with related parties, including key management personnel compensation.' },
    { id: 'x15', title: 'Commitments & contingencies', desc: 'Capital commitments, guarantees and contingent liabilities not recognised in the statement of financial position.' },
    { id: 'x16', title: 'Share-based payments', desc: 'Terms of equity-settled arrangements and the expense recognised in the period.' },
    { id: 'x17', title: 'Earnings per share', desc: 'Basic and diluted earnings per share and the reconciliation of the weighted-average number of shares.' },
    { id: 'x18', title: 'Events after the reporting period', desc: 'Adjusting and non-adjusting events between the reporting date and the date of authorisation.' },
  ],
};

const POL = '#7C3AED';
const NOTE = '#0F766E';

export type NdTag = 'sosap' | 'notes';

/**
 * A policy is drafted as a list of statements rather than one block of prose,
 * so that each statement carries the nuance that put it in — or took it out.
 */
export type NdStatement = {
  sid: string;
  text: string;
  origin: 'base' | 'added';   // came in with the standard narrative, or written here
  removed: boolean;           // struck out of this version
  tag: string;                // the nuance behind the addition or the removal
  note: string;               // free-text specifics for the file
};

export type NdVersion = {
  v: number;
  savedAt: string;
  label: string;
  title: string;
  statements: NdStatement[];
  added: number;
  removed: number;
};

/** why a statement was written in */
export const ND_ADD_TAGS: { key: string; label: string }[] = [
  { key: 'new-standard', label: 'New standard or amendment adopted' },
  { key: 'new-transaction', label: 'New transaction or arrangement in the period' },
  { key: 'now-material', label: 'Became material this period' },
  { key: 'entity-specific', label: 'Entity-specific tailoring' },
  { key: 'judgement', label: 'Change in judgement or estimate' },
  { key: 'reviewer', label: 'Auditor or regulator comment' },
  { key: 'group-align', label: 'Alignment with group policy' },
];

/** why a statement was struck out */
export const ND_DEL_TAGS: { key: string; label: string }[] = [
  { key: 'not-applicable', label: 'No longer applicable to the group' },
  { key: 'immaterial', label: 'No longer material' },
  { key: 'superseded', label: 'Superseded by a new standard' },
  { key: 'duplicated', label: 'Duplicated elsewhere in the notes' },
  { key: 'boilerplate', label: 'Boilerplate removed' },
  { key: 'relocated', label: 'Relocated to another note' },
];

export const ndTagLabel = (key: string) =>
  [...ND_ADD_TAGS, ...ND_DEL_TAGS].find((t) => t.key === key)?.label ?? key;

/** the standard narratives are prose; break them into statements to draft against */
export const ndSplit = (text: string): string[] =>
  text.split(/(?<=[.;])\s+/).map((s) => s.trim()).filter(Boolean);

export const ndSid = () => `s${Math.random().toString(36).slice(2, 8)}`;

/**
 * What an item reads as in an export: the formatted narrative if it has been
 * edited, else the submitted wording, else the seed — plus any text boxes.
 */
export const ndStripHtml = (h: string, sources?: NdSources) => {
  const d = document.createElement('div');
  d.innerHTML = h;
  if (sources) ndRefreshFigs(d, sources);
  return (d.textContent ?? '').replace(/\s+/g, ' ').trim();
};

/* ---------- figures linked into a narrative (design `ndResolveSeg()` line 6170) ---------- */

/** the seg a narrative figure chip stands for */
const figSeg = (el: HTMLElement): NdSeg | null => {
  const src = el.dataset.figSrc as NdSeg['src'] | undefined;
  const id = el.dataset.figId;
  return src && id != null ? { src, id, label: el.dataset.figLabel ?? '' } : null;
};

/**
 * A figure dropped into a narrative. Only the reference is meaningful — the
 * text is rewritten from the live sources on every render, so the number moves
 * with the period, the slice and the working note, exactly as a linked cell does.
 */
export const ndFigEl = (seg: NdSeg, found: NdSource | null): HTMLSpanElement => {
  const el = document.createElement('span');
  el.className = 'fc-fig';
  el.contentEditable = 'false';
  el.dataset.figSrc = seg.src;
  el.dataset.figId = seg.id;
  el.dataset.figLabel = seg.label;
  el.style.setProperty('--fig', ND_SRC_COLOR[seg.src]);
  el.textContent = found?.value ?? '#REF';
  el.title = found?.tip ?? `${seg.label} — source no longer available`;
  return el;
};

/** re-resolve every linked figure under `root`; a vanished source reads #REF */
export const ndRefreshFigs = (root: ParentNode, sources?: NdSources) => {
  root.querySelectorAll<HTMLElement>('.fc-fig').forEach((el) => {
    const seg = figSeg(el);
    if (!seg) return;
    const found = ndResolve(sources, seg);
    const txt = found?.value ?? '#REF';
    if (el.textContent !== txt) el.textContent = txt;
    const tip = found?.tip ?? `${seg.label} — source no longer available`;
    if (el.title !== tip) el.title = tip;
    el.toggleAttribute('data-fig-broken', !found);
  });
};

export const ndBodyText = (st: NdState, it: NdItem, sources?: NdSources) => {
  const strip = (h: string) => ndStripHtml(h, sources);
  const body = st.noBody[it.id]
    ? ''
    : st.html[it.id] != null ? strip(st.html[it.id]) : (st.bodies[it.id] ?? it.desc);
  const boxes = (st.blocks[it.id] ?? [])
    .map((b) => [b.caption.trim(), strip(b.html)].filter(Boolean).join(' — '))
    .filter(Boolean);
  /* footnote tables flatten to caption + rows; linked cells need the live sources to resolve */
  const tables = (st.tables[it.id] ?? []).map((t) => {
    const head = t.cols.map((c) => c.trim()).filter(Boolean).join(' · ');
    const body2 = t.rows
      .map((r) => r.cells.map((c) => (c.seg ? (ndResolve(sources, c.seg)?.value ?? '#REF') : c.v.trim())).filter(Boolean).join(' · '))
      .filter(Boolean);
    return [t.caption.trim(), head, ...body2].filter(Boolean).join('\n');
  }).filter(Boolean);
  return [body, ...boxes, ...tables].filter(Boolean).join('\n\n');
};

/** the wording that reaches the statements — struck statements drop out */
export const ndCompose = (sts: NdStatement[]) =>
  sts.filter((s) => !s.removed).map((s) => s.text.trim()).filter(Boolean).join(' ');

export type NdState = {
  sel: Record<string, boolean>;
  order: { sosap: string[]; notes: string[] };
  extra: { sosap: NdItem[]; notes: NdItem[] };
  hidden: Record<string, boolean>;
  titles: Record<string, string>;
  bodies: Record<string, string>;
  collapsed: Record<string, boolean>;
  statements: Record<string, NdStatement[]>;
  versions: Record<string, NdVersion[]>;
  /** rich-text html for an item's main narrative, once it has been formatted */
  html: Record<string, string>;
  /** extra text boxes under an item's narrative */
  blocks: Record<string, NdBlock[]>;
  /** the narrative itself has been deleted, leaving only the text boxes */
  noBody: Record<string, boolean>;
  comments: Record<string, NdComment[]>;
  /** footnote tables under an item */
  tables: Record<string, NdTable[]>;
  /** who has each item checked out — design `ndLockSeed()` line 6364 */
  locks: Record<string, NdLock>;
};

export type NdLock = { user: string; at: string };

/** a text box added under an item — design `ndTxtAdd()` line 6341 */
export type NdBlock = { tid: string; caption: string; html: string };

export type NdPrio = 'Low' | 'Medium' | 'High' | 'Critical';

/** priority tones — design `prioTone` line 7094 */
export const ND_PRIOS: { key: NdPrio; fg: string; bg: string }[] = [
  { key: 'Low', fg: '#0F766E', bg: 'rgba(15,118,110,.12)' },
  { key: 'Medium', fg: '#3B5BDB', bg: 'rgba(59,91,219,.1)' },
  { key: 'High', fg: '#B45309', bg: 'rgba(245,158,11,.15)' },
  { key: 'Critical', fg: '#B42318', bg: 'rgba(180,35,24,.1)' },
];
export const ndPrioTone = (p: NdPrio) => ND_PRIOS.find((x) => x.key === p) ?? ND_PRIOS[1];

export type NdComment = {
  cid: string; author: string; time: string; text: string; resolved: boolean;
  /** where in the document it was raised — "Property, plant & equipment · Lease table · row 2" */
  loc?: string;
  /** what was under the cursor when it was raised */
  quote?: string;
  prio?: NdPrio;
  assignee?: string;
};

/* ---------- footnote tables (design `buildNdTbl()` line 6505) ---------- */

/**
 * A cell bound to a figure elsewhere in the application. The value is never
 * stored — it is resolved against the live sources on every render, so a change
 * of period or a push through the data layer moves the number with it.
 */
export type NdSeg = { src: 'fsli' | 'tb' | 'wn'; id: string; label: string };

export type NdCell = { v: string; seg?: NdSeg };
export type NdRow = { rid: string; cells: NdCell[] };
export type NdTable = { tid: string; caption: string; cols: string[]; rows: NdRow[] };

/** one linkable figure, supplied by the screen that owns the data */
export type NdSource = { id: string; label: string; value: string; tip: string };
export type NdSources = { fsli: NdSource[]; tb: NdSource[]; wn: NdSource[] };

export const ND_SRC_LABEL: Record<NdSeg['src'], string> = {
  fsli: 'Statement faces',
  tb: 'Trial balance',
  wn: 'Working note (Excel)',
};

/** linked cells take their colour from where the number comes from */
export const ND_SRC_COLOR: Record<NdSeg['src'], string> = {
  fsli: '#2563EB',
  tb: '#B45309',
  wn: '#0F766E',
};

export const ndResolve = (sources: NdSources | undefined, seg: NdSeg): NdSource | null =>
  sources?.[seg.src]?.find((s) => s.id === seg.id) ?? null;

export const ndRid = (p: string) => `${p}${Math.random().toString(36).slice(2, 8)}`;

export const ndBlankTable = (): NdTable => ({
  tid: ndRid('t'),
  caption: 'Footnote table',
  cols: ['', 'Q3 2026', 'FY 2025'],
  rows: [0, 1, 2].map(() => ({ rid: ndRid('r'), cells: [{ v: '' }, { v: '' }, { v: '' }] })),
});

export const ndInitial = (): NdState => ({
  sel: Object.fromEntries([...ND_SEED.sosap, ...ND_SEED.notes].map((x) => [x.id, ['p1', 'p2', 'p4', 'x2', 'x5', 'x9'].includes(x.id)])),
  order: { sosap: ND_SEED.sosap.map((x) => x.id), notes: ND_SEED.notes.map((x) => x.id) },
  extra: { sosap: [], notes: [] },
  hidden: {},
  titles: {},
  bodies: {},
  collapsed: {},
  statements: {},
  versions: {},
  html: {},
  blocks: {},
  noBody: {},
  comments: {},
  tables: {},
  locks: ndLockSeed(),
});

/* ===================== collaborative check-out ===================== */

/**
 * The signed-in user — design `cmtMe()` line 6932. Named to match the roster in
 * AppContext (`seedUsers`), so locks, comment authorship and the assignee list
 * all speak about the same people.
 */
export const ND_ME = 'Amara Mensah';

/** colleagues already holding items when the period opens — design line 6364 */
export const ndLockSeed = (): Record<string, NdLock> => ({
  p1: { user: 'John D.', at: '08:52' },
  p3: { user: 'John D.', at: '09:06' },
  x4: { user: 'Sarah K.', at: '08:41' },
});

export const ndNowHm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const ndInitials = (name: string) => {
  const p = String(name || '').replace(/[^A-Za-z ]/g, '').trim().split(/\s+/);
  return ((p[0] ?? '').charAt(0) + (p[1] ?? '').charAt(0)).toUpperCase() || 'U';
};

export const ndLockOf = (st: NdState, id: string): NdLock | null => st.locks[id] ?? null;
export const ndLockedByOther = (st: NdState, id: string) => {
  const l = ndLockOf(st, id);
  return !!(l && l.user !== ND_ME);
};
export const ndLockMine = (st: NdState, id: string) => {
  const l = ndLockOf(st, id);
  return !!(l && l.user === ND_ME);
};

/** claim an item before editing it; a no-op when someone else holds it */
export const ndCheckOut = (setSt: React.Dispatch<React.SetStateAction<NdState>>, id: string) =>
  setSt((s) => {
    const l = s.locks[id];
    if (l) return s;                       // already held — by them, or already by me
    return { ...s, locks: { ...s.locks, [id]: { user: ND_ME, at: ndNowHm() } } };
  });

/** release an item — only the holder can */
export const ndCheckIn = (setSt: React.Dispatch<React.SetStateAction<NdState>>, id: string) =>
  setSt((s) => {
    if (s.locks[id]?.user !== ND_ME) return s;
    const next = { ...s.locks };
    delete next[id];
    return { ...s, locks: next };
  });

/** who is in the document right now, for the presence line */
export const ndPresence = (st: NdState) => {
  const by = new Map<string, number>();
  Object.values(st.locks).forEach((l) => by.set(l.user, (by.get(l.user) ?? 0) + 1));
  return [...by.entries()].map(([user, n]) => ({ user, n, me: user === ND_ME }));
};

/** move an item within its section — shared by the panel and the document */
export const ndReorder = (
  setSt: React.Dispatch<React.SetStateAction<NdState>>,
  sec: NdTag, from: string, to: string,
) => {
  if (from === to) return;
  setSt((s) => {
    const list = ndItems(s, sec).map((x) => x.id);
    const f = list.indexOf(from);
    const t = list.indexOf(to);
    if (f < 0 || t < 0) return s;
    list.splice(t, 0, ...list.splice(f, 1));
    return { ...s, order: { ...s.order, [sec]: list } };
  });
};

export type NdDraft = {
  id?: string;                // set when an already-submitted item is reopened
  tag: NdTag;
  title: string;
  statements: NdStatement[];
  versions: NdVersion[];
};

/** one path for both "submit new" and "submit a further version of an existing item" */
export const ndCommit = (
  setSt: React.Dispatch<React.SetStateAction<NdState>>,
  d: NdDraft,
) => {
  const id = d.id ?? `${d.tag === 'sosap' ? 'p' : 'x'}new${Date.now() % 100000}`;
  const body = ndCompose(d.statements);
  setSt((s) => {
    const known = [...ND_SEED[d.tag], ...s.extra[d.tag]].some((x) => x.id === id);
    return {
      ...s,
      extra: known ? s.extra : { ...s.extra, [d.tag]: [...s.extra[d.tag], { id, title: d.title, desc: body }] },
      order: s.order[d.tag].includes(id) ? s.order : { ...s.order, [d.tag]: [...s.order[d.tag], id] },
      sel: { ...s.sel, [id]: true },
      hidden: { ...s.hidden, [id]: false },
      titles: { ...s.titles, [id]: d.title },
      bodies: { ...s.bodies, [id]: body },
      /* a submitted version replaces the in-place narrative, formatting included */
      html: { ...s.html, [id]: body },
      noBody: { ...s.noBody, [id]: false },
      statements: { ...s.statements, [id]: d.statements },
      versions: { ...s.versions, [id]: d.versions },
    };
  });
  return id;
};

export const ndItems = (st: NdState, sec: 'sosap' | 'notes') => {
  const all = [...ND_SEED[sec], ...st.extra[sec]].filter((x) => !st.hidden[x.id]);
  const byId = Object.fromEntries(all.map((x) => [x.id, x]));
  const ordered = st.order[sec].map((id) => byId[id]).filter(Boolean);
  const extras = all.filter((x) => !st.order[sec].includes(x.id));
  return [...ordered, ...extras];
};

/* ===================== policy / note drafting screen ===================== */

const TAGS: { key: NdTag; label: string; where: string; accent: string }[] = [
  { key: 'sosap', label: 'Accounting policy', where: 'Statement of Significant Accounting Policies', accent: POL },
  { key: 'notes', label: 'Note to financial statements', where: 'Notes to the consolidated financial statements', accent: NOTE },
];

const ADD_C = '#0F766E';
const DEL_C = '#B42318';
const BASE_C = '#8B95AD';

export const ndBlankDraft = (tag: NdTag): NdDraft => ({ tag, title: '', statements: [], versions: [] });

/** reopen an item that has already been submitted, for a further version */
export const ndDraftOf = (st: NdState, id: string, tag: NdTag): NdDraft => {
  const seed = [...ND_SEED[tag], ...st.extra[tag]].find((x) => x.id === id);
  const existing = st.statements[id];
  /* prefer what the document now reads as — the narrative may have been edited in place */
  const source = st.html[id] != null ? ndStripHtml(st.html[id]) : (st.bodies[id] ?? seed?.desc ?? '');
  return {
    id,
    tag,
    title: st.titles[id] ?? seed?.title ?? '',
    versions: st.versions[id] ?? [],
    statements: existing?.length
      ? existing
      : ndSplit(source).map((t) => ({ sid: ndSid(), text: t, origin: 'base' as const, removed: false, tag: '', note: '' })),
  };
};

/**
 * Statements are drafted one at a time, and every statement the user writes in
 * or strikes out has to carry the nuance behind that change before the draft
 * can be submitted. Saving a version snapshots the draft with its change count.
 */
export function NdComposer({
  draft, onCancel, onSubmit,
}: {
  draft: NdDraft;
  onCancel: () => void;
  onSubmit: (d: NdDraft) => void;
}) {
  const [tag, setTag] = useState<NdTag>(draft.tag);
  const [title, setTitle] = useState(draft.title);
  const [sts, setSts] = useState<NdStatement[]>(draft.statements);
  const [vers, setVers] = useState<NdVersion[]>(draft.versions);
  const [std, setStd] = useState('');
  const [vLabel, setVLabel] = useState('');
  const [flash, setFlash] = useState('');
  const [confirm, setConfirm] = useState(false);

  const meta = TAGS.find((t) => t.key === tag)!;
  const accent = meta.accent;

  const live = sts.filter((s) => !s.removed && s.text.trim());
  const addedN = sts.filter((s) => s.origin === 'added' && !s.removed && s.text.trim()).length;
  const removedN = sts.filter((s) => s.removed && s.text.trim()).length;

  /** a written-in or struck-out statement is a change, and a change needs its nuance */
  const isChange = (s: NdStatement) => s.text.trim().length > 0 && (s.removed || s.origin === 'added');
  const untagged = sts.filter((s) => isChange(s) && !s.tag).length;
  const nextV = (vers[vers.length - 1]?.v ?? 0) + 1;

  const blocker =
    !title.trim() ? 'Give the policy a title.'
      : live.length === 0 ? 'Write at least one statement.'
      : untagged > 0 ? `Tag ${untagged} changed statement${untagged === 1 ? '' : 's'} with the nuance behind it.`
      : '';
  const ready = !blocker;
  const dirty = title.trim().length > 0 || sts.some((s) => s.text.trim());

  const say = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(''), 3200); };

  const patch = (sid: string, p: Partial<NdStatement>) =>
    setSts((a) => a.map((s) => (s.sid === sid ? { ...s, ...p } : s)));

  const addStatement = () =>
    setSts((a) => [...a, { sid: ndSid(), text: '', origin: 'added', removed: false, tag: '', note: '' }]);

  const strike = (s: NdStatement) => patch(s.sid, { removed: !s.removed, tag: '' });
  const dropRow = (sid: string) => setSts((a) => a.filter((s) => s.sid !== sid));

  const pickStd = (id: string) => {
    setStd(id);
    const it = ND_SEED[tag].find((x) => x.id === id);
    if (!it) return;
    if (!title.trim()) setTitle(it.title);
    setSts(ndSplit(it.desc).map((t) => ({ sid: ndSid(), text: t, origin: 'base' as const, removed: false, tag: '', note: '' })));
    say(`Loaded the standard wording for “${it.title}” as ${ndSplit(it.desc).length} statements — edit, strike out or add to them.`);
  };

  const retag = (next: NdTag) => { setTag(next); setStd(''); };

  const snapshot = (): NdVersion => ({
    v: nextV,
    savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    label: vLabel.trim(),
    title: title.trim(),
    statements: sts.map((s) => ({ ...s })),
    added: addedN,
    removed: removedN,
  });

  const saveVersion = () => {
    const v = snapshot();
    setVers((a) => [...a, v]);
    setVLabel('');
    say(`Version v${v.v} saved — ${v.added} added, ${v.removed} struck out.`);
  };

  const restore = (v: NdVersion) => {
    setTitle(v.title);
    setSts(v.statements.map((s) => ({ ...s, sid: ndSid() })));
    say(`Restored v${v.v} into the working draft. Save a version to keep it.`);
  };

  /** submitting always lands a version, so the submitted wording is in the history */
  const submit = () => {
    if (!ready) return;
    const clean = sts.filter((s) => s.text.trim());
    onSubmit({ id: draft.id, tag, title: title.trim(), statements: clean, versions: [...vers, { ...snapshot(), statements: clean }] });
  };

  const tryClose = () => { if (dirty) setConfirm(true); else onCancel(); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tryClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveVersion(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const FIELD: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: '10px',
    background: '#F6F7FB', border: '1px solid #E4E8F2', boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.3)',
    fontSize: '12.5px', color: '#232C42', outline: 'none', fontFamily: 'inherit',
  };
  const LABEL: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px', fontSize: '10.5px',
    fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#65708C',
  };
  const RAIL: React.CSSProperties = {
    background: 'rgba(255,255,255,.55)', border: '1px solid #DCE0EB', borderRadius: '12px', padding: '13px 14px',
  };
  const CHIP = (c: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', fontWeight: 700,
    letterSpacing: '.3px', textTransform: 'uppercase', color: c, background: `${c}14`,
    border: `1px solid ${c}3d`, padding: '2px 7px', borderRadius: '999px',
  });

  return (
    <div
      onClick={tryClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(35,44,66,.46)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px' }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        style={{
          width: '75vw', height: '75vh', maxWidth: 'calc(100vw - 36px)', maxHeight: 'calc(100vh - 36px)',
          minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: '#ECEFF6', border: '1px solid rgba(255,255,255,.8)', borderRadius: '18px',
          boxShadow: '0 40px 90px rgba(30,40,70,.48)',
        }}
      >
        {/* ---------------- header ---------------- */}
        <header
          style={{
            flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '15px 20px 13px',
            borderBottom: '1px solid #DCE0EB', background: 'linear-gradient(180deg,rgba(255,255,255,.7),rgba(255,255,255,0))',
          }}
        >
          <span
            style={{
              flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px',
              borderRadius: '10px', background: `linear-gradient(145deg,${accent},${accent}bb)`, color: '#fff',
              boxShadow: `0 4px 12px ${accent}4d`,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h6M9 16h4" />
            </svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16.5px', fontWeight: 700, color: '#232C42', letterSpacing: '-.1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title.trim() || (draft.id ? 'Untitled' : `New ${tag === 'sosap' ? 'accounting policy' : 'note'}`)}
            </div>
            <div style={{ fontSize: '11px', color: '#7A84A0', marginTop: '2px' }}>
              {meta.where} · drafting v{nextV}
              {vers.length > 0 && ` · ${vers.length} version${vers.length === 1 ? '' : 's'} saved`}
            </div>
          </div>
          <span style={CHIP(ADD_C)}>+{addedN} added</span>
          <span style={CHIP(DEL_C)}>−{removedN} struck</span>
          <button
            type="button" className="fc-btn" onClick={tryClose} title="Close (Esc)" aria-label="Close"
            style={{ flex: 'none', width: '28px', height: '28px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A84A0', background: '#E4E8F0', boxShadow: 'inset 1px 1px 3px rgba(166,175,195,.5),inset -1px -1px 3px rgba(255,255,255,.9)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        {flash && (
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 20px 0', padding: '8px 11px', borderRadius: '10px', background: `${accent}12`, border: `1px solid ${accent}3d` }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M20 6 9 17l-5-5" /></svg>
            <span style={{ flex: 1, fontSize: '11.5px', fontWeight: 600, color: '#414B62' }}>{flash}</span>
            <button type="button" className="fc-btn" onClick={() => setFlash('')} style={{ flex: 'none', fontSize: '10px', fontWeight: 700, color: accent }}>Dismiss</button>
          </div>
        )}

        {/* ---------------- body ---------------- */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '16px 20px', overflow: 'auto' }}>
          {/* ---- left rail: classification, library, versions ---- */}
          <aside style={{ flex: '1 1 250px', minWidth: '230px', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
            <div style={RAIL}>
              <span style={LABEL}>Tag as</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {TAGS.map((t) => {
                  const on = tag === t.key;
                  return (
                    <button
                      key={t.key} type="button" className="fc-h fc-btn" onClick={() => retag(t.key)} aria-pressed={on}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 11px', borderRadius: '10px',
                        textAlign: 'left', fontSize: '11.5px', fontWeight: 700, lineHeight: 1.3,
                        color: on ? t.accent : '#7A84A0',
                        background: on ? `${t.accent}14` : 'rgba(255,255,255,.75)',
                        border: `1px solid ${on ? `${t.accent}66` : '#D9DEE9'}`,
                      }}
                    >
                      <span
                        style={{
                          flex: 'none', width: '14px', height: '14px', borderRadius: '50%',
                          border: `1px solid ${on ? t.accent : '#CBD2E0'}`, background: on ? t.accent : '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {on && <i style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff' }} />}
                      </span>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={RAIL}>
              <label style={LABEL} htmlFor="nd-std">Standard wording</label>
              <select id="nd-std" value={std} onChange={(e) => pickStd(e.target.value)} style={{ ...FIELD, cursor: 'pointer' }}>
                <option value="">Start from a blank draft —</option>
                {ND_SEED[tag].map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
              </select>
              <div style={{ marginTop: '7px', fontSize: '10.5px', lineHeight: 1.5, color: '#8B95AD' }}>
                Loads the library policy split into statements, so you can strike what does not apply and write in what does.
              </div>
            </div>

            <div style={{ ...RAIL, flex: 1, minHeight: '120px', display: 'flex', flexDirection: 'column' }}>
              <span style={LABEL}>
                Version history
                <span style={{ flex: 1 }} />
                <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600, color: '#9AA3BA' }}>{vers.length}</span>
              </span>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '9px' }}>
                {vers.length === 0 && (
                  <div style={{ fontSize: '10.5px', color: '#9AA3BA', fontStyle: 'italic', lineHeight: 1.5 }}>
                    No versions yet. Save one whenever the wording reaches a state worth keeping — submitting saves one too.
                  </div>
                )}
                {[...vers].reverse().map((v) => (
                  <div
                    key={v.v}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', borderRadius: '9px', background: 'rgba(255,255,255,.8)', border: '1px solid #E4E8F2' }}
                  >
                    <span style={{ flex: 'none', fontSize: '10.5px', fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums' }}>v{v.v}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '10.5px', color: '#65708C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.label || v.savedAt} · <span style={{ color: ADD_C, fontWeight: 700 }}>+{v.added}</span> <span style={{ color: DEL_C, fontWeight: 700 }}>−{v.removed}</span>
                    </span>
                    <button
                      type="button" className="fc-h fc-btn" onClick={() => restore(v)} title={`Load v${v.v} into the working draft`}
                      style={{ flex: 'none', fontSize: '10px', fontWeight: 700, color: '#3B5BDB' }}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
              <input
                value={vLabel} onChange={(e) => setVLabel(e.target.value)}
                placeholder="Version label (optional)"
                style={{ ...FIELD, fontSize: '11px', padding: '7px 9px', marginBottom: '7px' }}
              />
              <button
                type="button" className="fc-h fc-btn" onClick={saveVersion} disabled={!dirty}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '30px',
                  borderRadius: '9px', fontSize: '11.5px', fontWeight: 700,
                  color: dirty ? '#414B62' : '#A6AEC2', background: 'rgba(255,255,255,.75)', border: '1px solid #CBD2E0',
                  cursor: dirty ? 'pointer' : 'not-allowed',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h11l3 3v13H5zM8 4v5h7" /></svg>
                Save version v{nextV}
              </button>
            </div>
          </aside>

          {/* ---- main: title + statements ---- */}
          <section style={{ flex: '3 1 440px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '340px' }}>
            <div style={{ flex: 'none' }}>
              <label style={LABEL} htmlFor="nd-title">
                Policy title
                <span style={{ color: DEL_C, fontSize: '11px' }} aria-hidden>*</span>
              </label>
              <input
                id="nd-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
                placeholder={tag === 'sosap' ? 'e.g. Revenue recognition' : 'e.g. Related party transactions'}
                style={{ ...FIELD, fontSize: '14px', fontWeight: 600, padding: '11px 13px' }}
              />
            </div>

            <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={LABEL}>
                Statements
                <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600, color: '#9AA3BA' }}>
                  — {live.length} in the wording
                </span>
              </span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: '10.5px', color: '#9AA3BA' }}>Strike out what no longer applies; every change needs a nuance tag.</span>
            </div>

            <div
              style={{
                flex: 1, minHeight: '160px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '9px',
                background: '#F6F7FB', border: '1px solid #E4E8F2', borderRadius: '12px',
                boxShadow: 'inset 2px 2px 7px rgba(166,175,195,.32)', padding: '11px',
              }}
            >
              {sts.length === 0 && (
                <div style={{ padding: '22px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#65708C', marginBottom: '4px' }}>No statements yet</div>
                  <div style={{ fontSize: '11px', color: '#9AA3BA', lineHeight: 1.6, maxWidth: '360px', margin: '0 auto' }}>
                    Write the policy one statement at a time, or load the standard wording from the rail and tailor it.
                  </div>
                </div>
              )}

              {sts.map((s, i) => {
                const changed = isChange(s);
                const c = s.removed ? DEL_C : s.origin === 'added' ? ADD_C : BASE_C;
                const opts = s.removed ? ND_DEL_TAGS : ND_ADD_TAGS;
                const needsTag = changed && !s.tag;
                return (
                  <div
                    key={s.sid}
                    style={{
                      display: 'flex', gap: '9px', padding: '9px 10px', borderRadius: '11px',
                      background: s.removed ? 'rgba(180,35,24,.05)' : s.origin === 'added' ? 'rgba(15,118,110,.05)' : 'rgba(255,255,255,.75)',
                      border: `1px solid ${s.removed ? 'rgba(180,35,24,.22)' : s.origin === 'added' ? 'rgba(15,118,110,.22)' : '#E4E8F2'}`,
                    }}
                  >
                    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '22px' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, color: c, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                      <span style={{ flex: 1, width: '2px', borderRadius: '2px', background: `${c}59` }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                        <span style={CHIP(c)}>
                          {s.removed ? 'Struck out' : s.origin === 'added' ? 'Written in' : 'Standard wording'}
                        </span>
                        <div style={{ flex: 1 }} />
                        <button
                          type="button" className="fc-h fc-btn" onClick={() => strike(s)}
                          title={s.removed ? 'Put this statement back in' : 'Strike this statement out of the wording'}
                          style={{ flex: 'none', fontSize: '10.5px', fontWeight: 700, color: s.removed ? ADD_C : DEL_C }}
                        >
                          {s.removed ? 'Restore' : 'Strike out'}
                        </button>
                        <button
                          type="button" className="fc-btn" onClick={() => dropRow(s.sid)} title="Remove this row from the draft"
                          style={{ flex: 'none', width: '20px', height: '20px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9AA3BA', background: '#E9ECF4' }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                        </button>
                      </div>

                      <textarea
                        value={s.text}
                        onChange={(e) => patch(s.sid, { text: e.target.value })}
                        rows={Math.min(6, Math.max(2, Math.ceil((s.text.length || 1) / 78)))}
                        placeholder="Type the statement as it should read in the financial statements."
                        style={{
                          ...FIELD, background: '#fff', boxShadow: 'none', resize: 'vertical', lineHeight: 1.6,
                          fontSize: '12.5px', textDecoration: s.removed ? 'line-through' : 'none',
                          color: s.removed ? '#8F97AB' : '#232C42',
                        }}
                      />

                      {changed && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '7px' }}>
                          <div style={{ flex: '1 1 240px', minWidth: '200px' }}>
                            <select
                              value={s.tag} onChange={(e) => patch(s.sid, { tag: e.target.value })}
                              aria-label={s.removed ? 'Reason for striking this statement out' : 'Reason this statement was written in'}
                              style={{
                                ...FIELD, background: '#fff', boxShadow: 'none', cursor: 'pointer', fontSize: '11.5px', padding: '7px 9px',
                                borderColor: needsTag ? 'rgba(180,35,24,.5)' : '#E4E8F2',
                                color: s.tag ? '#232C42' : '#A0A8BC',
                              }}
                            >
                              <option value="">{s.removed ? 'Why was this struck out? —' : 'Why was this written in? —'}</option>
                              {opts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                            </select>
                          </div>
                          <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                            <input
                              value={s.note} onChange={(e) => patch(s.sid, { note: e.target.value })}
                              placeholder="Specifics for the file (optional)"
                              style={{ ...FIELD, background: '#fff', boxShadow: 'none', fontSize: '11.5px', padding: '7px 9px' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <button
                type="button" className="fc-h fc-btn" onClick={addStatement}
                style={{
                  alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px', height: '30px',
                  padding: '0 13px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 700, color: '#fff',
                  background: `linear-gradient(145deg,${accent},${accent}cc)`, boxShadow: `0 2px 8px ${accent}59`,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Add statement
              </button>
            </div>
          </section>
        </div>

        {/* ---------------- footer ---------------- */}
        {confirm ? (
          <footer style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 20px 15px', borderTop: '1px solid rgba(180,35,24,.3)', background: 'rgba(180,35,24,.06)' }}>
            <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#8A2018' }}>
              Discard this draft? The wording and its {vers.length} saved version{vers.length === 1 ? '' : 's'} will be lost.
            </span>
            <button
              type="button" className="fc-h fc-btn" onClick={() => setConfirm(false)}
              style={{ flex: 'none', height: '34px', padding: '0 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, color: '#414B62', background: 'rgba(255,255,255,.8)', border: '1px solid #CBD2E0' }}
            >
              Keep editing
            </button>
            <button
              type="button" className="fc-h fc-btn" onClick={onCancel}
              style={{ flex: 'none', height: '34px', padding: '0 18px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, color: '#fff', background: 'linear-gradient(145deg,#C4342A,#9E1F17)', boxShadow: '0 3px 12px rgba(180,35,24,.4)' }}
            >
              Discard draft
            </button>
          </footer>
        ) : (
          <footer
            style={{
              flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 20px 15px',
              borderTop: '1px solid #DCE0EB', background: 'linear-gradient(0deg,rgba(255,255,255,.7),rgba(255,255,255,0))',
            }}
          >
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {ready ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ADD_C} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M20 6 9 17l-5-5" /></svg>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#0B5A54' }}>
                    Ready — submits as v{nextV} of {live.length} statement{live.length === 1 ? '' : 's'}, tagged {addedN} written in and {removedN} struck out.
                  </span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C98A2E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#8A6520' }}>{blocker}</span>
                </>
              )}
            </div>
            <span style={{ flex: 'none', fontSize: '10px', color: '#9AA3BA' }}>Ctrl + S saves a version · Ctrl + Enter submits</span>
            <button
              type="button" className="fc-h fc-btn" onClick={tryClose}
              style={{ flex: 'none', height: '34px', padding: '0 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, color: '#414B62', background: 'rgba(255,255,255,.7)', border: '1px solid #CBD2E0' }}
            >
              Cancel
            </button>
            <button
              type="submit" className="fc-h fc-btn" disabled={!ready}
              title={ready ? `Submit v${nextV}` : blocker}
              style={{
                flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '7px', height: '34px', padding: '0 20px',
                borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, color: '#fff',
                background: ready ? `linear-gradient(145deg,${accent},${accent}cc)` : '#C2C9D8',
                boxShadow: ready ? `0 3px 12px ${accent}5e` : 'none',
                cursor: ready ? 'pointer' : 'not-allowed',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
              Submit v{nextV}
            </button>
          </footer>
        )}
      </form>
    </div>
  );
}

/* ===================== floating selection panel ===================== */

export function NotesPanel({
  st, setSt, onClose,
}: { st: NdState; setSt: React.Dispatch<React.SetStateAction<NdState>>; onClose: () => void }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [moved, setMoved] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [secColl, setSecColl] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<NdDraft | null>(null);
  const [done, setDone] = useState('');

  const onDown = (e: React.PointerEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy });
    setMoved(true);
  };
  const onUp = () => { drag.current = null; };

  const toggle = (id: string) => setSt((s) => ({ ...s, sel: { ...s.sel, [id]: !s.sel[id] } }));

  /** drag an item within its section to set placement in the document */
  const reorder = (sec: 'sosap' | 'notes', from: string, to: string) => {
    if (from === to) return;
    setSt((s) => {
      const list = ndItems(s, sec).map((x) => x.id);
      const f = list.indexOf(from);
      const t = list.indexOf(to);
      if (f < 0 || t < 0) return s;
      list.splice(t, 0, ...list.splice(f, 1));
      return { ...s, order: { ...s.order, [sec]: list } };
    });
  };

  /** the drafting screen hands back a tagged, versioned draft */
  const commit = (d: NdDraft) => {
    ndCommit(setSt, d);
    if (d.id) ndCheckIn(setSt, d.id);
    setDrafting(null);
    const v = d.versions[d.versions.length - 1];
    setDone(`“${d.title}” submitted as v${v?.v ?? 1} — ${v?.added ?? 0} written in, ${v?.removed ?? 0} struck out.`);
    window.setTimeout(() => setDone(''), 4000);
  };

  const section = (sec: 'sosap' | 'notes', label: string, accent: string) => {
    const items = ndItems(st, sec);
    const on = items.filter((x) => st.sel[x.id]).length;
    const open = !secColl[sec];
    return (
      <div key={sec}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <button
            type="button" className="fc-btn"
            onClick={() => setSecColl((c) => ({ ...c, [sec]: !c[sec] }))}
            style={{ flex: 'none', width: '20px', height: '20px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, lineHeight: 1, color: '#65708C', background: '#E4E8F0' }}
          >
            {open ? '−' : '+'}
          </button>
          <span style={{ flex: 'none', width: '8px', height: '8px', borderRadius: '2px', background: accent }} />
          <span style={{ flex: 1, fontSize: '10.5px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: sec === 'sosap' ? '#5A4B7C' : '#2F5C58' }}>
            {label}
          </span>
          <span style={{ flex: 'none', fontSize: '9.5px', fontWeight: 700, color: accent, background: `${accent}1a`, border: `1px solid ${accent}47`, padding: '2px 7px', borderRadius: '999px' }}>
            {on}/{items.length}
          </span>
        </div>

        {open && (
          <div style={{ background: '#F6F7FB', border: '1px solid #E4E8F2', borderRadius: '12px', boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.3)', padding: '5px 6px' }}>
            {items.map((it) => (
              <div
                key={it.id}
                draggable
                onDragStart={() => setDragId(it.id)}
                /* the design reorders on dragEnter, so the list rearranges live under the cursor */
                onDragEnter={() => { if (dragId && dragId !== it.id) reorder(sec, dragId, it.id); }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={() => setDragId(null)}
                onDrop={(e) => { e.preventDefault(); setDragId(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 7px', borderRadius: '8px',
                  cursor: 'grab', background: st.sel[it.id] ? `${accent}0f` : 'transparent',
                  opacity: dragId === it.id ? 0.4 : 1,
                  outline: dragId === it.id ? `1px dashed ${accent}` : 'none',
                }}
              >
                {/* six-dot grip — 3 rows × 2 dots, design line 2305 */}
                <span
                  title="Drag to change where this appears in the statements"
                  style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: '2px', padding: '1px 0', cursor: 'grab' }}
                >
                  {[0, 1, 2].map((r) => (
                    <span key={r} style={{ display: 'flex', gap: '2px' }}>
                      <i style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#B4BCCE' }} />
                      <i style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#B4BCCE' }} />
                    </span>
                  ))}
                </span>
                <button
                  type="button" className="fc-btn" onClick={() => toggle(it.id)}
                  title={st.sel[it.id] ? 'Included — click to exclude' : 'Click to include'}
                  style={{
                    flex: 'none', width: '16px', height: '16px', borderRadius: '5px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${st.sel[it.id] ? accent : '#CBD2E0'}`,
                    background: st.sel[it.id] ? accent : '#fff', color: '#fff',
                  }}
                >
                  {st.sel[it.id] && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
                <span style={{ flex: 1, minWidth: 0, fontSize: '11.5px', color: st.sel[it.id] ? '#232C42' : '#7A84A0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {st.titles[it.id] ?? it.title}
                </span>
                {(st.versions[it.id]?.length ?? 0) > 0 && (
                  <span
                    title={`${st.versions[it.id].length} version${st.versions[it.id].length === 1 ? '' : 's'} on file`}
                    style={{ flex: 'none', fontSize: '9px', fontWeight: 700, color: accent, background: `${accent}1a`, border: `1px solid ${accent}3d`, padding: '1px 5px', borderRadius: '999px', fontVariantNumeric: 'tabular-nums' }}
                  >
                    v{st.versions[it.id][st.versions[it.id].length - 1].v}
                  </span>
                )}
                {(() => {
                  const lk = ndLockOf(st, it.id);
                  const byOther = ndLockedByOther(st, it.id);
                  return (
                    <>
                      {lk && (
                        <span
                          title={byOther ? `Checked out by ${lk.user} since ${lk.at} — read-only` : `Checked out to you since ${lk.at}`}
                          style={{
                            flex: 'none', width: '16px', height: '16px', borderRadius: '50%', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: '#fff',
                            background: byOther ? 'linear-gradient(145deg,#F0B23A,#D9881C)' : 'linear-gradient(145deg,#12907F,#0B6F62)',
                          }}
                        >
                          {ndInitials(byOther ? lk.user : 'You')}
                        </span>
                      )}
                      <button
                        type="button" className="fc-btn"
                        onClick={() => { if (byOther) return; ndCheckOut(setSt, it.id); setDrafting(ndDraftOf(st, it.id, sec)); }}
                        title={byOther ? `Checked out by ${lk?.user} — locked` : 'Open the drafting screen — edit statements and add a version'}
                        style={{ flex: 'none', width: '18px', height: '18px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: byOther ? '#C6CDDC' : '#8B95AD', cursor: byOther ? 'not-allowed' : 'pointer' }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
                      </button>
                    </>
                  );
                })()}
              </div>
            ))}
            <button
              type="button" className="fc-h fc-btn" onClick={() => setDrafting(ndBlankDraft(sec))}
              style={{
                marginTop: '5px', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '5px',
                height: '26px', padding: '0 11px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                color: '#fff', background: `linear-gradient(145deg,${accent},${accent}cc)`, boxShadow: `0 2px 8px ${accent}59`,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              {sec === 'sosap' ? 'Add policy' : 'Add note'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      style={{
        position: 'fixed', top: '96px', right: '28px', zIndex: 120, width: '330px',
        transform: `translate(${pos.x}px,${pos.y}px)`,
        background: '#ECEFF6', border: '1px solid rgba(255,255,255,.8)', borderRadius: '16px',
        boxShadow: '0 24px 60px rgba(40,50,80,.3),9px 9px 22px rgba(166,175,195,.4)',
        padding: '14px 15px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
        <div
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '7px', cursor: 'move', touchAction: 'none', userSelect: 'none' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9AA3BA" strokeWidth="2.2" strokeLinecap="round"><path d="M5 9h14M5 15h14" /></svg>
          <span style={{ flex: 1, fontSize: '15.5px', fontWeight: 700, color: '#232C42' }}>Notes and Disclosures</span>
        </div>
        <button
          type="button" className="fc-btn" onClick={onClose} title="Clear pane"
          style={{ flex: 'none', width: '24px', height: '24px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A84A0', background: '#E4E8F0', boxShadow: 'inset 1px 1px 3px rgba(166,175,195,.5),inset -1px -1px 3px rgba(255,255,255,.9)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <span style={{ flex: 1, fontSize: '11px', color: '#7A84A0', fontStyle: 'italic' }}>
          Tick a policy or note to include it; drag to set placement. Drag the header to move this panel.
        </span>
        {moved && (
          <button
            type="button" className="fc-h fc-btn" onClick={() => { setPos({ x: 0, y: 0 }); setMoved(false); }}
            style={{ flex: 'none', fontSize: '10px', fontWeight: 700, color: '#3B5BDB', background: 'rgba(59,91,219,.1)', padding: '3px 8px', borderRadius: '7px' }}
          >
            Reset
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '600px', overflow: 'auto', paddingRight: '3px' }}>
        {section('sosap', 'Accounting Policies (SOSAP)', POL)}
        {section('notes', 'Notes to the Financial Statements', NOTE)}
      </div>

      {done && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '12px', padding: '8px 10px', borderRadius: '10px', background: 'rgba(15,118,110,.09)', border: '1px solid rgba(15,118,110,.3)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M20 6 9 17l-5-5" /></svg>
          <span style={{ flex: 1, fontSize: '10.5px', fontWeight: 600, color: '#0B5A54', lineHeight: 1.45 }}>{done}</span>
        </div>
      )}

      {drafting && (
        <NdComposer
          draft={drafting}
          onCancel={() => { if (drafting.id) ndCheckIn(setSt, drafting.id); setDrafting(null); }}
          onSubmit={commit}
        />
      )}
    </aside>
  );
}

/* ===================== rich text editing ===================== */

/**
 * A contentEditable whose html is written in only when the block it is showing
 * changes — otherwise React reconciliation would fight the caret. Mirrors the
 * design's `ndEditorRef()` / `dataset.fcBlk` handling at line 6622.
 */
export function NdRich({
  blkKey, html, onSave, onActive, style, placeholder,
}: {
  blkKey: string;
  html: string;
  onSave: (html: string) => void;
  onActive: (el: HTMLElement | null) => void;
  style: React.CSSProperties;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.dataset.fcBlk !== blkKey) {
      el.innerHTML = html;
      el.dataset.fcBlk = blkKey;
    }
  }, [blkKey, html]);

  return (
    <div
      ref={ref}
      data-note-edit={blkKey}
      data-fc-linkable=""
      contentEditable
      suppressContentEditableWarning
      title="Click to edit — Shift + L (or right-click) links a live number"
      aria-label={placeholder}
      onFocus={() => onActive(ref.current)}
      onBlur={() => onSave(ref.current?.innerHTML ?? '')}
      style={style}
    />
  );
}

const BULLETS: [string, string, string][] = [
  ['disc', '•', 'Filled dot'], ['circle', '◦', 'Hollow dot'], ['square', '▪', 'Square'], ['fcDash', '–', 'Dash'],
];
const NUMBERS: [string, string, string][] = [
  ['decimal', '1.', 'Decimal'], ['fcParen', '1)', 'Decimal, bracket'], ['multi', '1.1', 'Multi-level'],
  ['lower-alpha', 'a.', 'Lower alpha'], ['upper-alpha', 'A.', 'Upper alpha'],
  ['lower-roman', 'i.', 'Roman'], ['upper-roman', 'I.', 'Roman, upper'],
];
const SWATCHES = ['#232C42', '#B4256F', '#0F766E', '#2563EB', '#B45309'];

/** the per-item formatting toolbar — design markup 2444–2470, `rtCmd()` line 6635 */
export function NdFormatBar({
  accent, getEl, onAfter,
}: { accent: string; getEl: () => HTMLElement | null; onAfter: () => void }) {
  const [menu, setMenu] = useState<'ul' | 'ol' | null>(null);
  const [bullet, setBullet] = useState('disc');
  const [num, setNum] = useState('decimal');

  const cmd = (c: string, v?: string) => {
    const el = getEl();
    el?.focus();
    try { document.execCommand(c, false, v); } catch { /* unsupported command */ }
    onAfter();
  };

  /** execCommand makes the list; the format is then set on the list element itself */
  const applyList = (kind: 'ul' | 'ol', fmt: string) => {
    const el = getEl();
    el?.focus();
    try { document.execCommand(kind === 'ul' ? 'insertUnorderedList' : 'insertOrderedList'); } catch { /* ignore */ }
    const sel = window.getSelection();
    let node: Node | null = sel?.anchorNode ?? null;
    let list: HTMLElement | null = null;
    while (node) {
      if (node.nodeType === 1 && ((node as HTMLElement).tagName === 'UL' || (node as HTMLElement).tagName === 'OL')) {
        list = node as HTMLElement; break;
      }
      if (node === el) break;
      node = node.parentNode;
    }
    if (list) {
      if (fmt === 'multi') { list.setAttribute('data-fc', 'multi'); list.style.listStyleType = ''; }
      else { list.removeAttribute('data-fc'); list.style.listStyleType = fmt; }
    }
    if (kind === 'ul') setBullet(fmt); else setNum(fmt);
    setMenu(null);
    onAfter();
  };

  const TB: React.CSSProperties = {
    width: '26px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '6px', color: '#65708C',
  };
  const CARET: React.CSSProperties = { width: '14px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', color: '#8A93AC', fontSize: '9px' };
  const SEP = <span style={{ width: '1px', height: '16px', background: '#CBD2E0', margin: '0 3px' }} />;
  const down = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn(); };

  const menuBox = (opts: [string, string, string][], cur: string, kind: 'ul' | 'ol', w: string) => (
    <div style={{ position: 'absolute', top: '27px', left: 0, zIndex: 70, background: '#fff', border: '1px solid #DCE0EB', borderRadius: '9px', boxShadow: '0 10px 24px rgba(90,100,130,.24)', padding: '5px', minWidth: w, display: 'flex', flexDirection: 'column', gap: '1px' }}>
      {opts.map(([f, mark, label]) => (
        <button
          key={f} type="button" className="fc-btn" onMouseDown={down(() => applyList(kind, f))}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 7px', borderRadius: '6px', fontSize: '11.5px', color: '#333D55' }}
        >
          <span style={{ flex: 'none', width: '22px', textAlign: kind === 'ol' ? 'right' : 'center', fontSize: kind === 'ol' ? '11.5px' : '13px', fontWeight: 700, color: '#3B5BDB' }}>{mark}</span>
          <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
          <span style={{ flex: 'none', width: '10px', color: '#3B5BDB', fontSize: '10px' }}>{cur === f ? '✓' : ''}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap', marginBottom: '5px', padding: '4px 5px', borderRadius: '8px', background: '#EDF0F7', border: '1px solid #DCE0EB', boxShadow: 'inset 1px 1px 3px rgba(166,175,195,.35)' }}>
      <button type="button" className="fc-btn fc-h" title="Bold" onMouseDown={down(() => cmd('bold'))} style={{ ...TB, fontFamily: 'Georgia,serif', fontWeight: 700, fontSize: '13px', color: '#333D55' }}>B</button>
      <button type="button" className="fc-btn fc-h" title="Italic" onMouseDown={down(() => cmd('italic'))} style={{ ...TB, fontFamily: 'Georgia,serif', fontStyle: 'italic', fontWeight: 600, fontSize: '13px', color: '#333D55' }}>I</button>
      <button type="button" className="fc-btn fc-h" title="Underline" onMouseDown={down(() => cmd('underline'))} style={{ ...TB, fontFamily: 'Georgia,serif', fontWeight: 600, fontSize: '13px', color: '#333D55', textDecoration: 'underline' }}>U</button>
      {SEP}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '1px' }}>
        <button type="button" className="fc-btn fc-h" title="Bulleted list" onMouseDown={down(() => applyList('ul', bullet))} style={TB}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1.4" fill="currentColor" stroke="none" /><circle cx="3.5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="3.5" cy="18" r="1.4" fill="currentColor" stroke="none" /></svg>
        </button>
        <button type="button" className="fc-btn fc-h" title="Bullet format" onMouseDown={down(() => setMenu((m) => (m === 'ul' ? null : 'ul')))} style={CARET}>▾</button>
        {menu === 'ul' && menuBox(BULLETS, bullet, 'ul', '150px')}
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '1px' }}>
        <button type="button" className="fc-btn fc-h" title="Numbered list" onMouseDown={down(() => applyList('ol', num))} style={TB}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6h12M9 12h12M9 18h12M3 5.5 4.4 4.6V9M2.6 15c0-1.6 2.6-1.4 2.6.1 0 .8-2.6 1.6-2.6 3.2h2.8" /></svg>
        </button>
        <button type="button" className="fc-btn fc-h" title="Number format" onMouseDown={down(() => setMenu((m) => (m === 'ol' ? null : 'ol')))} style={CARET}>▾</button>
        {menu === 'ol' && menuBox(NUMBERS, num, 'ol', '172px')}
      </div>
      <button type="button" className="fc-btn fc-h" title="Decrease indent" onMouseDown={down(() => cmd('outdent'))} style={TB}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 6h10M11 12h10M11 18h10M7 9 4 12l3 3" /></svg>
      </button>
      <button type="button" className="fc-btn fc-h" title="Increase indent" onMouseDown={down(() => cmd('indent'))} style={TB}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 6h10M11 12h10M11 18h10M4 9l3 3-3 3" /></svg>
      </button>
      {SEP}
      <button type="button" className="fc-btn fc-h" title="Undo" onMouseDown={down(() => cmd('undo'))} style={TB}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
      </button>
      <button type="button" className="fc-btn fc-h" title="Redo" onMouseDown={down(() => cmd('redo'))} style={TB}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" /></svg>
      </button>
      {SEP}
      <button type="button" className="fc-btn fc-h" title="Cut (Ctrl+X)" onMouseDown={down(() => cmd('cut'))} style={TB}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.5 15.5M14.5 14.5 20 20M8.5 8.5 12 12" /></svg>
      </button>
      <button type="button" className="fc-btn fc-h" title="Copy (Ctrl+C)" onMouseDown={down(() => cmd('copy'))} style={TB}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>
      </button>
      <button type="button" className="fc-btn fc-h" title="Paste (Ctrl+V)" onMouseDown={down(() => cmd('paste'))} style={TB}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4h6v3H9zM8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /></svg>
      </button>
      {SEP}
      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', paddingRight: '3px' }} title="Text colour">
        {SWATCHES.map((col) => (
          <button
            key={col} type="button" className="fc-btn" aria-label={`Text colour ${col}`}
            onMouseDown={down(() => cmd('foreColor', col))}
            style={{ flex: 'none', width: '18px', height: '18px', borderRadius: '5px', background: col, border: '1px solid rgba(0,0,0,.15)' }}
          />
        ))}
      </span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase', color: accent, paddingRight: '3px' }}>
        Formatting
      </span>
    </div>
  );
}

/* ===================== link a number ===================== */

/**
 * The figure picker behind Shift + L and "Link a number…" — design markup
 * 2106–2170 (`ndDlg`). One list per source; typing filters it, arrows move,
 * Enter links. Working-note figures come from the embedded Excel workbook.
 */
export function NdLinkPicker({
  sources, what, onPick, onClose, onOpenWn,
}: {
  sources?: NdSources;
  /** "cell B2 · Leases table" or "the narrative — Revenue recognition" */
  what: string;
  onPick: (seg: NdSeg) => void;
  onClose: () => void;
  onOpenWn?: () => void;
}) {
  const [src, setSrc] = useState<NdSeg['src']>('fsli');
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const all = sources?.[src] ?? [];
  const matches = all.filter((s) => {
    const hay = `${s.label} ${s.value}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }).slice(0, 150);

  useEffect(() => { setHi(0); }, [src, q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [hi]);

  const pick = (s: NdSource) => onPick({ src, id: s.id, label: s.label });

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (matches[hi]) pick(matches[hi]); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const keys = (['fsli', 'tb', 'wn'] as const);
      setSrc(keys[(keys.indexOf(src) + (e.shiftKey ? 2 : 1)) % 3]);
    }
  };

  const color = ND_SRC_COLOR[src];
  return (
    <div
      data-fc-no-cmt=""
      onMouseDown={onClose}
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: 'fixed', inset: 0, zIndex: 1360, background: 'rgba(35,44,66,.32)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh' }}
    >
      <div
        role="dialog" aria-label="Link a number"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
        style={{ width: '600px', maxWidth: '94vw', background: '#ECEFF6', border: '1px solid rgba(255,255,255,.8)', borderRadius: '16px', boxShadow: '0 30px 70px rgba(30,40,70,.4)', padding: '16px 16px 14px', animation: 'fcFade .18s ease' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '4px' }}>
          <span style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '8px', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
          </span>
          <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: '#232C42' }}>Link a number</span>
          <span style={{ flex: 'none', fontSize: '10px', fontWeight: 700, color: '#7A84A0', background: '#E4E8F0', padding: '2px 8px', borderRadius: '6px' }}>{matches.length} found</span>
          <button
            type="button" className="fc-h fc-btn" onClick={onClose} title="Close (Esc)"
            style={{ flex: 'none', width: '24px', height: '24px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A84A0', background: '#E4E8F0' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div style={{ fontSize: '11px', color: '#7A84A0', fontStyle: 'italic', marginBottom: '11px' }}>
          Into {what}. The number stays linked and updates when its source changes.
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {(['fsli', 'tb', 'wn'] as const).map((k) => {
            const on = k === src;
            const c = ND_SRC_COLOR[k];
            return (
              <button
                key={k} type="button" className="fc-h fc-btn" aria-pressed={on} onClick={() => setSrc(k)}
                style={{ height: '30px', padding: '0 12px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 700, ...(on ? { color: '#fff', background: c } : { color: c, background: `${c}14`, border: `1px solid ${c}33` }) }}
              >
                {ND_SRC_LABEL[k]} <span style={{ opacity: 0.75, fontWeight: 600 }}>· {sources?.[k]?.length ?? 0}</span>
              </button>
            );
          })}
          {src === 'wn' && onOpenWn && (
            <button
              type="button" className="fc-h fc-btn" onClick={onOpenWn}
              title="Open the embedded Excel workbook to build or change a working note"
              style={{ marginLeft: 'auto', height: '30px', padding: '0 11px', borderRadius: '9px', fontSize: '11px', fontWeight: 700, color: '#414B62', background: 'rgba(255,255,255,.6)', border: '1px solid #CBD2E0' }}
            >
              Open working note (Excel)
            </button>
          )}
        </div>

        <input
          value={q} autoFocus onChange={(e) => setQ(e.target.value)}
          placeholder={src === 'wn' ? 'Search working-note cells — WN-014, lease, C5…' : src === 'tb' ? 'Search accounts — 1200, receivables, entity…' : 'Search line items — revenue, goodwill, total assets…'}
          style={{ width: '100%', boxSizing: 'border-box', height: '40px', background: '#E4E8F0', border: '1px solid #CBD2E0', boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.4),inset -2px -2px 5px rgba(255,255,255,.9)', borderRadius: '10px', fontFamily: 'inherit', fontSize: '13px', color: '#333D55', padding: '0 13px', marginBottom: '10px', outline: 'none' }}
        />

        <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflow: 'auto' }}>
          {matches.length === 0 && (
            <div style={{ padding: '14px 11px', fontSize: '12px', color: '#9AA3BA', fontStyle: 'italic' }}>
              {all.length === 0 && src === 'wn'
                ? 'No numeric cells in the working note yet — open it, enter the figures, then link a cell.'
                : 'Nothing matches that search.'}
            </div>
          )}
          {matches.map((s, i) => (
            <button
              key={s.id} data-i={i} type="button" className="fc-btn"
              onClick={() => pick(s)} onMouseEnter={() => setHi(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 11px', borderRadius: '10px', textAlign: 'left',
                background: i === hi ? '#fff' : '#F6F7FB', border: `1px solid ${i === hi ? color : '#E4E8F2'}`,
                boxShadow: i === hi ? `0 2px 8px ${color}24` : 'none',
              }}
            >
              <span style={{ flex: 1, minWidth: 0, fontFamily: 'Cambria,Georgia,serif', fontSize: '13px', fontWeight: 600, color: '#232C42', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
              <span style={{ flex: 'none', fontSize: '13px', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: '10px', fontSize: '10.5px', color: '#9AA3BA' }}>
          ↑ ↓ to move · Enter to link · Tab to switch source · Esc to close
        </div>
      </div>
    </div>
  );
}

/* ===================== the notes document ===================== */

const nowStamp = () => `Today ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

export function NotesDocument({
  st, setSt, tenant, period, sources, onOpenWn,
}: {
  st: NdState;
  setSt: React.Dispatch<React.SetStateAction<NdState>>;
  tenant: string;
  period: string;
  /** the figures a footnote-table cell or a narrative can be bound to */
  sources?: NdSources;
  /** opens the embedded Excel working note, from the link picker */
  onOpenWn?: () => void;
}) {
  const [drafting, setDrafting] = useState<NdDraft | null>(null);
  const [full, setFull] = useState<string | null>(null);        // item open full screen
  const [bars, setBars] = useState<Record<string, boolean>>({}); // formatting toolbar per item
  const [active, setActive] = useState<string | null>(null);     // item holding the caret
  const [cmtOn, setCmtOn] = useState<string | null>(null);       // comment popover
  /** the quick-comment composer, anchored at the cursor — design `cmtQuick()` line 7022 */
  const [quick, setQuick] = useState<
    { id: string; loc: string; quote: string; x: number; y: number; text: string; prio: NdPrio; assignee: string } | null
  >(null);
  /** the selected footnote-table cell, which the link bar acts on */
  const [tblSel, setTblSel] = useState<{ id: string; tid: string; ri: number; ci: number } | null>(null);
  /** everyone with access to the tool, for the assignee list */
  const { users: team } = useApp();
  const [dragId, setDragId] = useState<string | null>(null);
  const [lockToast, setLockToast] = useState<{ id: string; msg: string } | null>(null);
  const activeEl = useRef<HTMLElement | null>(null);
  const toastT = useRef<number | undefined>(undefined);
  const docRef = useRef<HTMLDivElement | null>(null);
  /** where a number picked in the link picker will land — a table cell, or a caret in a narrative */
  const [linkTo, setLinkTo] = useState<
    | { kind: 'cell'; id: string; tid: string; ri: number; ci: number; what: string }
    | { kind: 'text'; id: string; el: HTMLElement; range: Range | null; what: string }
    | null
  >(null);

  /** tell the user who holds the item — design `ndLockBlock()` line 6382 */
  const lockBlock = (id: string) => {
    const l = ndLockOf(st, id);
    setLockToast({
      id,
      msg: `Checked out by ${l?.user ?? 'another user'} since ${l?.at ?? ''}. Editing is locked until they check it back in.`,
    });
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setLockToast(null), 3600);
  };

  /** run an edit only if the item is free, claiming it first — design `lockGate` line 6415 */
  const gate = (id: string, fn: () => void) => () => {
    if (ndLockedByOther(st, id)) { lockBlock(id); return; }
    ndCheckOut(setSt, id);
    fn();
  };

  /* Esc leaves full screen — design `onToggleFull` / fullTitle line 6805 */
  useEffect(() => {
    if (!full) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [full]);

  const secTitle = (k: string, d: string) => st.titles[k] ?? d;
  const setTitle = (id: string, txt: string) =>
    setSt((s) => ({ ...s, titles: { ...s.titles, [id]: txt.replace(/\s+/g, ' ').trim() } }));
  const hide = (id: string) => setSt((s) => ({ ...s, hidden: { ...s.hidden, [id]: true } }));

  const setHtml = (id: string, html: string) =>
    setSt((s) => ({ ...s, html: { ...s.html, [id]: html } }));

  /* ---- text boxes (design ndTxtAdd / ndTblDel) ---- */
  const addBox = (id: string) =>
    setSt((s) => ({
      ...s,
      blocks: { ...s.blocks, [id]: [...(s.blocks[id] ?? []), { tid: `x${Math.random().toString(36).slice(2, 8)}`, caption: '', html: '' }] },
    }));
  const patchBox = (id: string, tid: string, p: Partial<NdBlock>) =>
    setSt((s) => ({ ...s, blocks: { ...s.blocks, [id]: (s.blocks[id] ?? []).map((b) => (b.tid === tid ? { ...b, ...p } : b)) } }));
  const dropBox = (id: string, tid: string) =>
    setSt((s) => ({ ...s, blocks: { ...s.blocks, [id]: (s.blocks[id] ?? []).filter((b) => b.tid !== tid) } }));

  /* ---- footnote tables (design ndTblAdd / ndTblAddRow / ndTblLink) ---- */
  const tblMap = (id: string, tid: string, fn: (t: NdTable) => NdTable) =>
    setSt((s) => ({ ...s, tables: { ...s.tables, [id]: (s.tables[id] ?? []).map((t) => (t.tid === tid ? fn(t) : t)) } }));

  const addTable = (id: string) =>
    setSt((s) => ({ ...s, tables: { ...s.tables, [id]: [...(s.tables[id] ?? []), ndBlankTable()] } }));
  const dropTable = (id: string, tid: string) => {
    setSt((s) => ({ ...s, tables: { ...s.tables, [id]: (s.tables[id] ?? []).filter((t) => t.tid !== tid) } }));
    setTblSel((sel) => (sel?.tid === tid ? null : sel));
  };
  const addRow = (id: string, tid: string) =>
    tblMap(id, tid, (t) => ({ ...t, rows: [...t.rows, { rid: ndRid('r'), cells: t.cols.map(() => ({ v: '' })) }] }));
  const delRow = (id: string, tid: string, ri: number) => {
    tblMap(id, tid, (t) => (t.rows.length <= 1 ? t : { ...t, rows: t.rows.filter((_, i) => i !== ri) }));
    setTblSel(null);
  };
  const addCol = (id: string, tid: string) =>
    tblMap(id, tid, (t) => ({ ...t, cols: [...t.cols, ''], rows: t.rows.map((r) => ({ ...r, cells: [...r.cells, { v: '' }] })) }));
  const delCol = (id: string, tid: string, ci: number) => {
    tblMap(id, tid, (t) => (t.cols.length <= 1 ? t : {
      ...t, cols: t.cols.filter((_, i) => i !== ci),
      rows: t.rows.map((r) => ({ ...r, cells: r.cells.filter((_, j) => j !== ci) })),
    }));
    setTblSel(null);
  };
  const setCell = (id: string, tid: string, ri: number, ci: number, patch: NdCell) =>
    tblMap(id, tid, (t) => ({ ...t, rows: t.rows.map((r, i) => (i !== ri ? r : { ...r, cells: r.cells.map((c, j) => (j !== ci ? c : patch)) })) }));

  /** bind the selected cell to a figure — it then reads live */
  const linkCell = (v: string) => {
    if (!tblSel || !v) return;
    const [src, ...rest] = v.split(':');
    const id = rest.join(':');
    const found = ndResolve(sources, { src: src as NdSeg['src'], id, label: '' });
    if (!found) return;
    setCell(tblSel.id, tblSel.tid, tblSel.ri, tblSel.ci, { v: '', seg: { src: src as NdSeg['src'], id, label: found.label } });
  };
  const unlinkCell = () => {
    if (!tblSel) return;
    const t = (st.tables[tblSel.id] ?? []).find((x) => x.tid === tblSel.tid);
    const cur = t?.rows[tblSel.ri]?.cells[tblSel.ci];
    const keep = cur?.seg ? (ndResolve(sources, cur.seg)?.value ?? '') : (cur?.v ?? '');
    setCell(tblSel.id, tblSel.tid, tblSel.ri, tblSel.ci, { v: keep });
  };

  /* ---- the narrative can be deleted and restored (design ndBodyDelete/Restore) ---- */
  const dropBody = (id: string) => setSt((s) => ({ ...s, noBody: { ...s.noBody, [id]: true } }));
  const restoreBody = (id: string) => setSt((s) => ({ ...s, noBody: { ...s.noBody, [id]: false } }));

  /* ---- comments: every one is raised through the composer ---- */
  /** open the composer against a spot in the document, carrying its reference */
  const openQuick = (id: string, loc: string, quote: string, x: number, y: number) =>
    setQuick({
      id, loc,
      quote: quote.replace(/\s+/g, ' ').trim().slice(0, 220),
      x: Math.min(x || 240, window.innerWidth - 400),
      y: Math.min(y || 200, Math.max(60, window.innerHeight - 430)),
      text: '', prio: 'High',
      assignee: team.find((u) => u.name !== ND_ME)?.name ?? ND_ME,
    });

  const addQuick = () => {
    const text = quick?.text.trim();
    if (!quick || !text) return;
    setSt((s) => ({
      ...s,
      comments: {
        ...s.comments,
        [quick.id]: [
          ...(s.comments[quick.id] ?? []),
          { cid: `c${Date.now() % 100000}`, author: ND_ME, time: nowStamp(), text, resolved: false, loc: quick.loc, quote: quick.quote, prio: quick.prio, assignee: quick.assignee },
        ],
      },
    }));
    setQuick(null);
  };

  /* ---- link a number: Shift + L, or "Link a number…" on the right-click menu ---- */

  /**
   * Work out what `el` is — a footnote-table cell or a narrative editor — and
   * open the picker against it. `range` is where in a narrative the number lands.
   */
  const openLinkAt = (el: Element | null, range: Range | null) => {
    if (!el || !docRef.current?.contains(el)) return;
    const id = el.closest<HTMLElement>('[data-nd-item]')?.dataset.ndItem;
    if (!id) return;
    if (ndLockedByOther(st, id)) { lockBlock(id); return; }
    const title = st.titles[id] ?? [...ND_SEED.sosap, ...ND_SEED.notes, ...st.extra.sosap, ...st.extra.notes].find((x) => x.id === id)?.title ?? 'this item';

    const cell = el.closest<HTMLElement>('[data-nd-ci]');
    const row = cell?.closest<HTMLElement>('[data-nd-ri]');
    if (cell && row) {
      const tid = row.dataset.ndTid ?? '';
      const ri = Number(row.dataset.ndRi);
      const ci = Number(cell.dataset.ndCi);
      const cap = (st.tables[id] ?? []).find((t) => t.tid === tid)?.caption.trim() || 'Footnote table';
      setTblSel({ id, tid, ri, ci });
      setLinkTo({ kind: 'cell', id, tid, ri, ci, what: `cell ${String.fromCharCode(65 + ci)}${ri + 1} of “${cap}” — ${title}` });
      return;
    }

    const ed = el.closest<HTMLElement>('[data-note-edit]');
    if (ed?.isContentEditable) {
      const inside = range && ed.contains(range.startContainer) && ed.contains(range.endContainer);
      setLinkTo({ kind: 'text', id, el: ed, range: inside ? range : null, what: `the narrative of “${title}”` });
    }
  };

  /** put the picked number where the picker was opened */
  const placeLink = (seg: NdSeg) => {
    const to = linkTo;
    setLinkTo(null);
    if (!to) return;
    ndCheckOut(setSt, to.id);
    if (to.kind === 'cell') {
      setCell(to.id, to.tid, to.ri, to.ci, { v: '', seg });
      return;
    }
    const ed = to.el;
    if (!ed.isConnected) return;
    ed.focus();
    let r = to.range;
    if (!r) { r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); }
    // a right-click mid-word would split it — move the caret to the end of that word
    if (r.collapsed && r.startContainer.nodeType === Node.TEXT_NODE) {
      const txt = r.startContainer.textContent ?? '';
      let at = r.startOffset;
      if (at > 0 && /\w/.test(txt[at - 1] ?? '') && /\w/.test(txt[at] ?? '')) {
        while (at < txt.length && /\w/.test(txt[at])) at++;
        r.setStart(r.startContainer, at);
        r.collapse(true);
      }
    }
    r.deleteContents();
    // keep the figure a word of its own: a space either side unless one is already there
    const around = (off: number) =>
      r.startContainer.nodeType === Node.TEXT_NODE ? (r.startContainer.textContent ?? '')[r.startOffset + off] ?? '' : '';
    const chip = ndFigEl(seg, ndResolve(sources, seg));
    const gap = document.createTextNode(/\s/.test(around(0)) ? '' : ' ');
    r.insertNode(gap);
    r.insertNode(chip);
    if (/\S/.test(around(-1))) r.insertNode(document.createTextNode(' '));
    // caret after the figure, so typing carries on
    const after = document.createRange();
    after.setStartAfter(gap);
    after.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(after);
    const key = ed.dataset.fcBlk ?? '';
    if (key.startsWith('body:')) setHtml(to.id, ed.innerHTML);
    else if (key.startsWith('box:')) patchBox(to.id, key.slice(4), { html: ed.innerHTML });
  };

  /* Shift + L in a narrative or a footnote cell */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.code !== 'KeyL' || e.isComposing) return;
      const ae = document.activeElement;
      if (!ae || !docRef.current?.contains(ae) || !ae.closest('[data-fc-linkable]')) return;
      e.preventDefault();
      const sel = window.getSelection();
      const range = (ae as HTMLElement).isContentEditable && sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      openLinkAt(ae, range);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  /* the application right-click menu hands "Link a number…" and row comments back here */
  useEffect(() => {
    const root = docRef.current;
    if (!root) return;
    const onLink = (e: Event) => openLinkAt(e.target as Element, (e as CustomEvent<FcMenuEvent>).detail.range);
    const onCmt = (e: Event) => {
      const row = (e.target as Element).closest<HTMLElement>('[data-fc-cmt-local]');
      const id = row?.closest<HTMLElement>('[data-nd-item]')?.dataset.ndItem;
      if (!row || !id) return;
      const d = (e as CustomEvent<FcMenuEvent>).detail;
      openQuick(id, row.dataset.fcLoc ?? '', row.dataset.fcQuote ?? '', d.x, d.y);
    };
    root.addEventListener('fc:link', onLink);
    root.addEventListener('fc:comment', onCmt);
    return () => {
      root.removeEventListener('fc:link', onLink);
      root.removeEventListener('fc:comment', onCmt);
    };
  });

  /* linked figures in narratives read live — rewritten whenever the sources move */
  useEffect(() => {
    if (docRef.current) ndRefreshFigs(docRef.current, sources);
  });

  const resolveComment = (id: string, cid: string) =>
    setSt((s) => ({ ...s, comments: { ...s.comments, [id]: (s.comments[id] ?? []).map((c) => (c.cid === cid ? { ...c, resolved: !c.resolved } : c)) } }));

  /** the nuances recorded against an item, grouped so the reader sees why it changed */
  const changeChips = (id: string) => {
    const rows = new Map<string, { n: number; label: string; removed: boolean }>();
    (st.statements[id] ?? []).forEach((s) => {
      if (!s.text.trim()) return;
      if (!s.removed && s.origin !== 'added') return;
      const key = `${s.removed ? 'd' : 'a'}:${s.tag || '_'}`;
      const prev = rows.get(key);
      rows.set(key, { n: (prev?.n ?? 0) + 1, label: s.tag ? ndTagLabel(s.tag) : 'Untagged', removed: s.removed });
    });
    return [...rows.entries()].map(([key, v]) => ({ key, ...v }));
  };

  const iconBtn = (c: string): React.CSSProperties => ({
    flex: 'none', width: '22px', height: '22px', borderRadius: '6px', display: 'flex',
    alignItems: 'center', justifyContent: 'center', color: c, background: `${c}14`, border: `1px solid ${c}33`,
  });

  /* ===== one item ===== */
  const item = (sec: NdTag, it: NdItem, i: number, accent: string) => {
    const open = !st.collapsed[it.id];
    const isFull = full === it.id;
    const barOn = !!bars[it.id];
    const boxes = st.blocks[it.id] ?? [];
    const cmts = st.comments[it.id] ?? [];
    const openCmts = cmts.filter((c) => !c.resolved).length;
    const bodyGone = !!st.noBody[it.id];
    const chips = changeChips(it.id);
    const vers = st.versions[it.id] ?? [];

    /* ---- collaborative check-out ---- */
    const lock = ndLockOf(st, it.id);
    const locked = ndLockedByOther(st, it.id);   // held by a colleague — read-only for me
    const mine = ndLockMine(st, it.id);
    const toastOn = lockToast?.id === it.id;

    const editorStyle: React.CSSProperties = {
      minHeight: isFull ? '44vh' : '32px', outline: 'none', fontSize: isFull ? '14px' : '12.5px',
      lineHeight: 1.7, color: '#414B62', borderRadius: '8px',
      padding: isFull ? '12px 14px' : '6px 9px',
      border: `1px solid ${active === it.id ? accent : isFull ? '#DCE0EB' : 'transparent'}`,
      background: active === it.id || isFull ? '#fff' : 'transparent',
      boxShadow: active === it.id ? '0 2px 10px rgba(40,50,80,.08)' : 'none',
      ...(locked ? { cursor: 'not-allowed', color: '#7A84A0' } : null),
    };

    /** focusing an editor claims the item; on a locked item it is refused */
    const onActive = (el: HTMLElement | null) => {
      if (locked) {
        lockBlock(it.id);
        try { (document.activeElement as HTMLElement | null)?.blur(); } catch { /* ignore */ }
        return;
      }
      ndCheckOut(setSt, it.id);
      activeEl.current = el;
      setActive(it.id);
    };

    return (
      <div
        key={it.id}
        id={`ndnote-${it.id}`}
        data-nd-item={it.id}
        data-nd-hover="1"
        data-nd-active={isFull || active === it.id || cmtOn === it.id ? '1' : '0'}
        /* drag by the grip reorders this item within its section */
        onDragEnter={() => { if (dragId && dragId !== it.id) ndReorder(setSt, sec, dragId, it.id); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); setDragId(null); }}
        style={
          isFull
            ? { position: 'fixed', inset: 0, zIndex: 75, display: 'flex', gap: '14px', background: '#EDF0F7', padding: '30px 36px 46px', overflow: 'auto' }
            : {
                display: 'flex', gap: '10px', marginBottom: '14px', padding: '2px', borderRadius: '10px',
                opacity: dragId === it.id ? 0.45 : locked ? 0.72 : 1,
                outline: dragId === it.id ? `1px dashed ${accent}` : 'none',
              }
        }
      >
        {/* grip + collapse + number */}
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          {!isFull && (
            <span
              draggable={!locked}
              onDragStart={() => { if (!locked) setDragId(it.id); }}
              onDragEnd={() => setDragId(null)}
              title={locked ? `Checked out by ${lock?.user} — cannot be moved` : 'Drag to move this item up or down the section'}
              style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px 0', cursor: locked ? 'not-allowed' : 'grab' }}
            >
              {[0, 1, 2].map((r) => (
                <span key={r} style={{ display: 'flex', gap: '2px' }}>
                  <i style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#B4BCCE' }} />
                  <i style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#B4BCCE' }} />
                </span>
              ))}
            </span>
          )}
          <button
            type="button" className="fc-btn fc-h" title="Group / ungroup"
            onClick={() => setSt((s) => ({ ...s, collapsed: { ...s.collapsed, [it.id]: !s.collapsed[it.id] } }))}
            style={{ flex: 'none', width: '20px', height: '20px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, lineHeight: 1, color: accent, background: `${accent}1a`, border: `1px solid ${accent}3d` }}
          >
            {open ? '−' : '+'}
          </button>
        </div>
        <span style={{ flex: 'none', fontSize: '13px', fontWeight: 700, color: accent, minWidth: '18px', marginTop: '1px', fontVariantNumeric: 'tabular-nums' }}>
          {sec === 'sosap' ? `${i + 1}.` : `${i + 1}`}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* ---- title row + item tools ---- */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '3px' }}>
            <div
              contentEditable={!locked}
              suppressContentEditableWarning
              onFocus={() => { if (locked) { lockBlock(it.id); } else ndCheckOut(setSt, it.id); }}
              onBlur={(e) => { if (!locked) setTitle(it.id, e.currentTarget.textContent ?? it.title); }}
              title={locked ? `Checked out by ${lock?.user} — read-only` : 'Click to rename this item'}
              style={{ flex: '0 1 auto', minWidth: 0, fontSize: '13.5px', fontWeight: 700, color: locked ? '#6B7488' : '#232C42', outline: 'none', borderRadius: '5px', padding: '1px 3px', cursor: locked ? 'not-allowed' : 'text' }}
            >
              {st.titles[it.id] ?? it.title}
            </div>

            {/* who holds it — design `lockAv*` line 6405 */}
            {lock && (
              <button
                type="button" className="fc-btn"
                onClick={() => { if (mine) ndCheckIn(setSt, it.id); else lockBlock(it.id); }}
                title={
                  locked
                    ? `Checked out by ${lock.user} since ${lock.at} — read-only until they check it back in`
                    : `Checked out to you since ${lock.at} — click to check in`
                }
                style={{
                  flex: 'none', marginTop: '2px', width: '22px', height: '22px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#fff',
                  ...(locked
                    ? { cursor: 'not-allowed', background: 'linear-gradient(145deg,#F0B23A,#D9881C)', boxShadow: '0 0 0 2px rgba(245,158,11,.26)' }
                    : { cursor: 'pointer', background: 'linear-gradient(145deg,#12907F,#0B6F62)', boxShadow: '0 0 0 2px rgba(15,118,110,.26)' }),
                }}
              >
                {ndInitials(mine ? 'You' : lock.user)}
              </button>
            )}
            {vers.length > 0 && (
              <span
                title={`${vers.length} version${vers.length === 1 ? '' : 's'} on file`}
                style={{ flex: 'none', marginTop: '2px', fontSize: '9.5px', fontWeight: 700, color: accent, background: `${accent}1a`, border: `1px solid ${accent}3d`, padding: '2px 7px', borderRadius: '999px', fontVariantNumeric: 'tabular-nums' }}
              >
                v{vers[vers.length - 1].v}
              </span>
            )}
            <span style={{ flex: 1, minWidth: '8px' }} />

            <button
              type="button" className="fc-btn fc-h" title="Add a comment on this item"
              onClick={() => setCmtOn((c) => (c === it.id ? null : it.id))}
              style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', height: '22px', padding: '0 9px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, color: accent, background: 'rgba(59,130,246,.09)', border: '1px solid rgba(59,130,246,.3)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Comment{openCmts > 0 ? ` ${openCmts}` : ''}
            </button>

            <span className="fc-tools" style={{ flex: 'none', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
              <button
                type="button" className="fc-btn fc-h" title={barOn ? 'Hide formatting toolbar' : 'Show formatting toolbar'}
                onClick={() => setBars((b) => ({ ...b, [it.id]: !b[it.id] }))}
                style={barOn ? { ...iconBtn(accent), color: '#fff', background: accent, border: `1px solid ${accent}` } : iconBtn(accent)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 6.5V5h9v1.5M9.5 5v13M7.5 18h4M14.5 12.5V11h5v1.5M17 11v7M15.5 18h3" /></svg>
              </button>
              <button
                type="button" className="fc-btn fc-h" onClick={gate(it.id, () => addBox(it.id))}
                title={locked ? `Checked out by ${lock?.user} — locked` : 'Add text box'}
                style={locked ? { ...iconBtn('#9AA3BA'), cursor: 'not-allowed' } : iconBtn(accent)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 10h10M7 14h6" /></svg>
              </button>
              <button
                type="button" className="fc-btn fc-h" onClick={gate(it.id, () => addTable(it.id))}
                title={locked ? `Checked out by ${lock?.user} — locked` : 'Add footnote table — cells can be linked to live figures'}
                style={locked ? { ...iconBtn('#9AA3BA'), cursor: 'not-allowed' } : iconBtn(accent)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10" /></svg>
              </button>
              <button
                type="button" className="fc-btn fc-h"
                title={locked ? `Checked out by ${lock?.user} — locked` : 'Open the drafting screen — statements, nuance tags and versions'}
                onClick={gate(it.id, () => setDrafting(ndDraftOf(st, it.id, sec)))}
                style={locked ? { ...iconBtn('#9AA3BA'), cursor: 'not-allowed' } : iconBtn('#3B5BDB')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
              </button>
              <button
                type="button" className="fc-btn fc-h" title={isFull ? 'Exit full screen (Esc)' : 'Open full screen'}
                onClick={() => { setFull(isFull ? null : it.id); setSt((s) => ({ ...s, collapsed: { ...s.collapsed, [it.id]: false } })); }}
                style={iconBtn(accent)}
              >
                {isFull ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
                )}
              </button>
              <button
                type="button" className="fc-btn fc-h"
                title={locked ? `Checked out by ${lock?.user} — cannot be deleted` : 'Delete this item'}
                onClick={gate(it.id, () => { if (isFull) setFull(null); hide(it.id); })}
                style={{ flex: 'none', width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: locked ? '#9AA3BA' : '#B4256F', background: locked ? 'rgba(154,163,186,.12)' : 'rgba(180,37,111,.08)', cursor: locked ? 'not-allowed' : 'pointer' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </span>
          </div>

          {/* ---- check-out strip + refusal toast (design 2434, `lockStyle` 6397) ---- */}
          {lock && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px', padding: '4px 9px',
                borderRadius: '8px', fontSize: '10.5px', fontWeight: 700,
                ...(locked
                  ? { color: '#B45309', background: 'rgba(245,158,11,.14)', border: '1px solid rgba(180,83,9,.28)' }
                  : { color: '#0F766E', background: 'rgba(15,118,110,.1)', border: '1px solid rgba(15,118,110,.26)' }),
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                {locked
                  ? <><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>
                  : <><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></>}
              </svg>
              <span style={{ flex: 1, minWidth: 0 }}>
                {locked ? `Checked out by ${lock.user} · ${lock.at}` : `Checked out to you · ${lock.at}`}
              </span>
              {locked ? (
                <span style={{ flex: 'none', fontWeight: 600, opacity: 0.85 }}>Read-only until {lock.user} checks it back in</span>
              ) : (
                <button
                  type="button" className="fc-h fc-btn" onClick={() => ndCheckIn(setSt, it.id)}
                  title="Release this item so colleagues can edit it"
                  style={{ flex: 'none', height: '20px', padding: '0 9px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, color: '#fff', background: 'linear-gradient(145deg,#12907F,#0B6F62)' }}
                >
                  Check in
                </button>
              )}
            </div>
          )}

          {toastOn && (
            <div style={{ marginBottom: '5px', padding: '6px 9px', borderRadius: '8px', fontSize: '10.5px', lineHeight: 1.5, color: '#B42318', background: 'rgba(180,35,24,.09)', border: '1px solid rgba(180,35,24,.25)' }}>
              {lockToast?.msg}
            </div>
          )}

          {/* ---- comment thread ---- */}
          {cmtOn === it.id && (
            <div style={{ margin: '6px 0 9px', padding: '10px 11px', borderRadius: '11px', background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.28)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                <span style={{ flex: 1, fontSize: '10.5px', fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: '#2563EB' }}>
                  Comments on “{st.titles[it.id] ?? it.title}”
                </span>
                <button
                  type="button" className="fc-h fc-btn"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    openQuick(it.id, st.titles[it.id] ?? it.title, st.titles[it.id] ?? it.title, rect.left - 300, rect.bottom + 8);
                  }}
                  style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', height: '22px', padding: '0 9px', borderRadius: '7px', fontSize: '10px', fontWeight: 700, color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  New comment
                </button>
                <button type="button" className="fc-btn" onClick={() => setCmtOn(null)} style={{ flex: 'none', fontSize: '10px', fontWeight: 700, color: '#7A84A0' }}>Close</button>
              </div>
              {cmts.length === 0 && (
                <div style={{ fontSize: '11px', color: '#7A84A0', fontStyle: 'italic', marginBottom: '8px' }}>
                  No comments on this item yet.
                </div>
              )}
              {cmts.map((c) => (
                <div key={c.cid} style={{ display: 'flex', gap: '8px', padding: '7px 0', borderTop: '1px solid rgba(59,130,246,.16)' }}>
                  <span style={{ flex: 'none', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9.5px', fontWeight: 700, color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)' }}>
                    {c.author.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '10px', color: '#7A84A0' }}>{c.author} · {c.time}</span>
                      {c.prio && (
                        <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', padding: '2px 7px', borderRadius: '6px', color: ndPrioTone(c.prio).fg, background: ndPrioTone(c.prio).bg }}>
                          {c.prio}
                        </span>
                      )}
                      {c.assignee && (
                        <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#2563EB' }}>
                          → {c.assignee === ND_ME ? 'you' : c.assignee}
                        </span>
                      )}
                    </div>
                    {c.loc && (
                      <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: '#B45309', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.loc}
                      </div>
                    )}
                    {c.quote && (
                      <div style={{ fontSize: '10.5px', color: '#7A84A0', fontStyle: 'italic', lineHeight: 1.45, marginBottom: '3px', borderLeft: '2px solid rgba(217,119,6,.5)', paddingLeft: '7px' }}>
                        “{c.quote}”
                      </div>
                    )}
                    <div style={{ fontSize: '11.5px', lineHeight: 1.55, color: c.resolved ? '#9AA3BA' : '#333D55', textDecoration: c.resolved ? 'line-through' : 'none' }}>{c.text}</div>
                  </div>
                  <button
                    type="button" className="fc-btn" onClick={() => resolveComment(it.id, c.cid)}
                    title={c.resolved ? 'Reopen' : 'Resolve'}
                    style={{ flex: 'none', fontSize: '10px', fontWeight: 700, color: c.resolved ? '#7A84A0' : '#0F766E' }}
                  >
                    {c.resolved ? 'Reopen' : 'Resolve'}
                  </button>
                </div>
              ))}
              <div style={{ marginTop: '9px', fontSize: '10px', color: '#7A84A0', fontStyle: 'italic' }}>
                Right-click a footnote-table row to comment on that line item, or use New comment for the item as a whole.
              </div>
            </div>
          )}

          {open && (
            <>
              {barOn && (
                <NdFormatBar
                  accent={accent}
                  getEl={() => activeEl.current}
                  onAfter={() => {
                    const el = activeEl.current;
                    if (!el) return;
                    const key = el.dataset.fcBlk ?? '';
                    if (key.startsWith('body:')) setHtml(it.id, el.innerHTML);
                    else if (key.startsWith('box:')) patchBox(it.id, key.slice(4), { html: el.innerHTML });
                  }}
                />
              )}

              {/* ---- the narrative ---- */}
              {bodyGone ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 9px', borderRadius: '9px', background: '#EDF0F7', border: '1px dashed #CBD2E0' }}>
                  <span style={{ flex: 1, fontSize: '11px', color: '#7A84A0', fontStyle: 'italic' }}>The narrative has been deleted — text boxes below are kept.</span>
                  <button
                    type="button" className="fc-h fc-btn" onClick={gate(it.id, () => restoreBody(it.id))}
                    title={locked ? `Checked out by ${lock?.user} — locked` : 'Restore the narrative'}
                    style={{ flex: 'none', fontSize: '10.5px', fontWeight: 700, color: locked ? '#9AA3BA' : accent, cursor: locked ? 'not-allowed' : 'pointer' }}
                  >
                    Restore narrative
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <NdRich
                    /* the version count is in the key so a newly submitted version repaints */
                    blkKey={`body:${it.id}:${vers.length}`}
                    html={st.html[it.id] ?? st.bodies[it.id] ?? it.desc}
                    onSave={(h) => { if (!locked) setHtml(it.id, h); }}
                    onActive={onActive}
                    style={{ ...editorStyle, flex: 1, minWidth: 0 }}
                  />
                  <span className="fc-tools" style={{ flex: 'none', display: 'flex', paddingTop: '4px' }}>
                    <button
                      type="button" className="fc-btn fc-h"
                      title={locked ? `Checked out by ${lock?.user} — locked` : 'Delete the narrative, keeping the text boxes'}
                      onClick={gate(it.id, () => dropBody(it.id))}
                      style={{ flex: 'none', width: '20px', height: '20px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: locked ? '#9AA3BA' : '#B4256F', background: locked ? 'rgba(154,163,186,.12)' : 'rgba(180,37,111,.08)', cursor: locked ? 'not-allowed' : 'pointer' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                    </button>
                  </span>
                </div>
              )}

              {/* ---- text boxes ---- */}
              {boxes.map((b) => (
                <div key={b.tid} data-nd-hover="1" style={{ marginTop: '9px', padding: '9px 10px', borderRadius: '11px', background: '#fff', border: '1px solid #E4E8F2', boxShadow: '0 1px 4px rgba(40,50,80,.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 10h10M7 14h6" /></svg>
                    <input
                      value={b.caption} readOnly={locked}
                      onFocus={() => { if (locked) lockBlock(it.id); }}
                      onChange={(e) => { if (!locked) patchBox(it.id, b.tid, { caption: e.target.value }); }}
                      placeholder="Label this text box — it becomes a heading in the Word export"
                      style={{ flex: 1, minWidth: '90px', boxSizing: 'border-box', padding: '2px 4px', fontSize: '11.5px', fontWeight: 700, color: locked ? '#8A93AC' : '#34406B', background: 'transparent', border: 0, borderBottom: '1px dashed #C3CADB', outline: 'none', fontFamily: 'inherit', cursor: locked ? 'not-allowed' : 'text' }}
                    />
                    <span className="fc-tools" style={{ flex: 'none', display: 'flex' }}>
                      <button
                        type="button" className="fc-btn fc-h"
                        title={locked ? `Checked out by ${lock?.user} — locked` : 'Delete this text box'}
                        onClick={gate(it.id, () => dropBox(it.id, b.tid))}
                        style={{ flex: 'none', width: '20px', height: '20px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: locked ? '#9AA3BA' : '#B4256F', background: locked ? 'rgba(154,163,186,.12)' : 'rgba(180,37,111,.08)', cursor: locked ? 'not-allowed' : 'pointer' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                      </button>
                    </span>
                  </div>
                  <NdRich
                    blkKey={`box:${b.tid}`}
                    html={b.html}
                    onSave={(h) => { if (!locked) patchBox(it.id, b.tid, { html: h }); }}
                    onActive={onActive}
                    style={{ minHeight: '34px', outline: 'none', fontSize: '12.5px', lineHeight: 1.7, color: '#414B62', borderRadius: '8px', padding: '6px 8px', border: '1px solid #EEF1F7', background: '#FCFDFF' }}
                  />
                </div>
              ))}

              {/* ---- footnote tables ---- */}
              {(st.tables[it.id] ?? []).map((t) => {
                const capTxt = (t.caption || 'Footnote table').replace(/\s+/g, ' ').trim();
                const selHere = tblSel?.id === it.id && tblSel.tid === t.tid;
                const selCell = selHere ? t.rows[tblSel.ri]?.cells[tblSel.ci] : null;
                const selAddr = selHere ? `${String.fromCharCode(65 + tblSel.ci)}${tblSel.ri + 1}` : '';
                const selSrc = selCell?.seg ? ndResolve(sources, selCell.seg) : null;
                return (
                  <div key={t.tid} data-nd-hover="1" style={{ marginTop: '10px', borderRadius: '11px', border: '1px solid #E4E8F2', background: '#fff', overflow: 'hidden', boxShadow: '0 1px 4px rgba(40,50,80,.05)' }}>
                    {/* caption + table actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 9px', background: '#F3F5FA', borderBottom: '1px solid #E4E8F2' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10" /></svg>
                      <input
                        value={t.caption} readOnly={locked}
                        onFocus={() => { if (locked) lockBlock(it.id); }}
                        onChange={(e) => { if (!locked) tblMap(it.id, t.tid, (x) => ({ ...x, caption: e.target.value })); }}
                        placeholder="Caption this footnote table"
                        style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '1px 3px', fontSize: '11.5px', fontStyle: 'italic', fontWeight: 700, color: locked ? '#8A93AC' : '#4A5471', background: 'transparent', border: 0, outline: 'none', fontFamily: 'inherit', cursor: locked ? 'not-allowed' : 'text' }}
                      />
                      <span className="fc-tools" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <button type="button" className="fc-h fc-btn" onClick={gate(it.id, () => addRow(it.id, t.tid))} style={{ height: '22px', padding: '0 9px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, color: '#4A5471', background: '#E4E8F0', border: '1px solid #DCE0EB' }}>+ Row</button>
                        <button type="button" className="fc-h fc-btn" onClick={gate(it.id, () => addCol(it.id, t.tid))} style={{ height: '22px', padding: '0 9px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, color: '#4A5471', background: '#E4E8F0', border: '1px solid #DCE0EB' }}>+ Column</button>
                        <button
                          type="button" className="fc-h fc-btn" onClick={gate(it.id, () => dropTable(it.id, t.tid))} title="Delete this footnote table"
                          style={{ width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: locked ? '#9AA3BA' : '#B4256F', background: locked ? 'rgba(154,163,186,.12)' : 'rgba(180,37,111,.08)' }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                        </button>
                      </span>
                    </div>

                    {/* link bar — acts on the selected cell (design `linkBarStyle` 6572) */}
                    {selHere && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '6px 9px', background: '#EDF0F7', borderBottom: '1px solid #E4E8F2' }}>
                        <span style={{ flex: 'none', fontSize: '10.5px', fontWeight: 700, color: '#4A5471' }}>Cell {selAddr}</span>
                        <select
                          value="" disabled={locked}
                          onChange={(e) => { const v = e.target.value; e.currentTarget.value = ''; if (locked) { lockBlock(it.id); return; } ndCheckOut(setSt, it.id); linkCell(v); }}
                          style={{ flex: 1, minWidth: '170px', maxWidth: '330px', height: '26px', border: '1px solid #CBD2E0', borderRadius: '7px', background: '#fff', fontFamily: 'inherit', fontSize: '11px', fontWeight: 600, color: '#333D55', padding: '0 6px', cursor: locked ? 'not-allowed' : 'pointer' }}
                        >
                          <option value="">Link source —</option>
                          {(['fsli', 'tb', 'wn'] as const).map((k) => {
                            const list = sources?.[k] ?? [];
                            if (!list.length) return null;
                            return (
                              <optgroup key={k} label={ND_SRC_LABEL[k]}>
                                {list.map((s) => <option key={`${k}:${s.id}`} value={`${k}:${s.id}`}>{s.label} — {s.value}</option>)}
                              </optgroup>
                            );
                          })}
                        </select>
                        {selCell?.seg && (
                          <button type="button" className="fc-h fc-btn" onClick={gate(it.id, unlinkCell)} style={{ flex: 'none', height: '22px', padding: '0 9px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, color: '#4A5471', background: '#E4E8F0', border: '1px solid #DCE0EB' }}>Unlink</button>
                        )}
                        <span style={{ flex: '1 1 100%', fontSize: '10px', color: selSrc ? '#0B5A54' : '#7A84A0' }}>
                          {selSrc ? selSrc.tip : 'Pick a source, or press Shift + L to search every figure — the cell then reads live and refreshes on push.'}
                        </span>
                      </div>
                    )}

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '26px', padding: 0, border: '1px solid #E4E8F2', background: '#F3F5FA' }} />
                            {t.cols.map((name, ci) => (
                              <th key={ci} style={{ padding: 0, border: '1px solid #E4E8F2', background: '#F3F5FA', verticalAlign: 'middle', position: 'relative', ...(ci === 0 ? null : { width: '112px' }) }}>
                                <input
                                  value={name} readOnly={locked}
                                  onFocus={() => { if (locked) lockBlock(it.id); }}
                                  onChange={(e) => { if (!locked) tblMap(it.id, t.tid, (x) => ({ ...x, cols: x.cols.map((c, i) => (i === ci ? e.target.value : c)) })); }}
                                  placeholder={ci === 0 ? 'Line item' : 'Column'}
                                  style={{ display: 'block', width: '100%', boxSizing: 'border-box', height: '26px', border: 0, outline: 'none', background: 'transparent', padding: '0 18px 0 7px', fontSize: '11px', fontWeight: 700, letterSpacing: '.3px', color: '#4A5471', textAlign: ci === 0 ? 'left' : 'right', fontFamily: 'inherit' }}
                                />
                                <span className="fc-tools" style={{ position: 'absolute', top: '5px', right: '3px' }}>
                                  <button
                                    type="button" className="fc-btn" title="Delete this column" onClick={gate(it.id, () => delCol(it.id, t.tid, ci))}
                                    style={{ width: '14px', height: '14px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, lineHeight: 1, color: '#9AA3BA' }}
                                  >
                                    ×
                                  </button>
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {t.rows.map((r, ri) => {
                            /* the reference the comment carries: item · table · row */
                            const rowLoc = `${st.titles[it.id] ?? it.title} · ${capTxt} · row ${ri + 1}`;
                            /* and the line item itself, resolved so linked cells read as figures */
                            const rowQuote = r.cells
                              .map((cc) => (cc.seg ? (ndResolve(sources, cc.seg)?.value ?? '#REF') : cc.v))
                              .map((v) => v.trim()).filter(Boolean).join('  ·  ');
                            const rowCmts = (st.comments[it.id] ?? []).filter((cm) => cm.loc === rowLoc && !cm.resolved);
                            return (
                              <tr
                                key={r.rid}
                                /*
                                 * right-click opens the application menu (design line 6531); its
                                 * "Add comment…" comes back here as `fc:comment` so the comment
                                 * stays on this row, and "Link a number…" as `fc:link`
                                 */
                                data-fc-cmt-local=""
                                data-fc-loc={rowLoc}
                                data-fc-quote={rowQuote || rowLoc}
                                data-nd-tid={t.tid}
                                data-nd-ri={ri}
                              >
                                <td style={{ padding: 0, border: '1px solid #E4E8F2', background: '#F8F9FC', textAlign: 'center', verticalAlign: 'middle' }}>
                                  <button
                                    type="button" className="fc-btn"
                                    title={rowCmts.length ? `${rowCmts.length} comment${rowCmts.length === 1 ? '' : 's'} on this row — click to open` : 'Comment on this row'}
                                    onClick={(e) => {
                                      if (rowCmts.length) { setCmtOn(it.id); return; }
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      openQuick(it.id, rowLoc, rowQuote || rowLoc, rect.left - 300, rect.bottom + 8);
                                    }}
                                    style={{ width: '18px', height: '18px', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', ...(rowCmts.length ? { color: '#B45309', background: 'rgba(245,158,11,.22)' } : { color: '#B4BCCE' }) }}
                                  >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                  </button>
                                </td>
                                {r.cells.map((cc, ci) => {
                                  const isSel = selHere && tblSel.ri === ri && tblSel.ci === ci;
                                  const num = ci > 0;
                                  const rv = cc.seg ? ndResolve(sources, cc.seg) : null;
                                  const linked = !!cc.seg;
                                  const srcC = cc.seg ? ND_SRC_COLOR[cc.seg.src] : '';
                                  return (
                                    <td
                                      key={ci}
                                      data-nd-ci={ci}
                                      data-fc-linkable=""
                                      data-fc-menu=""
                                      style={{
                                        padding: 0, border: '1px solid #E4E8F2', verticalAlign: 'top',
                                        background: isSel ? 'rgba(59,130,246,.07)' : linked ? `${srcC}0f` : '#fff',
                                        ...(isSel ? { boxShadow: `inset 0 0 0 2px ${accent}` } : null),
                                      }}
                                    >
                                      <input
                                        value={linked ? (rv?.value ?? '#REF') : cc.v}
                                        readOnly={linked || locked}
                                        title={linked ? rv?.tip : undefined}
                                        onFocus={() => { if (locked) { lockBlock(it.id); return; } setTblSel({ id: it.id, tid: t.tid, ri, ci }); }}
                                        onChange={(e) => { if (!linked && !locked) setCell(it.id, t.tid, ri, ci, { v: e.target.value }); }}
                                        style={{
                                          display: 'block', width: '100%', boxSizing: 'border-box', height: '25px', border: 0, outline: 'none',
                                          background: 'transparent', padding: '0 7px', fontSize: '11.5px', fontVariantNumeric: 'tabular-nums',
                                          textAlign: num ? 'right' : 'left', fontFamily: 'inherit',
                                          color: linked ? srcC : '#232C42', fontWeight: linked || num ? 600 : 400,
                                          cursor: linked ? 'default' : locked ? 'not-allowed' : 'text',
                                        }}
                                      />
                                      {linked && (
                                        <span style={{ display: 'block', padding: '0 7px 3px', fontSize: '8.5px', fontWeight: 700, color: srcC, textAlign: num ? 'right' : 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {cc.seg?.label}
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td style={{ border: 0, padding: '0 0 0 3px', verticalAlign: 'middle', width: '18px' }}>
                                  <span className="fc-tools">
                                    <button
                                      type="button" className="fc-btn" title="Delete this row" onClick={gate(it.id, () => delRow(it.id, t.tid, ri))}
                                      style={{ width: '18px', height: '18px', borderRadius: '5px', fontSize: '12px', fontWeight: 700, lineHeight: 1, color: '#B4BCCE' }}
                                    >
                                      ×
                                    </button>
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* ---- why it changed ---- */}
              {chips.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                  <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: '#9AA3BA' }}>Why it changed</span>
                  {chips.map((ch) => {
                    const c = ch.removed ? '#B42318' : '#0F766E';
                    return (
                      <span key={ch.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', fontWeight: 700, color: c, background: `${c}12`, border: `1px solid ${c}38`, padding: '2px 8px', borderRadius: '999px' }}>
                        {ch.removed ? '−' : '+'}{ch.n} {ch.label}
                      </span>
                    );
                  })}
                </div>
              )}

              {isFull && (
                <button
                  type="button" className="fc-h fc-btn" onClick={() => setFull(null)}
                  style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 15px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, color: '#414B62', background: 'rgba(255,255,255,.8)', border: '1px solid #CBD2E0' }}
                >
                  Exit full screen (Esc)
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  /* ===== one section ===== */
  const block = (sec: NdTag, accent: string, headKey: string, headDefault: string) => {
    const chosen = ndItems(st, sec).filter((x) => st.sel[x.id]);
    const hiddenCount = Object.keys(st.hidden).filter((id) => st.hidden[id] && id.startsWith(sec === 'sosap' ? 'p' : 'x')).length;
    return (
      <>
        <div
          data-nd-hover="1"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '7px', borderBottom: `1.5px solid ${accent}4d`, margin: sec === 'notes' ? '22px 0 12px' : '0 0 12px' }}
        >
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => setTitle(headKey, e.currentTarget.textContent ?? headDefault)}
            title="Click to rename this section"
            style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: 700, color: accent, letterSpacing: '.2px', outline: 'none', borderRadius: '5px', padding: '1px 3px', cursor: 'text' }}
          >
            {secTitle(headKey, headDefault)}
          </div>
          <button
            type="button" className="fc-h fc-btn" onClick={() => setDrafting(ndBlankDraft(sec))}
            title={sec === 'sosap' ? 'Add accounting policy' : 'Add note'}
            style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', height: '26px', padding: '0 11px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: '#fff', background: `linear-gradient(145deg,${accent},${accent}cc)`, boxShadow: `0 2px 8px ${accent}59` }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {sec === 'sosap' ? 'Add policy' : 'Add note'}
          </button>
          {hiddenCount > 0 && (
            <button
              type="button" className="fc-h fc-btn" onClick={() => setSt((s) => ({ ...s, hidden: {} }))} title="Restore deleted items"
              style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', height: '26px', padding: '0 11px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: accent, background: `${accent}1a`, border: `1px solid ${accent}3d` }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" /></svg>
              Restore {hiddenCount} deleted
            </button>
          )}
        </div>

        {chosen.length === 0 && (
          <div style={{ fontSize: '11.5px', color: '#9AA3BA', fontStyle: 'italic', paddingBottom: '8px' }}>
            Nothing ticked in this section yet — choose items in the panel, or add one here.
          </div>
        )}

        {chosen.map((it, i) => item(sec, it, i, accent))}
      </>
    );
  };

  return (
    <>
      <div style={{ fontSize: '11.5px', color: '#7A84A0', fontStyle: 'italic', marginBottom: '14px' }}>
        Policies and notes ticked in the panel appear here in order — drag an item by its grip to reposition it.
        Each item groups with its <b style={{ color: '#3B5BDB' }}>±</b> toggle; section and item titles are editable in
        place. The tools on each item add a <b style={{ color: '#3B5BDB' }}>text box</b>, show the{' '}
        <b style={{ color: '#3B5BDB' }}>formatting toolbar</b>, open it <b style={{ color: '#3B5BDB' }}>full screen</b>,
        raise a <b style={{ color: '#3B5BDB' }}>comment</b> or delete it. Place the cursor in a narrative and press{' '}
        <b style={{ color: '#3B5BDB' }}>Shift + L</b> to link a live number — or select a footnote-table cell and press it
        there. Right-click anywhere to comment, copy, open the comments rail or link a number.
      </div>

      <div
        ref={docRef}
        data-nd-doc="1"
        style={{
          background: '#F6F7FB', border: '1px solid #E4E8F2', borderRadius: '14px',
          boxShadow: 'inset 2px 2px 7px rgba(166,175,195,.35)', padding: '20px 22px',
          maxHeight: '640px', overflow: 'auto',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#232C42', marginBottom: '2px' }}>
          Notes to the Consolidated Financial Statements
        </div>
        <div style={{ fontSize: '11.5px', color: '#7A84A0', marginBottom: '10px' }}>{tenant} · {period}</div>

        {/* ---- who is in the document right now ---- */}
        {ndPresence(st).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '7px', marginBottom: '16px', padding: '6px 10px', borderRadius: '10px', background: 'rgba(59,91,219,.06)', border: '1px solid rgba(59,91,219,.2)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3B5BDB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
              <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.6a3.5 3.5 0 0 1 0 6.8" />
            </svg>
            <span style={{ flex: 'none', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: '#3B5BDB' }}>
              Working here now
            </span>
            {ndPresence(st).map((p) => (
              <span
                key={p.user}
                title={p.me ? `You have ${p.n} item${p.n === 1 ? '' : 's'} checked out` : `${p.user} has ${p.n} item${p.n === 1 ? '' : 's'} checked out — those are read-only for you`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700,
                  padding: '2px 8px 2px 3px', borderRadius: '999px',
                  ...(p.me
                    ? { color: '#0B5A54', background: 'rgba(15,118,110,.12)', border: '1px solid rgba(15,118,110,.3)' }
                    : { color: '#8A5A08', background: 'rgba(245,158,11,.14)', border: '1px solid rgba(180,83,9,.28)' }),
                }}
              >
                <span
                  style={{
                    flex: 'none', width: '17px', height: '17px', borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '8px', color: '#fff',
                    background: p.me ? 'linear-gradient(145deg,#12907F,#0B6F62)' : 'linear-gradient(145deg,#F0B23A,#D9881C)',
                  }}
                >
                  {ndInitials(p.me ? 'You' : p.user)}
                </span>
                {p.me ? 'You' : p.user} · {p.n}
              </span>
            ))}
            <span style={{ flex: 1 }} />
            <span style={{ flex: 'none', fontSize: '10px', color: '#7A84A0' }}>
              Items others hold are read-only until they check them back in.
            </span>
          </div>
        )}

        {block('sosap', POL, 'secA', 'A · Significant Accounting Policies')}
        {block('notes', NOTE, 'secB', 'B · Notes to the Financial Statements')}
      </div>

      {/* ---- quick-comment composer — design markup 3899–3931 ---- */}
      {quick && (
        <div
          onClick={() => setQuick(null)}
          onContextMenu={(e) => { e.preventDefault(); setQuick(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1340, background: 'rgba(35,44,66,.18)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') setQuick(null); }}
            style={{
              position: 'fixed', left: `${Math.max(12, quick.x)}px`, top: `${Math.max(12, quick.y)}px`,
              width: '384px', maxWidth: '94vw', background: '#ECEFF6', border: '1px solid rgba(255,255,255,.85)',
              borderRadius: '16px', boxShadow: '0 26px 60px -16px rgba(40,50,80,.5)', padding: '15px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <span style={{ flex: 'none', width: '26px', height: '26px', borderRadius: '8px', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 12.4c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.6-.34L4.5 21l1.2-3.5A6.9 6.9 0 0 1 3.5 12.4c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2z" /></svg>
              </span>
              <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 700, color: '#232C42' }}>New comment</span>
              <button
                type="button" className="fc-h fc-btn" onClick={() => setQuick(null)} title="Cancel (Esc)"
                style={{ flex: 'none', width: '24px', height: '24px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A84A0', background: '#E4E8F0' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>

            {/* a) what it relates to — the table and the line item within it */}
            <div style={{ marginTop: '10px', padding: '9px 11px', borderRadius: '10px', background: 'rgba(245,158,11,.12)', borderLeft: '3px solid #D97706' }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: '#B45309' }}>
                {quick.loc}
              </div>
              {quick.quote && (
                <div style={{ marginTop: '3px', fontSize: '11.5px', color: '#414B62', fontStyle: 'italic', lineHeight: 1.5 }}>
                  “{quick.quote}”
                </div>
              )}
            </div>

            {/* b) the comment itself */}
            <textarea
              value={quick.text} autoFocus
              onChange={(e) => setQuick((q) => (q ? { ...q, text: e.target.value } : q))}
              placeholder="Write your comment…"
              style={{ width: '100%', boxSizing: 'border-box', marginTop: '11px', minHeight: '78px', resize: 'vertical', background: '#E4E8F0', border: '1px solid #CBD2E0', boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.4),inset -2px -2px 6px rgba(255,255,255,.9)', borderRadius: '10px', fontSize: '12.5px', lineHeight: 1.55, color: '#333D55', padding: '9px 11px', outline: 'none', fontFamily: 'inherit' }}
            />

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginTop: '11px', flexWrap: 'wrap' }}>
              {/* c) priority */}
              <div>
                <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: '#9AA3BA', marginBottom: '5px' }}>Priority</div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {ND_PRIOS.map((p) => {
                    const on = quick.prio === p.key;
                    return (
                      <button
                        key={p.key} type="button" className="fc-h fc-btn"
                        onClick={() => setQuick((q) => (q ? { ...q, prio: p.key } : q))}
                        aria-pressed={on}
                        style={{ height: '32px', padding: '0 11px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 700, ...(on ? { color: '#fff', background: p.fg } : { color: p.fg, background: p.bg }) }}
                      >
                        {p.key}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* d) assign to someone with access */}
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: '#9AA3BA', marginBottom: '5px' }}>Assign to</div>
                <select
                  value={quick.assignee}
                  onChange={(e) => setQuick((q) => (q ? { ...q, assignee: e.target.value } : q))}
                  style={{ width: '100%', height: '32px', padding: '0 9px', borderRadius: '9px', border: '1px solid #CBD2E0', background: '#E4E8F0', boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.4),inset -2px -2px 5px rgba(255,255,255,.9)', fontSize: '12px', fontWeight: 700, color: '#333D55', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}
                >
                  {team.map((u) => (
                    <option key={u.email} value={u.name}>
                      {u.name === ND_ME ? `${u.name} (you)` : u.name} — {u.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '13px' }}>
              <span style={{ flex: 1, fontSize: '10.5px', color: '#9AA3BA', fontStyle: 'italic' }}>
                Appears in the assignee’s My Tasks and notifies them.
              </span>
              <button
                type="button" className="fc-h fc-btn" onClick={() => setQuick(null)}
                style={{ flex: 'none', height: '34px', padding: '0 14px', borderRadius: '9px', border: '1px solid #CBD2E0', background: 'rgba(255,255,255,.6)', fontSize: '12px', fontWeight: 700, color: '#414B62' }}
              >
                Cancel
              </button>
              <button
                type="button" className="fc-h fc-btn" onClick={addQuick} disabled={!quick.text.trim()}
                style={{ flex: 'none', height: '34px', padding: '0 18px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, color: '#fff', background: quick.text.trim() ? 'linear-gradient(145deg,#3B82F6,#2563EB)' : '#C2C9D8', boxShadow: quick.text.trim() ? '0 3px 12px rgba(37,99,235,.38)' : 'none', cursor: quick.text.trim() ? 'pointer' : 'not-allowed' }}
              >
                Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {drafting && (
        <NdComposer
          draft={drafting}
          /* opening the drafting screen checked the item out; closing releases it */
          onCancel={() => { if (drafting.id) ndCheckIn(setSt, drafting.id); setDrafting(null); }}
          onSubmit={(d) => { ndCommit(setSt, d); if (d.id) ndCheckIn(setSt, d.id); setDrafting(null); }}
        />
      )}

      {linkTo && (
        <NdLinkPicker
          sources={sources}
          what={linkTo.what}
          onPick={placeLink}
          onClose={() => {
            // hand the caret back to where the user was typing
            if (linkTo.kind === 'text' && linkTo.el.isConnected) {
              linkTo.el.focus();
              if (linkTo.range) { const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(linkTo.range); }
            }
            setLinkTo(null);
          }}
          onOpenWn={onOpenWn ? () => { setLinkTo(null); onOpenWn(); } : undefined}
        />
      )}
    </>
  );
}
