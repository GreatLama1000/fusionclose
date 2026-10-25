import readXlsxFile from 'read-excel-file/browser';
import writeXlsxFile, { SheetData } from 'write-excel-file/browser';
import {
  BU_OPTS, COA_REF, ENTITIES, JE_TYPES, PERIODS, TEMPLATE_COLS, BRIDGE_LABELS,
  Je, JeLine, byLcoa, byGcoa, leCanon, leNameOf, newLid, normPeriod, parseAmt, fmtAmt, tidyAmt,
} from './model';

/**
 * Bulk journal entries: the input template, and reading a filled one back.
 * Every line is checked against the same reference data the grid uses, and an
 * entry that does not balance or names an unknown account / entity is held
 * back with its reasons rather than imported half-right.
 */

/* ---------------- the template ---------------- */

const HEAD = { fontWeight: 'bold' as const, backgroundColor: '#1B3A5C', textColor: '#FFFFFF', align: 'center' as const };

export async function downloadTemplate() {
  const header = TEMPLATE_COLS.map((c) => ({ value: c, ...HEAD }));
  const ex = (je: string, lcoa: string, le: string, bu: string, dr: number | null, cr: number | null, narr: string, label: string) => [
    { value: je }, { value: "June '26" }, { value: 'Type 1' }, { value: lcoa }, { value: byLcoa(lcoa)?.gcoa ?? '' },
    { value: le }, { value: bu }, dr == null ? null : { value: dr, type: Number, format: '#,##0.00' },
    cr == null ? null : { value: cr, type: Number, format: '#,##0.00' }, { value: narr }, { value: label },
  ];
  const entries = [
    header,
    ex('B-001', '6100', 'UK01', 'Corporate', 25000, null, 'Accrue Q2 audit fee', 'TB → Adj'),
    ex('B-001', '2010', 'UK01', 'Corporate', null, 25000, 'Accrue Q2 audit fee', 'TB → Adj'),
  ];

  const refHead = ['LCOA', 'GCOA', 'GCOA Description', '', 'LE Code', 'LE Name', '', 'BU', '', 'Period', '', 'Type', '', 'Bridge Label'].map((c) => (c ? { value: c, ...HEAD } : null));
  const rows = Math.max(COA_REF.length, ENTITIES.length, PERIODS.length);
  const ref: SheetData = [refHead];
  for (let i = 0; i < rows; i++) {
    const c = COA_REF[i];
    const e = ENTITIES[i];
    ref.push([
      c ? { value: c.lcoa } : null, c ? { value: c.gcoa } : null, c ? { value: c.gdesc } : null, null,
      e ? { value: e.code } : null, e ? { value: e.name } : null, null,
      BU_OPTS[i] ? { value: BU_OPTS[i] } : null, null,
      PERIODS[i] ? { value: PERIODS[i] } : null, null,
      JE_TYPES[i] ? { value: JE_TYPES[i] } : null, null,
      BRIDGE_LABELS[i] ? { value: BRIDGE_LABELS[i] } : null,
    ]);
  }

  const notes = [
    [{ value: 'How to fill this template', fontWeight: 'bold' as const, fontSize: 13 }],
    [{ value: '• One row per journal line. Lines sharing a JE # form one entry; each entry must balance (debits = credits).' }],
    [{ value: '• LCOA must exist in the Reference sheet — GCOA and the GCOA description are filled automatically on import.' }],
    [{ value: '• LE Code must exist in the Reference sheet — the LE name is filled automatically.' }],
    [{ value: '• Put each amount in either Debit or Credit, not both. Positive numbers only.' }],
    [{ value: '• Period as "June \'26", "Jun-2026" or "2026-06". Type is "Type 1" (known to management beforehand) or "Type 2" (not known).' }],
    [{ value: '• Imported entries arrive Parked; a reviewer posts them. Entries in a locked period are refused.' }],
  ];

  await writeXlsxFile([
    { sheet: 'Journal entries', data: entries, columns: [10, 12, 9, 9, 9, 10, 15, 14, 14, 44, 14].map((width) => ({ width })), stickyRowsCount: 1 },
    { sheet: 'Reference', data: ref, columns: [8, 8, 30, 2, 10, 30, 2, 15, 2, 14, 2, 9, 2, 14].map((width) => ({ width })), stickyRowsCount: 1 },
    { sheet: 'Instructions', data: notes, columns: [{ width: 120 }] },
  ]).toFile('Fusion Close — JE bulk upload template.xlsx');
}

/* ---------------- reading a filled template ---------------- */

export type ParsedEntry = {
  je: Je;
  issues: string[];
  /** the sheet rows it came from, for the messages */
  rows: number[];
};

export type ParseResult = { entries: ParsedEntry[]; error?: string; rowCount: number };

type Cell = string | number | boolean | Date | null | undefined;

const splitCsv = (text: string): Cell[][] =>
  text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()));

/** "LE code", "le_code", "LE Code " → "le code" */
const key = (s: Cell) => String(s ?? '').toLowerCase().replace(/[_#]/g, ' ').replace(/\s+/g, ' ').trim();
const ALIASES: Record<string, string[]> = {
  'JE #': ['je', 'je no', 'je number', 'entry', 'journal'],
  Period: ['period'],
  Type: ['type', 'je type'],
  LCOA: ['lcoa', 'local account', 'account'],
  GCOA: ['gcoa', 'group account'],
  'LE Code': ['le code', 'entity', 'legal entity', 'le'],
  BU: ['bu', 'business unit'],
  Debit: ['debit', 'dr'],
  Credit: ['credit', 'cr'],
  Narration: ['narration', 'description', 'narrative'],
  'Bridge Label': ['bridge label', 'label'],
};

export async function parseJeFile(file: File): Promise<ParseResult> {
  let grid: Cell[][];
  try {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') grid = splitCsv(await file.text());
    else {
      const sheets = await readXlsxFile(file);
      // the template's entry sheet, else the first sheet with a JE # column
      const pick = sheets.find((s) => /journal/i.test(s.sheet)) ?? sheets.find((s) => s.data.some((r) => r.some((c) => /^je\s*#?$/i.test(String(c ?? '').trim())))) ?? sheets[0];
      grid = (pick?.data ?? []) as Cell[][];
    }
  } catch {
    return { entries: [], rowCount: 0, error: 'The file could not be read — is it a valid .xlsx or .csv?' };
  }

  const hi = grid.findIndex((r) => r.some((c) => /^je\s*#?$/i.test(String(c ?? '').trim())));
  if (hi < 0) return { entries: [], rowCount: 0, error: 'No “JE #” header row found — start from the template.' };
  const head = grid[hi].map(key);
  const col: Record<string, number> = {};
  (Object.keys(ALIASES) as (keyof typeof ALIASES)[]).forEach((k) => {
    col[k] = head.findIndex((h) => ALIASES[k].includes(h));
  });
  const missing = ['JE #', 'LCOA', 'LE Code', 'Debit', 'Credit'].filter((k) => col[k] < 0);
  if (missing.length) return { entries: [], rowCount: 0, error: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.` };

  const at = (r: Cell[], k: string) => (col[k] >= 0 ? r[col[k]] : undefined);
  const str = (v: Cell) => (v instanceof Date ? v.toISOString() : String(v ?? '').trim());

  const groups = new Map<string, ParsedEntry>();
  let rowCount = 0;
  grid.slice(hi + 1).forEach((r, i) => {
    if (r.every((c) => str(c) === '')) return;
    rowCount += 1;
    const rowNo = hi + i + 2;
    const id = str(at(r, 'JE #')) || `row ${rowNo}`;
    const g = groups.get(id) ?? { je: { id, period: '', status: 'Parked', jtype: '', lines: [] }, issues: [], rows: [] };
    groups.set(id, g);
    g.rows.push(rowNo);

    const per = normPeriod(at(r, 'Period'));
    if (per && !g.je.period) g.je.period = per;
    else if (!per && str(at(r, 'Period'))) g.issues.push(`Row ${rowNo}: “${str(at(r, 'Period'))}” is not a recognisable period`);
    const ty = str(at(r, 'Type')).replace(/^(\d)$/, 'Type $1');
    if (ty && !g.je.jtype) {
      const t = JE_TYPES.find((x) => x.toLowerCase() === ty.toLowerCase());
      if (t) g.je.jtype = t; else g.issues.push(`Row ${rowNo}: type “${ty}” — use Type 1 or Type 2`);
    }

    const lcoa = str(at(r, 'LCOA')).replace(/\.0+$/, '');
    const gIn = str(at(r, 'GCOA')).toUpperCase();
    const ref = byLcoa(lcoa) ?? (gIn && byGcoa(gIn).length === 1 ? byGcoa(gIn)[0] : undefined);
    if (!lcoa && !gIn) g.issues.push(`Row ${rowNo}: no account`);
    else if (!ref) g.issues.push(`Row ${rowNo}: account ${lcoa || gIn} is not in the chart`);
    else if (gIn && gIn !== ref.gcoa) g.issues.push(`Row ${rowNo}: LCOA ${ref.lcoa} maps to ${ref.gcoa}, not ${gIn}`);

    const leIn = str(at(r, 'LE Code'));
    if (!leIn) g.issues.push(`Row ${rowNo}: no LE code`);
    else if (!leNameOf(leIn)) g.issues.push(`Row ${rowNo}: LE code “${leIn}” is not a known legal entity`);

    const bu = str(at(r, 'BU'));
    const buOk = BU_OPTS.find((b) => b.toLowerCase() === bu.toLowerCase()) ?? '';
    if (bu && !buOk) g.issues.push(`Row ${rowNo}: business unit “${bu}” is not recognised`);

    const dr = parseAmt(at(r, 'Debit'));
    const cr = parseAmt(at(r, 'Credit'));
    if (dr && cr) g.issues.push(`Row ${rowNo}: both a debit and a credit`);
    if (!dr && !cr) g.issues.push(`Row ${rowNo}: no amount`);
    if (dr < 0 || cr < 0) g.issues.push(`Row ${rowNo}: negative amount — put it in the other column`);

    const line: JeLine = {
      lid: newLid(), lcoa: ref?.lcoa ?? lcoa, gcoa: ref?.gcoa ?? gIn, gdesc: ref?.gdesc ?? '',
      le: leCanon(leIn), leName: leNameOf(leIn), bu: buOk,
      debit: dr ? tidyAmt(String(dr)) : '', credit: cr ? tidyAmt(String(cr)) : '',
      narr: str(at(r, 'Narration')), label: str(at(r, 'Bridge Label')),
    };
    g.je.lines.push(line);
  });

  const entries = [...groups.values()].map((g) => {
    const dr = g.je.lines.reduce((s, l) => s + parseAmt(l.debit), 0);
    const cr = g.je.lines.reduce((s, l) => s + parseAmt(l.credit), 0);
    if (!g.je.period) g.issues.push('No period');
    if (g.je.lines.length < 2) g.issues.push('Only one line — an entry needs a debit and a credit');
    if (Math.round(dr * 100) !== Math.round(cr * 100)) g.issues.push(`Out of balance — debits ${fmtAmt(dr)}, credits ${fmtAmt(cr)}`);
    if (!g.je.jtype) g.je.jtype = 'Type 1';
    return g;
  });
  return { entries, rowCount };
}
