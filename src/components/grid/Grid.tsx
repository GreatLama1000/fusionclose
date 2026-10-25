import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * The application's table toolkit — every data table gets the same column
 * behaviour, following the design's generic table builder (`mkTable()`,
 * docs/design/Fusion Close.dc.html line 5757, column menu markup 1523):
 *
 *  - a ⋮ menu in the top-right of each header: sort, filter (text or a value
 *    checklist), freeze panes up to the column, width (fit / reset), rename
 *  - drag a header to move the column; drag its right edge to resize it
 *  - equal row heights — text stays on one line and ends in an ellipsis; a
 *    click wraps that cell over as many lines as it needs, and the row grows
 *  - layout (order, widths, freeze, sort, names) is remembered per table
 *
 * A screen keeps its own row markup: it asks `useGrid` for the ordered
 * columns and the filtered / sorted rows, renders `<GridHead>`, and styles
 * each cell with `g.td(col)`.
 */

export type GridCol = {
  key: string;
  label: string;
  /** default width in px */
  w: number;
  align?: 'left' | 'right' | 'center';
  /** sort numerically — "(1,234)" reads as negative */
  num?: boolean;
  /** set false for action / checkbox-like columns */
  sort?: boolean;
  filter?: boolean;
  /** what the column means — shown on the header's hover and as an ⓘ mark */
  info?: string;
};

type Filter = { q: string; vals: string[] | null };
type Saved = { order?: string[]; widths?: Record<string, number>; freeze?: string | null; sort?: { key: string; dir: 'asc' | 'desc' } | null; names?: Record<string, string> };

/** the single height every body row shares, unless a cell is opened up */
export const ROW_H = 34;

const load = (id: string): Saved => {
  try { return JSON.parse(localStorage.getItem(`fc-grid:${id}`) ?? '{}') as Saved; } catch { return {}; }
};
const save = (id: string, s: Saved) => {
  try { localStorage.setItem(`fc-grid:${id}`, JSON.stringify(s)); } catch { /* storage blocked */ }
};

export const toNum = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const t = String(v ?? '').trim();
  if (!t) return Number.NEGATIVE_INFINITY;
  const neg = t.includes('(') || t.startsWith('-');
  const n = parseFloat(t.replace(/[^0-9.]/g, ''));
  return Number.isNaN(n) ? Number.NEGATIVE_INFINITY : neg ? -n : n;
};

const str = (v: unknown) => (v == null ? '' : String(v));

export function useGrid<R>(
  id: string,
  cols: GridCol[],
  rows: R[],
  valueOf: (r: R, key: string) => unknown,
  opts: {
    /** width of a leading cell that is not a column (row checkbox, grip) */
    lead?: number;
    /** column frozen by default, by key */
    defFreeze?: string | null;
    /** a stable key per row, for remembering which cells are opened up */
    rowKey?: (r: R, i: number) => string;
    /** keep rows that belong together (a journal entry's lines) in order when sorting */
    groupOf?: (r: R) => string;
  } = {},
) {
  const saved = useMemo(() => load(id), [id]);
  const [order, setOrder] = useState<string[]>(saved.order ?? cols.map((c) => c.key));
  const [widths, setWidths] = useState<Record<string, number>>(saved.widths ?? {});
  const [freeze, setFreeze] = useState<string | null>(saved.freeze !== undefined ? saved.freeze : opts.defFreeze ?? null);
  const [sort, setSort] = useState<Saved['sort']>(saved.sort ?? null);
  const [names, setNames] = useState<Record<string, string>>(saved.names ?? {});
  const [filters, setFilters] = useState<Record<string, Filter>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(null);
  /** the column whose heading is being renamed in place */
  const [renaming, setRenaming] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ key: string; over: string | null; side: 'l' | 'r' }>({ key: '', over: null, side: 'l' });

  useEffect(() => { save(id, { order, widths, freeze, sort, names }); }, [id, order, widths, freeze, sort, names]);

  /* columns: saved order first, then any column the screen has added since */
  const byKey = useMemo(() => Object.fromEntries(cols.map((c) => [c.key, c])), [cols]);
  const ordered = useMemo(() => {
    const seen = new Set<string>();
    const out: GridCol[] = [];
    order.forEach((k) => { if (byKey[k] && !seen.has(k)) { seen.add(k); out.push(byKey[k]); } });
    cols.forEach((c) => { if (!seen.has(c.key)) out.push(c); });
    return out.map((c) => ({ ...c, w: widths[c.key] ?? c.w, label: names[c.key] || c.label }));
  }, [order, cols, byKey, widths, names]);

  /* rows: filter, then sort (keeping groups together when asked) */
  const view = useMemo(() => {
    const fs = Object.entries(filters).filter(([, f]) => f.q.trim() || f.vals);
    let out = rows.filter((r) => fs.every(([k, f]) => {
      const v = str(valueOf(r, k));
      if (f.vals && !f.vals.includes(v)) return false;
      return !f.q.trim() || v.toLowerCase().includes(f.q.trim().toLowerCase());
    }));
    if (sort && byKey[sort.key]) {
      const c = byKey[sort.key];
      const cmp = (a: R, b: R) => {
        const x = c.num ? toNum(valueOf(a, c.key)) : str(valueOf(a, c.key)).toLowerCase();
        const y = c.num ? toNum(valueOf(b, c.key)) : str(valueOf(b, c.key)).toLowerCase();
        return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === 'desc' ? -1 : 1);
      };
      if (opts.groupOf) {
        // sort the groups by their first row, keep each group's own line order
        const groups = new Map<string, R[]>();
        out.forEach((r) => { const g = opts.groupOf!(r); groups.set(g, [...(groups.get(g) ?? []), r]); });
        out = [...groups.values()].sort((a, b) => cmp(a[0], b[0])).flat();
      } else out = [...out].sort(cmp);
    }
    return out;
  }, [rows, filters, sort, byKey, valueOf, opts.groupOf]);

  /* freeze panes — sticky offsets from the widths we already know */
  const lead = opts.lead ?? 0;
  const fzIdx = freeze ? ordered.findIndex((c) => c.key === freeze) : -1;
  const offsets = useMemo(() => {
    const o: Record<string, number> = {};
    let acc = lead;
    ordered.forEach((c, i) => { if (i <= fzIdx) { o[c.key] = acc; acc += c.w; } });
    return o;
  }, [ordered, fzIdx, lead]);

  const stick = (key: string, z: number, bg: string): React.CSSProperties =>
    offsets[key] !== undefined
      ? { position: 'sticky', left: `${offsets[key]}px`, zIndex: z, background: bg, ...(key === freeze ? { boxShadow: '6px 0 10px -8px rgba(60,70,100,.45)' } : null) }
      : {};

  const widthCss = (w: number): React.CSSProperties => ({ width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px` });

  const cellKey = (rk: string, ck: string) => `${rk}\u0000${ck}`;

  return {
    id,
    cols: ordered,
    rows: view,
    total: rows.length,
    lead,
    sort, filters, freeze, names, menu, drag, renaming,
    setSort, setFilters, setFreeze, setNames, setMenu, setDrag, setWidths, setOrder, setRenaming,
    /** the label the screen gave the column, before any rename */
    baseLabel: (key: string) => byKey[key]?.label ?? key,
    /** rename a column; an empty name restores the original */
    rename: (key: string, v: string) => setNames((n) => { const x = { ...n }; const t = v.replace(/\s+/g, ' ').trim(); if (!t || t === byKey[key]?.label) delete x[key]; else x[key] = t; return x; }),
    hasFilters: Object.values(filters).some((f) => f.q.trim() || f.vals) || !!sort,
    clearAll: () => { setFilters({}); setSort(null); },
    filterOf: (key: string) => filters[key],
    /** distinct values of a column across all rows, for the checklist */
    distinct: (key: string) => [...new Set(rows.map((r) => str(valueOf(r, key))))].sort((a, b) => (byKey[key]?.num ? toNum(a) - toNum(b) : a.localeCompare(b))),
    /** style for a body / footer cell of this column */
    td: (c: GridCol, bg = '#fff', extra?: React.CSSProperties): React.CSSProperties => ({
      ...widthCss(c.w), height: `${ROW_H}px`, boxSizing: 'border-box', padding: '0 8px', verticalAlign: 'middle',
      textAlign: c.align ?? 'left', borderBottom: '1px solid #E1E5EF', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      ...stick(c.key, 2, bg), ...extra,
    }),
    /** style for the leading (non-column) cell — frozen whenever anything is */
    leadStyle: (bg: string, extra?: React.CSSProperties): React.CSSProperties => ({
      ...widthCss(lead), boxSizing: 'border-box', height: `${ROW_H}px`, textAlign: 'center', verticalAlign: 'middle', borderBottom: '1px solid #E1E5EF',
      ...(fzIdx >= 0 ? { position: 'sticky', left: 0, zIndex: 2, background: bg } : null), ...extra,
    }),
    headStick: (key: string) => stick(key, 7, '#E4E8F0'),
    leadHeadStick: (): React.CSSProperties => (fzIdx >= 0 ? { left: 0, zIndex: 7 } : {}),
    widthCss,
    isOpen: (rk: string, ck: string) => open.has(cellKey(rk, ck)),
    toggleOpen: (rk: string, ck: string) => setOpen((s) => { const n = new Set(s); const k = cellKey(rk, ck); if (n.has(k)) n.delete(k); else n.add(k); return n; }),
    rowKey: opts.rowKey,
    /** widen a column to its longest value */
    fit: (key: string) => {
      const c = byKey[key];
      if (!c) return;
      const longest = Math.max(str(names[key] || c.label).length * 7.2 + 44, ...rows.slice(0, 500).map((r) => str(valueOf(r, key)).length * 6.6 + 24));
      setWidths((w) => ({ ...w, [key]: Math.round(Math.max(64, Math.min(640, longest))) }));
    },
    resetLayout: () => { setOrder(cols.map((c) => c.key)); setWidths({}); setFreeze(opts.defFreeze ?? null); setSort(null); setNames({}); setFilters({}); },
  };
}

export type Grid = ReturnType<typeof useGrid<any>>;

/* ============================== header ============================== */

const TH: React.CSSProperties = {
  position: 'sticky', top: 0, zIndex: 5, height: '38px', boxSizing: 'border-box', padding: '0 26px 0 10px', verticalAlign: 'middle',
  borderBottom: '1px solid #CBD2E0', borderTop: '2px solid #1B3A5C', fontSize: '9.5px', letterSpacing: '.45px', textTransform: 'uppercase',
  fontWeight: 700, background: '#E4E8F0', color: '#1B3A5C', userSelect: 'none', whiteSpace: 'nowrap',
};

/**
 * The header row. `lead` is an optional leading cell (select-all checkbox);
 * it is not a column and is never moved.
 */
export function GridHead({ g, lead, leadStyle }: { g: Grid; lead?: React.ReactNode; leadStyle?: React.CSSProperties }) {
  return (
    <>
      <tr>
        {g.lead > 0 && <th style={{ ...TH, padding: 0, textAlign: 'center', ...g.widthCss(g.lead), ...g.leadHeadStick(), ...leadStyle }}>{lead}</th>}
        {g.cols.map((c) => <HeadCell key={c.key} g={g} c={c} />)}
      </tr>
      {g.menu && <ColMenu g={g} />}
    </>
  );
}

function HeadCell({ g, c }: { g: Grid; c: GridCol }) {
  const f = g.filterOf(c.key);
  const filtered = !!f && (!!f.q.trim() || !!f.vals);
  const sorted = g.sort?.key === c.key ? g.sort.dir : null;
  const over = g.drag.over === c.key && g.drag.key !== c.key;
  const canMenu = true;
  const editing = g.renaming === c.key;
  const renamed = c.label !== g.baseLabel(c.key);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX;
    const w0 = c.w;
    const mv = (ev: MouseEvent) => g.setWidths((w) => ({ ...w, [c.key]: Math.max(52, Math.min(720, w0 + ev.clientX - x0)) }));
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); document.body.style.cursor = ''; };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
  };

  return (
    <th
      draggable={!editing}
      onDragStart={(e) => {
        if ((e.target as HTMLElement).closest('[data-nodrag]')) { e.preventDefault(); return; }
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', c.key); } catch { /* ignore */ }
        g.setDrag({ key: c.key, over: null, side: 'l' });
      }}
      onDragOver={(e) => {
        if (!g.drag.key) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        const side = e.clientX < r.left + r.width / 2 ? 'l' : 'r';
        if (g.drag.over !== c.key || g.drag.side !== side) g.setDrag({ ...g.drag, over: c.key, side });
      }}
      onDrop={(e) => {
        e.preventDefault();
        const from = g.drag.key;
        if (from && from !== c.key) {
          const keys = g.cols.map((x) => x.key).filter((k) => k !== from);
          const at = keys.indexOf(c.key) + (g.drag.side === 'r' ? 1 : 0);
          keys.splice(at, 0, from);
          g.setOrder(keys);
        }
        g.setDrag({ key: '', over: null, side: 'l' });
      }}
      onDragEnd={() => g.setDrag({ key: '', over: null, side: 'l' })}
      onContextMenu={(e) => { if (!canMenu) return; e.preventDefault(); g.setMenu({ key: c.key, x: e.clientX, y: e.clientY }); }}
      title={`${c.info ? `${c.label}: ${c.info}

` : ''}Drag to move · ⋮ for sort, filter and freeze`}
      style={{
        ...TH, ...g.widthCss(c.w), textAlign: c.align ?? 'left', cursor: 'grab',
        color: filtered || sorted ? '#3B5BDB' : TH.color,
        ...(c.align === 'right' ? { padding: '0 26px 0 8px' } : null),
        ...g.headStick(c.key),
        ...(g.drag.key === c.key ? { opacity: 0.45 } : null),
        ...(over ? { boxShadow: `inset ${g.drag.side === 'l' ? '3px' : '-3px'} 0 0 #3B82F6` } : null),
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start', overflow: 'hidden' }}>
        {editing ? (
          <HeadRename g={g} c={c} />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); g.setRenaming(c.key); }}
            title={renamed ? `Renamed from “${g.baseLabel(c.key)}” — double-click to rename` : 'Double-click to rename'}
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'text' }}
          >
            {c.label}
          </span>
        )}
        {c.info && (
          <span aria-hidden style={{ flex: 'none', display: 'inline-grid', placeItems: 'center', width: '12px', height: '12px', borderRadius: '50%', background: '#3B5BDB', color: '#fff', fontSize: '8px', fontWeight: 700, fontStyle: 'italic', textTransform: 'none' }}>i</span>
        )}
        {sorted && <span aria-label={sorted === 'asc' ? 'sorted ascending' : 'sorted descending'}>{sorted === 'asc' ? '↑' : '↓'}</span>}
        {filtered && (
          <span title="Filtered" style={{ flex: 'none', display: 'inline-grid', placeItems: 'center', width: '13px', height: '13px', borderRadius: '4px', background: '#3B5BDB', color: '#fff' }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h18l-7 9v6l-4 2v-8z" /></svg>
          </span>
        )}
      </span>
      {canMenu && (
        <button
          type="button" className="fc-btn" data-nodrag="" draggable={false}
          onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); g.setMenu(g.menu?.key === c.key ? null : { key: c.key, x: r.right, y: r.bottom + 4 }); }}
          aria-label={`Column actions for ${c.label}`} title="Sort, filter, freeze…"
          style={{
            position: 'absolute', top: '50%', right: '7px', transform: 'translateY(-50%)', width: '18px', height: '22px', borderRadius: '5px',
            display: 'grid', placeItems: 'center', color: g.menu?.key === c.key ? '#fff' : '#65708C',
            background: g.menu?.key === c.key ? '#3B5BDB' : 'transparent',
          }}
        >
          <svg width="3" height="13" viewBox="0 0 3 13" fill="currentColor" aria-hidden><circle cx="1.5" cy="1.5" r="1.5" /><circle cx="1.5" cy="6.5" r="1.5" /><circle cx="1.5" cy="11.5" r="1.5" /></svg>
        </button>
      )}
      <span
        data-nodrag="" draggable={false} onMouseDown={startResize}
        onDoubleClick={(e) => { e.stopPropagation(); g.fit(c.key); }}
        title="Drag to resize · double-click to fit"
        style={{ position: 'absolute', top: 0, right: 0, width: '6px', height: '100%', cursor: 'col-resize' }}
      />
    </th>
  );
}

/** the heading's own rename box — Enter keeps it, Esc cancels, an empty name restores the original */
function HeadRename({ g, c }: { g: Grid; c: GridCol }) {
  const [v, setV] = useState(c.label);
  const done = useRef(false);
  const finish = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    if (keep) g.rename(c.key, v);
    g.setRenaming(null);
  };
  return (
    <input
      autoFocus value={v} aria-label={`Rename column ${c.label}`}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); }}
      onBlur={() => finish(true)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      placeholder={g.baseLabel(c.key)}
      style={{
        flex: 1, minWidth: 0, height: '24px', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #3B82F6',
        boxShadow: '0 0 0 3px rgba(59,130,246,.15)', background: '#fff', padding: '0 7px', font: 'inherit', fontSize: '10.5px',
        fontWeight: 700, letterSpacing: '.3px', textTransform: 'none', color: '#232C42', outline: 'none', cursor: 'text',
      }}
    />
  );
}

/* ============================== the ⋮ menu ============================== */

function ColMenu({ g }: { g: Grid }) {
  const m = g.menu!;
  const c = g.cols.find((x) => x.key === m.key);
  const f = g.filterOf(m.key) ?? { q: '', vals: null };
  const [vq, setVq] = useState('');
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: m.x - 250, y: m.y });

  useEffect(() => {
    // keep the menu inside the window
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: Math.max(8, Math.min(m.x - r.width, window.innerWidth - r.width - 8)), y: Math.max(8, Math.min(m.y, window.innerHeight - r.height - 8)) });
  }, [m.x, m.y]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') g.setMenu(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [g]);

  if (!c) return null;
  const all = g.distinct(c.key);
  const shown = all.filter((v) => v.toLowerCase().includes(vq.trim().toLowerCase())).slice(0, 300);
  const ticked = (v: string) => !f.vals || f.vals.includes(v);
  const setF = (p: Partial<Filter>) => {
    const n = { ...f, ...p };
    g.setFilters((x) => ({ ...x, [c.key]: n }));
  };
  const toggleVal = (v: string) => {
    const cur = f.vals ?? all;
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    setF({ vals: next.length === all.length ? null : next });
  };
  const frozenHere = g.freeze === c.key;
  const idx = g.cols.findIndex((x) => x.key === c.key);

  const item: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '9px', width: '100%', padding: '7px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, color: '#333D55', textAlign: 'left' };
  const icon: React.CSSProperties = { flex: 'none', width: '16px', textAlign: 'center', color: '#65708C', fontSize: '12px' };
  const sep = <div style={{ height: '1px', background: '#D9DEE9', margin: '4px 6px' }} />;
  const close = () => g.setMenu(null);
  const MenuBtn = ({ ic, label, on, onClick, kbd }: { ic: string; label: string; on?: boolean; onClick: () => void; kbd?: string }) => (
    <button type="button" className="fc-btn fc-menu-item" onClick={onClick} style={{ ...item, ...(on ? { color: '#3B5BDB', background: 'rgba(59,130,246,.08)' } : null) }}>
      <span style={{ ...icon, ...(on ? { color: '#3B5BDB' } : null) }}>{ic}</span>{label}
      {kbd && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#9AA3BA' }}>{kbd}</span>}
    </button>
  );

  return (
    <tr style={{ display: 'contents' }}>
      <td style={{ display: 'contents' }}>
        <div style={{ position: 'fixed', inset: 0, zIndex: 950 }} onMouseDown={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
        <div
          ref={boxRef} role="menu" aria-label={`${c.label} column`} data-fc-no-cmt=""
          style={{
            position: 'fixed', left: pos.x, top: pos.y, zIndex: 951, width: '252px', maxHeight: '78vh', overflow: 'auto', background: '#F1F3F9',
            border: '1px solid #D3D9E6', borderRadius: '13px', boxShadow: '0 18px 40px rgba(45,54,80,.3)', padding: '6px',
            textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: '#333D55', cursor: 'default', textAlign: 'left', animation: 'fcPop .14s ease',
          }}
        >
          <div style={{ padding: '6px 10px 8px', borderBottom: '1px solid #D9DEE9', marginBottom: '4px' }}>
            <div style={{ fontSize: '9.5px', letterSpacing: '.6px', textTransform: 'uppercase', color: '#9AA3BA', fontWeight: 700 }}>Column</div>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#232C42' }}>{c.label}</div>
            {c.label !== g.baseLabel(c.key) && (
              <div style={{ fontSize: '10.5px', color: '#9AA3BA' }}>originally “{g.baseLabel(c.key)}”</div>
            )}
          </div>

          {/* renaming opens the editor in the heading itself */}
          <MenuBtn ic="✎" label="Rename column" kbd="double-click" onClick={() => { g.setRenaming(c.key); close(); }} />
          {c.label !== g.baseLabel(c.key) && (
            <MenuBtn ic="↺" label="Restore original name" onClick={() => { g.rename(c.key, ''); close(); }} />
          )}
          {sep}

          {c.sort !== false && (
            <>
              <MenuBtn ic="↑" label={c.num ? 'Sort smallest to largest' : 'Sort A → Z'} on={g.sort?.key === c.key && g.sort.dir === 'asc'} onClick={() => { g.setSort({ key: c.key, dir: 'asc' }); close(); }} />
              <MenuBtn ic="↓" label={c.num ? 'Sort largest to smallest' : 'Sort Z → A'} on={g.sort?.key === c.key && g.sort.dir === 'desc'} onClick={() => { g.setSort({ key: c.key, dir: 'desc' }); close(); }} />
              {g.sort?.key === c.key && <MenuBtn ic="✕" label="Clear sort" onClick={() => { g.setSort(null); close(); }} />}
              {sep}
            </>
          )}

          {c.filter !== false && (
            <div style={{ padding: '4px 8px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: '#65708C' }}>Filter</span>
                {(f.q || f.vals) && (
                  <button type="button" className="fc-btn" onClick={() => g.setFilters((x) => { const n = { ...x }; delete n[c.key]; return n; })} style={{ marginLeft: 'auto', fontSize: '10.5px', fontWeight: 700, color: '#3B5BDB' }}>Clear</button>
                )}
              </div>
              <input
                autoFocus value={f.q} onChange={(e) => setF({ q: e.target.value })} placeholder="Contains…"
                onKeyDown={(e) => { if (e.key === 'Enter') close(); }}
                style={{ width: '100%', boxSizing: 'border-box', height: '28px', borderRadius: '7px', border: '1px solid #CBD2E0', background: '#fff', padding: '0 8px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' }}
              />
              {all.length > 1 && all.length <= 400 && (
                <div style={{ marginTop: '7px', border: '1px solid #D9DEE9', borderRadius: '8px', background: '#fff' }}>
                  {all.length > 8 && (
                    <input value={vq} onChange={(e) => setVq(e.target.value)} placeholder="Search values…"
                      style={{ width: '100%', boxSizing: 'border-box', height: '26px', border: 0, borderBottom: '1px solid #E4E8F0', borderRadius: '8px 8px 0 0', padding: '0 8px', fontSize: '11.5px', fontFamily: 'inherit', outline: 'none' }} />
                  )}
                  <div style={{ maxHeight: '170px', overflow: 'auto', padding: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '3px 5px', fontSize: '11.5px', fontWeight: 700, color: '#232C42', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!f.vals} onChange={() => setF({ vals: f.vals ? null : [] })} style={{ accentColor: '#3B5BDB' }} />
                      Select all <span style={{ marginLeft: 'auto', fontWeight: 400, color: '#9AA3BA' }}>{all.length}</span>
                    </label>
                    {shown.map((v) => (
                      <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '3px 5px', fontSize: '11.5px', color: '#414B62', cursor: 'pointer' }}>
                        <input type="checkbox" checked={ticked(v)} onChange={() => toggleVal(v)} style={{ accentColor: '#3B5BDB' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v === '' ? '(blank)' : v}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {sep}

          <MenuBtn ic="‖" label={frozenHere ? 'Frozen up to here' : 'Freeze panes up to this column'} on={frozenHere} onClick={() => { g.setFreeze(c.key); close(); }} />
          {g.freeze && <MenuBtn ic="✕" label="Unfreeze panes" onClick={() => { g.setFreeze(null); close(); }} />}
          {sep}
          <MenuBtn ic="↔" label="Fit width to contents" onClick={() => { g.fit(c.key); close(); }} />
          <MenuBtn ic="⇤" label="Reset width" onClick={() => { g.setWidths((w) => { const n = { ...w }; delete n[c.key]; return n; }); close(); }} />
          {idx > 0 && <MenuBtn ic="←" label="Move left" onClick={() => { const k = g.cols.map((x) => x.key); [k[idx - 1], k[idx]] = [k[idx], k[idx - 1]]; g.setOrder(k); }} />}
          {idx < g.cols.length - 1 && <MenuBtn ic="→" label="Move right" onClick={() => { const k = g.cols.map((x) => x.key); [k[idx + 1], k[idx]] = [k[idx], k[idx + 1]]; g.setOrder(k); }} />}
          {sep}
          <MenuBtn ic="⟲" label="Reset table layout" onClick={() => { g.resetLayout(); close(); }} />
        </div>
      </td>
    </tr>
  );
}

/* ============================== cells ============================== */

/**
 * Read-only text in a cell: one line with an ellipsis; click to wrap it over
 * as many lines as it needs (the row grows), click again to fold it back.
 */
export function Clip({ g, rk, ck, children, style, title }: {
  g: Grid; rk: string; ck: string; children: React.ReactNode; style?: React.CSSProperties; title?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [cut, setCut] = useState(false);
  const opened = g.isOpen(rk, ck);
  useEffect(() => {
    const el = ref.current;
    if (el && !opened) setCut(el.scrollWidth > el.clientWidth + 1);
  });
  const can = cut || opened;
  return (
    <span
      ref={ref}
      onClick={can ? (e) => { e.stopPropagation(); g.toggleOpen(rk, ck); } : undefined}
      title={can ? (opened ? 'Click to fold back to one line' : `${title ?? (typeof children === 'string' ? children : '')}\n— click to show in full`) : title}
      style={{
        display: 'block', maxWidth: '100%',
        ...(opened
          ? { whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.45, padding: '7px 0', cursor: 'zoom-out' }
          : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: can ? 'zoom-in' : 'inherit' }),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Editable remarks: a one-line field with an ellipsis at rest; while it holds
 * the caret it becomes a wrapping box that grows with the text.
 */
export function GrowText({ value, onChange, placeholder, style, label, list }: {
  value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties; label?: string; list?: string;
}) {
  const [editing, setEditing] = useState(false);
  const ta = useRef<HTMLTextAreaElement | null>(null);
  const fit = () => { const el = ta.current; if (el) { el.style.height = '0px'; el.style.height = `${Math.max(26, el.scrollHeight + 2)}px`; } };
  useEffect(() => { if (editing) { fit(); ta.current?.focus(); const n = ta.current?.value.length ?? 0; ta.current?.setSelectionRange(n, n); } }, [editing]);
  useEffect(() => { if (editing) fit(); }, [value, editing]);
  const base: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #D6DBE8', borderRadius: '6px',
    fontFamily: 'inherit', fontSize: '10.5px', color: '#333D55', padding: '0 6px', outline: 'none', ...style,
  };
  if (!editing) {
    return (
      <input
        value={value} placeholder={placeholder} aria-label={label} list={list} readOnly={!list}
        onFocus={() => { if (!list) setEditing(true); }}
        onChange={(e) => onChange(e.target.value)}
        title={value || undefined}
        style={{ ...base, height: '26px', textOverflow: 'ellipsis', cursor: 'text' }}
      />
    );
  }
  return (
    <textarea
      ref={ta} value={value} placeholder={placeholder} aria-label={label} rows={1}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur(); }}
      style={{ ...base, display: 'block', resize: 'none', overflow: 'hidden', lineHeight: 1.45, padding: '4px 6px', margin: '4px 0', border: '1px solid #3B82F6', boxShadow: '0 0 0 3px rgba(59,130,246,.12)' }}
    />
  );
}
