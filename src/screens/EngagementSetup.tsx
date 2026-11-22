import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { engagementSetupApi } from '../api/engagementSetupClient';
import type { EngagementConfigRecord, LegalEntity, LegalEntityInput, LegalEntityPatch } from '../../shared/engagementSetup';
import { GridCol, GridHead, ROW_H, useGrid } from '../components/grid/Grid';
import { PanelFooter, SidePanel } from '../components/SidePanel';

/**
 * Engagement Setup — ported from docs/design/Fusion Close.dc.html,
 * block `<sc-if value="{{ is.engagement }}">` lines 3111–3329.
 *
 * Two "set once" steps: Legal Entity Master (the 21-column entity grid,
 * data `leData` line 10305, styles 10304–10441) and Engagement Configuration
 * (accordion sections A–G, `rawSections` line 9745, derived preview 3238+).
 */

/* ============================ shared ============================ */

const SECTION_SHELL: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: '#ECEFF6',
  border: '1px solid rgba(255,255,255,.75)',
  boxShadow: '9px 9px 22px rgba(166,175,195,.5),-9px -9px 22px rgba(255,255,255,.95)',
  padding: '22px',
};

const CRUD_BASE: React.CSSProperties = {
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '11.5px',
  fontWeight: 700,
  padding: '7px 12px',
  borderRadius: '9px',
  background: '#E4E8F0',
  boxShadow: '2px 2px 5px rgba(166,175,195,.5),-2px -2px 5px rgba(255,255,255,.9)',
};

const CRUD_OFF: React.CSSProperties = {
  ...CRUD_BASE,
  background: '#E9ECF3',
  color: '#B4BBCC',
  cursor: 'not-allowed',
  boxShadow: 'none',
};

/** in-grid cell editor */
const EDIT_CELL: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: '24px',
  background: '#fff',
  border: '1px solid #3B5BDB',
  borderRadius: '5px',
  font: 'inherit',
  fontSize: '10.5px',
  color: '#232C42',
  padding: '0 5px',
  outline: 'none',
};

const INSET_INPUT: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: '34px',
  background: '#E4E8F0',
  border: '1px solid #CBD2E0',
  boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.4),inset -2px -2px 5px rgba(255,255,255,.9)',
  borderRadius: '9px',
  color: '#333D55',
  font: 'inherit',
  fontSize: '12.5px',
  padding: '0 12px',
  outline: 'none',
};

/* ==================== step 1 · legal entity master ==================== */

const LE_COLS = [
  'LE Code', 'LE Name', 'Parent Entity', 'Entity Type', 'Country', 'Own. Direct', 'Own. Indirect',
  'Own. Total', 'NCI %', 'Consol %', 'Consol Method', 'Consol Structure', 'Local CCY', 'Funct. CCY',
  'Report CCY', 'Classification', 'Fiscal YE', 'Primary GAAP', 'Secondary GAAP', 'Acq. Date', 'Disposal Date',
];

type FieldType = 'text' | 'dropdown' | 'pct' | 'auto' | 'date';

const LE_TYPES: FieldType[] = [
  'text', 'text', 'text', 'dropdown', 'dropdown', 'pct', 'auto', 'auto', 'auto', 'auto', 'dropdown',
  'dropdown', 'dropdown', 'dropdown', 'dropdown', 'auto', 'dropdown', 'dropdown', 'dropdown', 'date', 'date',
];

const TYPE_TINT: Record<FieldType, string | undefined> = {
  auto: 'rgba(124,58,237,.09)',
  dropdown: 'rgba(59,130,246,.05)',
  pct: 'rgba(16,185,129,.07)',
  date: 'rgba(245,158,11,.07)',
  text: undefined,
};

const LE_LEGEND = [
  { label: 'Text entry', color: '#E9ECF3', bd: '#CBD2E0' },
  { label: 'Dropdown', color: 'rgba(59,130,246,.14)', bd: 'rgba(59,130,246,.4)' },
  { label: '% input', color: 'rgba(16,185,129,.16)', bd: 'rgba(16,185,129,.45)' },
  { label: 'Auto-computed', color: 'rgba(124,58,237,.16)', bd: 'rgba(124,58,237,.5)' },
  { label: 'Date', color: 'rgba(245,158,11,.16)', bd: 'rgba(245,158,11,.5)' },
];

/* Hardcoded sample data — replaced by the legal_entity_master table, loaded through the API (see below).
const LE_DATA: string[][] = [
  ['GRP00', 'ClientCo Industries Group', '—', 'Ultimate parent', 'United States', '100%', '—', '100%', '—', '100%', 'Full consolidation', 'Group', 'USD', 'USD', 'USD', 'LCFC', '31 Dec', 'US GAAP', 'IFRS', '—', '—'],
  ['US01', 'US Holdings Inc.', 'GRP00', 'Subsidiary', 'United States', '100%', '—', '100%', '—', '100%', 'Full consolidation', 'Group', 'USD', 'USD', 'USD', 'LCFC', '31 Dec', 'US GAAP', 'IFRS', '12 Mar 2018', '—'],
  ['EU-SUB', 'EMEA Holding B.V.', 'US01', 'Intermediate holding', 'Netherlands', '100%', '—', '100%', '—', '100%', 'Sub-consolidation', 'EMEA sub-group', 'EUR', 'EUR', 'USD', 'LCFC', '31 Dec', 'IFRS', '—', '30 Jun 2016', '—'],
  ['DE01', 'Germany GmbH', 'EU-SUB', 'Subsidiary', 'Germany', '100%', '—', '100%', '—', '100%', 'Full consolidation', 'EMEA sub-group', 'EUR', 'EUR', 'USD', 'LCFC', '31 Dec', 'HGB (Local)', 'IFRS', '04 Jul 2015', '—'],
  ['FR01', 'France SAS', 'EU-SUB', 'Subsidiary', 'France', '80%', '—', '80%', '20%', '100%', 'Full consolidation', 'EMEA sub-group', 'EUR', 'USD', 'USD', 'RCFC', '31 Dec', 'PCG (Local)', 'IFRS', '21 Sep 2019', '—'],
  ['IN01', 'Bharat Services Pvt Ltd', 'EU-SUB', 'Subsidiary', 'India', '60%', '15%', '75%', '25%', '100%', 'Full consolidation', 'APAC sub-group', 'INR', 'USD', 'USD', 'RCFC', '31 Mar', 'Ind AS', 'IFRS', '08 Nov 2022', '—'],
  ['JV01', 'Nordic JV AS', 'US01', 'Joint venture', 'Norway', '50%', '—', '50%', '—', '50%', 'Equity method', '—', 'NOK', 'NOK', 'USD', 'LCFC', '31 Dec', 'NGAAP (Local)', 'IFRS', '15 Feb 2021', '—'],
  ['ES01', 'Iberia SL (disposed)', 'EU-SUB', 'Former subsidiary', 'Spain', '0%', '—', '0%', '—', '—', 'Deconsolidated', '—', 'EUR', 'EUR', 'USD', '—', '31 Dec', 'PGC (Local)', 'IFRS', '03 May 2017', '30 Apr 2026'],
];
*/

/**
 * Engagement whose legal_entity_master rows the grid loads.
 * TODO: take this from the selected engagement once the app has one (no engagement context exists yet).
 */
const ENGAGEMENT_ID = '00000000-0000-0000-0000-000000000001';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const showPct = (n: number | null, blankZero = false) => (n === null || (blankZero && n === 0) ? '—' : `${n}%`);
const showDate = (iso: string | null) => {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '—';
};
const dash = (v: string | null) => (v ? v : '—');

/** API entity -> grid row, in LE_COLS order */
const entityToRow = (e: LegalEntity): string[] => [
  e.code, e.name, dash(e.parentCode), dash(e.entityType), dash(e.country),
  showPct(e.ownershipDirectPct), showPct(e.ownershipIndirectPct, true), showPct(e.ownershipTotalPct),
  showPct(e.nciPct), showPct(e.consolidationPct), dash(e.consolidationMethod), dash(e.consolidationStructure),
  dash(e.localCurrency), dash(e.functionalCurrency), dash(e.reportingCurrency), dash(e.classification),
  dash(e.fiscalYearEnd), dash(e.primaryGaap), dash(e.secondaryGaap),
  showDate(e.acquisitionDate), showDate(e.disposalDate),
];

/* grid row -> API entity (the reverse of entityToRow), used by the row Save button */
const blankCell = (v: string | undefined) => {
  const s = (v ?? '').trim();
  return s === '—' || s === '-' ? '' : s;
};
const parsePct = (v: string | undefined, label: string): number | null => {
  const s = blankCell(v).replace(/%$/, '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`${label} “${v}” is not a percentage`);
  return n;
};
/** accepts the grid's "04 Jul 2015" or an ISO yyyy-mm-dd */
const parseDate = (v: string | undefined, label: string): string | null => {
  const s = blankCell(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})[\s-]+([A-Za-z]{3})[A-Za-z]*[\s-]+(\d{4})$/.exec(s);
  const mi = m ? MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase()) : -1;
  if (!m || mi < 0) throw new Error(`${label} “${v}” must look like 04 Jul 2015`);
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};
const rowToInput = (r: string[]): LegalEntityInput => ({
  code: blankCell(r[0]),
  name: blankCell(r[1]),
  parentCode: blankCell(r[2]) || null,
  entityType: blankCell(r[3]),
  country: blankCell(r[4]),
  ownershipDirectPct: parsePct(r[5], 'Own. Direct') ?? 0,
  ownershipIndirectPct: parsePct(r[6], 'Own. Indirect') ?? 0,
  nciPct: parsePct(r[8], 'NCI %'),
  consolidationPct: parsePct(r[9], 'Consol %'),
  consolidationMethod: blankCell(r[10]),
  consolidationStructure: blankCell(r[11]) || null,
  localCurrency: blankCell(r[12]),
  functionalCurrency: blankCell(r[13]),
  reportingCurrency: blankCell(r[14]),
  classification: blankCell(r[15]) || null,
  fiscalYearEnd: blankCell(r[16]),
  primaryGaap: blankCell(r[17]),
  secondaryGaap: blankCell(r[18]) || null,
  acquisitionDate: parseDate(r[19], 'Acq. Date'),
  disposalDate: parseDate(r[20], 'Disposal Date'),
});
/** API field -> grid column label, so server validation messages name the column the user sees */
const FIELD_LABEL: Record<string, string> = {
  code: 'LE Code', name: 'LE Name', parentCode: 'Parent Entity', entityType: 'Entity Type', country: 'Country',
  ownershipDirectPct: 'Own. Direct', ownershipIndirectPct: 'Own. Indirect', nciPct: 'NCI %', consolidationPct: 'Consol %',
  consolidationMethod: 'Consol Method', consolidationStructure: 'Consol Structure', localCurrency: 'Local CCY',
  functionalCurrency: 'Funct. CCY', reportingCurrency: 'Report CCY', classification: 'Classification',
  fiscalYearEnd: 'Fiscal YE', primaryGaap: 'Primary GAAP', secondaryGaap: 'Secondary GAAP',
  acquisitionDate: 'Acq. Date', disposalDate: 'Disposal Date',
};
const friendlyError = (msg: string) =>
  msg.replace(/\b(code|name|parentCode|entityType|country|ownershipDirectPct|ownershipIndirectPct|nciPct|consolidationPct|consolidationMethod|consolidationStructure|localCurrency|functionalCurrency|reportingCurrency|classification|fiscalYearEnd|primaryGaap|secondaryGaap|acquisitionDate|disposalDate)\b/g,
    (k) => FIELD_LABEL[k] ?? k);
/** a row differs from its last-saved copy (blank and "—" count as the same) */
const rowChanged = (r: string[], saved: string[] | null) =>
  saved ? r.some((v, ci) => blankCell(v) !== blankCell(saved[ci])) : r.some((v) => blankCell(v) !== '');

/* ---------------------- bulk structure upload ---------------------- */

/** RFC4180-ish split: handles quoted fields, embedded commas and "" escapes */
function parseDelimited(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const delim = text.split('\n')[0].includes('\t') ? '\t' : ',';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === delim) { row.push(field.trim()); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field.trim()); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field.trim()); rows.push(row); }
  return rows.filter((r) => r.some((v) => v !== ''));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** map the file's header row onto Legal Entity Master columns; fall back to position */
function mapHeaders(header: string[]): number[] {
  const targets = LE_COLS.map(norm);
  return header.map((h, i) => {
    const exact = targets.indexOf(norm(h));
    if (exact >= 0) return exact;
    const partial = targets.findIndex((t) => t.startsWith(norm(h)) || norm(h).startsWith(t));
    return partial >= 0 ? partial : i < LE_COLS.length ? i : -1;
  });
}

type ParsedUpload = {
  fileName: string;
  fileSize: number;
  rows: string[][];
  issues: { line: number; msg: string }[];
  headerMapped: boolean;
};

const TEMPLATE_EXAMPLE = [
  'SG01', 'Singapore Operations Pte Ltd', 'US01', 'Subsidiary', 'Singapore', '100%', '', '', '',
  '100%', 'Full consolidation', 'APAC sub-group', 'SGD', 'SGD', 'USD', 'LCFC', '31 Dec', 'SFRS', 'IFRS', '01 Jan 2024', '',
];

function StructureUpload({
  existing,
  onImport,
  onClose,
}: {
  existing: string[][];
  onImport: (rows: string[][]) => void;
  onClose: () => void;
}) {
  const [dropActive, setDropActive] = useState(false);
  const [parsed, setParsed] = useState<ParsedUpload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const existingCodes = new Set(existing.map((r) => r[0]).filter(Boolean));

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setParsed(null);
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (['xlsx', 'xls'].includes(ext)) {
      setError(
        `“${file.name}” is a workbook. Spreadsheet parsing is not wired up yet — save the sheet as CSV and upload that, or use the template below.`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const grid = parseDelimited(String(reader.result ?? ''));
      if (!grid.length) { setError('That file is empty.'); return; }

      // treat the first line as a header when it names any known column
      const looksHeader = grid[0].some((h) => LE_COLS.map(norm).includes(norm(h)));
      const map = looksHeader ? mapHeaders(grid[0]) : LE_COLS.map((_, i) => i);
      const body = looksHeader ? grid.slice(1) : grid;

      const issues: { line: number; msg: string }[] = [];
      const seen = new Set<string>();
      const out: string[][] = [];

      body.forEach((r, i) => {
        const line = i + (looksHeader ? 2 : 1);
        const row = LE_COLS.map(() => '');
        r.forEach((v, ci) => {
          const target = map[ci];
          if (target >= 0 && target < LE_COLS.length) row[target] = v;
        });
        if (!row[0]) { issues.push({ line, msg: 'no LE Code — row skipped' }); return; }
        if (seen.has(row[0])) { issues.push({ line, msg: `duplicate LE Code “${row[0]}” in file — row skipped` }); return; }
        if (existingCodes.has(row[0])) { issues.push({ line, msg: `LE Code “${row[0]}” already exists — row skipped` }); return; }
        seen.add(row[0]);
        out.push(withDerived(row));
      });

      // a parent that is neither in the file nor already loaded leaves an orphan
      out.forEach((row, i) => {
        const p = row[2];
        if (p && p !== '—' && !seen.has(p) && !existingCodes.has(p)) {
          issues.push({ line: i + 1, msg: `parent “${p}” not found — ${row[0]} will import as a root` });
        }
      });

      setParsed({ fileName: file.name, fileSize: file.size, rows: out, issues, headerMapped: looksHeader });
    };
    reader.onerror = () => setError('That file could not be read.');
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csv = [LE_COLS.join(','), TEMPLATE_EXAMPLE.join(',')].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'legal-entity-structure-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

  return (
    <SidePanel
      id="upload-le-structure" title="Upload legal entity structure" onClose={onClose} width={500}
      subtitle="Select or drag & drop your completed template — the entities are checked before they are added to the Legal Entity Master."
    >
          {/* drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDropActive(true); }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => { e.preventDefault(); setDropActive(false); handleFile(e.dataTransfer.files?.[0]); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              padding: '30px 20px', borderRadius: '14px',
              border: `1.5px dashed ${dropActive ? '#2563EB' : '#CBD2E0'}`,
              background: dropActive ? 'rgba(59,130,246,.08)' : '#F5F7FC',
              transition: 'border-color .12s, background .12s',
            }}
          >
            <button
              type="button" className="fc-h fc-btn" onClick={() => inputRef.current?.click()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 20px', borderRadius: '10px',
                background: '#ECEFF6', border: '1px solid #CBD2E0',
                boxShadow: '2px 2px 6px rgba(166,175,195,.5),-2px -2px 6px rgba(255,255,255,.9)',
                fontSize: '13.5px', fontWeight: 700, color: '#333D55',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
              </svg>
              Browse files
            </button>
            <div style={{ marginTop: '14px', fontSize: '14px', fontWeight: 700, color: '#333D55' }}>
              Choose a file or drag &amp; drop it here
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#9AA3BA' }}>
              Accepted: .csv, .tsv · one row per legal entity
            </div>
            <button
              type="button" className="fc-btn" onClick={downloadTemplate}
              style={{ marginTop: '10px', fontSize: '11.5px', fontWeight: 700, color: '#3B5BDB' }}
            >
              Download the CSV template ↓
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              hidden
              onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: '11px 14px', borderRadius: '11px', fontSize: '12px', lineHeight: 1.45,
                color: '#8A5A10', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.38)',
              }}
            >
              {error}
            </div>
          )}

          {parsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', padding: '12px 14px', border: '1px solid #DCE0EB', borderRadius: '12px', background: '#F5F7FC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    flex: 'none', width: '36px', height: '36px', borderRadius: '9px',
                    background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.28)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8.5px', fontWeight: 700, color: '#2563EB',
                  }}
                >
                  {(parsed.fileName.split('.').pop() ?? '').toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#232C42', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {parsed.fileName}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#7A84A0' }}>
                    {fmtBytes(parsed.fileSize)} ·{' '}
                    <span style={{ fontWeight: 700, color: parsed.rows.length ? '#15803D' : '#B42318' }}>
                      {parsed.rows.length} entit{parsed.rows.length === 1 ? 'y' : 'ies'} ready
                    </span>
                    {parsed.issues.length > 0 && (
                      <span style={{ color: '#B45309', fontWeight: 700 }}> · {parsed.issues.length} issue{parsed.issues.length === 1 ? '' : 's'}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button" className="fc-h fc-btn" onClick={() => setParsed(null)} aria-label="Remove file"
                  style={{ width: '26px', height: '26px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9AA3BA' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              {!parsed.headerMapped && (
                <div style={{ fontSize: '11px', color: '#8A5A10', fontStyle: 'italic' }}>
                  No header row recognised — columns were read in template order.
                </div>
              )}

              {parsed.issues.length > 0 && (
                <div style={{ maxHeight: '110px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {parsed.issues.map((it, i) => (
                    <div key={i} style={{ fontSize: '11px', color: '#B45309', lineHeight: 1.4 }}>
                      <b style={{ fontWeight: 700 }}>Line {it.line}</b> · {it.msg}
                    </div>
                  ))}
                </div>
              )}

              {parsed.rows.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {parsed.rows.slice(0, 12).map((r) => (
                    <span
                      key={r[0]}
                      title={r[1]}
                      style={{
                        fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px',
                        color: '#0F766E', background: 'rgba(15,118,110,.11)', border: '1px solid rgba(15,118,110,.28)',
                      }}
                    >
                      {r[0]}
                    </span>
                  ))}
                  {parsed.rows.length > 12 && (
                    <span style={{ fontSize: '9.5px', color: '#7A84A0', alignSelf: 'center' }}>+{parsed.rows.length - 12} more</span>
                  )}
                </div>
              )}
            </div>
          )}

          <PanelFooter>
            <div style={{ flex: 1 }} />
            <button
              type="button" className="fc-h fc-btn" onClick={onClose}
              style={{ fontSize: '12px', fontWeight: 700, color: '#414B62', padding: '9px 16px', borderRadius: '9px', border: '1px solid #CBD2E0', background: 'rgba(255,255,255,.6)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="fc-h fc-btn"
              disabled={!parsed || parsed.rows.length === 0}
              onClick={() => { if (parsed) { onImport(parsed.rows); onClose(); } }}
              style={{
                fontSize: '12px', fontWeight: 700, padding: '9px 18px', borderRadius: '9px',
                ...(parsed && parsed.rows.length
                  ? { color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', boxShadow: '2px 2px 8px rgba(37,99,235,.32)' }
                  : { color: '#B4BBCC', background: '#E9ECF3', cursor: 'not-allowed' }),
              }}
            >
              {parsed && parsed.rows.length ? `Import ${parsed.rows.length} entit${parsed.rows.length === 1 ? 'y' : 'ies'}` : 'Import'}
            </button>
          </PanelFooter>
    </SidePanel>
  );
}

/* ------------------------- org chart (modal) ------------------------- */

type OrgNode = {
  code: string; name: string; parent: string; type: string; country: string;
  consol: string; method: string; cls: string; kids: OrgNode[]; depth: number;
  /** the entity's full Legal Entity Master row, for the detail drawer */
  row: string[];
};

/** layout constants, design line 10347 */
const NW = 168, NH = 62, GAPX = 188, GAPY = 116, PADX = 34, PADY = 26;

const methodAccent = (m: string) =>
  m === 'Equity method' ? '#0E7490' : m === 'Deconsolidated' ? '#9AA3BA' : '#2563EB';

/** "", "—", "-" and "n/a" all mean "no value" in a Legal Entity Master cell */
const cellVal = (v: string | undefined) => {
  const s = (v ?? '').trim();
  return s === '—' || s === '-' || /^n\/?a$/i.test(s) ? '' : s;
};
const matchKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** a Legal Entity Master row the chart could not place exactly as written */
type OrgIssue = { code: string; msg: string };

/**
 * Build the hierarchy from the Legal Entity Master rows (LE Code, LE Name, Parent Entity, …).
 * The parent may be given as an LE Code or an LE Name, in any case. An unknown parent,
 * a self-reference or a loop puts the entity at the top level and is reported back.
 */
function resolveOrg(data: string[][]) {
  const byCode: Record<string, OrgNode> = {};
  const nodes: OrgNode[] = [];
  const issues: OrgIssue[] = [];
  const codeIdx = new Map<string, OrgNode>();
  const nameIdx = new Map<string, OrgNode>();
  const rawParent = new Map<OrgNode, string>();

  data.forEach((r, i) => {
    const code0 = cellVal(r[0]);
    const name = cellVal(r[1]);
    if (!code0 && !name) return; // a blank row still being filled in
    // every row needs a unique key: a missing code gets a placeholder, a repeated one a suffix
    let code = code0 || `Row ${i + 1}`;
    if (byCode[code]) {
      let k = 2;
      while (byCode[`${code} (${k})`]) k++;
      issues.push({ code, msg: `LE Code “${code}” is used more than once` });
      code = `${code} (${k})`;
    } else if (!code0) {
      issues.push({ code, msg: `“${name}” has no LE Code` });
    }
    const n: OrgNode = {
      code, name, parent: '', type: cellVal(r[3]), country: cellVal(r[4]),
      consol: cellVal(r[9]), method: cellVal(r[10]), cls: cellVal(r[15]), kids: [], depth: 0, row: r,
    };
    byCode[code] = n;
    nodes.push(n);
    if (code0 && !codeIdx.has(matchKey(code0))) codeIdx.set(matchKey(code0), n);
    if (name && !nameIdx.has(matchKey(name))) nameIdx.set(matchKey(name), n);
    rawParent.set(n, cellVal(r[2]));
  });

  // link each entity to its parent, refusing links that would close a loop
  nodes.forEach((n) => {
    const raw = rawParent.get(n) ?? '';
    if (!raw) return;
    const p = codeIdx.get(matchKey(raw)) ?? nameIdx.get(matchKey(raw));
    if (!p) { issues.push({ code: n.code, msg: `parent “${raw}” is not in the Legal Entity Master` }); return; }
    if (p === n) { issues.push({ code: n.code, msg: 'is listed as its own parent' }); return; }
    for (let cur: OrgNode | undefined = p; cur; cur = byCode[cur.parent]) {
      if (cur === n) { issues.push({ code: n.code, msg: `parent “${raw}” would create a loop` }); return; }
    }
    n.parent = p.code;
    p.kids.push(n);
  });

  const roots = nodes.filter((n) => !n.parent);
  const setDepth = (n: OrgNode, d: number) => { n.depth = d; n.kids.forEach((k) => setDepth(k, d + 1)); };
  roots.forEach((r) => setDepth(r, 0));
  return { byCode, nodes, roots, issues };
}

function buildOrg(data: string[][], collapsed: Set<string>) {
  const { byCode, roots, issues } = resolveOrg(data);
  /** a collapsed node keeps its children in the model but hides them from the chart */
  const shownKids = (n: OrgNode) => (collapsed.has(n.code) ? [] : n.kids);

  // flat list for the tree view — only what is currently revealed
  const flat: OrgNode[] = [];
  const walk = (n: OrgNode) => { flat.push(n); shownKids(n).forEach(walk); };
  roots.forEach(walk);

  // slot assignment for the mind map: leaves take the next column,
  // parents centre over their children (design line 10350). A collapsed
  // branch behaves as a leaf, so the layout closes up around it.
  const pos: Record<string, number> = {};
  let leafSlot = 0;
  const assignSlot = (n: OrgNode): number => {
    const kids = shownKids(n);
    if (!kids.length) { const s = leafSlot++; pos[n.code] = s; return s; }
    const cs = kids.map(assignSlot);
    const s = (Math.min(...cs) + Math.max(...cs)) / 2;
    pos[n.code] = s;
    return s;
  };
  roots.forEach(assignSlot);

  const all = flat;
  const maxSlot = Math.max(0, ...Object.values(pos));
  const maxDepth = Math.max(0, ...all.map((n) => n.depth));
  const cx = (n: OrgNode) => PADX + pos[n.code] * GAPX + NW / 2;
  const cyTop = (n: OrgNode) => PADY + n.depth * GAPY;

  const conns: string[] = [];
  all.forEach((n) => {
    const p = byCode[n.parent];
    if (!p || pos[p.code] === undefined || collapsed.has(p.code)) return;
    const x1 = cx(p), y1 = cyTop(p) + NH, x2 = cx(n), y2 = cyTop(n);
    const my = y1 + (y2 - y1) / 2;
    conns.push(`M${x1} ${y1} V${my} H${x2} V${y2}`);
  });

  return {
    all, flat, pos, conns, byCode, roots, issues,
    nodeCount: Object.keys(byCode).length,
    canvasW: PADX * 2 + maxSlot * GAPX + NW,
    canvasH: PADY * 2 + maxDepth * GAPY + NH,
    left: (n: OrgNode) => PADX + pos[n.code] * GAPX,
    top: cyTop,
  };
}

/** every parent below the root starts closed, so the chart opens as you explore */
function initialCollapsed(data: string[][]): Set<string> {
  const { nodes } = resolveOrg(data);
  return new Set(nodes.filter((n) => n.parent && n.kids.length).map((n) => n.code));
}

/**
 * Fields the compact card can't carry, grouped for the expansion drawer.
 * Indices are Legal Entity Master columns (LE_COLS).
 */
const DETAIL_GROUPS: { title: string; cols: number[] }[] = [
  { title: 'Ownership', cols: [5, 6, 7, 8, 9] },
  { title: 'Consolidation', cols: [3, 10, 11] },
  { title: 'Currency', cols: [12, 13, 14, 15] },
  { title: 'Reporting', cols: [16, 17, 18] },
  { title: 'Dates', cols: [19, 20] },
];

function DetailField({ ci, value }: { ci: number; value: string }) {
  const ft = LE_TYPES[ci] ?? 'text';
  const empty = !value || value === '—';
  return (
    <div
      style={{
        minWidth: 0, padding: '8px 10px', borderRadius: '10px',
        background: TYPE_TINT[ft] ?? 'rgba(228,232,240,.55)',
        border: '1px solid rgba(255,255,255,.75)',
      }}
    >
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9AA3BA' }}>
        {LE_COLS[ci]}
      </div>
      <div
        style={{
          marginTop: '3px', fontSize: '12px', fontWeight: 700, lineHeight: 1.3,
          color: empty ? '#A6AEC2' : ft === 'auto' ? '#6D28D9' : '#232C42',
          fontStyle: empty || ft === 'auto' ? 'italic' : 'normal',
          overflowWrap: 'anywhere',
        }}
      >
        {empty ? '—' : value}
      </div>
    </div>
  );
}

function OrgChart({ data, onClose }: { data: string[][]; onClose: () => void }) {
  const [view, setView] = useState<'map' | 'list'>('map');
  const [selected, setSelected] = useState<string | null>(null);
  // opens fully expanded — the whole structure is visible at a glance,
  // and branches can be closed from the card handles or the Collapse button
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set<string>());
  const org = useMemo(() => buildOrg(data, collapsed), [data, collapsed]);

  const node = selected ? org.byCode[selected] ?? null : null;
  const parent = node ? org.byCode[node.parent] ?? null : null;
  const siblings = node && parent ? parent.kids.filter((k) => k.code !== node.code) : [];

  /** clicking a card selects it and, if it has a hidden branch, reveals it */
  const onCardClick = (n: OrgNode) => {
    const hasHidden = n.kids.length > 0 && collapsed.has(n.code);
    if (hasHidden) {
      setCollapsed((c) => { const next = new Set(c); next.delete(n.code); return next; });
      setSelected(n.code);
      return;
    }
    setSelected((s) => (s === n.code ? null : n.code));
  };

  const toggleBranch = (n: OrgNode) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(n.code)) next.delete(n.code);
      else next.add(n.code);
      return next;
    });

  /** reveal every ancestor so a related entity is visible when jumped to */
  const revealTo = (code: string) => {
    setCollapsed((c) => {
      const next = new Set(c);
      let cur = org.byCode[code];
      while (cur && cur.parent) {
        next.delete(cur.parent);
        cur = org.byCode[cur.parent];
      }
      return next;
    });
    setSelected(code);
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(initialCollapsed(data));

  /** clicking a related entity moves the selection rather than closing it */
  const relChip = (n: OrgNode, tone: string) => (
    <button
      key={n.code}
      type="button"
      className="fc-h fc-btn"
      onClick={() => revealTo(n.code)}
      title={`${n.name} — ${n.type}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 9px', borderRadius: '8px',
        fontSize: '10.5px', fontWeight: 700, color: tone,
        background: 'rgba(255,255,255,.7)', border: `1px solid ${tone}44`,
      }}
    >
      <b style={{ fontWeight: 700 }}>{n.code}</b>
      <span style={{ fontWeight: 400, color: '#65708C', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {n.name}
      </span>
    </button>
  );

  const seg = (on: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
    ...(on
      ? { background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff', boxShadow: '1px 1px 5px rgba(37,99,235,.35)' }
      : { color: '#65708C' }),
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(35,44,66,.4)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '1000px', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          background: '#ECEFF6', border: '1px solid rgba(255,255,255,.85)', borderRadius: '20px',
          boxShadow: '16px 16px 44px rgba(45,54,80,.42),-8px -8px 24px rgba(255,255,255,.55)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '20px 22px', borderBottom: '1px solid #D9DEE9' }}>
          <span
            style={{
              flex: 'none', width: '44px', height: '44px', borderRadius: '12px',
              background: 'linear-gradient(150deg,#3B82F6,#2563EB)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(37,99,235,.45)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4h6v3H9zM3 16h6v3H3zM15 16h6v3h-6zM12 7v4M6 16v-2h12v2" />
            </svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16.5px', fontWeight: 700, color: '#232C42' }}>Consolidation structure — org chart</div>
            <div style={{ fontSize: '12px', color: '#7A84A0' }}>
              Ownership hierarchy from the Legal Entity Master · {org.nodeCount} entit{org.nodeCount === 1 ? 'y' : 'ies'}
              {org.roots.length > 1 ? ` · ${org.roots.length} top-level` : ''} · consolidation % shown per entity
            </div>
          </div>
          <div
            style={{
              flex: 'none', display: 'flex', gap: '3px', padding: '3px', borderRadius: '11px', background: '#E4E8F0',
              boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.45),inset -2px -2px 5px rgba(255,255,255,.9)',
            }}
          >
            <button type="button" className="fc-btn" onClick={() => setView('map')} style={seg(view === 'map')}>Mind map</button>
            <button type="button" className="fc-btn" onClick={() => setView('list')} style={seg(view === 'list')}>Tree list</button>
          </div>
          <div style={{ flex: 'none', display: 'flex', gap: '6px' }}>
            <button
              type="button" className="fc-h fc-btn" onClick={expandAll}
              title="Reveal every subsidiary"
              style={{ fontSize: '10.5px', fontWeight: 700, color: '#3B5BDB', padding: '6px 11px', borderRadius: '8px', background: '#E4E8F0', boxShadow: '1px 1px 3px rgba(166,175,195,.5),-1px -1px 3px rgba(255,255,255,.9)' }}
            >
              Expand all
            </button>
            <button
              type="button" className="fc-h fc-btn" onClick={collapseAll}
              title="Collapse back to the top level"
              style={{ fontSize: '10.5px', fontWeight: 700, color: '#3B5BDB', padding: '6px 11px', borderRadius: '8px', background: '#E4E8F0', boxShadow: '1px 1px 3px rgba(166,175,195,.5),-1px -1px 3px rgba(255,255,255,.9)' }}
            >
              Collapse
            </button>
          </div>
          <button
            type="button" className="fc-h fc-btn" onClick={onClose} aria-label="Close"
            style={{ width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A84A0' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {org.issues.length > 0 && (
          <div
            role="status"
            style={{
              flex: 'none', margin: '14px 22px 0', padding: '9px 12px', borderRadius: '10px',
              background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.4)',
              fontSize: '11px', color: '#92400E', maxHeight: '86px', overflow: 'auto',
            }}
          >
            <b style={{ fontWeight: 700 }}>
              {org.issues.length} entit{org.issues.length === 1 ? 'y' : 'ies'} could not be placed as entered — shown at the top level.
            </b>{' '}
            Fix the Parent Entity / LE Code in the Legal Entity Master.
            <ul style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
              {org.issues.map((x, i) => (
                <li key={i}><b style={{ fontWeight: 700 }}>{x.code}</b> — {x.msg}</li>
              ))}
            </ul>
          </div>
        )}
        {org.nodeCount === 0 ? (
          <div style={{ flex: 1, minHeight: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '30px', textAlign: 'center' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#232C42' }}>No legal entities yet</div>
            <div style={{ fontSize: '11.5px', color: '#7A84A0', maxWidth: '360px' }}>
              Add entities to the Legal Entity Master (or upload a structure file) and set each one’s Parent Entity — the chart builds itself from those rows.
            </div>
          </div>
        ) : view === 'map' ? (
          <div style={{ flex: 1, minHeight: 0, padding: '22px', overflow: 'auto' }}>
            <div style={{ position: 'relative', width: `${org.canvasW}px`, height: `${org.canvasH}px` }}>
              <svg
                style={{ position: 'absolute', inset: 0, width: `${org.canvasW}px`, height: `${org.canvasH}px`, pointerEvents: 'none' }}
                fill="none" stroke="#B2BACB" strokeWidth="1.6"
              >
                {org.conns.map((d, i) => <path key={i} d={d} />)}
              </svg>
              {org.all.map((n) => {
                const isRoot = n.depth === 0;
                const acc = methodAccent(n.method);
                const dim = n.method === 'Deconsolidated';
                return (
                  <div
                    key={n.code}
                    style={{ position: 'absolute', left: `${org.left(n)}px`, top: `${org.top(n)}px`, width: `${NW}px`, height: `${NH}px` }}
                  >
                    <button
                      type="button"
                      className="fc-h fc-btn"
                      onClick={() => onCardClick(n)}
                      title={
                        n.kids.length && collapsed.has(n.code)
                          ? `${n.name} — click to show ${n.kids.length} subsidiar${n.kids.length === 1 ? 'y' : 'ies'}`
                          : `${n.name} — click for full detail`
                      }
                      style={{
                        boxSizing: 'border-box', width: '100%', height: '100%', display: 'flex',
                        flexDirection: 'column', justifyContent: 'center', gap: '3px', padding: '8px 12px',
                        borderRadius: '13px', borderLeft: `4px solid ${isRoot ? '#1D4ED8' : acc}`,
                        textAlign: 'left', cursor: 'pointer',
                        ...(isRoot
                          ? { background: 'linear-gradient(150deg,#3B82F6,#2563EB)', boxShadow: '0 6px 16px rgba(37,99,235,.38)' }
                          : {
                              background: '#F5F7FC', border: '1px solid #E4E8F2',
                              borderLeft: `4px solid ${acc}`,
                              boxShadow: '3px 3px 10px rgba(166,175,195,.35)',
                              ...(dim ? { opacity: 0.62 } : null),
                            }),
                        ...(selected === n.code
                          ? { boxShadow: `0 0 0 3px rgba(59,130,246,.45), 0 6px 18px rgba(37,99,235,.3)`, opacity: 1 }
                          : null),
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            flex: 'none', whiteSpace: 'nowrap', fontSize: '9px', fontWeight: 700, letterSpacing: '.3px',
                            padding: '1px 6px', borderRadius: '5px', fontVariantNumeric: 'tabular-nums',
                            ...(isRoot
                              ? { color: '#fff', background: 'rgba(255,255,255,.22)' }
                              : { color: '#4055C8', background: '#E4E8F0', border: '1px solid #CBD2E0' }),
                          }}
                        >
                          {n.code}
                        </span>
                        <span
                          style={{
                            flex: 'none', marginLeft: 'auto', fontSize: '9px', fontWeight: 700,
                            padding: '1px 6px', borderRadius: '999px',
                            ...(isRoot
                              ? { color: '#fff', background: 'rgba(255,255,255,.2)' }
                              : { color: '#15803D', background: 'rgba(34,197,94,.13)' }),
                          }}
                        >
                          {n.consol || '—'}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '12px', fontWeight: 700, lineHeight: 1.35, whiteSpace: 'nowrap',
                          overflow: 'hidden', textOverflow: 'ellipsis', color: isRoot ? '#fff' : '#232C42',
                        }}
                      >
                        {n.name || 'Unnamed entity'}
                      </div>
                      <div
                        style={{
                          fontSize: '9.5px', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          color: isRoot ? 'rgba(255,255,255,.85)' : '#7A84A0',
                        }}
                      >
                        {n.type || '—'} · {n.country || '—'}
                      </div>
                    </button>

                    {/* branch handle — subsidiary count, click to open or close */}
                    {n.kids.length > 0 && (
                      <button
                        type="button"
                        className="fc-btn"
                        onClick={(e) => { e.stopPropagation(); toggleBranch(n); }}
                        title={
                          collapsed.has(n.code)
                            ? `Show ${n.kids.length} subsidiar${n.kids.length === 1 ? 'y' : 'ies'}`
                            : `Hide ${n.kids.length} subsidiar${n.kids.length === 1 ? 'y' : 'ies'}`
                        }
                        style={{
                          position: 'absolute', left: '50%', bottom: '-11px', transform: 'translateX(-50%)',
                          zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: '4px',
                          height: '20px', padding: '0 8px', borderRadius: '999px',
                          fontSize: '10px', fontWeight: 700, lineHeight: 1,
                          border: '1px solid #CBD2E0',
                          ...(collapsed.has(n.code)
                            ? { background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff', borderColor: '#2563EB', boxShadow: '0 2px 7px rgba(37,99,235,.4)' }
                            : { background: '#ECEFF6', color: '#7A84A0', boxShadow: '0 2px 6px rgba(166,175,195,.45)' }),
                        }}
                      >
                        {collapsed.has(n.code) ? `+${n.kids.length}` : '−'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, padding: '18px 22px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {org.flat.map((n) => (
              <div key={n.code} style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ flex: 'none', width: `${n.depth * 30}px` }} />
                {n.depth > 0 && (
                  <span style={{ flex: 'none', width: '20px', color: '#9AA3BA', fontSize: '15px', lineHeight: 1, marginRight: '2px' }}>└</span>
                )}
                {n.kids.length > 0 ? (
                  <button
                    type="button"
                    className="fc-btn"
                    onClick={(e) => { e.stopPropagation(); toggleBranch(n); }}
                    title={collapsed.has(n.code) ? `Show ${n.kids.length} subsidiaries` : `Hide ${n.kids.length} subsidiaries`}
                    style={{
                      flex: 'none', width: '22px', height: '22px', marginRight: '7px', borderRadius: '6px',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, border: '1px solid #CBD2E0',
                      ...(collapsed.has(n.code)
                        ? { background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff', borderColor: '#2563EB' }
                        : { background: '#E4E8F0', color: '#4055C8' }),
                    }}
                  >
                    {collapsed.has(n.code) ? '+' : '−'}
                  </button>
                ) : (
                  <span style={{ flex: 'none', width: '22px', marginRight: '7px' }} />
                )}
                <button
                  type="button"
                  className="fc-h fc-btn"
                  onClick={() => onCardClick(n)}
                  title={
                    n.kids.length && collapsed.has(n.code)
                      ? `${n.name} — click to show ${n.kids.length} subsidiaries`
                      : `${n.name} — click for full detail`
                  }
                  style={{
                    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '13px',
                    padding: '11px 15px', borderRadius: '13px', textAlign: 'left', cursor: 'pointer',
                    background: n.depth === 0 ? 'linear-gradient(155deg,rgba(59,130,246,.13),rgba(255,255,255,.5))' : '#F5F7FC',
                    border: `1px solid ${n.depth === 0 ? '#7C97E8' : '#E4E8F2'}`,
                    boxShadow: selected === n.code
                      ? '0 0 0 3px rgba(59,130,246,.4), 3px 3px 10px rgba(166,175,195,.3)'
                      : '3px 3px 10px rgba(166,175,195,.3)',
                  }}
                >
                  <span
                    style={{
                      flex: 'none', fontSize: '10.5px', fontWeight: 700, color: '#4055C8', background: '#E4E8F0',
                      border: '1px solid #CBD2E0', borderRadius: '6px', padding: '2px 8px', fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {n.code}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#232C42', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {n.name || 'Unnamed entity'}
                    </span>
                    <span style={{ display: 'block', fontSize: '11px', color: '#7A84A0' }}>{n.type || '—'} · {n.country || '—'}</span>
                  </span>
                  {n.cls && n.cls !== '—' && (
                    <span
                      style={{
                        flex: 'none', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.4px',
                        padding: '2px 7px', borderRadius: '5px',
                        ...(n.cls === 'RCFC'
                          ? { color: '#B45309', background: 'rgba(245,158,11,.14)' }
                          : { color: '#0E7490', background: 'rgba(14,116,144,.12)' }),
                      }}
                    >
                      {n.cls}
                    </span>
                  )}
                  <span style={{ flex: 'none', fontSize: '11px', color: '#65708C' }}>
                    Consol <b style={{ color: '#232C42', fontWeight: 700 }}>{n.consol || '—'}</b>
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ---- expansion drawer: everything the card had no room for ---- */}
        {node && (
          <div
            style={{
              flex: 'none', maxHeight: '46%', overflow: 'auto',
              borderTop: '1px solid #D9DEE9', background: '#E7EAF2',
              animation: 'fcPop .2s cubic-bezier(.2,.9,.3,1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 22px 10px' }}>
              <span
                style={{
                  flex: 'none', fontSize: '11px', fontWeight: 700, color: '#4055C8', background: '#E4E8F0',
                  border: '1px solid #CBD2E0', borderRadius: '7px', padding: '4px 9px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {node.code}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#232C42' }}>{node.name || 'Unnamed entity'}</div>
                <div style={{ fontSize: '11px', color: '#7A84A0', marginTop: '2px' }}>
                  {node.type || '—'} · {node.country || '—'}
                  {node.method ? ` · ${node.method}` : ''}
                </div>
              </div>
              <button
                type="button" className="fc-h fc-btn" onClick={() => setSelected(null)} aria-label="Collapse detail"
                style={{
                  flex: 'none', width: '26px', height: '26px', borderRadius: '7px', color: '#7A84A0',
                  background: '#E0E4EE', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {/* related entities — click to walk the structure */}
            {(parent || node.kids.length > 0 || siblings.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '0 22px 12px' }}>
                {parent && (
                  <>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9AA3BA' }}>Parent</span>
                    {relChip(parent, '#2563EB')}
                  </>
                )}
                {node.kids.length > 0 && (
                  <>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9AA3BA', marginLeft: parent ? '6px' : 0 }}>
                      Subsidiaries ({node.kids.length})
                    </span>
                    {node.kids.map((k) => relChip(k, '#15803D'))}
                  </>
                )}
                {siblings.length > 0 && (
                  <>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9AA3BA', marginLeft: '6px' }}>
                      Siblings ({siblings.length})
                    </span>
                    {siblings.map((s) => relChip(s, '#7A84A0'))}
                  </>
                )}
              </div>
            )}

            {/* the columns the card could not carry */}
            <div style={{ padding: '0 22px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {DETAIL_GROUPS.map((g) => (
                <div key={g.title}>
                  <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#9AA3BA', marginBottom: '6px' }}>
                    {g.title}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '8px' }}>
                    {g.cols.map((ci) => <DetailField key={ci} ci={ci} value={node.row[ci] ?? ''} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

/** width of the pinned Save column in the Legal Entity Master grid */
const LE_SAVE_W = 84;

/** blank entity row — auto columns stay em-dash until their inputs are filled */
const blankEntity = (): string[] => LE_COLS.map(() => '');

/** Own. Total (col 7) is derived from Direct (5) + Indirect (6) */
const withDerived = (r: string[]): string[] => {
  const pct = (v: string) => {
    const n = parseFloat(String(v).replace('%', ''));
    return Number.isFinite(n) ? n : null;
  };
  const d = pct(r[5]);
  const i = pct(r[6]);
  const next = [...r];
  next[7] = d === null && i === null ? '' : `${(d ?? 0) + (i ?? 0)}%`;
  return next;
};

function LegalEntityMaster() {
  // const [data, setData] = useState<string[][]>(() => LE_DATA.map((r) => [...r]));
  const [data, setData] = useState<string[][]>([]);
  /** each row as last saved in the database, index-aligned with `data`; null = never saved (new / imported) */
  const [base, setBase] = useState<(string[] | null)[]>([]);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  /** confirmation (or error) shown above the table after a row Save */
  const [rowMsg, setRowMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!rowMsg?.ok) return;
    const t = window.setTimeout(() => setRowMsg(null), 6000);
    return () => window.clearTimeout(t);
  }, [rowMsg]);
  const [loadState,setLoadState] = useState<{ loading: boolean; error: string | null }>({ loading: true, error: null });

  // load the grid from legal_entity_master (via GET /api/v1/engagements/:id/entities)
  useEffect(() => {
    const ctrl = new AbortController();
    engagementSetupApi
      .listEntities(ENGAGEMENT_ID, ctrl.signal)
      .then((list) => {
        const loaded = list.map(entityToRow);
        setData(loaded);
        setBase(loaded);
        setLoadState({ loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setLoadState({ loading: false, error: e instanceof Error ? e.message : 'Could not load legal entities' });
      });
    return () => ctrl.abort();
  }, []);

  const [added, setAdded] = useState<number[]>([]);
  const [edit, setEdit] = useState<{ ri: number; ci: number } | null>(null);
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<number[]>([]);
  const [full, setFull] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);


  /** distinct existing values power the dropdown columns */
  const optionsFor = (ci: number) =>
    Array.from(new Set(data.map((r) => r[ci]).filter((v) => v && v !== '—'))).sort();

  const setCell = (ri: number, ci: number, v: string) =>
    setData((d) => d.map((r, i) => (i === ri ? withDerived(Object.assign([...r], { [ci]: v })) : r)));

  /** write one row to legal_entity_master: PATCH the changed fields of a saved entity, POST a new one */
  const saveRow = async (i: number) => {
    const r = data[i];
    const prev = base[i] ?? null;
    setSavingRow(i);
    setRowMsg(null);
    try {
      const input = rowToInput(r);
      // the Parent Entity cell may hold the parent's LE Name — the database stores its LE Code
      if (input.parentCode) {
        const k = input.parentCode.trim().toLowerCase();
        const hit = data.find((x) => blankCell(x[0]).toLowerCase() === k) ?? data.find((x) => blankCell(x[1]).toLowerCase() === k);
        if (hit) input.parentCode = blankCell(hit[0]);
      }
      let saved: LegalEntity;
      if (!prev) {
        saved = await engagementSetupApi.createEntity(ENGAGEMENT_ID, input);
      } else {
        const before = rowToInput(prev);
        if (input.code !== before.code) throw new Error(`LE Code cannot be changed once saved (was “${before.code}”)`);
        const patch: Record<string, unknown> = {};
        (Object.keys(input) as (keyof LegalEntityInput)[]).forEach((k) => {
          if (k !== 'code' && input[k] !== before[k]) patch[k] = input[k];
        });
        saved = await engagementSetupApi.updateEntity(ENGAGEMENT_ID, before.code, patch as LegalEntityPatch);
      }
      const fresh = entityToRow(saved);
      setData((d) => d.map((x, j) => (j === i ? fresh : x)));
      setBase((b) => b.map((x, j) => (j === i ? fresh : x)));
      setAdded((a) => a.filter((x) => x !== i));
      setRowMsg({ ok: true, text: `${saved.code} — ${saved.name} ${prev ? 'updated' : 'added'} in the Legal Entity Master.` });
    } catch (e) {
      const why = e instanceof Error ? friendlyError(e.message) : 'unexpected error';
      setRowMsg({ ok: false, text: `Could not save ${blankCell(r[0]) || 'the new row'} — ${why}` });
    } finally {
      setSavingRow(null);
    }
  };

  const addEntity = () => {
    setBase((b) => [...b, null]);
    setData((d) => {
      const next = [...d, blankEntity()];
      setAdded((a) => [...a, next.length - 1]);
      setEdit({ ri: next.length - 1, ci: 0 });
      return next;
    });
    // a new row must be visible to be filled in
    setSearch('');
    g.setFilters({});
  };

  const deleteSelected = () => {
    setData((d) => d.filter((_, i) => !sel.includes(i)));
    setBase((b) => b.filter((_, i) => !sel.includes(i)));
    // removing rows shifts every index above them, so remap rather than reset
    setAdded((a) =>
      a
        .filter((idx) => !sel.includes(idx))
        .map((idx) => idx - sel.filter((s) => s < idx).length),
    );
    setSel([]);
    setEdit(null);
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.map((r, i) => ({ r, i })).filter(({ r }) => !q || r.join(' ').toLowerCase().includes(q));
  }, [data, search]);

  /* shared table kit — ⋮ menu, filters, sort, freeze, drag to move, resize */
  const leCols = useMemo<GridCol[]>(() => LE_COLS.map((label, ci) => ({ key: `c${ci}`, label, w: ci === 1 ? 210 : 132 })), []);
  const g = useGrid<{ r: string[]; i: number }>('eng-le-structure', leCols, rows, (x, k) => x.r[Number(k.slice(1))] ?? '', {
    lead: 38, defFreeze: 'c1', rowKey: (x) => String(x.i),
  });

  const allChecked = g.rows.length > 0 && g.rows.every(({ i }) => sel.includes(i));


  return (
    <section
      style={{
        ...SECTION_SHELL,
        ...(full
          ? { position: 'fixed', top: 0, right: 0, bottom: 0, left: '68px', zIndex: 400, borderRadius: 0 }
          : { flex: 1, minHeight: 0, borderRadius: '18px' }),
      }}
    >
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '360px' }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9AA3BA" strokeWidth="2" strokeLinecap="round"
            style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities…"
            style={{ ...INSET_INPUT, padding: '0 12px 0 32px' }}
          />
        </div>
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: sel.length ? '#3B5BDB' : '#7A84A0' }}>
          {sel.length
            ? `${sel.length} selected`
            : loadState.loading
              ? 'Loading entities…'
              : loadState.error
                ? `Could not load entities — ${loadState.error}`
                : `${data.length} entities · click any cell to edit`}
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="fc-h fc-btn"
          onClick={addEntity}
          style={{ ...CRUD_BASE, color: '#15803D' }}
          title="Add a blank row and start filling in the new legal entity"
        >
          ＋ New entity
        </button>
        <button
          type="button" className="fc-h fc-btn" onClick={() => setUploadOpen(true)}
          style={{ ...CRUD_BASE, color: '#2563EB' }}
          title="Bulk-import the whole structure from a completed template (.csv)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
          </svg>
          Upload structure
        </button>
        <button
          type="button" className="fc-h fc-btn" disabled={!sel.length}
          onClick={deleteSelected}
          style={sel.length ? { ...CRUD_BASE, color: '#B42318' } : CRUD_OFF}
          title={sel.length ? `Remove ${sel.length} selected entit${sel.length === 1 ? 'y' : 'ies'}` : 'Select rows to delete'}
        >
          🗑 Delete
        </button>
        <button
          type="button" className="fc-h fc-btn" onClick={() => setOrgOpen(true)}
          style={{ ...CRUD_BASE, color: '#4055C8' }}
          title="View the consolidation structure as an org chart"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5h6v3H9zM3 16h6v3H3zM15 16h6v3h-6zM12 8v4M6 16v-2h12v2" />
          </svg>
          Org chart
        </button>
        <button
          type="button" className="fc-h fc-btn" onClick={() => setFull((v) => !v)}
          style={{ ...CRUD_BASE, color: '#65708C' }}
          title={full ? 'Exit full screen' : 'View table full screen'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={full ? 'M9 4v5H4M15 20v-5h5M20 9h-5V4M4 15h5v5' : 'M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5'} />
          </svg>
        </button>
      </div>

      {g.hasFilters && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#3B5BDB' }}>{g.rows.length} of {g.total} entities shown — filtered or sorted from the column ⋮ menus</span>
          <button type="button" className="fc-btn" onClick={g.clearAll} style={{ fontSize: '11px', fontWeight: 700, color: '#7A84A0' }}>Clear filters</button>
        </div>
      )}

      {/* field-type legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '13px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9AA3BA' }}>
          Field types
        </span>
        {LE_LEGEND.map((l) => (
          <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: '#65708C' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: l.color, border: `1px solid ${l.bd}` }} />
            {l.label}
          </span>
        ))}
      </div>

      {rowMsg && (
        <div
          role={rowMsg.ok ? 'status' : 'alert'}
          style={{
            display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px', padding: '8px 12px', borderRadius: '10px',
            fontSize: '11.5px', fontWeight: 700,
            ...(rowMsg.ok
              ? { color: '#15803D', background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.4)' }
              : { color: '#B42318', background: 'rgba(240,68,56,.1)', border: '1px solid rgba(240,68,56,.38)' }),
          }}
        >
          <span aria-hidden>{rowMsg.ok ? '✓' : '!'}</span>
          <span style={{ flex: 1 }}>{rowMsg.text}</span>
          <button type="button" className="fc-btn" onClick={() => setRowMsg(null)} aria-label="Dismiss message" style={{ color: 'inherit', fontSize: '13px', lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* grid */}
      <div style={{ overflow: 'auto', border: '1px solid #DCE0EB', borderRadius: '12px', flex: 1, minHeight: 0 }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%', font: 'inherit', tableLayout: 'fixed' }}>
          <thead>
            <GridHead
              g={g}
              lead={(
                <input
                  type="checkbox"
                  checked={allChecked}
                  aria-label="Select all entities"
                  onChange={() => setSel(allChecked ? [] : g.rows.map(({ i }) => i))}
                  style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#3B5BDB' }}
                />
              )}
              trail={<span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.45px' }}>ACTION</span>}
              trailWidth={LE_SAVE_W}
            />
          </thead>
          <tbody>
            {g.rows.map(({ r, i }) => {
              const on = sel.includes(i);
              const isNew = added.includes(i);
              const rowBg = on ? '#E2E8FB' : isNew ? '#EAF4EC' : '#ECEFF6';
              return (
                <tr key={i}>
                  <td style={g.leadStyle(rowBg, { background: rowBg })}>
                    <input
                      type="checkbox"
                      checked={on}
                      aria-label="Select entity"
                      onChange={() => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))}
                      style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#3B5BDB' }}
                    />
                  </td>
                  {g.cols.map((c) => {
                    const ci = Number(c.key.slice(1));
                    const v = r[ci] ?? '';
                    const ft = LE_TYPES[ci] ?? 'text';
                    const tone: React.CSSProperties =
                      ci === 0 ? { fontWeight: 700, color: '#232C42' }
                        : ci === 1 ? { color: '#333D55', fontWeight: 600 }
                          : ft === 'auto' ? { color: '#6D28D9', fontStyle: 'italic' }
                            : ci === 20 && v !== '—' ? { color: '#B45309', fontWeight: 700 }
                              : { color: '#65708C' };
                    const editable = ft !== 'auto';
                    const isEditing = edit?.ri === i && edit?.ci === ci;
                    // field-type tint, unless the row is selected / new
                    const bg = on || isNew ? rowBg : TYPE_TINT[ft] ?? rowBg;

                    const commit = () => setEdit(null);
                    const step = (delta: number) => {
                      // Tab walks to the next editable column, in the order shown
                      const order = g.cols.map((x) => Number(x.key.slice(1)));
                      let at = order.indexOf(ci) + delta;
                      while (at >= 0 && at < order.length && LE_TYPES[order[at]] === 'auto') at += delta;
                      setEdit(at >= 0 && at < order.length ? { ri: i, ci: order[at] } : null);
                    };

                    return (
                      <td
                        key={c.key}
                        onClick={() => { if (editable && !isEditing) setEdit({ ri: i, ci }); }}
                        title={editable ? 'Click to edit' : 'Auto-computed'}
                        style={{ ...g.td(c, bg, { background: bg }), fontSize: '10.5px', ...tone, ...(isEditing ? { padding: '0 4px', overflow: 'visible' } : null), ...(editable ? { cursor: 'text' } : null) }}
                      >
                        {isEditing ? (
                          ft === 'dropdown' ? (
                            <select
                              autoFocus
                              value={v}
                              onChange={(e) => setCell(i, ci, e.target.value)}
                              onBlur={commit}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commit(); }}
                              style={EDIT_CELL}
                            >
                              <option value="">—</option>
                              {optionsFor(ci).map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input
                              autoFocus
                              value={v}
                              placeholder={ft === 'pct' ? '0%' : ft === 'date' ? 'DD Mmm YYYY' : ''}
                              onChange={(e) => setCell(i, ci, e.target.value)}
                              onBlur={commit}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') commit();
                                else if (e.key === 'Enter') commit();
                                else if (e.key === 'Tab') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
                              }}
                              style={EDIT_CELL}
                            />
                          )
                        ) : v ? (
                          // one line with an ellipsis; double-click shows the full value (single click edits)
                          <span onDoubleClick={(e) => { e.stopPropagation(); g.toggleOpen(String(i), c.key); }}
                            title={g.isOpen(String(i), c.key) ? undefined : `${v}\n— double-click to show in full`}
                            style={g.isOpen(String(i), c.key)
                              ? { display: 'block', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.45, padding: '7px 0' }
                              : { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {v}
                          </span>
                        ) : (isNew ? <span style={{ color: '#A6AEC2', fontStyle: 'italic' }}>—</span> : '')}
                      </td>
                    );
                  })}
                  {/* Save — appears only once the row differs from what is in the database */}
                  <td
                    style={{
                      width: `${LE_SAVE_W}px`, minWidth: `${LE_SAVE_W}px`, maxWidth: `${LE_SAVE_W}px`, height: `${ROW_H}px`,
                      boxSizing: 'border-box', padding: '0 6px', textAlign: 'center', verticalAlign: 'middle',
                      borderBottom: '1px solid #E1E5EF', position: 'sticky', right: 0, zIndex: 2, background: rowBg,
                      boxShadow: '-6px 0 10px -8px rgba(60,70,100,.45)',
                    }}
                  >
                    {rowChanged(r, base[i] ?? null) && (
                      <button
                        type="button" className="fc-h fc-btn"
                        disabled={savingRow !== null}
                        // mousedown fires before the cell editor's blur, so one click both commits the edit and saves
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setEdit(null); saveRow(i); }}
                        title={base[i] ? 'Save the changes in this row to the database' : 'Add this entity to the database'}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px', height: '24px', padding: '0 10px',
                          borderRadius: '7px', fontSize: '10.5px', fontWeight: 700, color: '#fff',
                          background: 'linear-gradient(145deg,#3B82F6,#2563EB)', boxShadow: '0 2px 6px rgba(37,99,235,.35)',
                          opacity: savingRow !== null && savingRow !== i ? 0.5 : 1,
                          cursor: savingRow !== null ? 'default' : 'pointer',
                        }}
                      >
                        {savingRow === i ? 'Saving…' : 'Save'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {orgOpen && <OrgChart data={data} onClose={() => setOrgOpen(false)} />}

      {uploadOpen && (
        <StructureUpload
          existing={data}
          onClose={() => setUploadOpen(false)}
          onImport={(incoming) => {
            setBase((b) => [...b, ...incoming.map(() => null)]);
            setData((d) => {
              const next = [...d, ...incoming];
              // mark the imported block so it reads as newly added
              setAdded((a) => [...a, ...incoming.map((_, i) => d.length + i)]);
              return next;
            });
            setSearch('');
            g.setFilters({});
            setSel([]);
          }}
        />
      )}
    </section>
  );
}

/* ================= step 2 · engagement configuration ================= */

type Kind = 'input' | 'textarea' | 'select' | 'multiselect' | 'toggle' | 'seg' | 'auto' | 'subhead';
type Field = {
  id: string;
  label: string;
  kind: Kind;
  key?: string;
  req?: boolean;
  auto?: boolean;
  opts?: string[];
  inputType?: string;
  ph?: string;
  help?: string;
};
type CfgSection = { letter: string; title: string; fields: Field[] };

const YN = ['No', 'Yes'];

const SECTIONS: CfgSection[] = [
  {
    letter: 'A', title: 'Entity Identification & Framework',
    fields: [
      // options come from the LE Name column of legal_entity_master (loaded in EngagementConfiguration)
      { id: 'A1', label: 'Entity / company name', kind: 'multiselect', key: 'entity_name', req: true, help: 'Legal name printed on every statement header. Pick one or more from the Legal Entity Master.' },
      { id: 'A2', label: 'Entity CIN / registration ID', kind: 'input', key: 'entity_id', req: true, help: 'CIN (India), company number (UK) or EIN (US). Links to the entity master.' },
      { id: 'A3', label: 'Reporting framework', kind: 'select', key: 'reporting_framework', req: true, opts: ['Ind AS (Sch 3 Div II)', 'IFRS', 'US GAAP (private)', 'US GAAP (SEC)'], help: 'Top-level driver — sets comparative defaults, disclosure depth, ageing and ratio requirements.' },
      { id: 'A4', label: 'SEC registrant type', kind: 'select', key: 'sec_registrant_type', req: true, opts: ['Standard', 'SRC (Smaller Reporting Co.)', 'EGC (Emerging Growth Co.)', 'Large accelerated', 'Accelerated', 'Non-accelerated'], help: 'Drives P&L comparative exceptions.' },
    ],
  },
  {
    letter: 'B', title: 'Fiscal Year Structure',
    fields: [
      { id: 'B1', label: 'Fiscal year type', kind: 'select', key: 'fiscal_year_type', req: true, opts: ['Calendar year (Jan-Dec)', 'Fixed fiscal year (custom month-end)', '52-53 week fiscal year'], help: 'Calendar: Jan 1 – Dec 31. Fixed: any month-end (Apr–Mar for India).' },
      { id: 'B2', label: 'FY start date', kind: 'input', key: 'fy_start_date', req: true, inputType: 'date', help: 'First day of the current reporting period. Must be on or before the period end.' },
      { id: 'B3', label: 'Period length (months)', kind: 'input', key: 'period_length_months', req: true, inputType: 'number', help: '1–18. <12 = short first year, >12 = extended (max 18 per Companies Act Sec 2(41)).' },
      { id: 'B4', label: 'Reporting period end (BS date)', kind: 'input', key: 'reporting_period_end', req: true, inputType: 'date', help: 'Auto-derived as FY start + length − 1 day. Overridable for 52-53 week years.' },
      { id: 'B5head', label: '52-53 week fiscal year configuration', kind: 'subhead' },
      { id: 'B5a', label: 'End day of week', kind: 'select', key: 'week_end_day', opts: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], help: 'The weekday the FY always ends on.' },
      { id: 'B5b', label: 'Anchor method', kind: 'select', key: 'week_anchor_method', opts: ['Nearest to month-end', 'Last in month'], help: 'Nearest: the weekday nearest to the anchor month-end. Last: the last such weekday in the anchor month.' },
      { id: 'B5c', label: 'Anchor month', kind: 'select', key: 'week_anchor_month', opts: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], help: 'The calendar month the FY end is anchored to.' },
      { id: 'B5d', label: 'Quarter week pattern', kind: 'select', key: 'week_quarter_pattern', opts: ['4-4-5', '4-5-4', '5-4-4'], help: 'How 52/53 weeks distribute across quarters. 4-4-5 is the US NRF retail standard.' },
      { id: 'B5e', label: 'Custom week rule (free text)', kind: 'input', key: 'week_custom_rule', ph: 'e.g. Saturday nearest January 31', help: 'For non-standard rules. Printed in the accounting policy note.' },
    ],
  },
  {
    letter: 'C', title: 'Report Type & Data Ingestion',
    fields: [
      { id: 'C1', label: 'Report type (output)', kind: 'select', key: 'report_type', req: true, opts: ['Annual', 'Interim (half-yearly)', 'Interim (quarterly)', 'Interim Ind AS 34 (SEBI LODR)'], help: 'MASTER BRANCH. Annual reveals comparatives (Section D); any interim value reveals Section F and hides D.' },
      { id: 'C2', label: 'TB ingestion granularity', kind: 'select', key: 'tb_granularity', req: true, opts: ['Monthly', 'Quarterly', 'Semi-annual', 'Annual', 'Custom'], help: 'How often TB files are uploaded per entity per FY. Must be at least as frequent as the report type.' },
      { id: 'C3', label: 'Custom sub-period count', kind: 'input', key: 'custom_sub_period_count', inputType: 'number', help: 'Exact number of sub-periods when standard options don’t fit. Range 1–18.' },
      { id: 'C4', label: 'Adjustment periods enabled', kind: 'seg', key: 'adj_enabled', help: 'Period 13+ for audit / year-end adjustments. Posts to the annual total but tracked separately.' },
      { id: 'C5', label: 'Number of adjustment periods', kind: 'select', key: 'adj_count', opts: ['1', '2', '3', '4'], help: '1 = year-end accruals. SAP uses up to 4 (accruals, audit, tax, carry-forward).' },
      { id: 'C6', label: 'Adjustment period labels', kind: 'input', key: 'adj_labels', ph: 'e.g. Year-end accruals, Audit adjustments', help: 'Comma-separated. Auto-generated if blank. Shown on the TB upload screen.' },
    ],
  },
  {
    letter: 'D', title: 'Comparative Periods — Annual reports only',
    fields: [
      { id: 'D1', label: 'Comparative years', kind: 'select', key: 'comparative_years', opts: ['0', '1', '2', '3', '4'], help: 'Prior years alongside the current year. Ind AS ageing needs 3-yr data; SEC P&L min 2.' },
      { id: 'D2', label: 'PY end date', kind: 'input', key: 'py_end', inputType: 'date', auto: true, help: 'Auto: BS date − 1 FY. Override for a short / extended PY.' },
      { id: 'D3', label: 'PY period length (months)', kind: 'input', key: 'py_len', inputType: 'number', auto: true, help: 'Auto = same as current period. If different, triggers the comparability footnote.' },
      { id: 'D4', label: 'PY-1 end date', kind: 'auto', key: 'py1_end', auto: true, help: 'Auto: PY − 1 FY. Required by Ind AS ageing even when only 1 comparative is presented.' },
      { id: 'D5', label: 'PY-2 end date', kind: 'auto', key: 'py2_end', auto: true, help: 'Auto: PY-1 − 1 FY. SEC 10-K P&L carries 3 years by default.' },
    ],
  },
  {
    letter: 'E', title: 'Triggered Conditions',
    fields: [
      { id: 'Ehead1', label: 'Restatement / reclassification', kind: 'subhead' },
      { id: 'E1', label: 'Retrospective accounting policy change', kind: 'select', key: 'has_retro_policy', opts: YN, help: 'Ind AS / IFRS — a new policy applied fully retrospectively can trigger a third balance sheet.' },
      { id: 'E2', label: 'Prior-period error restatement', kind: 'select', key: 'has_prior_error', opts: YN, help: 'Material prior-period error corrected retrospectively (IAS 8 / Ind AS 8).' },
      { id: 'E3', label: 'Reclassification of BS items', kind: 'select', key: 'has_reclass', opts: YN, help: 'Items reclassified between balance-sheet line items.' },
      { id: 'E4', label: 'Material effect on opening BS?', kind: 'select', key: 'is_material_opening', req: true, opts: YN, help: 'GATE (IAS 1.40A(b)): the third BS is only required when a trigger is Yes AND this is also Yes.' },
      { id: 'E8', label: 'Description of change', kind: 'textarea', key: 'desc_change', req: true, ph: 'e.g. Change in revenue recognition policy per Ind AS 115 amendment', help: 'Free text for the IAS 8 / Ind AS 8 disclosure note.' },
      { id: 'Ehead2', label: 'First-time adoption (Ind AS 101 / IFRS 1)', kind: 'subhead' },
      { id: 'E9', label: 'First-time adoption of Ind AS / IFRS', kind: 'select', key: 'is_fta', opts: YN, help: 'First year under Ind AS / IFRS. Adds a transition-date BS and reconciliations.' },
      { id: 'E10', label: 'Transition date', kind: 'input', key: 'fta_transition_date', inputType: 'date', req: true, help: 'Opening BS date — typically April 1 of the year before the first Ind AS year.' },
      { id: 'E11', label: 'Previous GAAP', kind: 'select', key: 'fta_prev_gaap', req: true, opts: ['Indian GAAP (AS)', 'Local GAAP (other)', 'US GAAP'], help: 'The GAAP transitioning from. Drives which reconciliations are produced.' },
      { id: 'Ehead3', label: 'Change in accounting period', kind: 'subhead' },
      { id: 'E13', label: 'Change in accounting period', kind: 'select', key: 'period_changed', opts: YN, help: 'Did the entity change its FY end (e.g. Dec to Mar)? Triggers a comparability footnote.' },
      { id: 'E15', label: 'Reason for change', kind: 'textarea', key: 'change_reason', req: true, ph: 'e.g. To align with parent company reporting calendar', help: 'Required by IAS 1.36. Printed in the accounting policy note.' },
    ],
  },
  {
    letter: 'F', title: 'Interim Period Configuration — Interim reports only',
    fields: [
      { id: 'F1', label: 'Interim frequency', kind: 'select', key: 'interim_frequency', req: true, opts: ['Quarterly', 'Half-yearly'], help: 'Quarterly: P&L gets 4 columns (Q + PY Q + YTD + PY YTD).' },
      { id: 'F2', label: 'Current quarter number', kind: 'select', key: 'current_quarter', req: true, opts: ['Q1', 'Q2', 'Q3', 'Q4'], help: 'Which quarter this report covers. Q1: YTD column suppressed.' },
      { id: 'F3', label: 'Interim period start', kind: 'input', key: 'interim_start', inputType: 'date', auto: true, help: 'First day of the current interim period. Auto-derived, overridable.' },
      { id: 'F4', label: 'Interim period end (BS date)', kind: 'input', key: 'interim_end', inputType: 'date', auto: true, help: 'Last day of the current interim period — the BS date for the interim report.' },
      { id: 'F8', label: 'Include full PY annual column (P&L)', kind: 'seg', key: 'include_py_annual', help: 'Adds a full prior-year annual P&L column. Mandated by SEBI LODR Reg 33.' },
      { id: 'F9', label: 'Include PY comparable-quarter BS', kind: 'seg', key: 'include_py_bs', help: 'Adds a PY comparable-quarter BS column. Common in practice for seasonality (S-X 10-01(c)(1)).' },
    ],
  },
  {
    letter: 'G', title: 'Currency & FX Rate Alignment',
    fields: [
      { id: 'G1', label: 'Multi-currency entity', kind: 'toggle', key: 'is_multi_currency', help: 'Is the entity’s functional currency different from the group presentation currency? When No, the rest of Section G is hidden.' },
      { id: 'G2', label: 'Functional currency', kind: 'select', key: 'functional_currency', req: true, opts: ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AED', 'SGD'], help: 'ISO 4217 code — the currency of the primary economic environment.' },
      { id: 'G3', label: 'Presentation currency', kind: 'select', key: 'presentation_currency', req: true, opts: ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AED', 'SGD'], help: 'ISO 4217 code — the currency the statements are presented in.' },
      { id: 'G4', label: 'Closing rate date rule', kind: 'select', key: 'closing_rate_rule', opts: ['Period end date', 'Last business day'], help: 'Which date’s rate is used for BS translation.' },
      { id: 'G5', label: 'Average rate method (P&L)', kind: 'select', key: 'avg_rate_method', req: true, opts: ['Simple monthly average', 'Weighted daily average', 'Single period rate', 'Custom (manual entry)'], help: 'How the P&L translation rate is computed.' },
      { id: 'G6', label: 'Rate source', kind: 'input', key: 'rate_source', ph: 'e.g. RBI reference rate', help: 'Where rates come from. Printed in the FX accounting policy note.' },
    ],
  },
];

type Cfg = Record<string, string>;

const FIELD_INPUT: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: '32px',
  background: '#E4E8F0',
  border: '1px solid #CBD2E0',
  boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.35),inset -2px -2px 5px rgba(255,255,255,.9)',
  borderRadius: '9px',
  color: '#333D55',
  font: 'inherit',
  fontSize: '12px',
  padding: '0 10px',
  outline: 'none',
};

/** A multi-select answer is stored in the (string) config value as names joined by this separator. */
const MULTI_SEP = '; ';

/** Dropdown with a checkbox per option; the value is the selected options joined by MULTI_SEP. */
function MultiSelect({
  value, options, loading, onChange, disabled = false,
}: {
  value: string;
  options: string[];
  loading: boolean;
  onChange: (v: string) => void;
  /** read-only: the chosen entities are shown but cannot be changed (used when editing a saved configuration) */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? value.split(MULTI_SEP).filter(Boolean) : [];
  // keep an already-chosen name visible even if it is no longer in the master
  const all = Array.from(new Set([...selected, ...options]));

  const toggle = (name: string) =>
    onChange((selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]).join(MULTI_SEP));

  const placeholder = loading ? 'Loading entities…' : all.length ? '— Select entities —' : 'No legal entities found';

  return (
    <div style={{ position: 'relative' }}>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 25 }} onClick={() => setOpen(false)} />}
      {/* the field shows every chosen entity as a chip with its own × to cancel it */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        aria-disabled={disabled}
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen((o) => !o); } }}
        style={{
          ...FIELD_INPUT, height: 'auto', minHeight: '32px', padding: '4px 10px', cursor: disabled ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px',
          ...(disabled ? { opacity: 0.85 } : null),
        }}
      >
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {selected.length === 0 && <span style={{ color: '#8A93A8' }}>{placeholder}</span>}
          {selected.map((name) => (
            <span
              key={name}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px', maxWidth: '100%', padding: '2px 4px 2px 8px',
                borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: '#3B5BDB',
                background: 'rgba(59,91,219,.12)', border: '1px solid rgba(59,91,219,.28)',
              }}
            >
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: disabled ? '4px' : 0 }} title={name}>{name}</span>
              {!disabled && (
                <button
                  type="button"
                  className="fc-btn"
                  aria-label={`Remove ${name}`}
                  title={`Remove ${name}`}
                  onClick={(e) => { e.stopPropagation(); toggle(name); }}
                  style={{
                    flex: 'none', width: '16px', height: '16px', borderRadius: '50%', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', color: '#3B5BDB', background: 'rgba(59,91,219,.16)',
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              )}
            </span>
          ))}
        </span>
        {!disabled && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7A84A0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
            <path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        )}
      </div>

      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', marginTop: '4px', left: 0, right: 0, zIndex: 30, maxHeight: '240px', overflow: 'auto',
            background: '#ECEFF6', border: '1px solid #CBD2E0', borderRadius: '10px', padding: '6px',
            boxShadow: '0 14px 30px -10px rgba(50,60,90,.4),4px 4px 12px rgba(166,175,195,.45)',
          }}
        >
          {all.length === 0 ? (
            <div style={{ padding: '10px', fontSize: '11.5px', fontStyle: 'italic', color: '#9AA3BA' }}>
              {loading ? 'Loading entities…' : 'No legal entities found'}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '12px', padding: '4px 8px 6px', borderBottom: '1px solid #D9DEE9', marginBottom: '4px' }}>
                <button type="button" className="fc-btn" onClick={() => onChange(all.join(MULTI_SEP))} style={{ fontSize: '10.5px', fontWeight: 700, color: '#3B5BDB' }}>Select all</button>
                <button type="button" className="fc-btn" onClick={() => onChange('')} style={{ fontSize: '10.5px', fontWeight: 700, color: '#7A84A0' }}>Clear</button>
              </div>
              {all.map((name) => (
                <label
                  key={name}
                  className="fc-h"
                  style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', color: '#333D55' }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(name)}
                    onChange={() => toggle(name)}
                    style={{ width: '14px', height: '14px', accentColor: '#3B5BDB', cursor: 'pointer' }}
                  />
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{name}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------ saved configurations table ------------------ */

/** columns of the saved-configurations grid: label, width, and how to read the value off a saved row */
const CFG_COLS: { key: string; label: string; w: number; get: (r: EngagementConfigRecord) => string }[] = [
  { key: 'le', label: 'LE Name', w: 210, get: (r) => r.entityName },
  { key: 'fw', label: 'Reporting Framework', w: 170, get: (r) => dash(r.values.reporting_framework ?? null) },
  { key: 'fy', label: 'Fiscal Year Type', w: 200, get: (r) => dash(r.values.fiscal_year_type ?? null) },
  { key: 'fys', label: 'FY Start', w: 112, get: (r) => showDate(r.values.fy_start_date ?? null) },
  { key: 'len', label: 'Period (months)', w: 120, get: (r) => dash(r.values.period_length_months ?? null) },
  { key: 'rt', label: 'Report Type', w: 170, get: (r) => dash(r.values.report_type ?? null) },
  { key: 'tb', label: 'TB Granularity', w: 130, get: (r) => dash(r.values.tb_granularity ?? null) },
  { key: 'cmp', label: 'Comparatives', w: 112, get: (r) => dash(r.values.comparative_years ?? null) },
  { key: 'mc', label: 'Multi-Currency', w: 118, get: (r) => dash(r.values.is_multi_currency ?? null) },
  { key: 'fc', label: 'Functional CCY', w: 118, get: (r) => dash(r.values.functional_currency ?? null) },
  { key: 'pc', label: 'Presentation CCY', w: 128, get: (r) => dash(r.values.presentation_currency ?? null) },
  { key: 'ver', label: 'Version', w: 80, get: (r) => String(r.version) },
  { key: 'upd', label: 'Last Saved', w: 160, get: (r) => new Date(r.updatedAt).toLocaleString() },
];

/** width of the pinned Edit / Delete column */
const ACTION_W = 168;

/** The engagement configurations saved so far, one row per legal entity — same grid kit as the Legal Entity Master. */
function SavedConfigsTable({
  rows, loading, error, fresh, onEdit, onDelete,
}: {
  rows: EngagementConfigRecord[];
  loading: boolean;
  error: string | null;
  /** entities written by the most recent save — tinted like newly added rows in the entity grid */
  fresh: string[];
  /** open the form with this saved configuration loaded */
  onEdit: (r: EngagementConfigRecord) => void;
  /** delete this saved configuration (the table asks for confirmation first) */
  onDelete: (r: EngagementConfigRecord) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  // two-step delete: first click arms the row, second click confirms
  const [armed, setArmed] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const confirmDelete = async (r: EngagementConfigRecord) => {
    setDeleting(r.entityName);
    try { await onDelete(r); } finally { setDeleting(null); setArmed(null); }
  };
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => !q || CFG_COLS.map((c) => c.get(r)).join(' ').toLowerCase().includes(q));
  }, [rows, search]);

  const cols = useMemo<GridCol[]>(() => CFG_COLS.map(({ key, label, w }) => ({ key, label, w })), []);
  const g = useGrid<EngagementConfigRecord>(
    'eng-config-saved', cols, shown,
    (r, k) => CFG_COLS.find((c) => c.key === k)?.get(r) ?? '',
    { defFreeze: 'le', rowKey: (r) => r.entityName },
  );

  const status = loading ? 'Loading…' : error ? `Could not load — ${error}` : `${rows.length} configuration${rows.length === 1 ? '' : 's'}`;

  return (
    <section
      style={{
        background: '#ECEFF6', border: '1px solid rgba(255,255,255,.75)', borderRadius: '14px',
        boxShadow: '7px 7px 18px rgba(166,175,195,.45),-7px -7px 18px rgba(255,255,255,.95)',
        padding: '18px 20px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#232C42' }}>Saved engagement configurations</div>
          <div style={{ fontSize: '11px', color: '#7A84A0' }}>One row per legal entity picked in A1 · {status}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', minWidth: '200px', maxWidth: '320px', flex: 1 }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9AA3BA" strokeWidth="2" strokeLinecap="round"
            style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search configurations…"
            style={{ ...INSET_INPUT, padding: '0 12px 0 32px' }}
          />
        </div>
      </div>

      {g.hasFilters && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#3B5BDB' }}>{g.rows.length} of {g.total} configurations shown — filtered or sorted from the column ⋮ menus</span>
          <button type="button" className="fc-btn" onClick={g.clearAll} style={{ fontSize: '11px', fontWeight: 700, color: '#7A84A0' }}>Clear filters</button>
        </div>
      )}

      <div style={{ overflow: 'auto', border: '1px solid #DCE0EB', borderRadius: '12px', maxHeight: '360px' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%', font: 'inherit', tableLayout: 'fixed' }}>
          <thead>
            <GridHead
              g={g}
              trail={<span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.45px' }}>ACTION</span>}
              trailWidth={ACTION_W}
            />
          </thead>
          <tbody>
            {g.rows.map((r) => {
              const isNew = fresh.includes(r.entityName);
              const rowBg = isNew ? '#EAF4EC' : '#ECEFF6';
              return (
                <tr key={r.entityName}>
                  {g.cols.map((c) => {
                    const v = CFG_COLS.find((x) => x.key === c.key)?.get(r) ?? '';
                    const tone: React.CSSProperties = c.key === 'le' ? { fontWeight: 700, color: '#232C42' } : { color: '#65708C' };
                    return (
                      <td key={c.key} title={v} style={{ ...g.td(c, rowBg, { background: rowBg }), fontSize: '10.5px', ...tone }}>
                        {v}
                      </td>
                    );
                  })}
                  {/* actions — pinned to the right edge */}
                  <td
                    style={{
                      width: `${ACTION_W}px`, minWidth: `${ACTION_W}px`, maxWidth: `${ACTION_W}px`, height: `${ROW_H}px`,
                      boxSizing: 'border-box', padding: '0 8px', textAlign: 'center', verticalAlign: 'middle',
                      borderBottom: '1px solid #E1E5EF', position: 'sticky', right: 0, zIndex: 2, background: rowBg,
                      boxShadow: '-6px 0 10px -8px rgba(60,70,100,.45)',
                    }}
                  >
                    {armed === r.entityName ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button" className="fc-h fc-btn" disabled={deleting === r.entityName}
                          onClick={() => confirmDelete(r)}
                          title={`Permanently delete the configuration for ${r.entityName}`}
                          style={{ fontSize: '10.5px', fontWeight: 700, color: '#fff', padding: '3px 9px', borderRadius: '7px', background: '#DC2626', boxShadow: '1px 1px 4px rgba(220,38,38,.35)' }}
                        >
                          {deleting === r.entityName ? 'Deleting…' : 'Confirm'}
                        </button>
                        <button
                          type="button" className="fc-h fc-btn" disabled={deleting === r.entityName}
                          onClick={() => setArmed(null)}
                          style={{ fontSize: '10.5px', fontWeight: 700, color: '#65708C', padding: '3px 6px' }}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button" className="fc-h fc-btn" onClick={() => onEdit(r)}
                          title={`Edit the configuration for ${r.entityName}`} aria-label={`Edit ${r.entityName}`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 700,
                            color: '#3B5BDB', padding: '3px 9px', borderRadius: '7px', background: '#E4E8F0',
                            boxShadow: '1px 1px 3px rgba(166,175,195,.5),-1px -1px 3px rgba(255,255,255,.9)',
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 20l1-4L16 5l3 3L8 19l-4 1zM13 8l3 3" />
                          </svg>
                          Edit
                        </button>
                        <button
                          type="button" className="fc-h fc-btn" onClick={() => setArmed(r.entityName)}
                          title={`Delete the configuration for ${r.entityName}`} aria-label={`Delete ${r.entityName}`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 700,
                            color: '#B42318', padding: '3px 9px', borderRadius: '7px', background: '#E4E8F0',
                            boxShadow: '1px 1px 3px rgba(166,175,195,.5),-1px -1px 3px rgba(255,255,255,.9)',
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                          </svg>
                          Delete
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {g.rows.length === 0 && (
              <tr>
                <td colSpan={g.cols.length + 1} style={{ padding: '26px 12px', textAlign: 'center', fontSize: '12px', fontStyle: 'italic', color: '#9AA3BA' }}>
                  {loading ? 'Loading…' : rows.length ? 'No configurations match your search.' : 'Nothing saved yet — pick entities in A1, fill the form and press Save.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** the form's starting answers — also what a fresh "Create Engagement config" opens with */
const DEFAULT_CFG: Cfg = {
  reporting_framework: 'Ind AS (Sch 3 Div II)',
  report_type: 'Annual',
  comparative_years: '1',
  fiscal_year_type: 'Calendar year (Jan-Dec)',
  tb_granularity: 'Monthly',
  is_multi_currency: 'No',
  adj_enabled: 'No',
};

function EngagementConfiguration() {
  // 'list' = only the saved configurations (default); 'form' = the configuration form
  const [view, setView] = useState<'list' | 'form'>('list');
  // the saved configuration (LE Name) being edited, or null when creating a new one
  const [editing, setEditing] = useState<string | null>(null);
  const [cfg, setCfg] = useState<Cfg>(DEFAULT_CFG);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [checksOpen, setChecksOpen] = useState(false);

  // A1 options: the LE Names in legal_entity_master (same endpoint the Legal Entity Master grid uses)
  const [entityNames, setEntityNames] = useState<{ names: string[]; loading: boolean }>({ names: [], loading: true });
  useEffect(() => {
    const ctrl = new AbortController();
    engagementSetupApi
      .listEntities(ENGAGEMENT_ID, ctrl.signal)
      .then((list) => setEntityNames({ names: Array.from(new Set(list.map((e) => e.name))), loading: false }))
      .catch(() => { if (!ctrl.signal.aborted) setEntityNames({ names: [], loading: false }); });
    return () => ctrl.abort();
  }, []);

  // saved configurations (engagement_config), one row per legal entity chosen in A1
  const [saved, setSaved] = useState<{ rows: EngagementConfigRecord[]; loading: boolean; error: string | null }>({
    rows: [], loading: true, error: null,
  });
  const [fresh, setFresh] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const savedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    engagementSetupApi
      .listConfigs(ENGAGEMENT_ID, ctrl.signal)
      .then((rows) => setSaved({ rows, loading: false, error: null }))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setSaved({ rows: [], loading: false, error: e instanceof Error ? e.message : 'Could not load configurations' });
      });
    return () => ctrl.abort();
  }, []);

  const set = (k: string, v: string) => setCfg((c) => ({ ...c, [k]: v }));

  const annual = cfg.report_type === 'Annual';
  const framework = cfg.reporting_framework ?? '';
  const isSec = framework === 'US GAAP (SEC)';
  const isIndAsIfrs = framework.startsWith('Ind AS') || framework === 'IFRS';
  const anyTrigger = ['has_retro_policy', 'has_prior_error', 'has_reclass'].some((k) => cfg[k] === 'Yes');
  const thirdBS = anyTrigger && cfg.is_material_opening === 'Yes' && isIndAsIfrs;

  /** the visibility rules that actually branch the form */
  const visible = (f: Field): boolean => {
    switch (f.id) {
      case 'A4': return isSec;
      case 'B5head': case 'B5a': case 'B5b': case 'B5c': case 'B5d': case 'B5e':
        return cfg.fiscal_year_type === '52-53 week fiscal year';
      case 'C3': return cfg.tb_granularity === 'Custom';
      case 'C5': case 'C6': return cfg.adj_enabled === 'Yes';
      case 'E4': return anyTrigger;
      case 'E8': return anyTrigger;
      case 'E10': case 'E11': return cfg.is_fta === 'Yes';
      case 'E15': return cfg.period_changed === 'Yes';
      case 'D1': case 'D2': case 'D3': case 'D4': case 'D5': return annual;
      case 'F1': case 'F2': case 'F3': case 'F4': case 'F8': case 'F9': return !annual;
      case 'G2': case 'G3': case 'G4': case 'G5': case 'G6': return cfg.is_multi_currency === 'Yes';
      default: return true;
    }
  };

  const sections = SECTIONS.map((s) => {
    let fields = s.fields.filter(visible);
    // drop a subhead with no real field following it
    fields = fields.filter((f, i) => {
      if (f.kind !== 'subhead') return true;
      for (let j = i + 1; j < fields.length; j++) return fields[j].kind !== 'subhead';
      return false;
    });
    return { ...s, fields };
  }).filter((s) => s.fields.length > 0);

  const comparatives = Number(cfg.comparative_years ?? '1');
  const bsCols = 1 + (annual ? comparatives : 1) + (thirdBS ? 1 : 0);
  const plCols = annual ? 1 + comparatives : cfg.interim_frequency === 'Half-yearly' ? 3 : 4;

  // one check per required (Req) field that is currently on screen — a field the form's branching hides
  // (e.g. the interim section on an Annual report) is not required
  const CHECKS = SECTIONS.flatMap((s) => s.fields)
    .filter((f) => f.req && f.key && visible(f))
    .map((f) => ({ id: f.id, label: `${f.label} is filled in`, ok: !!(cfg[f.key!] ?? '').trim() }));
  const failing = CHECKS.filter((c) => !c.ok).length;

  const selectedNames = (cfg.entity_name ?? '').split(MULTI_SEP).filter(Boolean);
  const failedChecks = CHECKS.filter((c) => !c.ok);
  /** saving needs an entity in A1 and every configuration check passing */
  const canSave = !saving && selectedNames.length > 0 && failedChecks.length === 0;

  /** one row is saved per entity picked in A1, each carrying the answers currently on screen */
  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      // answers for fields hidden by the form's branching are not saved
      const values: Cfg = {};
      SECTIONS.forEach((s) => s.fields.filter(visible).forEach((f) => {
        const v = f.key ? cfg[f.key] : undefined;
        if (f.key && f.key !== 'entity_name' && v) values[f.key] = v;
      }));
      // editing updates exactly the one saved row; creating writes one row per entity picked in A1
      const rows = await engagementSetupApi.saveConfigs(ENGAGEMENT_ID, { entityNames: editing ? [editing] : selectedNames, values });
      setSaved((s) => {
        const byName = new Map(s.rows.map((r) => [r.entityName, r]));
        rows.forEach((r) => byName.set(r.entityName, r));
        return { rows: [...byName.values()], loading: false, error: null };
      });
      setFresh(rows.map((r) => r.entityName));
      setSaveMsg({
        ok: true,
        text: editing ? `Updated the configuration for ${editing}.` : `Saved ${rows.length} configuration${rows.length === 1 ? '' : 's'}.`,
      });
      // saved: hide the form and fall back to the saved-configurations list
      setCfg(DEFAULT_CFG);
      setEditing(null);
      setView('list');
      requestAnimationFrame(() => savedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save the configuration' });
    } finally {
      setSaving(false);
    }
  };

  /** open the form with a clean slate */
  const openForm = () => {
    setEditing(null);
    setCfg(DEFAULT_CFG);
    setCollapsed({});
    setChecksOpen(false);
    setSaveMsg(null);
    setView('form');
  };
  /** open the form with a saved configuration's answers loaded */
  const openEdit = (r: EngagementConfigRecord) => {
    setEditing(r.entityName);
    setCfg({ ...r.values, entity_name: r.entityName });
    setCollapsed({});
    setChecksOpen(false);
    setSaveMsg(null);
    setView('form');
  };
  const closeForm = () => { setSaveMsg(null); setEditing(null); setView('list'); };
  const removeConfig = async (r: EngagementConfigRecord) => {
    try {
      await engagementSetupApi.deleteConfig(ENGAGEMENT_ID, r.entityName);
      setSaved((s) => ({ ...s, rows: s.rows.filter((x) => x.entityName !== r.entityName) }));
      setFresh((f) => f.filter((n) => n !== r.entityName));
      setSaveMsg({ ok: true, text: `Deleted the configuration for ${r.entityName}.` });
    } catch (e) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not delete the configuration' });
    }
  };

  // default view: only the saved configurations, with the button that opens the form
  if (view === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {saveMsg && (
            <span role="status" style={{ fontSize: '12px', fontWeight: 700, color: saveMsg.ok ? '#15803D' : '#B42318' }}>{saveMsg.text}</span>
          )}
          <span style={{ flex: 1 }} />
          <button
            type="button" className="fc-h fc-btn" onClick={openForm}
            style={{
              fontSize: '12.5px', fontWeight: 700, color: '#fff', padding: '10px 20px', borderRadius: '10px',
              background: 'linear-gradient(145deg,#3B82F6,#2563EB)', boxShadow: '2px 2px 8px rgba(37,99,235,.32)',
            }}
          >
            ＋ Create Engagement config
          </button>
        </div>
        <div ref={savedRef} style={{ scrollMarginTop: '80px' }}>
          <SavedConfigsTable rows={saved.rows} loading={saved.loading} error={saved.error} fresh={fresh} onEdit={openEdit} onDelete={removeConfig} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button" className="fc-h fc-btn" onClick={closeForm}
          style={{ fontSize: '11.5px', fontWeight: 700, color: '#3B5BDB', padding: '5px 4px' }}
        >
          ← Saved configurations
        </button>
        {editing && (
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#232C42' }}>
            Editing the configuration for <span style={{ color: '#3B5BDB' }}>{editing}</span>
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button" className="fc-h fc-btn" onClick={() => setCollapsed({})}
          style={{ fontSize: '10.5px', fontWeight: 700, color: '#3B5BDB', padding: '5px 11px', borderRadius: '8px', background: '#E4E8F0', boxShadow: '1px 1px 3px rgba(166,175,195,.5),-1px -1px 3px rgba(255,255,255,.9)' }}
        >
          Expand all
        </button>
        <button
          type="button" className="fc-h fc-btn"
          onClick={() => setCollapsed(Object.fromEntries(SECTIONS.map((s) => [s.letter, true])))}
          style={{ fontSize: '10.5px', fontWeight: 700, color: '#3B5BDB', padding: '5px 11px', borderRadius: '8px', background: '#E4E8F0', boxShadow: '1px 1px 3px rgba(166,175,195,.5),-1px -1px 3px rgba(255,255,255,.9)' }}
        >
          Collapse all
        </button>
      </div>

      {sections.map((sec) => {
        const isCollapsed = collapsed[sec.letter] === true;
        const count = sec.fields.filter((f) => f.kind !== 'subhead').length;
        return (
          <section
            key={sec.letter}
            style={{
              background: '#ECEFF6', border: '1px solid rgba(255,255,255,.75)', borderRadius: '14px',
              boxShadow: '7px 7px 18px rgba(166,175,195,.45),-7px -7px 18px rgba(255,255,255,.95)',
              padding: '18px 20px 20px',
            }}
          >
            <button
              type="button"
              className="fc-h fc-btn"
              onClick={() => setCollapsed((c) => ({ ...c, [sec.letter]: !isCollapsed }))}
              style={{ display: 'flex', alignItems: 'center', gap: '11px', width: '100%' }}
            >
              <span
                style={{
                  flex: 'none', width: '26px', height: '26px', borderRadius: '8px',
                  background: 'linear-gradient(150deg,#3B82F6,#2563EB)', color: '#fff',
                  fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(37,99,235,.3)',
                }}
              >
                {sec.letter}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#232C42' }}>{sec.title}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: '10px', color: '#9AA3BA', fontWeight: 700 }}>{count} fields</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7A84A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d={isCollapsed ? 'M9 6l6 6-6 6' : 'M6 9l6 6 6-6'} />
              </svg>
            </button>

            {!isCollapsed && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px 14px', marginTop: '14px' }}>
                {sec.fields.map((f) =>
                  f.kind === 'subhead' ? (
                    <div
                      key={f.id}
                      style={{
                        gridColumn: '1/-1', marginTop: '4px', paddingTop: '9px', borderTop: '1px dashed #CBD2E0',
                        fontSize: '9.5px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: '#9AA3BA',
                      }}
                    >
                      {f.label}
                    </div>
                  ) : (
                    <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <span style={{ flex: 'none', fontSize: '9px', fontWeight: 700, letterSpacing: '.3px', color: '#3B5BDB', background: 'rgba(255,255,255,.7)', padding: '1px 6px', borderRadius: '5px' }}>
                          {f.id}
                        </span>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#333D55' }}>{f.label}</label>
                        {f.req && (
                          <span style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase', color: '#B45309' }}>Req</span>
                        )}
                        {f.auto && (
                          <span style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase', color: '#7A84A0', background: 'rgba(122,132,160,.14)', padding: '1px 6px', borderRadius: '999px' }}>Auto</span>
                        )}
                      </div>

                      {f.kind === 'input' && (
                        <input
                          type={f.inputType ?? 'text'}
                          value={cfg[f.key!] ?? ''}
                          onChange={(e) => set(f.key!, e.target.value)}
                          placeholder={f.ph}
                          style={FIELD_INPUT}
                        />
                      )}
                      {f.kind === 'textarea' && (
                        <textarea
                          value={cfg[f.key!] ?? ''}
                          onChange={(e) => set(f.key!, e.target.value)}
                          placeholder={f.ph}
                          rows={2}
                          style={{ ...FIELD_INPUT, height: 'auto', padding: '8px 10px', resize: 'vertical' }}
                        />
                      )}
                      {f.kind === 'select' && (
                        <select value={cfg[f.key!] ?? ''} onChange={(e) => set(f.key!, e.target.value)} style={FIELD_INPUT}>
                          <option value="">—</option>
                          {f.opts?.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                      {f.kind === 'multiselect' && (
                        <MultiSelect
                          value={cfg[f.key!] ?? ''}
                          options={entityNames.names}
                          loading={entityNames.loading}
                          onChange={(v) => set(f.key!, v)}
                          disabled={editing !== null}
                        />
                      )}
                      {(f.kind === 'toggle' || f.kind === 'seg') && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            onClick={() => set(f.key!, cfg[f.key!] === 'Yes' ? 'No' : 'Yes')}
                            style={{
                              width: '38px', height: '20px', padding: '2px', borderRadius: '999px', cursor: 'pointer',
                              boxSizing: 'border-box', display: 'flex', alignItems: 'center',
                              transition: 'background .15s ease',
                              background: cfg[f.key!] === 'Yes' ? 'linear-gradient(145deg,#3B82F6,#2563EB)' : '#D6DBE8',
                              boxShadow: cfg[f.key!] === 'Yes' ? 'inset 0 1px 2px rgba(29,78,216,.5)' : 'inset 1px 1px 2px rgba(166,175,195,.7)',
                            }}
                          >
                            <span
                              style={{
                                display: 'block', width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
                                boxShadow: '0 1px 2px rgba(45,54,80,.35)', transition: 'transform .15s ease',
                                transform: cfg[f.key!] === 'Yes' ? 'translateX(18px)' : 'translateX(0)',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#5A6482' }}>
                            {cfg[f.key!] === 'Yes' ? 'Yes' : 'No'}
                          </span>
                        </div>
                      )}
                      {f.kind === 'auto' && (
                        <div
                          style={{
                            ...FIELD_INPUT,
                            display: 'flex', alignItems: 'center',
                            background: 'rgba(124,58,237,.09)', border: '1px solid rgba(124,58,237,.3)',
                            boxShadow: 'none', color: '#6D28D9', fontStyle: 'italic',
                          }}
                        >
                          {cfg[f.key!] || 'Derived'}
                        </div>
                      )}
                      {f.help && (
                        <div style={{ fontSize: '10px', color: '#8A93A8', fontStyle: 'italic', lineHeight: 1.4 }}>{f.help}</div>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </section>
        );
      })}

      {/* ---- derived output ---- */}
      <section
        style={{
          background: '#ECEFF6', border: '1px solid rgba(255,255,255,.75)', borderLeft: '3px solid #16A34A',
          borderRadius: '14px', boxShadow: '7px 7px 18px rgba(166,175,195,.45),-7px -7px 18px rgba(255,255,255,.95)',
          padding: '18px 20px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '14px' }}>
          <span
            style={{
              flex: 'none', width: '26px', height: '26px', borderRadius: '8px',
              background: 'linear-gradient(150deg,#16A34A,#15803D)', color: '#fff', fontSize: '13px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(21,128,61,.3)',
            }}
          >
            ↳
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#232C42' }}>Derived output — live column layout</div>
            <div style={{ fontSize: '11px', color: '#7A84A0' }}>Recalculates from the selections above. Column counts are overridable.</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'Reporting mode', value: annual ? 'Annual' : 'Interim', big: true },
            { label: 'Framework profile', value: framework || '—', big: false },
            { label: 'Balance sheet cols', value: String(bsCols), big: true },
            { label: 'Income stmt cols', value: String(plCols), big: true },
            { label: 'Third balance sheet', value: thirdBS ? 'Yes' : 'No', big: true },
            { label: 'Ageing lookback', value: isIndAsIfrs ? '3 years' : 'n/a', big: true },
          ].map((t) => (
            <div
              key={t.label}
              style={{
                background: '#E4E8F0', borderRadius: '12px',
                boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.4),inset -2px -2px 6px rgba(255,255,255,.9)',
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9AA3BA' }}>
                {t.label}
              </div>
              <div style={{ fontSize: t.big ? '15px' : '12px', fontWeight: 700, color: '#232C42', marginTop: '3px', lineHeight: 1.3 }}>
                {t.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '11px', color: '#65708C', fontStyle: 'italic', marginBottom: '10px' }}>
          Column basis: {annual ? `current year + ${comparatives} comparative${comparatives === 1 ? '' : 's'}` : 'interim period + prior-year comparable'}.
        </div>

        {bsCols !== plCols && (
          <div
            style={{
              fontSize: '11px', color: '#8A5A10', background: 'rgba(245,158,11,.08)',
              border: '1px solid rgba(245,158,11,.3)', borderRadius: '10px', padding: '9px 13px', marginBottom: '14px',
            }}
          >
            BS / P&amp;L asymmetry — balance-sheet notes follow the BS count, income-statement notes follow the P&amp;L count.
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button" className="fc-h fc-btn" onClick={() => setChecksOpen((v) => !v)}
            style={{
              fontSize: '11.5px', fontWeight: 700, color: '#fff', padding: '8px 16px', borderRadius: '9px',
              background: 'linear-gradient(145deg,#3B82F6,#2563EB)', boxShadow: '2px 2px 8px rgba(37,99,235,.32)',
            }}
          >
            {checksOpen ? 'Hide checks' : 'Run configuration checks'}
          </button>
          <span style={{ fontSize: '11px', color: '#7A84A0', fontStyle: 'italic' }}>
            {failing === 0 ? 'All gate checks pass.' : `${failing} of ${CHECKS.length} checks need attention.`}
          </span>
        </div>

        {checksOpen && (
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9AA3BA', marginBottom: '8px' }}>
              Validation &amp; gate checks
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '14px' }}>
              {CHECKS.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '6px 0' }}>
                  <span
                    style={{
                      flex: 'none', marginTop: '5px', width: '8px', height: '8px', borderRadius: '50%',
                      background: c.ok ? '#16A34A' : '#F59E0B',
                    }}
                  />
                  <span style={{ flex: 1, fontSize: '12px', color: '#333D55', lineHeight: 1.4 }}>
                    <b style={{ color: '#65708C', fontWeight: 700 }}>{c.id}</b> · {c.label}
                  </span>
                  <span
                    style={{
                      flex: 'none', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase',
                      padding: '2px 8px', borderRadius: '6px',
                      color: c.ok ? '#15803D' : '#B45309',
                      background: c.ok ? 'rgba(34,197,94,.14)' : 'rgba(245,158,11,.15)',
                    }}
                  >
                    {c.ok ? 'Pass' : 'Review'}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12px', fontWeight: 700,
                padding: '10px 14px', borderRadius: '10px',
                color: failing === 0 ? '#15803D' : '#B45309',
                background: failing === 0 ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)',
                border: `1px solid ${failing === 0 ? 'rgba(34,197,94,.34)' : 'rgba(245,158,11,.38)'}`,
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: failing === 0 ? '#16A34A' : '#F59E0B' }} />
              {failing === 0
                ? 'Configuration gate open — the engagement can proceed to data ingestion.'
                : 'Configuration gate held — resolve the items above before ingestion.'}
            </div>
          </div>
        )}
      </section>

      {/* ---- save ---- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="fc-h fc-btn"
          disabled={!canSave}
          onClick={save}
          title={
            failedChecks.length
              ? `Resolve the configuration checks first (${failedChecks.map((c) => c.id).join(', ')})`
              : selectedNames.length
                ? `Save one configuration for each of the ${selectedNames.length} selected entit${selectedNames.length === 1 ? 'y' : 'ies'}`
                : 'Select at least one entity in A1 first'
          }
          style={{
            fontSize: '12.5px', fontWeight: 700, padding: '10px 22px', borderRadius: '10px',
            ...(canSave
              ? { color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', boxShadow: '2px 2px 8px rgba(37,99,235,.32)' }
              : { color: '#B4BBCC', background: '#E9ECF3', cursor: 'not-allowed' }),
          }}
        >
          {saving ? 'Saving…' : editing ? 'Update configuration' : selectedNames.length > 1 ? `Save ${selectedNames.length} configurations` : 'Save configuration'}
        </button>
        {failedChecks.length > 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '11.5px', color: '#8A5A10' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />
            Saving is blocked until the configuration checks pass — {failedChecks.length} need attention:
            <b>{failedChecks.map((c) => `${c.id} ${c.label}`).join(' · ')}</b>
            <button
              type="button" className="fc-btn" onClick={() => setChecksOpen(true)}
              style={{ fontSize: '11.5px', fontWeight: 700, color: '#3B5BDB', textDecoration: 'underline' }}
            >
              Show checks
            </button>
          </span>
        ) : selectedNames.length === 0 && !saveMsg ? (
          <span style={{ fontSize: '11.5px', fontStyle: 'italic', color: '#8A93A8' }}>Select at least one entity in A1 to save.</span>
        ) : null}
        <button
          type="button" className="fc-h fc-btn" onClick={closeForm} disabled={saving}
          style={{ fontSize: '12px', fontWeight: 700, color: '#414B62', padding: '9px 16px', borderRadius: '10px', border: '1px solid #CBD2E0', background: 'rgba(255,255,255,.6)' }}
        >
          Cancel
        </button>
        {saveMsg && !saveMsg.ok && (
          <span role="alert" style={{ fontSize: '12px', fontWeight: 700, color: '#B42318' }}>{saveMsg.text}</span>
        )}
      </div>
    </div>
  );
}

/* ============================== screen ============================== */

const STEPS = ['Legal Entity Master', 'Engagement Configuration'];

export default function EngagementSetup() {
  const { route } = useApp();
  const [step, setStep] = useState(0);
  void route;

  return (
    <div
      style={{
        padding: '24px 28px 26px',
        animation: 'fcFade .25s ease',
        ...(step === 0 ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : null),
      }}
    >
      <div style={{ marginBottom: '18px' }}>
        <div
          style={{
            display: 'inline-flex', gap: '5px', padding: '5px', borderRadius: '14px', background: '#EDF0F7',
            boxShadow: '3px 3px 9px rgba(166,175,195,.42),-3px -3px 9px rgba(255,255,255,.92)',
          }}
        >
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              className="fc-h fc-btn"
              onClick={() => setStep(i)}
              style={{
                font: 'inherit', fontSize: '12px', fontWeight: 700, letterSpacing: '.2px', whiteSpace: 'nowrap',
                padding: '6px 15px', borderRadius: '9px', transition: 'all .16s',
                ...(step === i
                  ? { color: '#fff', background: 'linear-gradient(180deg,#3B82F6,#2563EB)', boxShadow: '0 3px 10px rgba(37,99,235,.45)' }
                  : { color: '#8A93A8', background: 'transparent' }),
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {step === 0 ? <LegalEntityMaster /> : <EngagementConfiguration />}
    </div>
  );
}
