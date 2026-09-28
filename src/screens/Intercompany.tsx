import React, { useMemo, useState } from 'react';

/**
 * Intercompany Eliminations (ICE) — ported from docs/design/Fusion Close.dc.html,
 * block `<sc-if value="{{ is.ice }}">` lines 1764–1965, dashboard 242–464.
 *
 * Data: icNature 8970, icPipelineDef 9004, icRowPlan 9012, icCalcChecks 9027,
 * icData 9093, icTjeCols 8982.
 *
 * NOTE: the design loads its per-nature column specs from `./ic-schema.js`
 * (line 5256), which is NOT part of the shared handoff. The E1 grid below is
 * built from the keys present in `icData`; the other registers show their row
 * plan and await that schema, exactly as the design degrades when the import
 * fails (it catches and leaves `icSchema` undefined).
 */

/* ============================== natures ============================== */

type NatureKey =
  | 'E1_IC_Balances' | 'E2_IC_PnL' | 'E3_URP_Inventory' | 'E4_URP_FixedAssets'
  | 'E5_Investment_Consol' | 'E6_Dividends' | 'E7_Associates_JV' | 'E8_IC_Provisions'
  | 'E9_InTransit' | 'TJE_Manual';

const NATURE: Record<NatureKey, [string, string, string, string]> = {
  E1_IC_Balances: ['E1', 'Balances', 'Receivables, payables, loans, accrued interest, current accounts', 'Stateless'],
  E2_IC_PnL: ['E2', 'Income & expense', 'Recharges, management fees, royalties, rent, commission, interest', 'Stateless'],
  E3_URP_Inventory: ['E3', 'Profit in inventory', 'Unrealised profit in stock held at period end', 'Stateful'],
  E4_URP_FixedAssets: ['E4', 'Profit in fixed assets', 'Unrealised profit in assets transferred intragroup, and its unwind', 'Stateful'],
  E5_Investment_Consol: ['E5', 'Investment & capital', 'Cost of investment against acquisition-date equity, goodwill and NCI', 'Master data'],
  E6_Dividends: ['E6', 'Dividends', 'Intragroup dividends declared and paid', 'Stateless'],
  E7_Associates_JV: ['E7', 'Associates & JV', 'Pro-rata elimination against equity-accounted investees', 'Stateful'],
  E8_IC_Provisions: ['E8', 'Provisions', 'ECL and impairments raised against group entities, to be reversed', 'Stateful'],
  E9_InTransit: ['E9', 'In transit & cut-off', 'Goods and cash in transit, and cut-off adjustments', 'Normalisation'],
  TJE_Manual: ['TJE', 'Manual & top-side', 'Judgemental elimination entries keyed here, posted to the top-side JE master', 'Linked register'],
};

const ROW_PLAN: Record<string, number> = {
  E1_IC_Balances: 7, E2_IC_PnL: 5, E3_URP_Inventory: 4, E4_URP_FixedAssets: 4,
  E5_Investment_Consol: 3, E6_Dividends: 3, E7_Associates_JV: 3, E8_IC_Provisions: 4, E9_InTransit: 4,
};

/** pipeline order — E9 first so timing gaps don't masquerade as match errors */
const PIPELINE: [string, string][] = [
  ['E9', 'In-transit normalisation runs first, so timing gaps stop masquerading as matching errors'],
  ['E5', 'Investment elimination and capital consolidation'],
  ['E1 · E2', 'Reciprocal matching of balances and profit or loss'],
  ['E3 · E4 · E7', 'Unrealised profit, including the pro-rata share on associates'],
  ['E6 · E8', 'Dividends and intragroup provisions'],
  ['Tax · NCI', 'Deferred tax, then attribution to non-controlling interests'],
];

const ENT_NAMES: Record<string, string> = {
  'IN-HOLD': 'Bharat Holdings Ltd', 'US-OPCO': 'US Operating Co. Inc.',
  'SG-OPCO': 'Singapore Operations Pte Ltd', 'AE-DIST': 'Gulf Distribution FZE',
  'IN-MFG': 'Bharat Manufacturing Pvt Ltd', 'LK-OPCO': 'Lanka Operations (Pvt) Ltd',
};

/* ---- E1 register (design icData, line 9094) ---- */

type E1Row = {
  elim_id: string; balance_nature: string; entity_a_code: string; entity_a_account: string;
  entity_b_code: string; entity_b_account: string; txn_ccy: string;
  amt_a_txn: number; amt_b_txn: number; entity_a_func_ccy: string; entity_b_func_ccy: string;
  amt_a_func: number; amt_b_func: number; in_transit_goods: number; in_transit_cash: number;
  gross_difference: number; unexplained_difference: number; diff_reason: string;
  diff_owner_entity: string; is_net_investment: string; due_date: string;
  is_interest_bearing: string; interest_rate_pct: number; elim_basis: string;
  eliminate_amount: number; support_ref: string; comments: string;
};

const E1: E1Row[] = [
  { elim_id: 'ICB-0001', balance_nature: 'LOAN_PRINCIPAL', entity_a_code: 'IN-HOLD', entity_a_account: '1320-ICLOAN-REC', entity_b_code: 'US-OPCO', entity_b_account: '2320-ICLOAN-PAY', txn_ccy: 'USD', amt_a_txn: 500000, amt_b_txn: 500000, entity_a_func_ccy: 'INR', entity_b_func_ccy: 'USD', amt_a_func: 41750000, amt_b_func: 500000, in_transit_goods: 0, in_transit_cash: 0, gross_difference: 0, unexplained_difference: 0, diff_reason: 'NIL', diff_owner_entity: 'US-OPCO', is_net_investment: 'Y', due_date: '2030-03-31', is_interest_bearing: 'Y', interest_rate_pct: 0.085, elim_basis: 'LOWER_OF_TWO', eliminate_amount: 500000, support_ref: 'LOAN-AGR-2025-04', comments: 'Long-term funding, no repayment schedule' },
  { elim_id: 'ICB-0002', balance_nature: 'TRADE_AR_AP', entity_a_code: 'IN-MFG', entity_a_account: '1310-ICTRADE-REC', entity_b_code: 'AE-DIST', entity_b_account: '2310-ICTRADE-PAY', txn_ccy: 'USD', amt_a_txn: 268000, amt_b_txn: 238000, entity_a_func_ccy: 'INR', entity_b_func_ccy: 'AED', amt_a_func: 22378000, amt_b_func: 873740, in_transit_goods: 30000, in_transit_cash: 0, gross_difference: 30000, unexplained_difference: 0, diff_reason: 'GOODS_IN_TRANSIT', diff_owner_entity: 'AE-DIST', is_net_investment: 'N', due_date: '2026-06-30', is_interest_bearing: 'N', interest_rate_pct: 0, elim_basis: 'LOWER_OF_TWO', eliminate_amount: 238000, support_ref: 'INV-BM-4471', comments: 'Shipment in transit at cut-off' },
  { elim_id: 'ICB-0003', balance_nature: 'TRADE_AR_AP', entity_a_code: 'US-OPCO', entity_a_account: '1310-ICTRADE-REC', entity_b_code: 'SG-OPCO', entity_b_account: '2310-ICTRADE-PAY', txn_ccy: 'USD', amt_a_txn: 415000, amt_b_txn: 415000, entity_a_func_ccy: 'USD', entity_b_func_ccy: 'SGD', amt_a_func: 415000, amt_b_func: 561290, in_transit_goods: 0, in_transit_cash: 0, gross_difference: 0, unexplained_difference: 0, diff_reason: 'NIL', diff_owner_entity: 'SG-OPCO', is_net_investment: 'N', due_date: '2026-05-31', is_interest_bearing: 'N', interest_rate_pct: 0, elim_basis: 'LOWER_OF_TWO', eliminate_amount: 415000, support_ref: 'INV-US-2290', comments: '' },
  { elim_id: 'ICB-0004', balance_nature: 'INTEREST_ACCRUED', entity_a_code: 'IN-HOLD', entity_a_account: '1325-ICINT-REC', entity_b_code: 'US-OPCO', entity_b_account: '2325-ICINT-PAY', txn_ccy: 'USD', amt_a_txn: 42500, amt_b_txn: 42500, entity_a_func_ccy: 'INR', entity_b_func_ccy: 'USD', amt_a_func: 3548750, amt_b_func: 42500, in_transit_goods: 0, in_transit_cash: 0, gross_difference: 0, unexplained_difference: 0, diff_reason: 'NIL', diff_owner_entity: 'US-OPCO', is_net_investment: 'N', due_date: '2026-04-30', is_interest_bearing: 'N', interest_rate_pct: 0, elim_basis: 'LOWER_OF_TWO', eliminate_amount: 42500, support_ref: 'INT-CALC-Q4', comments: 'Accrued on ICB-0001 at 8.5%' },
  { elim_id: 'ICB-0005', balance_nature: 'CURRENT_ACCOUNT', entity_a_code: 'SG-OPCO', entity_a_account: '1330-ICCA-REC', entity_b_code: 'LK-OPCO', entity_b_account: '2330-ICCA-PAY', txn_ccy: 'USD', amt_a_txn: 96000, amt_b_txn: 88500, entity_a_func_ccy: 'SGD', entity_b_func_ccy: 'LKR', amt_a_func: 123840, amt_b_func: 26550000, in_transit_goods: 0, in_transit_cash: 5000, gross_difference: 7500, unexplained_difference: 2500, diff_reason: 'UNRESOLVED', diff_owner_entity: 'LK-OPCO', is_net_investment: 'N', due_date: '2026-04-15', is_interest_bearing: 'N', interest_rate_pct: 0, elim_basis: 'LOWER_OF_TWO', eliminate_amount: 88500, support_ref: '', comments: 'Residual under investigation' },
  { elim_id: 'ICB-0006', balance_nature: 'ADVANCE_PREPAYMENT', entity_a_code: 'AE-DIST', entity_a_account: '1340-ICADV-REC', entity_b_code: 'IN-MFG', entity_b_account: '2340-ICADV-PAY', txn_ccy: 'USD', amt_a_txn: 120000, amt_b_txn: 120000, entity_a_func_ccy: 'AED', entity_b_func_ccy: 'INR', amt_a_func: 440400, amt_b_func: 10020000, in_transit_goods: 0, in_transit_cash: 0, gross_difference: 0, unexplained_difference: 0, diff_reason: 'NIL', diff_owner_entity: 'IN-MFG', is_net_investment: 'N', due_date: '2026-09-30', is_interest_bearing: 'N', interest_rate_pct: 0, elim_basis: 'LOWER_OF_TWO', eliminate_amount: 120000, support_ref: 'PO-AE-8812', comments: '' },
  { elim_id: 'ICB-0007', balance_nature: 'DIVIDEND_RECEIVABLE', entity_a_code: 'IN-HOLD', entity_a_account: '1350-DIV-RECEIVABLE', entity_b_code: 'LK-OPCO', entity_b_account: '2350-DIV-PAYABLE', txn_ccy: 'LKR', amt_a_txn: 165000, amt_b_txn: 165000, entity_a_func_ccy: 'INR', entity_b_func_ccy: 'LKR', amt_a_func: 45870, amt_b_func: 165000, in_transit_goods: 0, in_transit_cash: 0, gross_difference: 0, unexplained_difference: 0, diff_reason: 'NIL', diff_owner_entity: 'LK-OPCO', is_net_investment: 'N', due_date: '2026-05-15', is_interest_bearing: 'N', interest_rate_pct: 0, elim_basis: 'LOWER_OF_TWO', eliminate_amount: 165000, support_ref: 'BOARD-RES-0412', comments: 'Declared, unpaid at period end' },
];

type Kind = 'input' | 'formula' | 'system';

const KIND_META: Record<Kind, [string, string, string]> = {
  input: ['#1B3A5C', 'rgba(27,58,92,.10)', 'You fill this in'],
  formula: ['#2C5580', 'rgba(59,130,246,.12)', 'Computed by the template — do not overtype'],
  system: ['#6B7A8D', 'rgba(107,122,141,.13)', 'The engine populates it on upload from master or prior-period data'],
};

const E1_COLS: { k: keyof E1Row; l: string; t: Kind; num?: boolean; note?: string }[] = [
  { k: 'elim_id', l: 'Elimination ID', t: 'system', note: 'Allocated on upload and carried across periods' },
  { k: 'balance_nature', l: 'Balance nature', t: 'input' },
  { k: 'entity_a_code', l: 'Entity A', t: 'input' },
  { k: 'entity_a_account', l: 'Entity A account', t: 'input' },
  { k: 'entity_b_code', l: 'Entity B', t: 'input' },
  { k: 'entity_b_account', l: 'Entity B account', t: 'input' },
  { k: 'txn_ccy', l: 'Txn ccy', t: 'input' },
  { k: 'amt_a_txn', l: 'Amount A (txn)', t: 'input', num: true },
  { k: 'amt_b_txn', l: 'Amount B (txn)', t: 'input', num: true },
  { k: 'amt_a_func', l: 'Amount A (func)', t: 'formula', num: true, note: 'Translated at the rate for the entity’s functional currency' },
  { k: 'amt_b_func', l: 'Amount B (func)', t: 'formula', num: true },
  { k: 'in_transit_goods', l: 'In transit — goods', t: 'system', num: true, note: 'Carried from the E9 register' },
  { k: 'in_transit_cash', l: 'In transit — cash', t: 'system', num: true },
  { k: 'gross_difference', l: 'Gross difference', t: 'formula', num: true, note: 'Amount A less Amount B in transaction currency' },
  { k: 'unexplained_difference', l: 'Unexplained difference', t: 'formula', num: true, note: 'Gross difference less anything explained by in-transit items' },
  { k: 'diff_reason', l: 'Difference reason', t: 'input' },
  { k: 'diff_owner_entity', l: 'Owner', t: 'input' },
  { k: 'is_net_investment', l: 'Net investment', t: 'input', note: 'Y marks a loan designated as part of a net investment in a foreign operation' },
  { k: 'elim_basis', l: 'Elimination basis', t: 'input' },
  { k: 'eliminate_amount', l: 'Eliminate', t: 'formula', num: true, note: 'The lower of the two sides, once in-transit items are normalised' },
  { k: 'support_ref', l: 'Support ref', t: 'input' },
  { k: 'comments', l: 'Comments', t: 'input' },
];

/* ============================== styles ============================== */

const SEC: React.CSSProperties = {
  background: '#ECEFF6', border: '1px solid rgba(255,255,255,.75)', borderRadius: '14px',
  boxShadow: '6px 6px 16px rgba(166,175,195,.42),-6px -6px 16px rgba(255,255,255,.95)',
};

const LABEL: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#65708C',
};

const TH: React.CSSProperties = {
  padding: '7px 10px', textAlign: 'left', verticalAlign: 'top', borderBottom: '1px solid #CBD2E0',
  borderTop: '2px solid #1B3A5C', background: '#E4E8F0', position: 'sticky', top: 0, zIndex: 5,
  fontWeight: 700, color: '#1B3A5C', whiteSpace: 'nowrap',
};

const TD: React.CSSProperties = {
  padding: '5px 10px', borderBottom: '1px solid #E7EAF2', fontSize: '10.5px', color: '#65708C', whiteSpace: 'nowrap',
};

const n0 = (v: number) => v.toLocaleString('en-US');

/* ============================== screen ============================== */

export default function Intercompany() {
  const [tab, setTab] = useState<NatureKey>('E1_IC_Balances');
  const [tplOpen, setTplOpen] = useState(false);
  const [chkOpen, setChkOpen] = useState(true);
  const [loaded, setLoaded] = useState(true);
  const [tol, setTol] = useState('2500');
  const [view, setView] = useState<'grid' | 'guide'>('grid');
  const [running, setRunning] = useState(false);
  const [runIdx, setRunIdx] = useState(PIPELINE.length - 1);
  const [runDone, setRunDone] = useState(true);
  const [full, setFull] = useState(false);
  const [dashOpen, setDashOpen] = useState(false);
  const [toast, setToast] = useState('');

  const tolValue = Number(tol) || 0;
  const [code, name, sub, state] = NATURE[tab];

  /* ---- icCalcChecks, design line 9027 ---- */
  const checks = useMemo(() => {
    if (!loaded) return [] as [string, string, string, string, 'PASS' | 'INFO' | 'FAIL'][];
    const unexplained = E1.reduce((t, r) => t + r.unexplained_difference, 0);
    const unresolved = E1.filter((r) => r.diff_reason === 'UNRESOLVED').length;
    const noReason = E1.filter((r) => Math.abs(r.gross_difference) > 0 && (!r.diff_reason || r.diff_reason === 'NIL')).length;
    const divPaired = E1.filter((r) => r.balance_nature === 'DIVIDEND_RECEIVABLE').length;
    const netInv = E1.filter((r) => r.is_net_investment === 'Y').length;
    const inTransit = E1.reduce((t, r) => t + r.in_transit_goods + r.in_transit_cash, 0);
    return [
      ['C1', 'Reciprocal balances agree within tolerance', 'E1', `${n0(unexplained)} unexplained`, unexplained <= tolValue ? 'PASS' : 'FAIL'],
      ['C2', 'Every difference carries a reason', 'E1 · E2', `${noReason} without a reason`, noReason === 0 ? 'PASS' : 'FAIL'],
      ['C3', 'No unresolved residuals left open', 'E1', `${unresolved} unresolved`, unresolved === 0 ? 'PASS' : 'FAIL'],
      ['C4', 'In-transit items normalised before matching', 'E9 → E1', `${n0(inTransit)} normalised`, inTransit > 0 ? 'INFO' : 'PASS'],
      ['C5', 'Dividend receivable paired to the declaring entity', 'E1 ↔ E6', `${divPaired} paired`, divPaired > 0 ? 'PASS' : 'INFO'],
      ['C6', 'Net-investment loans flagged for OCI treatment', 'E1', `${netInv} designated`, netInv > 0 ? 'INFO' : 'PASS'],
    ] as [string, string, string, string, 'PASS' | 'INFO' | 'FAIL'][];
  }, [loaded, tolValue]);

  const chkCount = checks.reduce((a, c) => ({ ...a, [c[4]]: (a[c[4]] ?? 0) + 1 }), {} as Record<string, number>);
  const totalRows = Object.values(ROW_PLAN).reduce((a, b) => a + b, 0);

  const runEngine = () => {
    setRunning(true); setRunDone(false); setRunIdx(0);
    PIPELINE.forEach((_, i) => setTimeout(() => setRunIdx(i), i * 320));
    setTimeout(() => {
      setRunning(false); setRunDone(true); setRunIdx(PIPELINE.length - 1);
      setToast(`Elimination run complete — ${totalRows} rows processed across nine natures in pipeline order. Nine rows eliminated automatically without review.`);
      setTimeout(() => setToast(''), 4200);
    }, PIPELINE.length * 320 + 250);
  };

  const downloadTemplate = () => {
    const head = E1_COLS.map((c) => c.l);
    const body = E1.map((r) => E1_COLS.map((c) => String(r[c.k] ?? '')));
    const csv = [head, ...body].map((x) => x.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'ice-input-template-E1.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const runPct = runDone ? 100 : Math.round(((runIdx + 1) / PIPELINE.length) * 100);
  const autoRows = E1.filter((r) => r.unexplained_difference === 0 && r.diff_reason !== 'UNRESOLVED').length;

  return (
    <div style={{ padding: '24px 28px 26px', animation: 'fcFade .25s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: '#7A84A0' }}>Module · Step 4</div>
          <h1 style={{ margin: '6px 0 0', fontSize: '24px', fontWeight: 700, color: '#232C42' }}>Intercompany Eliminations (ICE)</h1>
          <div style={{ marginTop: '5px', fontSize: '12.5px', color: '#7A84A0', maxWidth: '860px' }}>
            Nine elimination natures, one input template. Fill only the natures that apply to the period; the engine matches
            reciprocals, carries unrealised profit forward and attributes the result to the parent and non-controlling interests.
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ marginBottom: '14px', padding: '9px 12px', borderRadius: '9px', fontSize: '12px', color: '#0B5A54', background: 'rgba(15,118,110,.09)', border: '1px solid rgba(15,118,110,.26)' }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '13px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '9px', alignItems: 'stretch' }}>
          {/* ---- data input template ---- */}
          <section style={{ ...SEC, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 15px' }}>
              <button type="button" className="fc-btn" onClick={() => setTplOpen((v) => !v)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '6px', color: '#7A84A0', background: '#E4E8F0', transition: 'transform .25s ease', transform: `rotate(${tplOpen ? 90 : 0}deg)` }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                  <span style={{ ...LABEL, whiteSpace: 'nowrap' }}>Data input template</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                    <span style={{
                      flex: 'none', fontSize: '10px', fontWeight: 700, letterSpacing: '.4px', padding: '3px 9px', borderRadius: '999px',
                      ...(loaded
                        ? { color: '#15803D', background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.35)' }
                        : { color: '#8A5A10', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.38)' }),
                    }}>
                      {loaded ? 'Loaded' : 'Not loaded'}
                    </span>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#93A0C4', whiteSpace: 'nowrap' }}>
                      {loaded ? `${totalRows} rows across 9 natures` : 'Awaiting the completed template'}
                    </span>
                  </span>
                </span>
              </button>
              <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button type="button" className="fc-h fc-btn" onClick={downloadTemplate} title="Download the input template"
                  style={{ width: '30px', height: '30px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B5BDB', background: '#E7EAF2', border: '1px solid rgba(255,255,255,.7)', boxShadow: '3px 3px 8px rgba(166,175,195,.4)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v10M8 10l4 4 4-4M5 20h14" /></svg>
                </button>
                <button type="button" className="fc-h fc-btn" onClick={() => setLoaded((v) => !v)} title={loaded ? 'Replace the loaded template' : 'Load the completed template'}
                  style={{ width: '30px', height: '30px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', boxShadow: '0 3px 9px rgba(37,99,235,.35)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
                </button>
              </div>
            </div>
            {tplOpen && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 15px 15px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '12px',
                  ...(loaded
                    ? { background: '#F6F7FB', border: '1px solid #E4E8F2', boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.3)' }
                    : { background: 'rgba(59,130,246,.05)', border: '1.5px dashed rgba(59,130,246,.4)' }),
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7A84A0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" /><path d="M9 13h6M9 16.5h4" />
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#232C42', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {loaded ? 'ICE-input-Q3-2026-ClientCo.xlsx' : 'Drop the completed template here'}
                    </div>
                    <div style={{ marginTop: '2px', fontSize: '11px', color: '#7A84A0' }}>
                      {loaded ? `${totalRows} rows · 9 nature sheets · uploaded 08:41 by JB` : 'Accepted: .xlsx · one sheet per elimination nature'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ---- checks ---- */}
          <section style={{ ...SEC, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 15px' }}>
              <button type="button" className="fc-btn" onClick={() => setChkOpen((v) => !v)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '6px', color: '#7A84A0', background: '#E4E8F0', transition: 'transform .25s ease', transform: `rotate(${chkOpen ? 90 : 0}deg)` }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                  <span style={{ ...LABEL, whiteSpace: 'nowrap' }}>Pre-run checks</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {(['PASS', 'INFO', 'FAIL'] as const).map((k) => (
                      <span key={k} style={{
                        fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px',
                        color: k === 'PASS' ? '#15803D' : k === 'INFO' ? '#3B5BDB' : '#B42318',
                        background: k === 'PASS' ? 'rgba(34,197,94,.12)' : k === 'INFO' ? 'rgba(59,130,246,.12)' : 'rgba(180,35,24,.1)',
                      }}>
                        {chkCount[k] ?? 0} {k.toLowerCase()}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
            </div>
            {chkOpen && (
              <div style={{ padding: '0 15px 15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {checks.map(([id, label, src, val, res]) => (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <span style={{ flex: 'none', width: '20px', fontSize: '9.5px', fontWeight: 700, color: '#9AA3BA' }}>{id}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: '11.5px', color: '#414B62', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                      <span style={{ flex: 'none', fontSize: '9.5px', fontWeight: 700, color: '#93A0C4' }}>{src}</span>
                      <span style={{ flex: 'none', fontSize: '10px', color: '#7A84A0', fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                      <span style={{
                        flex: 'none', fontSize: '9px', fontWeight: 700, letterSpacing: '.3px', padding: '2px 7px', borderRadius: '5px',
                        color: res === 'PASS' ? '#15803D' : res === 'INFO' ? '#3B5BDB' : '#B42318',
                        background: res === 'PASS' ? 'rgba(34,197,94,.14)' : res === 'INFO' ? 'rgba(59,130,246,.12)' : 'rgba(180,35,24,.1)',
                      }}>
                        {res}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <label style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '7px', fontSize: '10.5px', color: '#7A84A0' }} title="Absolute tolerance in transaction currency, set by group policy">
                    Tolerance
                    <input
                      value={tol} onChange={(e) => setTol(e.target.value)}
                      style={{ width: '78px', height: '26px', background: '#E4E8F0', border: '1px solid #CBD2E0', boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.4)', borderRadius: '7px', color: '#232C42', font: 'inherit', fontSize: '11px', fontWeight: 700, textAlign: 'right', padding: '0 8px', outline: 'none' }}
                    />
                  </label>
                  <span style={{ flex: 1, minWidth: '140px', fontSize: '11.5px', color: '#7A84A0', fontStyle: 'italic' }}>
                    Differences inside tolerance are eliminated at the lower of the two sides; anything above it needs a reason and an owner before the run.
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ---- run bar ---- */}
        <section style={{ ...SEC, padding: '11px 15px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button
            type="button" className="fc-h fc-btn" onClick={runEngine} disabled={running}
            style={{
              flex: 'none', height: '34px', padding: '0 16px', borderRadius: '9px', fontSize: '12px', fontWeight: 700,
              ...(running
                ? { color: '#B4BBCC', background: '#E9ECF3', cursor: 'not-allowed' }
                : { color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', boxShadow: '0 3px 10px rgba(37,99,235,.35)' }),
            }}
          >
            {running ? 'Running…' : runDone ? 'Re-run eliminations' : 'Run eliminations'}
          </button>
          <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: '11.5px', fontWeight: 700, color: '#232C42', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {running ? `Stage ${runIdx + 1} of ${PIPELINE.length} · ${PIPELINE[runIdx][0]}` : runDone ? 'Elimination run settled' : 'Ready to run'}
              </span>
              <span style={{ flex: 'none', fontSize: '10.5px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#7A84A0' }}>{runPct}%</span>
            </div>
            <div style={{ height: '7px', borderRadius: '999px', background: '#E0E4EE', boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.45)' }}>
              <div style={{ height: '100%', width: `${runPct}%`, borderRadius: '999px', background: 'linear-gradient(90deg,#3B82F6,#2563EB)', transition: 'width .3s ease' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            {PIPELINE.map(([l, t], i) => {
              const cur = running && i === runIdx;
              const done = runIdx > i || (!running && runDone);
              const isCur = l.split(' · ').includes(code);
              return (
                <span key={l} title={t} style={{
                  display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 9px', borderRadius: '7px',
                  fontSize: '10px', fontWeight: 700, letterSpacing: '.3px', cursor: 'help', transition: 'all .3s',
                  ...(cur ? { color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', border: '1px solid #2563EB', boxShadow: '0 0 0 3px rgba(59,130,246,.2)' }
                    : done ? { color: '#0F7A5B', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.34)' }
                      : isCur ? { color: '#3B5BDB', background: 'rgba(59,130,246,.13)', border: '1px solid rgba(59,130,246,.34)' }
                        : { color: '#65708C', background: '#E4E8F0', border: '1px solid #D6DBE7' }),
                }}>
                  {l}
                </span>
              );
            })}
          </div>
        </section>
      </div>

      {/* ---- registers ---- */}
      <section style={{
        ...SEC, padding: '18px 20px', display: 'flex', flexDirection: 'column',
        ...(full ? { position: 'fixed', top: 0, right: 0, bottom: 0, left: '68px', zIndex: 400, borderRadius: 0 } : null),
      }}>
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {(Object.keys(NATURE) as NatureKey[]).map((k) => {
            const [c, nm, , st] = NATURE[k];
            const on = tab === k;
            const rows = k === 'TJE_Manual' ? 3 : ROW_PLAN[k] ?? 0;
            return (
              <button
                key={k} type="button" className="fc-h fc-btn" onClick={() => setTab(k)} title={NATURE[k][2]}
                style={{
                  display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 12px', borderRadius: '11px', textAlign: 'left',
                  ...(on
                    ? { background: 'linear-gradient(150deg,rgba(59,130,246,.14),rgba(255,255,255,.4))', border: '1px solid #7C97E8', color: '#232C42' }
                    : { background: '#E7EAF2', border: '1px solid rgba(255,255,255,.7)', color: '#65708C' }),
                }}
              >
                <span style={{
                  flex: 'none', minWidth: '28px', height: '22px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10.5px', fontWeight: 700,
                  ...(on ? { color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)' } : { color: '#4055C8', background: '#E4E8F0', border: '1px solid #CBD2E0' }),
                }}>
                  {c}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px', minWidth: 0 }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, lineHeight: 1.2 }}>{nm}</span>
                  <span style={{ fontSize: '9.5px', color: on ? '#4055C8' : '#93A0C4' }}>{st} · {loaded ? `${rows} rows` : 'no data'}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#232C42' }}>{code} · {name}</div>
            <div style={{ marginTop: '3px', fontSize: '12px', color: '#7A84A0' }}>
              {sub} — {tab === 'TJE_Manual'
                ? 'Each row is a two-sided journal in the top-side master; the elimination link keeps the audit trail intact.'
                : `${state} register. The engine matches reciprocals and normalises in-transit items before eliminating at the lower of the two sides.`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              {(Object.keys(KIND_META) as Kind[]).map((k) => (
                <span key={k} title={KIND_META[k][2]} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, color: '#65708C' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: KIND_META[k][1], border: `1px solid ${KIND_META[k][0]}55` }} />
                  {k === 'input' ? 'You fill' : k === 'formula' ? 'Formula' : 'System'}
                </span>
              ))}
            </div>
            <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', borderRadius: '11px', background: '#E4E8F0', boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.42),inset -2px -2px 6px rgba(255,255,255,.9)' }}>
              {(['grid', 'guide'] as const).map((v) => (
                <button key={v} type="button" className="fc-btn" onClick={() => setView(v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', height: '26px', padding: '0 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                    ...(view === v ? { background: '#fff', color: '#232C42', boxShadow: '0 1px 4px rgba(60,70,100,.18)' } : { color: '#7A84A0' }),
                  }}>
                  {v === 'grid' ? 'Grid' : 'Field guide'}
                </button>
              ))}
            </div>
            <button type="button" className="fc-h fc-btn" onClick={() => setDashOpen(true)} title="Intercompany dashboard — heatmap, flow and exceptions"
              style={{ width: '30px', height: '30px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B5BDB', background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.3)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16M7 16v-6M12 16V6M17 16v-3" /></svg>
            </button>
            <button type="button" className="fc-h fc-btn" onClick={() => setFull((v) => !v)} title={full ? 'Exit full screen' : 'Expand the table to full screen'}
              style={{ width: '30px', height: '30px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#414B62', background: '#E7EAF2', border: '1px solid rgba(255,255,255,.7)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={full ? 'M4 9h5V4M20 9h-5V4M20 15h-5v5M4 15h5v5' : 'M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5'} />
              </svg>
            </button>
          </div>
        </div>

        {tab === 'TJE_Manual' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '11px', padding: '11px 14px', borderRadius: '12px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.34)' }}>
            <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '9px', color: '#B45309', background: 'rgba(245,158,11,.16)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
            </span>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#232C42' }}>Entries keyed here post straight to the top-side JE master</div>
              <div style={{ marginTop: '2px', fontSize: '11.5px', color: '#65708C' }}>
                The master register owns the JE number, reviewer sign-off and the period lock. This tab keys the entry in
                elimination context and keeps the link to the nature row it corrects.
              </div>
            </div>
          </div>
        )}

        {view === 'grid' ? (
          tab === 'E1_IC_Balances' && loaded ? (
            <>
              <div style={{ overflow: 'auto', border: '1px solid #DCE0EB', borderRadius: '12px', background: '#ECEFF6', flex: 1, minHeight: 0 }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%', font: 'inherit' }}>
                  <thead>
                    <tr>
                      {E1_COLS.map((c) => {
                        const [col, bg] = KIND_META[c.t];
                        return (
                          <th key={c.k} style={{ ...TH, background: bg, color: col }} title={c.note ?? KIND_META[c.t][2]}>
                            <span style={{ display: 'block', fontSize: '9px', letterSpacing: '.4px', textTransform: 'uppercase', lineHeight: 1.25 }}>{c.l}</span>
                            <span style={{ display: 'block', marginTop: '2px', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: '8.5px', fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#8A93AB' }}>{c.k}</span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {E1.map((r) => {
                      const flagged = r.unexplained_difference > tolValue || r.diff_reason === 'UNRESOLVED';
                      return (
                        <tr key={r.elim_id} className="fc-h" style={flagged ? { background: 'rgba(180,35,24,.045)' } : undefined}>
                          {E1_COLS.map((c) => {
                            const raw = r[c.k];
                            const v = c.num ? (Number(raw) ? n0(Number(raw)) : '—') : String(raw ?? '') || '—';
                            const isDiff = c.k === 'unexplained_difference' || c.k === 'gross_difference';
                            return (
                              <td
                                key={c.k}
                                title={c.k === 'entity_a_code' || c.k === 'entity_b_code' ? ENT_NAMES[String(raw)] : undefined}
                                style={{
                                  ...TD,
                                  textAlign: c.num ? 'right' : 'left',
                                  fontVariantNumeric: c.num ? 'tabular-nums' : undefined,
                                  color: isDiff && Number(raw) > 0 ? '#B42318'
                                    : c.k === 'eliminate_amount' ? '#232C42'
                                      : c.t === 'formula' ? '#2C5580' : '#65708C',
                                  fontWeight: c.k === 'elim_id' || c.k === 'eliminate_amount' || (isDiff && Number(raw) > 0) ? 700 : 400,
                                  background: c.t === 'formula' ? 'rgba(59,130,246,.04)' : c.t === 'system' ? 'rgba(107,122,141,.04)' : undefined,
                                }}
                              >
                                {c.k === 'diff_reason' && raw && raw !== 'NIL' ? (
                                  <span style={{
                                    fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '5px',
                                    color: raw === 'UNRESOLVED' ? '#B42318' : '#B45309',
                                    background: raw === 'UNRESOLVED' ? 'rgba(180,35,24,.1)' : 'rgba(245,158,11,.14)',
                                  }}>{String(raw)}</span>
                                ) : v}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '11px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: '#9AA3BA' }}>{E1.length} rows · {E1_COLS.length} fields</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '24px', padding: '0 10px 0 8px', borderRadius: '7px', background: 'rgba(16,185,129,.11)', border: '1px solid rgba(16,185,129,.35)' }}>
                  <span style={{ flex: 'none', width: '3px', height: '13px', borderRadius: '2px', background: '#10B981' }} />
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#0F7A5B' }}>{autoRows} eliminated automatically</span>
                </span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: '11.5px', fontStyle: 'italic', color: '#7A84A0' }}>
                  Rows shaded red carry an unexplained difference above tolerance or an unresolved reason.
                </span>
              </div>
            </>
          ) : (
            <div style={{ padding: '46px 20px', textAlign: 'center', border: '1px solid #DCE0EB', borderRadius: '12px', background: '#F6F7FB' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#232C42' }}>
                {loaded ? `${code} · ${name} — ${tab === 'TJE_Manual' ? 3 : ROW_PLAN[tab] ?? 0} rows in the loaded template` : 'Template not loaded'}
              </div>
              <div style={{ marginTop: '6px', fontSize: '11.5px', color: '#7A84A0', maxWidth: '620px', margin: '6px auto 0', lineHeight: 1.55 }}>
                {loaded
                  ? 'The column specification for this register lives in ic-schema.js, which is not part of the shared design handoff — add that file and this grid renders with its own fields, kinds and field guide.'
                  : 'Load the completed input template to populate every nature register.'}
              </div>
            </div>
          )
        ) : (
          <div style={{ border: '1px solid #DCE0EB', borderRadius: '12px', background: '#F6F7FB', overflow: 'auto' }}>
            {(tab === 'E1_IC_Balances' ? E1_COLS : []).map((c) => {
              const [col, bg, lab] = KIND_META[c.t];
              return (
                <div key={c.k} style={{ display: 'flex', gap: '12px', padding: '10px 16px', borderBottom: '1px solid #E7EAF2' }}>
                  <span style={{ flex: 'none', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', height: '19px', padding: '0 8px', borderRadius: '6px', fontSize: '9px', fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: col, background: bg }}>
                    {c.t === 'input' ? 'You fill' : c.t === 'formula' ? 'Formula' : 'System'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#232C42' }}>
                      {c.l}
                      <span style={{ marginLeft: '8px', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: '9.5px', fontWeight: 400, color: '#8A93AB' }}>{c.k}</span>
                    </div>
                    <div style={{ marginTop: '3px', fontSize: '11.5px', color: '#65708C', lineHeight: 1.5 }}>{c.note ?? lab}</div>
                  </div>
                  <span style={{ flex: 'none', fontSize: '10.5px', color: '#7A84A0', fontVariantNumeric: 'tabular-nums' }}>
                    e.g. {String(E1[0][c.k] ?? '—').slice(0, 26)}
                  </span>
                </div>
              );
            })}
            {tab !== 'E1_IC_Balances' && (
              <div style={{ padding: '36px 20px', textAlign: 'center', fontSize: '11.5px', color: '#7A84A0', fontStyle: 'italic' }}>
                The field guide for this register comes from ic-schema.js, which is missing from the handoff.
              </div>
            )}
          </div>
        )}
      </section>

      {dashOpen && <IcDashboard onClose={() => setDashOpen(false)} />}
    </div>
  );
}

/* ========================== dashboard ========================== */

const DASH_ENTS = ['IN-HOLD', 'US-OPCO', 'SG-OPCO', 'AE-DIST', 'IN-MFG', 'LK-OPCO'];

function IcDashboard({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'heat' | 'flow' | 'exc'>('heat');
  const [sel, setSel] = useState<string | null>(null);

  /** pair matrix from the E1 register */
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    DASH_ENTS.forEach((a) => { m[a] = {}; DASH_ENTS.forEach((b) => { m[a][b] = 0; }); });
    E1.forEach((r) => { if (m[r.entity_a_code] && m[r.entity_a_code][r.entity_b_code] !== undefined) m[r.entity_a_code][r.entity_b_code] += r.amt_a_txn; });
    return m;
  }, []);
  const max = Math.max(...DASH_ENTS.flatMap((a) => DASH_ENTS.map((b) => matrix[a][b])), 1);

  const exceptions = E1.filter((r) => r.unexplained_difference > 0 || r.diff_reason === 'UNRESOLVED' || !r.support_ref);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 640, background: 'rgba(35,44,66,.42)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '1100px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#ECEFF6', border: '1px solid rgba(255,255,255,.85)', borderRadius: '18px', boxShadow: '18px 18px 48px rgba(120,130,155,.5)', padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#7A84A0' }}>Intercompany</div>
            <h2 style={{ margin: '5px 0 0', fontSize: '19px', fontWeight: 700, color: '#232C42' }}>Exposure heatmap, flow and exceptions</h2>
          </div>
          <div style={{ display: 'flex', gap: '3px', padding: '3px', borderRadius: '11px', background: '#E4E8F0', boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.45),inset -2px -2px 5px rgba(255,255,255,.9)' }}>
            {([['heat', 'Heatmap'], ['flow', 'Flow'], ['exc', `Exceptions (${exceptions.length})`]] as const).map(([k, l]) => (
              <button key={k} type="button" className="fc-btn" onClick={() => setMode(k)}
                style={{ padding: '6px 13px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, ...(mode === k ? { background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff' } : { color: '#65708C' }) }}>
                {l}
              </button>
            ))}
          </div>
          <button type="button" className="fc-h fc-btn" onClick={onClose} title="Close"
            style={{ flex: 'none', width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#65708C', background: '#E7EAF2', border: '1px solid rgba(255,255,255,.7)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {mode === 'heat' && (
            <table style={{ borderCollapse: 'collapse', width: '100%', font: 'inherit' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, borderTop: 'none', fontSize: '9px' }}>A ↓ / B →</th>
                  {DASH_ENTS.map((b) => <th key={b} style={{ ...TH, borderTop: 'none', fontSize: '9px', textAlign: 'center' }}>{b}</th>)}
                </tr>
              </thead>
              <tbody>
                {DASH_ENTS.map((a) => (
                  <tr key={a}>
                    <td style={{ ...TD, fontWeight: 700, color: '#232C42' }}>{a}</td>
                    {DASH_ENTS.map((b) => {
                      const v = matrix[a][b];
                      const t = v / max;
                      return (
                        <td key={b} onClick={() => setSel(v ? `${a} → ${b}` : null)} title={v ? `${a} → ${b} · ${n0(v)}` : 'No exposure'}
                          style={{ ...TD, textAlign: 'center', cursor: v ? 'pointer' : 'default', background: v ? `rgba(37,99,235,${(0.08 + t * 0.55).toFixed(2)})` : 'rgba(228,232,240,.4)', color: t > 0.5 ? '#fff' : '#414B62', fontWeight: v ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>
                          {v ? n0(v) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {mode === 'flow' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {E1.map((r) => {
                const w = (r.amt_a_txn / Math.max(...E1.map((x) => x.amt_a_txn))) * 100;
                return (
                  <div key={r.elim_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '11px', background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.85)' }}>
                    <span style={{ flex: 'none', width: '76px', fontSize: '10px', fontWeight: 700, color: '#0F766E' }}>{r.elim_id}</span>
                    <span style={{ flex: 'none', width: '78px', fontSize: '11px', fontWeight: 700, color: '#232C42' }}>{r.entity_a_code}</span>
                    <span style={{ flex: 1, minWidth: 0, height: '8px', borderRadius: '999px', background: '#E0E4EE', position: 'relative' }}>
                      <span style={{ position: 'absolute', inset: 0, width: `${w}%`, borderRadius: '999px', background: 'linear-gradient(90deg,#3B82F6,#2563EB)' }} />
                    </span>
                    <span style={{ flex: 'none', width: '78px', fontSize: '11px', fontWeight: 700, color: '#232C42' }}>{r.entity_b_code}</span>
                    <span style={{ flex: 'none', width: '96px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#232C42', fontVariantNumeric: 'tabular-nums' }}>{n0(r.amt_a_txn)}</span>
                    <span style={{ flex: 'none', fontSize: '9.5px', color: '#7A84A0' }}>{r.txn_ccy}</span>
                  </div>
                );
              })}
            </div>
          )}

          {mode === 'exc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {exceptions.map((r) => (
                <div key={r.elim_id} style={{ display: 'flex', alignItems: 'flex-start', gap: '11px', padding: '11px 13px', borderRadius: '11px', background: 'linear-gradient(155deg,rgba(245,158,11,.10),rgba(255,255,255,.34))', border: '1px solid rgba(245,158,11,.34)' }}>
                  <span style={{ flex: 'none', fontSize: '10px', fontWeight: 700, color: '#B45309' }}>{r.elim_id}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#232C42' }}>
                      {r.entity_a_code} ↔ {r.entity_b_code} · {r.balance_nature}
                    </div>
                    <div style={{ marginTop: '2px', fontSize: '11px', color: '#65708C' }}>
                      {r.unexplained_difference > 0 && `Unexplained ${n0(r.unexplained_difference)} ${r.txn_ccy}. `}
                      {r.diff_reason === 'UNRESOLVED' && 'Reason still unresolved. '}
                      {!r.support_ref && 'No supporting reference attached. '}
                      Owner: {r.diff_owner_entity}
                    </div>
                  </div>
                  <span style={{ flex: 'none', fontSize: '11px', fontWeight: 700, color: '#B42318', fontVariantNumeric: 'tabular-nums' }}>{n0(r.amt_a_txn - r.amt_b_txn)}</span>
                </div>
              ))}
              {exceptions.length === 0 && (
                <div style={{ padding: '36px', textAlign: 'center', fontSize: '12px', color: '#15803D', fontStyle: 'italic' }}>Every pair matches within tolerance.</div>
              )}
            </div>
          )}
        </div>

        {sel && <div style={{ marginTop: '12px', fontSize: '11.5px', color: '#3B5BDB', fontWeight: 700 }}>Selected pair: {sel}</div>}
      </div>
    </div>
  );
}
