import React, { useMemo, useState } from 'react';

/**
 * The two deliverables reachable from the Reporting header, ported from
 * docs/design/Fusion Close.dc.html:
 *
 *  - Word preview     (markup 590–604)  — the consolidated financial statements,
 *                                          openable and editable in MS Word
 *  - Working Note     (markup 606–700)  — an embedded MS Excel workbook whose
 *                                          cells link to footnotes and statement lines
 *
 * "Open in MS Word" / "Open in desktop Excel" emit an Office-readable HTML
 * document. Word and Excel both open these natively and they stay fully
 * editable — no server round-trip and no third-party writer library.
 */

const officeBlob = (html: string, mime: string, name: string) => {
  const doc = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${name}</title></head><body>${html}</body></html>`;
  const url = URL.createObjectURL(new Blob(['﻿', doc], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

/* ========================= Word preview ========================= */

export type WordDoc = {
  title: string;
  meta: string;
  statement: { title: string; sub: string; cols: string[]; rows: { label: string; depth: number; vals: string[]; strong?: boolean; blank?: boolean }[] };
  notes: { heading: string; items: { title: string; body: string }[] }[];
};

export function WordPreview({ doc, onClose }: { doc: WordDoc; onClose: () => void }) {
  const html = useMemo(() => {
    const th = doc.statement.cols.map((c) => `<th style="border-bottom:1px solid #999;padding:5px 8px;text-align:right;font-size:9pt">${c}</th>`).join('');
    const body = doc.statement.rows.map((r) => {
      const pad = 8 + r.depth * 14;
      const cells = r.blank ? doc.statement.cols.map(() => '<td></td>').join('')
        : r.vals.map((v) => `<td style="padding:3px 8px;text-align:right;font-size:10pt${r.strong ? ';font-weight:bold' : ''}">${v}</td>`).join('');
      return `<tr><td style="padding:3px 8px;padding-left:${pad}px;font-size:10pt${r.strong ? ';font-weight:bold' : ''}">${r.label}</td>${cells}</tr>`;
    }).join('');
    const notes = doc.notes.map((sec) => `
      <h2 style="font-family:Cambria,serif;font-size:13pt;margin:18pt 0 6pt">${sec.heading}</h2>
      ${sec.items.map((it, i) => `<h3 style="font-family:Cambria,serif;font-size:11pt;margin:10pt 0 3pt">${i + 1}. ${it.title}</h3><p style="font-family:Cambria,serif;font-size:10pt;line-height:1.5;margin:0 0 6pt">${it.body}</p>`).join('')}
    `).join('');
    return `
      <div style="font-family:Cambria,serif">
        <h1 style="font-size:16pt;margin:0 0 2pt">${doc.title}</h1>
        <p style="font-size:10pt;color:#555;margin:0 0 14pt">${doc.meta}</p>
        <h2 style="font-size:13pt;margin:0 0 2pt">${doc.statement.title}</h2>
        <p style="font-size:9.5pt;color:#555;margin:0 0 8pt">${doc.statement.sub}</p>
        <table style="border-collapse:collapse;width:100%">
          <thead><tr><th style="border-bottom:1px solid #999;padding:5px 8px;text-align:left;font-size:9pt">Line item</th>${th}</tr></thead>
          <tbody>${body}</tbody>
        </table>
        ${notes}
      </div>`;
  }, [doc]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(28,36,58,.55)', backdropFilter: 'blur(3px)', display: 'flex', flexDirection: 'column', padding: '22px 22px 0', animation: 'fcFade .18s ease' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '14px 14px 0 0', background: '#ECEFF6', border: '1px solid rgba(255,255,255,.75)', boxShadow: '0 -2px 18px rgba(30,40,70,.18)' }}>
        <span style={{ flex: 'none', width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(145deg,#3B82F6,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(29,78,216,.3)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 3.5H6a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5V8.5z" />
            <path d="M14.5 3.5v5h5M8.5 12.5h7M8.5 16h4.5" />
          </svg>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '14.5px', fontWeight: 700, color: '#232C42' }}>
            Consolidated Financial Statements — Word preview
          </span>
          <span style={{ display: 'block', marginTop: '2px', fontSize: '11px', color: '#7A84A0' }}>{doc.meta}</span>
        </span>
        <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#15803D', background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)', padding: '4px 10px', borderRadius: '999px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16A34A' }} />
          Live figures
        </span>
        <button
          type="button" className="fc-h fc-btn"
          onClick={() => officeBlob(html, 'application/msword', 'Consolidated-Financial-Statements.doc')}
          style={{ whiteSpace: 'nowrap', height: '34px', padding: '0 15px', borderRadius: '9px', background: 'linear-gradient(145deg,#3B82F6,#1D4ED8)', color: '#fff', fontSize: '12px', fontWeight: 700, boxShadow: '0 5px 14px rgba(29,78,216,.3)' }}
        >
          Open in MS Word
        </button>
        <button
          type="button" className="fc-h fc-btn" onClick={onClose} title="Close preview"
          style={{ flex: 'none', width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#65708C', background: '#E4E8F0', border: '1px solid #D6DBE8' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#8E96AC', border: '1px solid rgba(255,255,255,.4)', borderTop: 'none', padding: '26px 20px 40px' }}>
        <div
          style={{ width: '820px', maxWidth: '100%', margin: '0 auto', background: '#fff', padding: '54px 64px', boxShadow: '0 10px 40px rgba(20,28,50,.35)', minHeight: '600px' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

/* ========================= Working Note (Excel) ========================= */

type Cell = { raw: string };
export type Sheet = { name: string; rows: Cell[][] };

const COLS = ['A', 'B', 'C', 'D', 'E', 'F'];
const blankRow = (): Cell[] => COLS.map(() => ({ raw: '' }));

export const SEED_SHEETS: Sheet[] = [
  {
    name: 'WN-014 Leases',
    rows: [
      [{ raw: 'Right-of-use assets — movement' }, { raw: '' }, { raw: '' }, { raw: '' }, { raw: '' }, { raw: '' }],
      [{ raw: '' }, { raw: '' }, { raw: '' }, { raw: '' }, { raw: '' }, { raw: '' }],
      [{ raw: 'Class' }, { raw: 'Opening' }, { raw: 'Additions' }, { raw: 'Depreciation' }, { raw: 'Closing' }, { raw: '' }],
      [{ raw: 'Property' }, { raw: '5200' }, { raw: '1400' }, { raw: '-820' }, { raw: '=B4+C4+D4' }, { raw: '' }],
      [{ raw: 'Vehicles' }, { raw: '1850' }, { raw: '260' }, { raw: '-410' }, { raw: '=B5+C5+D5' }, { raw: '' }],
      [{ raw: 'Equipment' }, { raw: '1860' }, { raw: '0' }, { raw: '-330' }, { raw: '=B6+C6+D6' }, { raw: '' }],
      [{ raw: 'Total' }, { raw: '=SUM(B4:B6)' }, { raw: '=SUM(C4:C6)' }, { raw: '=SUM(D4:D6)' }, { raw: '=SUM(E4:E6)' }, { raw: '' }],
    ],
  },
];

/** tiny formula engine: =SUM(range) and =A1+B2-C3 */
function evalCell(sheet: Sheet, raw: string, depth = 0): string {
  if (!raw.startsWith('=') || depth > 6) return raw;
  const at = (ref: string): number => {
    const m = /^([A-F])(\d+)$/.exec(ref.trim().toUpperCase());
    if (!m) return 0;
    const c = COLS.indexOf(m[1]);
    const r = Number(m[2]) - 1;
    const cell = sheet.rows[r]?.[c];
    if (!cell) return 0;
    return Number(evalCell(sheet, cell.raw, depth + 1)) || 0;
  };
  let expr = raw.slice(1).toUpperCase();
  expr = expr.replace(/SUM\(\s*([A-F])(\d+)\s*:\s*([A-F])(\d+)\s*\)/g, (_m, c1, r1, c2, r2) => {
    const ci1 = COLS.indexOf(c1); const ci2 = COLS.indexOf(c2);
    let s = 0;
    for (let r = Number(r1); r <= Number(r2); r++) {
      for (let c = Math.min(ci1, ci2); c <= Math.max(ci1, ci2); c++) s += at(`${COLS[c]}${r}`);
    }
    return String(s);
  });
  expr = expr.replace(/[A-F]\d+/g, (ref) => String(at(ref)));
  if (!/^[-+*/().\d\s]+$/.test(expr)) return raw;
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict";return (${expr})`)() as number;
    return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : raw;
  } catch {
    return raw;
  }
}

export type WnLink = { sheet: string; addr: string; target: string; value: string };

/**
 * The workbook's numeric cells, offered as link targets to footnote tables —
 * the design's `ndTblLinkOpts()` (line 6189) walks the working note the same way.
 * Row labels come from column A, as they do there.
 */
export const wnLinkSources = (sheets: Sheet[] = SEED_SHEETS) =>
  sheets.flatMap((sh) =>
    sh.rows.flatMap((row, ri) =>
      row.map((cell, ci) => ({ cell, ci, ri })).filter(({ cell, ci }) => {
        if (ci === 0 || !cell.raw.trim()) return false;
        return !Number.isNaN(Number(evalCell(sh, cell.raw).replace(/,/g, '')));
      }).map(({ cell, ci, ri }) => {
        const addr = `${COLS[ci]}${ri + 1}`;
        const lab = sh.rows[ri]?.[0]?.raw.trim() || `row ${ri + 1}`;
        const head = sh.rows[2]?.[ci]?.raw.trim();
        return {
          id: `${sh.name}!${addr}`,
          label: `${sh.name}!${addr} — ${lab}${head ? ` · ${head}` : ''}`,
          value: evalCell(sh, cell.raw),
          tip: `Working note · ${sh.name}!${addr} (live)`,
        };
      }),
    ),
  );

export function WorkingNote({
  onClose, links, setLinks, noteTargets, sheets: liftedSheets, setSheets: setLiftedSheets,
}: {
  onClose: () => void;
  links: WnLink[];
  setLinks: React.Dispatch<React.SetStateAction<WnLink[]>>;
  noteTargets: string[];
  /** held by the screen when figures elsewhere link to this workbook, so they read live */
  sheets?: Sheet[];
  setSheets?: React.Dispatch<React.SetStateAction<Sheet[]>>;
}) {
  const [ownSheets, setOwnSheets] = useState<Sheet[]>(SEED_SHEETS);
  const sheets = liftedSheets ?? ownSheets;
  const setSheets = setLiftedSheets ?? setOwnSheets;
  const [active, setActive] = useState(0);
  const [sel, setSel] = useState({ r: 3, c: 4 });
  const [toast, setToast] = useState('');
  const [target, setTarget] = useState(noteTargets[0] ?? '');

  const sheet = sheets[active];
  const addr = `${COLS[sel.c]}${sel.r + 1}`;
  const selRaw = sheet.rows[sel.r]?.[sel.c]?.raw ?? '';

  const patch = (fn: (s: Sheet) => Sheet) =>
    setSheets((all) => all.map((s, i) => (i === active ? fn({ ...s, rows: s.rows.map((r) => r.map((c) => ({ ...c }))) }) : s)));

  const setRaw = (v: string) => patch((s) => { s.rows[sel.r][sel.c] = { raw: v }; return s; });
  const insertRow = (at: number) => patch((s) => { s.rows.splice(at, 0, blankRow()); return s; });
  const deleteRow = () => patch((s) => { if (s.rows.length > 1) s.rows.splice(sel.r, 1); return s; });

  const say = (m: string) => { setToast(m); };

  const linkCell = () => {
    if (!target) return;
    const value = evalCell(sheet, selRaw);
    setLinks((l) => [...l.filter((x) => !(x.sheet === sheet.name && x.addr === addr)), { sheet: sheet.name, addr, target, value }]);
    say(`${sheet.name}!${addr} is now the source for “${target}”. The link binds to the cell, not its address — inserting rows will not break it.`);
  };

  const exportXls = () => {
    const rows = sheet.rows.map((r) => `<tr>${r.map((c) => `<td>${evalCell(sheet, c.raw)}</td>`).join('')}</tr>`).join('');
    officeBlob(`<table border="1">${rows}</table>`, 'application/vnd.ms-excel', `${sheet.name}.xls`);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(35,44,66,.42)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '1180px', maxWidth: 'min(96vw,1180px)', maxHeight: 'calc(100vh - 36px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ECEFF6', border: '1px solid rgba(255,255,255,.8)', borderRadius: '18px', boxShadow: '0 36px 80px rgba(30,40,70,.45)', padding: '16px 18px 18px' }}
      >
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(145deg,#12867D,#0B5A54)', color: '#fff' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M3.5 9.5h17M9.5 9.5v11" />
            </svg>
          </span>
          <span style={{ flex: 'none', fontSize: '16px', fontWeight: 700, color: '#232C42' }}>Working Note (WN) — embedded MS Excel</span>
          <span style={{ flex: 'none', fontSize: '10.5px', fontWeight: 700, color: '#0F766E', background: 'rgba(15,118,110,.1)', border: '1px solid rgba(15,118,110,.28)', padding: '3px 9px', borderRadius: '7px' }}>
            ClientCo-WN-Q3-2026.xlsx
          </span>
          <div style={{ flex: 1 }} />
          <button type="button" className="fc-h fc-btn" onClick={exportXls}
            style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', height: '30px', padding: '0 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: '#414B62', background: 'rgba(255,255,255,.65)', border: '1px solid #CBD2E0' }}>
            Open in desktop Excel
          </button>
          <button type="button" className="fc-h fc-btn" onClick={onClose}
            style={{ flex: 'none', width: '26px', height: '26px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A84A0', background: '#E4E8F0' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div style={{ flex: 'none', fontSize: '11.5px', color: '#7A84A0', fontStyle: 'italic', marginBottom: '12px' }}>
          Build the working note here, select the cell that carries the figure, then link it to a statement line or a
          disclosure note. Links bind to the cell itself, not to its address — inserting rows will not break them.
        </div>

        {toast && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '9px 11px', marginBottom: '12px', borderRadius: '10px', background: 'rgba(15,118,110,.08)', border: '1px solid rgba(15,118,110,.3)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: '1px' }}><path d="M20 6 9 17l-5-5" /></svg>
            <span style={{ flex: 1, fontSize: '11.5px', fontWeight: 600, color: '#0B5A54' }}>{toast}</span>
            <button type="button" className="fc-btn" onClick={() => setToast('')} style={{ flex: 'none', fontSize: '10px', fontWeight: 700, color: '#0F766E' }}>Dismiss</button>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px' }}>
              {sheets.map((s, i) => (
                <button key={s.name} type="button" className="fc-btn" onClick={() => setActive(i)}
                  style={{
                    height: '26px', padding: '0 12px', borderRadius: '8px 8px 0 0', fontSize: '11px', fontWeight: 700,
                    ...(i === active ? { background: '#fff', color: '#0F766E', border: '1px solid #DCE0EB', borderBottom: 'none' } : { background: '#E0E4EE', color: '#7A84A0' }),
                  }}>
                  {s.name}
                </button>
              ))}
              <button type="button" className="fc-h fc-btn" title="New working-note sheet"
                onClick={() => { setSheets((a) => [...a, { name: `WN-${String(a.length + 15).padStart(3, '0')}`, rows: Array.from({ length: 6 }, blankRow) }]); setActive(sheets.length); }}
                style={{ marginLeft: '5px', marginBottom: '3px', display: 'inline-flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 9px', borderRadius: '7px', fontSize: '10.5px', fontWeight: 700, color: '#0F766E', background: 'rgba(15,118,110,.1)' }}>
                + Sheet
              </button>
            </div>

            <div style={{ background: '#fff', border: '1px solid #DCE0EB', borderRadius: '0 10px 10px 10px', padding: '9px 10px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                <span style={{ flex: 'none', minWidth: '52px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '7px', background: '#EDF0F7', border: '1px solid #DCE0EB', fontFamily: 'ui-sans-serif,system-ui,sans-serif', fontSize: '11px', fontWeight: 700, color: '#0F766E' }}>
                  {addr}
                </span>
                <span style={{ flex: 'none', fontStyle: 'italic', fontSize: '12px', color: '#9AA3BA' }}>fx</span>
                <input
                  value={selRaw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder="Value or formula — e.g. =SUM(C4:C6)"
                  style={{ flex: 1, minWidth: 0, height: '26px', boxSizing: 'border-box', border: '1px solid #DCE0EB', borderRadius: '7px', background: '#F6F7FB', fontFamily: 'ui-sans-serif,system-ui,sans-serif', fontSize: '11.5px', color: '#232C42', padding: '0 8px', outline: 'none' }}
                />
                <div style={{ flex: 'none', display: 'flex', gap: '4px' }}>
                  <button type="button" className="fc-h fc-btn" onClick={() => insertRow(sel.r)} title="Insert row above the selected cell" style={{ height: '26px', padding: '0 9px', borderRadius: '7px', fontSize: '10.5px', fontWeight: 700, color: '#414B62', background: '#EDF0F7', border: '1px solid #DCE0EB' }}>Row ↑</button>
                  <button type="button" className="fc-h fc-btn" onClick={() => insertRow(sel.r + 1)} title="Insert row below the selected cell" style={{ height: '26px', padding: '0 9px', borderRadius: '7px', fontSize: '10.5px', fontWeight: 700, color: '#414B62', background: '#EDF0F7', border: '1px solid #DCE0EB' }}>Row ↓</button>
                  <button type="button" className="fc-h fc-btn" onClick={deleteRow} title="Delete the selected row" style={{ height: '26px', padding: '0 9px', borderRadius: '7px', fontSize: '10.5px', fontWeight: 700, color: '#B4256F', background: 'rgba(180,37,111,.08)', border: '1px solid rgba(180,37,111,.25)' }}>Delete row</button>
                </div>
              </div>

              <div style={{ overflow: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', font: 'inherit' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '34px', background: '#F3F5FA', border: '1px solid #E4E8F2', fontSize: '9.5px', color: '#9AA3BA' }} />
                      {COLS.map((c) => (
                        <th key={c} style={{ minWidth: '116px', background: '#F3F5FA', border: '1px solid #E4E8F2', fontSize: '9.5px', fontWeight: 700, color: '#7A84A0', padding: '3px 6px' }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.map((row, ri) => (
                      <tr key={ri}>
                        <td style={{ background: '#F3F5FA', border: '1px solid #E4E8F2', textAlign: 'center', fontSize: '9.5px', fontWeight: 700, color: '#9AA3BA' }}>{ri + 1}</td>
                        {row.map((cell, ci) => {
                          const on = sel.r === ri && sel.c === ci;
                          const linked = links.some((l) => l.sheet === sheet.name && l.addr === `${COLS[ci]}${ri + 1}`);
                          const shown = evalCell(sheet, cell.raw);
                          const numeric = shown !== '' && !Number.isNaN(Number(shown));
                          return (
                            <td
                              key={ci}
                              onClick={() => setSel({ r: ri, c: ci })}
                              style={{
                                border: on ? '2px solid #0F766E' : '1px solid #E4E8F2',
                                padding: '3px 7px', fontSize: '11.5px', cursor: 'cell',
                                fontFamily: 'ui-sans-serif,system-ui,sans-serif',
                                textAlign: numeric ? 'right' : 'left',
                                fontVariantNumeric: 'tabular-nums',
                                background: linked ? 'rgba(15,118,110,.09)' : '#fff',
                                color: '#232C42',
                              }}
                            >
                              {shown}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* link panel */}
          <div style={{ flex: 'none', width: '290px', background: '#E4E8F0', border: '1px solid rgba(255,255,255,.7)', borderRadius: '12px', boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.4),inset -2px -2px 6px rgba(255,255,255,.9)', padding: '13px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9AA3BA', marginBottom: '8px' }}>Link source</div>
            <div style={{ fontSize: '11.5px', color: '#65708C', lineHeight: 1.5, marginBottom: '10px' }}>
              Selected cell <b style={{ color: '#0F766E' }}>{addr}</b> = <b style={{ color: '#232C42' }}>{evalCell(sheet, selRaw) || '—'}</b>
            </div>
            <select value={target} onChange={(e) => setTarget(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', height: '32px', borderRadius: '8px', border: '1px solid #CBD2E0', background: '#fff', font: 'inherit', fontSize: '11.5px', color: '#333D55', padding: '0 8px', cursor: 'pointer' }}>
              {noteTargets.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button type="button" className="fc-h fc-btn" onClick={linkCell}
              style={{ width: '100%', marginTop: '9px', height: '32px', borderRadius: '8px', background: 'linear-gradient(145deg,#12867D,#0B5A54)', color: '#fff', fontSize: '11.5px', fontWeight: 700 }}>
              Link this cell
            </button>

            {links.length > 0 && (
              <>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9AA3BA', margin: '14px 0 7px' }}>Linked figures</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {links.map((l) => (
                    <div key={`${l.sheet}${l.addr}`} style={{ display: 'flex', alignItems: 'baseline', gap: '7px', fontSize: '11px' }}>
                      <span style={{ flex: 'none', fontWeight: 700, color: '#0F766E' }}>{l.addr}</span>
                      <span style={{ flex: 1, minWidth: 0, color: '#65708C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.target}</span>
                      <span style={{ flex: 'none', fontWeight: 700, color: '#232C42', fontVariantNumeric: 'tabular-nums' }}>{l.value}</span>
                      <button type="button" className="fc-btn" onClick={() => setLinks((x) => x.filter((y) => y !== l))} title="Unlink" style={{ flex: 'none', color: '#B42318', fontWeight: 700 }}>×</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
