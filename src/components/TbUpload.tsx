import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PanelFooter, SidePanel } from './SidePanel';

/**
 * Trial-balance ingestion — the "Upload TB" flow on the Financial Data Layer.
 *
 * Grows the design's generic uploader (docs/design/Fusion Close.dc.html,
 * markup 465–505, `addFiles` / `simUpload` 5652–5680, `freqRadios` 10295) into
 * a periodic TB intake:
 *
 *  - several TBs dropped at once, each tagged to a reporting period — read from
 *    the file name where it says one ("TB_Q3_2026.xlsx", "UK01 Jul-26.csv")
 *  - each runs a pipeline: upload → validate → map to COA → ready, with a
 *    progress bar for the transfer and a stage track for the processing
 *  - a status button in the toolbar shows the batch's progress while the panel
 *    is closed, and opens the activity list
 *  - the cadence (ingestion frequency and due day) lives under the settings
 *    button and decides which periods a TB can be filed against
 *
 * There is no ingestion service behind this build, so the transfer and the
 * processing stages are timed on the client. CSV files are genuinely read:
 * their rows are counted and the amount column is checked to net to nil.
 */

/* ============================== model ============================== */

export type TbFreq = 'Monthly' | 'Quarterly' | 'Half-yearly' | 'Annually';
export const TB_FREQS: TbFreq[] = ['Monthly', 'Quarterly', 'Half-yearly', 'Annually'];

export type TbSettings = { freq: TbFreq; dueDay: number };

export type TbStage = 'uploading' | 'validating' | 'mapping' | 'needsPeriod' | 'ready' | 'failed';

export type TbJob = {
  id: string;
  name: string;
  size: number;
  ext: string;
  period: string;
  stage: TbStage;
  /** 0–100 for the transfer, then for the stage in hand */
  pct: number;
  /** the stage the pipeline resumes at once a period is assigned */
  resume?: TbStage;
  error?: string;
  /** what processing found — row count, nets-to-nil, replaced period */
  notes: string[];
  warn?: string;
  addedAt: number;
};

const ACCEPT = ['xlsx', 'xls', 'csv'];
const MAX_BYTES = 500 * 1024 * 1024;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = [2025, 2026];

/** the periods a TB can be filed against under each cadence, latest first */
export const periodsFor = (f: TbFreq): string[] => {
  const out: string[] = [];
  [...YEARS].reverse().forEach((y) => {
    const yy = String(y).slice(2);
    if (f === 'Monthly') [...MONTHS].reverse().forEach((m) => out.push(`${m} '${yy}`));
    if (f === 'Quarterly') [4, 3, 2, 1].forEach((q) => out.push(`Q${q} ${y}`));
    if (f === 'Half-yearly') [2, 1].forEach((h) => out.push(`H${h} ${y}`));
    if (f === 'Annually') out.push(`FY ${y}`);
  });
  return out;
};

/**
 * Read a period out of a file name and express it in the cadence in force —
 * a monthly file under a quarterly cadence files against its quarter.
 */
export const detectPeriod = (name: string, f: TbFreq): string => {
  const s = name.toLowerCase().replace(/\.[a-z0-9]+$/, '');
  const yr = (t: string) => (t.length === 2 ? 2000 + Number(t) : Number(t));
  let y: number | null = null;
  let m: number | null = null;
  let q: number | null = null;
  let h: number | null = null;

  // named markers first — a bare "01" in an entity code ("UK01_2026") is not January
  const mon = s.match(/(?<![a-z])(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-_ .']*((?:20)?\d\d)(?!\d)/);
  const qtr = s.match(/(?<![a-z])q([1-4])[-_ .']*((?:20)?\d\d)(?!\d)/) ?? s.match(/(20\d\d)[-_ .']*q([1-4])(?!\d)/);
  const half = s.match(/(?<![a-z])h([12])[-_ .']*((?:20)?\d\d)(?!\d)/) ?? s.match(/(20\d\d)[-_ .']*h([12])(?!\d)/);
  const fy = s.match(/(?<![a-z])fy[-_ .']*((?:20)?\d\d)(?!\d)/);
  const iso = s.match(/(?<!\d)(20\d\d)[-_. ]?(0[1-9]|1[0-2])(?!\d)/);
  const rev = s.match(/(?<![a-z\d])(0[1-9]|1[0-2])[-_. ](20\d\d)(?!\d)/);

  if (mon) { m = MONTHS.findIndex((x) => x.toLowerCase() === mon[1]) + 1; y = yr(mon[2]); }
  else if (qtr) { [q, y] = qtr[0].startsWith('q') ? [Number(qtr[1]), yr(qtr[2])] : [Number(qtr[2]), Number(qtr[1])]; }
  else if (half) { [h, y] = half[0].startsWith('h') ? [Number(half[1]), yr(half[2])] : [Number(half[2]), Number(half[1])]; }
  else if (fy) { y = yr(fy[1]); }
  else if (iso) { y = Number(iso[1]); m = Number(iso[2]); }
  else if (rev) { m = Number(rev[1]); y = Number(rev[2]); }
  if (!y || !YEARS.includes(y)) return '';

  if (m) { q = Math.ceil(m / 3); h = m <= 6 ? 1 : 2; }
  else if (q) { h = q <= 2 ? 1 : 2; }

  const yy = String(y).slice(2);
  if (f === 'Monthly') return m ? `${MONTHS[m - 1]} '${yy}` : '';
  if (f === 'Quarterly') return q ? `Q${q} ${y}` : '';
  if (f === 'Half-yearly') return h ? `H${h} ${y}` : '';
  return `FY ${y}`;
};

export const fmtBytes = (n: number) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(n >= 10485760 ? 0 : 1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;

/** a CSV trial balance, actually read: data rows, and whether the amounts net to nil */
const inspectCsv = async (file: File): Promise<string[]> => {
  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return ['No data rows found under the header.'];
    const split = (l: string) => l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim());
    const head = split(lines[0]).map((c) => c.toLowerCase());
    let col = head.findIndex((c) => /net|amount|balance|value/.test(c));
    const rows = lines.slice(1).map(split);
    if (col < 0) {
      // fall back to the right-most column that is numeric throughout
      for (let c = head.length - 1; c >= 0 && col < 0; c--) {
        if (rows.every((r) => r[c] !== undefined && !Number.isNaN(Number(r[c].replace(/[(),\s]/g, ''))))) col = c;
      }
    }
    const notes = [`${rows.length.toLocaleString('en-US')} account line${rows.length === 1 ? '' : 's'} read`];
    if (col >= 0) {
      const num = (v: string) => {
        const neg = /^\(.*\)$/.test(v) || v.startsWith('-');
        const n = Number(v.replace(/[(),\s-]/g, ''));
        return Number.isNaN(n) ? 0 : neg ? -n : n;
      };
      const net = rows.reduce((s, r) => s + num(r[col] ?? '0'), 0);
      notes.push(Math.abs(net) < 0.005 ? 'Debits equal credits — nets to nil' : `Out of balance by ${net.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    }
    return notes;
  } catch {
    return [];
  }
};

/* ============================== the queue ============================== */

/** timings for the stages after the transfer, in ms */
const STAGE_MS: Partial<Record<TbStage, number>> = { validating: 1500, mapping: 1300 };
const NEXT: Partial<Record<TbStage, TbStage>> = { validating: 'mapping', mapping: 'ready' };
const TICK = 90;

/**
 * Holds the TB jobs and runs their pipeline. Mounted by the screen rather than
 * the panel, so uploads keep going while the panel is closed.
 */
export function useTbUploads() {
  const [settings, setSettings] = useState<TbSettings>({ freq: 'Monthly', dueDay: 5 });
  const [jobs, setJobs] = useState<TbJob[]>([]);
  const uid = useRef(0);
  /** CSV findings arrive asynchronously — kept until the job reaches "ready" */
  const found = useRef<Record<string, string[]>>({});

  const active = jobs.some((j) => j.stage === 'uploading' || j.stage === 'validating' || j.stage === 'mapping');

  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => {
      setJobs((all) => all.map((j) => {
        if (j.stage === 'uploading') {
          // transfer rate scales with size — 1.6 s floor, ~6 MB/s, 9 s ceiling
          const ms = Math.min(9000, 1600 + j.size / 6000);
          const pct = Math.min(100, j.pct + (100 * TICK) / ms);
          if (pct < 100) return { ...j, pct };
          return j.period ? { ...j, stage: 'validating', pct: 0 } : { ...j, stage: 'needsPeriod', pct: 0, resume: 'validating' };
        }
        const ms = STAGE_MS[j.stage];
        if (!ms) return j;
        const pct = Math.min(100, j.pct + (100 * TICK) / ms);
        if (pct < 100) return { ...j, pct };
        const next = NEXT[j.stage] as TbStage;
        if (next !== 'ready') return { ...j, stage: next, pct: 0 };
        // filing a second TB for the same period supersedes the first
        const dup = all.find((o) => o.id !== j.id && o.stage === 'ready' && o.period === j.period);
        return {
          ...j, stage: 'ready', pct: 100,
          notes: [...(found.current[j.id] ?? []), 'Accounts mapped to the local chart'],
          warn: [j.warn, dup ? `Supersedes ${dup.name} for ${j.period}` : ''].filter(Boolean).join(' · ') || undefined,
        };
      }));
    }, TICK);
    return () => window.clearInterval(t);
  }, [active]);

  const add = useCallback((files: File[]) => {
    if (!files.length) return;
    const fresh: TbJob[] = files.map((f) => {
      const id = `tb${(uid.current += 1)}`;
      const ext = (f.name.split('.').pop() ?? '').toLowerCase();
      const base: TbJob = {
        id, name: f.name, size: f.size, ext, period: detectPeriod(f.name, settings.freq),
        stage: 'uploading', pct: 0, notes: [], addedAt: Date.now(),
      };
      if (!ACCEPT.includes(ext)) return { ...base, stage: 'failed', error: `.${ext || '?'} is not accepted — use .xlsx, .xls or .csv` };
      if (f.size > MAX_BYTES) return { ...base, stage: 'failed', error: `${fmtBytes(f.size)} is over the 500 MB limit` };
      if (f.size === 0) return { ...base, stage: 'failed', error: 'The file is empty' };
      if (ext === 'csv') {
        inspectCsv(f).then((n) => {
          found.current[id] = n;
          // a CSV that will not net to nil is flagged when it lands
          const off = n.find((x) => x.startsWith('Out of balance'));
          if (off) setJobs((all) => all.map((j) => (j.id === id ? { ...j, warn: off } : j)));
        });
      }
      return base;
    });
    setJobs((all) => [...fresh, ...all]);
  }, [settings.freq]);

  /** assigning a period releases a job that was waiting for one */
  const setPeriod = (id: string, period: string) =>
    setJobs((all) => all.map((j) => {
      if (j.id !== id) return j;
      if (j.stage === 'needsPeriod' && period) return { ...j, period, stage: j.resume ?? 'validating', pct: 0, resume: undefined };
      return { ...j, period };
    }));

  const remove = (id: string) => setJobs((all) => all.filter((j) => j.id !== id));
  const clearFinished = () => setJobs((all) => all.filter((j) => j.stage !== 'ready' && j.stage !== 'failed'));

  return { settings, setSettings, jobs, add, setPeriod, remove, clearFinished };
}

export type TbUploads = ReturnType<typeof useTbUploads>;

/* ============================== look ============================== */

const C = {
  ink: '#232C42', ink2: '#414B62', mute: '#7A84A0', faint: '#9AA3BA',
  blue: '#2563EB', blueL: '#3B82F6', green: '#15803D', greenL: '#16A34A', amber: '#B45309', red: '#B42318',
  panel: '#ECEFF6', card: '#F5F7FC', line: '#DCE0EB',
};

const STAGES: { key: TbStage; label: string }[] = [
  { key: 'uploading', label: 'Upload' },
  { key: 'validating', label: 'Validate' },
  { key: 'mapping', label: 'Map to COA' },
  { key: 'ready', label: 'Ready' },
];

const STAGE_TXT: Record<TbStage, string> = {
  uploading: 'Uploading', validating: 'Validating balances', mapping: 'Mapping to chart of accounts',
  needsPeriod: 'Waiting for a period', ready: 'Ready', failed: 'Failed',
};

const stageIdx = (j: TbJob) =>
  j.stage === 'needsPeriod' ? 1 : j.stage === 'failed' ? -1 : STAGES.findIndex((s) => s.key === j.stage);

/** overall progress of one job across all four stages, 0–1 */
const jobProgress = (j: TbJob) => {
  if (j.stage === 'ready') return 1;
  if (j.stage === 'failed') return 0;
  const i = stageIdx(j);
  const w = [0.55, 0.25, 0.2];
  return w.slice(0, i).reduce((a, b) => a + b, 0) + (w[i] ?? 0) * (j.pct / 100);
};

const tone = (j: TbJob) =>
  j.stage === 'failed' ? C.red : j.stage === 'ready' ? (j.warn ? C.amber : C.green) : j.stage === 'needsPeriod' ? C.amber : C.blue;

const ICON = {
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  cloud: 'M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1 .5 7.97M12 12v8M9 15l3-3 3 3',
  check: 'M20 6L9 17l-5-5',
  x: 'M6 6l12 12M18 6 6 18',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  stack: 'M12 3 3 7.5l9 4.5 9-4.5L12 3zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5',
  cal: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
};

const Svg = ({ d, size = 14, w = 2, color = 'currentColor' }: { d: string; size?: number; w?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <path d={d} />
  </svg>
);

/** the next date a TB falls due under the cadence — period end plus N business days */
export const nextDue = (s: TbSettings, today = new Date()) => {
  const step = s.freq === 'Monthly' ? 1 : s.freq === 'Quarterly' ? 3 : s.freq === 'Half-yearly' ? 6 : 12;
  for (let k = 0; k < 30; k++) {
    // period ends are month-ends on the cadence's grid (calendar year)
    const d = new Date(today.getFullYear(), today.getMonth() - 1 + k, 1);
    if ((d.getMonth() + 1) % step !== 0) continue;
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const due = new Date(end);
    let n = 0;
    while (n < s.dueDay) { due.setDate(due.getDate() + 1); if (due.getDay() % 6 !== 0) n++; }
    if (due >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      const p = s.freq === 'Monthly' ? `${MONTHS[end.getMonth()]} '${String(end.getFullYear()).slice(2)}`
        : s.freq === 'Quarterly' ? `Q${Math.ceil((end.getMonth() + 1) / 3)} ${end.getFullYear()}`
        : s.freq === 'Half-yearly' ? `H${end.getMonth() < 6 ? 1 : 2} ${end.getFullYear()}` : `FY ${end.getFullYear()}`;
      return { period: p, date: due.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) };
    }
  }
  return null;
};

/* ============================== settings ============================== */

export function TbSettingsPanel({ up, onClose }: { up: TbUploads; onClose: () => void }) {
  const { settings: s, setSettings } = up;
  const due = nextDue(s);
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 129 }} onClick={onClose} />
      <div
        role="dialog" aria-label="Trial balance upload settings"
        style={{ position: 'absolute', top: '40px', right: 0, zIndex: 130, width: '330px', background: '#F1F3F9', border: '1px solid #D3D9E6', borderRadius: '14px', boxShadow: '0 18px 40px rgba(45,54,80,.28)', padding: '14px', animation: 'fcPop .16s ease' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{ color: C.blue }}><Svg d={ICON.gear} size={15} w={1.8} /></span>
          <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: C.ink }}>TB upload settings</span>
        </div>
        <div style={{ fontSize: '11px', color: C.mute, marginBottom: '12px' }}>How often entity trial balances are ingested each close.</div>

        <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: C.faint, marginBottom: '6px' }}>Ingestion frequency</div>
        <div role="radiogroup" aria-label="Ingestion frequency" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {TB_FREQS.map((f) => {
            const on = s.freq === f;
            return (
              <button
                key={f} type="button" role="radio" aria-checked={on} className="fc-h fc-btn"
                onClick={() => setSettings({ ...s, freq: f })}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                  ...(on ? { background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.45)', color: C.ink } : { background: '#E4E8F0', border: '1px solid #D3D9E6', color: '#65708C' }),
                }}
              >
                <span style={{ flex: 'none', width: '14px', height: '14px', borderRadius: '50%', boxSizing: 'border-box', background: '#fff', border: on ? `4.5px solid ${C.blueL}` : '2px solid #9AA3BA' }} />
                {f}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: C.faint, margin: '14px 0 6px' }}>Due after period end</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12px', color: C.ink2 }}>
          <select
            value={s.dueDay} onChange={(e) => setSettings({ ...s, dueDay: Number(e.target.value) })}
            style={{ height: '32px', borderRadius: '9px', border: '1px solid #CBD2E0', background: '#E4E8F0', padding: '0 9px', fontSize: '12px', fontWeight: 700, color: '#333D55', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 10, 15].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          business day{s.dueDay === 1 ? '' : 's'}
        </label>

        {due && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '14px', padding: '9px 11px', borderRadius: '10px', background: 'rgba(59,130,246,.07)', border: '1px solid rgba(59,130,246,.22)' }}>
            <span style={{ color: C.blue }}><Svg d={ICON.cal} size={15} w={1.8} /></span>
            <span style={{ flex: 1, fontSize: '11.5px', color: C.ink2, lineHeight: 1.4 }}>
              Next TB due <b style={{ color: C.ink }}>{due.date}</b> for <b style={{ color: C.ink }}>{due.period}</b>
            </span>
          </div>
        )}
      </div>
    </>
  );
}

/* ============================== status button ============================== */

/**
 * The toolbar icon that reports on the batch: a ring fills as the TBs move
 * through the pipeline, a badge counts what is still running, and the icon
 * settles to a check (or a warning) when everything is through.
 */
export function TbStatusButton({ up, onOpen }: { up: TbUploads; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const { jobs } = up;
  const running = jobs.filter((j) => j.stage === 'uploading' || j.stage === 'validating' || j.stage === 'mapping');
  const waiting = jobs.filter((j) => j.stage === 'needsPeriod');
  const failed = jobs.filter((j) => j.stage === 'failed');
  const live = jobs.filter((j) => j.stage !== 'failed');
  const prog = live.length ? live.reduce((s, j) => s + jobProgress(j), 0) / live.length : 0;
  const state = running.length ? 'run' : waiting.length || failed.length ? 'attn' : jobs.length ? 'done' : 'idle';
  const col = state === 'run' ? C.blueL : state === 'attn' ? '#D97706' : state === 'done' ? C.greenL : '#9AA3BA';
  const R = 14;
  const CIRC = 2 * Math.PI * R;

  const title = state === 'run'
    ? `Processing ${running.length} trial balance${running.length === 1 ? '' : 's'} · ${Math.round(prog * 100)}%`
    : state === 'attn' ? `${waiting.length + failed.length} upload${waiting.length + failed.length === 1 ? ' needs' : 's need'} attention`
    : state === 'done' ? 'All trial balances processed' : 'No uploads yet';

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button" className="fc-h fc-btn" onClick={() => setOpen((v) => !v)}
        title={title} aria-label={`Upload status — ${title}`} aria-expanded={open}
        style={{
          position: 'relative', width: '36px', height: '32px', borderRadius: '9px', display: 'grid', placeItems: 'center',
          background: '#ECEFF6', border: `1px solid ${state === 'idle' ? '#CBD2E0' : `${col}66`}`, color: state === 'idle' ? '#65708C' : col,
          boxShadow: '1px 1px 3px rgba(166,175,195,.5),-1px -1px 3px rgba(255,255,255,.9)',
        }}
      >
        {/* progress ring */}
        {state !== 'idle' && (
          <svg width="32" height="32" viewBox="0 0 32 32" style={{ position: 'absolute', inset: 0, margin: 'auto', transform: 'rotate(-90deg)' }} aria-hidden>
            <circle cx="16" cy="16" r={R} fill="none" strokeWidth="2.2" style={{ stroke: `${col}26` }} />
            <circle
              cx="16" cy="16" r={R} fill="none" strokeWidth="2.2" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - (state === 'run' ? prog : 1))}
              style={{ stroke: col, transition: 'stroke-dashoffset .25s linear' }}
            />
          </svg>
        )}
        <span style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
          <Svg d={state === 'done' ? ICON.check : state === 'attn' ? ICON.alert : ICON.stack} size={state === 'done' ? 13 : 14} w={state === 'done' ? 2.6 : 1.9} />
        </span>
        {(running.length > 0 || waiting.length + failed.length > 0) && (
          <span
            style={{
              position: 'absolute', top: '-6px', right: '-6px', minWidth: '16px', height: '16px', padding: '0 4px', boxSizing: 'border-box',
              borderRadius: '999px', background: col, color: '#fff', fontSize: '9.5px', fontWeight: 700, display: 'grid', placeItems: 'center',
              boxShadow: '0 0 0 2px #ECEFF6', animation: state === 'run' ? 'fcPulse 1.6s ease-in-out infinite' : undefined,
            }}
          >
            {running.length || waiting.length + failed.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 129 }} onClick={() => setOpen(false)} />
          <div
            role="dialog" aria-label="Upload activity"
            style={{ position: 'absolute', top: '40px', right: 0, zIndex: 130, width: '380px', background: '#F1F3F9', border: '1px solid #D3D9E6', borderRadius: '14px', boxShadow: '0 18px 40px rgba(45,54,80,.28)', overflow: 'hidden', animation: 'fcPop .16s ease' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px 10px', borderBottom: `1px solid ${C.line}` }}>
              <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: C.ink }}>Upload activity</span>
              {jobs.some((j) => j.stage === 'ready' || j.stage === 'failed') && (
                <button type="button" className="fc-btn" onClick={up.clearFinished} style={{ fontSize: '10.5px', fontWeight: 700, color: C.mute }}>Clear finished</button>
              )}
            </div>
            {state === 'run' && (
              <div style={{ padding: '10px 14px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: C.mute, marginBottom: '5px' }}>
                  <span>Batch progress</span><span style={{ color: C.blue }}>{Math.round(prog * 100)}%</span>
                </div>
                <Bar pct={prog * 100} color={C.blueL} />
              </div>
            )}
            <div style={{ maxHeight: '320px', overflow: 'auto', padding: '8px 8px 10px' }}>
              {jobs.length === 0 && (
                <div style={{ padding: '22px 12px', textAlign: 'center', fontSize: '11.5px', color: C.faint, fontStyle: 'italic' }}>
                  Nothing uploaded this session.
                </div>
              )}
              {jobs.map((j) => {
                const t = tone(j);
                return (
                  <div key={j.id} style={{ display: 'flex', gap: '10px', padding: '8px 8px', borderRadius: '10px' }}>
                    <FileBadge ext={j.ext} color={t} small />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.name}</span>
                        <span style={{ flex: 'none', fontSize: '10.5px', fontWeight: 700, color: t }}>
                          {j.stage === 'ready' ? (j.warn ? 'Ready · check' : 'Ready') : j.stage === 'failed' ? 'Failed' : j.stage === 'needsPeriod' ? 'Needs period' : `${Math.round(jobProgress(j) * 100)}%`}
                        </span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: C.mute, margin: '2px 0 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {j.period || 'No period'} · {j.stage === 'failed' ? j.error : j.warn && j.stage === 'ready' ? j.warn : STAGE_TXT[j.stage]}
                      </div>
                      {j.stage !== 'failed' && <Bar pct={jobProgress(j) * 100} color={t} thin still={j.stage === 'needsPeriod'} />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.line}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="fc-h fc-btn" onClick={() => { setOpen(false); onOpen(); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: '#3B5BDB' }}>
                Open uploader <Svg d="M9 6l6 6-6 6" size={12} w={2.4} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================== pieces ============================== */

export function Bar({ pct, color, thin, still }: { pct: number; color: string; thin?: boolean; still?: boolean }) {
  // the sheen only plays while something is moving — a job waiting on a period holds still
  const running = !still && pct > 0 && pct < 100;
  return (
    <div style={{ position: 'relative', height: thin ? '4px' : '6px', borderRadius: '999px', background: '#DDE2EE', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', borderRadius: '999px', background: `linear-gradient(90deg,${color}cc,${color})`, transition: 'width .15s linear' }} />
      {running && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '30%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent)', animation: 'fcSweep 1.3s ease-in-out infinite' }} />
      )}
    </div>
  );
}

export function FileBadge({ ext, color, small }: { ext: string; color: string; small?: boolean }) {
  const s = small ? 30 : 40;
  return (
    <span
      style={{
        flex: 'none', position: 'relative', width: `${s}px`, height: `${s + (small ? 4 : 6)}px`, borderRadius: small ? '6px' : '8px',
        background: '#fff', border: `1px solid ${color}40`, boxShadow: '0 1px 3px rgba(40,50,80,.08)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: small ? '4px' : '6px', boxSizing: 'border-box', overflow: 'hidden',
      }}
    >
      {/* folded corner */}
      <span style={{ position: 'absolute', top: 0, right: 0, width: small ? '9px' : '12px', height: small ? '9px' : '12px', background: `linear-gradient(225deg,#ECEFF6 50%,${color}26 50%)` }} />
      <span style={{ fontSize: small ? '7.5px' : '9px', fontWeight: 800, letterSpacing: '.4px', color: '#fff', background: color, padding: small ? '1px 3px' : '2px 4px', borderRadius: '3px', textTransform: 'uppercase' }}>
        {ext || '?'}
      </span>
    </span>
  );
}

/* ============================== the uploader ============================== */

export function TbUploadModal({ up, onClose, onSettings }: { up: TbUploads; onClose: () => void; onSettings: () => void }) {
  const { jobs, settings } = up;
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const periods = periodsFor(settings.freq);
  const due = nextDue(settings);

  const pick = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.xlsx,.xls,.csv';
    inp.multiple = true;
    inp.onchange = () => up.add(inp.files ? [...inp.files] : []);
    inp.click();
  };

  const running = jobs.filter((j) => j.stage === 'uploading' || j.stage === 'validating' || j.stage === 'mapping').length;
  const ready = jobs.filter((j) => j.stage === 'ready').length;
  const attn = jobs.filter((j) => j.stage === 'needsPeriod' || j.stage === 'failed').length;

  return (
    <SidePanel
      id="upload-tb" title="Upload trial balances" icon={ICON.cloud} onClose={onClose} width={540}
      subtitle="Drop one TB per period — each is validated and mapped to the chart of accounts on import. Uploads carry on if you close the panel."
    >
          {/* cadence strip */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '11px', background: C.card, border: `1px solid ${C.line}` }}>
            <span style={{ color: C.blue }}><Svg d={ICON.cal} size={15} w={1.8} /></span>
            <span style={{ flex: 1, minWidth: 0, fontSize: '12px', lineHeight: 1.5, color: C.ink2 }}>
              <b style={{ color: C.ink }}>{settings.freq}</b> ingestion · due business day {settings.dueDay} after period end
              {due && <> · next <b style={{ color: C.ink }}>{due.period}</b> by {due.date}</>}
            </span>
            <button
              type="button" className="fc-h fc-btn" onClick={onSettings}
              style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#3B5BDB', whiteSpace: 'nowrap' }}
            >
              <Svg d={ICON.gear} size={12} w={1.9} /> Settings
            </button>
          </div>

          {/* drop zone */}
          <div
            onDragEnter={(e) => { e.preventDefault(); depth.current += 1; setOver(true); }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDragLeave={(e) => { e.preventDefault(); depth.current -= 1; if (depth.current <= 0) { depth.current = 0; setOver(false); } }}
            onDrop={(e) => { e.preventDefault(); depth.current = 0; setOver(false); up.add([...e.dataTransfer.files]); }}
            onClick={pick}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}
            aria-label="Choose trial balance files, or drop them here"
            style={{
              position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              padding: jobs.length ? '22px 20px' : '38px 20px', borderRadius: '16px', transition: 'all .16s ease',
              border: `2px dashed ${over ? C.blueL : '#C3CADB'}`,
              background: over ? 'rgba(59,130,246,.08)' : 'linear-gradient(180deg,#F5F7FC,#EEF1F8)',
              boxShadow: over ? '0 0 0 5px rgba(59,130,246,.12)' : 'inset 2px 2px 6px rgba(166,175,195,.25)',
            }}
          >
            <span
              style={{
                width: '52px', height: '52px', borderRadius: '50%', display: 'grid', placeItems: 'center', color: over ? '#fff' : C.blue,
                background: over ? 'linear-gradient(150deg,#3B82F6,#2563EB)' : 'rgba(59,130,246,.1)',
                transform: over ? 'translateY(-3px) scale(1.06)' : 'none', transition: 'all .16s ease',
                boxShadow: over ? '0 8px 20px rgba(37,99,235,.35)' : 'none',
              }}
            >
              <Svg d={ICON.upload} size={22} w={2} />
            </span>
            <div style={{ marginTop: '12px', fontSize: '14px', fontWeight: 700, color: C.ink }}>
              {over ? 'Release to upload' : <>Drag &amp; drop trial balances here, or <span style={{ color: '#3B5BDB', textDecoration: 'underline', textUnderlineOffset: '3px' }}>browse</span></>}
            </div>
            <div style={{ marginTop: '5px', fontSize: '11.5px', color: C.faint }}>
              Several files at once · .xlsx, .xls, .csv · up to 500 MB each · period read from the file name
            </div>
          </div>

          {/* summary */}
          {jobs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: C.faint }}>
                {jobs.length} file{jobs.length === 1 ? '' : 's'}
              </span>
              {running > 0 && <Pill color={C.blue}>{running} processing</Pill>}
              {ready > 0 && <Pill color={C.green}>{ready} ready</Pill>}
              {attn > 0 && <Pill color={C.amber}>{attn} need{attn === 1 ? 's' : ''} attention</Pill>}
            </div>
          )}

          {/* files */}
          {jobs.map((j) => <JobRow key={j.id} j={j} periods={periods} up={up} />)}
        <PanelFooter>
          <span style={{ flex: 1, fontSize: '11px', color: C.faint, fontStyle: 'italic' }}>
            {running ? 'You can close this panel — uploads carry on and the status icon tracks them.' : 'Ready TBs load into the trial balance for their period.'}
          </span>
          <button
            type="button" className="fc-h fc-btn" onClick={onClose}
            style={{ height: '34px', padding: '0 18px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', boxShadow: '0 3px 12px rgba(37,99,235,.32)' }}
          >
            {running ? 'Continue in background' : 'Done'}
          </button>
        </PanelFooter>
    </SidePanel>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 700, color, background: `${color}14`, border: `1px solid ${color}33`, padding: '2px 9px', borderRadius: '999px' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
      {children}
    </span>
  );
}

function JobRow({ j, periods, up }: { j: TbJob; periods: string[]; up: TbUploads }) {
  const t = tone(j);
  const si = stageIdx(j);
  const pctAll = Math.round(jobProgress(j) * 100);
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 14px', borderRadius: '13px', background: '#fff',
        border: `1px solid ${j.stage === 'failed' ? 'rgba(180,35,24,.3)' : j.stage === 'needsPeriod' ? 'rgba(217,119,6,.4)' : '#E1E5EE'}`,
        boxShadow: '0 1px 4px rgba(40,50,80,.06)', animation: 'fcPop .2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <FileBadge ext={j.ext} color={t} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={j.name}>{j.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '3px', fontSize: '11.5px', color: C.mute, flexWrap: 'wrap' }}>
            <span>{fmtBytes(j.size)}</span>
            <span style={{ color: '#CBD2E0' }}>•</span>
            <span style={{ fontWeight: 700, color: t }}>
              {j.stage === 'failed' ? 'Failed' : STAGE_TXT[j.stage]}
            </span>
          </div>
        </div>

        {/* period */}
        {j.stage !== 'failed' && (
          <label style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: j.period ? C.faint : C.amber }}>Period</span>
            <select
              value={j.period} onChange={(e) => up.setPeriod(j.id, e.target.value)}
              disabled={j.stage === 'ready'}
              aria-label={`Period for ${j.name}`}
              style={{
                height: '30px', minWidth: '112px', borderRadius: '8px', padding: '0 8px', fontFamily: 'inherit', fontSize: '12px', fontWeight: 700,
                color: j.period ? '#333D55' : C.amber, cursor: j.stage === 'ready' ? 'default' : 'pointer',
                background: j.period ? '#F1F3F9' : 'rgba(245,158,11,.1)', border: `1px solid ${j.period ? '#CBD2E0' : 'rgba(217,119,6,.55)'}`,
              }}
            >
              <option value="">Select…</option>
              {j.period && !periods.includes(j.period) && <option value={j.period}>{j.period}</option>}
              {periods.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        )}

        <button
          type="button" className="fc-h fc-btn" onClick={() => up.remove(j.id)}
          title={j.stage === 'ready' || j.stage === 'failed' ? 'Remove from the list' : 'Cancel this upload'}
          aria-label={`Remove ${j.name}`}
          style={{ flex: 'none', width: '28px', height: '28px', borderRadius: '8px', display: 'grid', placeItems: 'center', color: C.faint, background: '#F1F3F9' }}
        >
          <Svg d={ICON.x} size={13} w={2.2} />
        </button>
      </div>

      {j.stage === 'failed' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', fontWeight: 600, color: C.red }}>
          <Svg d={ICON.alert} size={13} w={2} /> {j.error}
        </div>
      ) : (
        <>
          {/* stage track */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {STAGES.map((s, i) => {
              const done = j.stage === 'ready' || i < si;
              const cur = i === si && j.stage !== 'ready';
              const c = done ? (j.stage === 'ready' && j.warn ? C.amber : C.greenL) : cur ? (j.stage === 'needsPeriod' ? '#D97706' : C.blueL) : '#C3CADB';
              return (
                <React.Fragment key={s.key}>
                  {i > 0 && <span style={{ flex: 1, height: '2px', borderRadius: '2px', background: done || cur ? `${c}88` : '#DDE2EE' }} />}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 700, color: done || cur ? c : C.faint, whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        width: '16px', height: '16px', borderRadius: '50%', display: 'grid', placeItems: 'center', boxSizing: 'border-box',
                        background: done ? c : '#fff', border: `2px solid ${c}`, color: '#fff',
                        animation: cur && j.stage !== 'needsPeriod' ? 'fcPulse 1.4s ease-in-out infinite' : undefined,
                      }}
                    >
                      {done && <Svg d={ICON.check} size={9} w={3.4} />}
                    </span>
                    {s.label}
                  </span>
                </React.Fragment>
              );
            })}
          </div>

          {/* bar */}
          {j.stage !== 'ready' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1 }}><Bar pct={jobProgress(j) * 100} color={t} still={j.stage === 'needsPeriod'} /></div>
              <span style={{ flex: 'none', width: '34px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: C.mute, fontVariantNumeric: 'tabular-nums' }}>{pctAll}%</span>
            </div>
          )}

          {j.stage === 'needsPeriod' && (
            <div style={{ fontSize: '11.5px', color: C.amber, fontWeight: 600 }}>
              No period in the file name — choose the period this TB belongs to and processing will continue.
            </div>
          )}

          {(j.stage === 'ready' || j.warn) && (j.notes.length > 0 || j.warn) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {j.notes.map((n) => (
                <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 600, color: '#0B5A54', background: 'rgba(15,118,110,.08)', border: '1px solid rgba(15,118,110,.22)', padding: '2px 8px', borderRadius: '7px' }}>
                  <Svg d={ICON.check} size={10} w={3} /> {n}
                </span>
              ))}
              {j.warn && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 600, color: C.amber, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(217,119,6,.3)', padding: '2px 8px', borderRadius: '7px' }}>
                  <Svg d={ICON.alert} size={10} w={2.4} /> {j.warn}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
