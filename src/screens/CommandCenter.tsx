import React, { useState } from 'react';
import ImageSlot from '../components/ImageSlot';
import { useApp } from '../state/AppContext';
import { RouteKey } from '../routes';

/**
 * Command Center — ported verbatim from docs/design/Fusion Close.dc.html,
 * block `<sc-if value="{{ is.command }}">` at lines 940–1154, with the computed
 * values from lines 9995–10001 and 10519–10526.
 *
 * Styles are copied as inline style objects rather than re-expressed as Tailwind
 * classes: the design's scale (9px radii, 11.5px type) has no Tailwind equivalent
 * and every translation rounds.
 */

/* ---------- shared bits ---------- */

const RESET: React.CSSProperties = { cursor: 'pointer', boxSizing: 'border-box' };

const SECTION: React.CSSProperties = {
  background: '#ECEFF6',
  border: '1px solid rgba(255,255,255,.75)',
  borderRadius: '18px',
  boxShadow: '9px 9px 22px rgba(166,175,195,.5),-9px -9px 22px rgba(255,255,255,.95)',
  padding: '22px',
};

const SECTION_HEAD: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: '16px',
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.5px',
  textTransform: 'uppercase',
  color: '#65708C',
};

const SECTION_HINT: React.CSSProperties = {
  fontSize: '11px',
  color: '#9AA3BA',
  fontStyle: 'italic',
};

const CHIP: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '9px',
  padding: '9px 13px',
  borderRadius: '11px',
  background: '#E7EAF2',
  boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.45),inset -2px -2px 6px rgba(255,255,255,.9)',
};

const CHIP_TEXT: React.CSSProperties = { fontSize: '12px', color: '#65708C' };

const PANEL: React.CSSProperties = {
  borderRadius: '16px',
  padding: '15px',
  background: '#E9ECF4',
  border: '1px solid rgba(154,163,186,.28)',
  boxShadow: '7px 7px 18px rgba(166,175,195,.5),-7px -7px 18px rgba(255,255,255,.95)',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const PANEL_HEAD: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '0 3px',
};

const TILE_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
  gap: '12px',
};

/** Button that swaps a single style prop on hover — the dc-runtime's `style-hover`. */
function HoverButton({
  style,
  hoverStyle,
  onClick,
  children,
}: {
  style: React.CSSProperties;
  hoverStyle: React.CSSProperties;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      className="fc-h fc-btn"
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...style, ...(hover ? hoverStyle : null) }}
    >
      {children}
    </button>
  );
}

/* ---------- stage cards (lines 1006–1049) ---------- */

type Led = { color: string; glow?: string; anim?: string };
type StageRow = {
  dot: string;
  dotGlow?: string;
  label: string;
  labelColor: string;
  value: string;
  valueColor: string;
  valueBold?: boolean;
};
type Stage = {
  route: RouteKey;
  bg: string;
  border: string;
  hoverBorder: string;
  ledDim?: boolean;
  leds: Led[];
  badge: { text: string; color: string; bg: string; border: string; lock?: boolean };
  num: string;
  title: string;
  titleColor: string;
  desc: string;
  descColor: string;
  rows: StageRow[];
  bar: { width: string; background: string };
  footLeft: string;
  footLeftStyle: React.CSSProperties;
  footRight: string;
  footRightColor: string;
};

const DIM = '#3A445C';

const STAGES: Stage[] = [
  {
    route: 'engagement',
    bg: '#E8F0EB',
    border: '1px solid rgba(34,197,94,.34)',
    hoverBorder: 'rgba(34,197,94,.65)',
    leds: [
      { color: DIM },
      { color: DIM },
      { color: '#22C55E', glow: '0 0 6px #22C55E', anim: 'fcPulse 2.6s ease-in-out infinite' },
    ],
    badge: {
      text: 'Done',
      color: '#15803D',
      bg: 'rgba(34,197,94,.14)',
      border: '1px solid rgba(34,197,94,.32)',
    },
    num: 'Stage 1',
    title: 'Engagement Setup',
    titleColor: '#232C42',
    desc: 'Legal Entity Master & Engagement Configuration.',
    descColor: '#65708C',
    rows: [
      { dot: '#16A34A', label: 'Legal Entity Master', labelColor: '#414B62', value: '30 entities', valueColor: '#7A84A0' },
      { dot: '#16A34A', label: 'Engagement Config', labelColor: '#414B62', value: 'Complete', valueColor: '#7A84A0' },
      { dot: '#16A34A', label: 'Org chart', labelColor: '#414B62', value: 'Generated', valueColor: '#7A84A0' },
    ],
    bar: { width: '100%', background: 'linear-gradient(90deg,#22C55E,#16A34A)' },
    footLeft: '100% complete',
    footLeftStyle: { fontSize: '10.5px', fontWeight: 700, color: '#15803D' },
    footRight: 'Open ›',
    footRightColor: '#15803D',
  },
  {
    route: 'upload',
    bg: '#F2EEE3',
    border: '1px solid rgba(245,158,11,.38)',
    hoverBorder: 'rgba(245,158,11,.7)',
    leds: [
      { color: DIM },
      { color: '#F59E0B', glow: '0 0 6px #F59E0B', anim: 'fcPulse 1.8s ease-in-out infinite' },
      { color: DIM },
    ],
    badge: {
      text: 'In progress',
      color: '#B45309',
      bg: 'rgba(245,158,11,.14)',
      border: '1px solid rgba(245,158,11,.34)',
    },
    num: 'Stage 2',
    title: 'Financial Data Layer',
    titleColor: '#232C42',
    desc: 'Trial balances, FSLI mapping and journal entries.',
    descColor: '#65708C',
    rows: [
      { dot: '#F59E0B', label: 'Trial Balance', labelColor: '#414B62', value: '28 / 30', valueColor: '#B45309', valueBold: true },
      { dot: '#F59E0B', label: 'FSLI Mapping', labelColor: '#414B62', value: '14 unmapped', valueColor: '#B45309', valueBold: true },
      { dot: '#9AA3BA', label: 'Journal Entries', labelColor: '#414B62', value: '2 drafts', valueColor: '#7A84A0' },
    ],
    bar: { width: '78%', background: 'linear-gradient(90deg,#FBBF24,#F59E0B)' },
    footLeft: '78% loaded',
    footLeftStyle: { fontSize: '10.5px', fontWeight: 700, color: '#B45309' },
    footRight: 'Resume ›',
    footRightColor: '#B45309',
  },
  {
    route: 'fx',
    bg: '#E7EAF2',
    border: '1px solid rgba(154,163,186,.32)',
    hoverBorder: '#9AA3BA',
    ledDim: true,
    leds: [{ color: DIM }, { color: DIM }, { color: DIM }],
    badge: {
      text: 'Queued',
      color: '#65708C',
      bg: 'rgba(148,163,184,.14)',
      border: '1px solid rgba(148,163,184,.3)',
      lock: true,
    },
    num: 'Stage 3',
    title: 'Currency Translation',
    titleColor: '#414B62',
    desc: 'Currency translation runs into presentation currency.',
    descColor: '#7A84A0',
    rows: [
      { dot: '#9AA3BA', label: 'Rate table', labelColor: '#65708C', value: '7 currencies staged', valueColor: '#7A84A0' },
      { dot: '#C0C7D6', label: 'Translation run', labelColor: '#65708C', value: 'Not started', valueColor: '#9AA3BA' },
    ],
    bar: { width: '0%', background: '#9AA3BA' },
    footLeft: 'Unlocks when data layer clears',
    footLeftStyle: { fontSize: '10.5px', color: '#9AA3BA', fontStyle: 'italic' },
    footRight: 'Open ›',
    footRightColor: '#7A84A0',
  },
  {
    route: 'ice',
    bg: '#F2E7E7',
    border: '1px solid rgba(239,68,68,.36)',
    hoverBorder: 'rgba(239,68,68,.65)',
    leds: [
      { color: '#EF4444', glow: '0 0 7px #EF4444', anim: 'fcPulse 1.3s ease-in-out infinite' },
      { color: DIM },
      { color: DIM },
    ],
    badge: {
      text: 'Action',
      color: '#B91C1C',
      bg: 'rgba(239,68,68,.12)',
      border: '1px solid rgba(239,68,68,.34)',
    },
    num: 'Stage 4',
    title: 'IC Eliminations',
    titleColor: '#232C42',
    desc: 'Match & eliminate intercompany balances.',
    descColor: '#65708C',
    rows: [
      { dot: '#16A34A', label: 'Auto-matched', labelColor: '#414B62', value: '147 pairs', valueColor: '#7A84A0' },
      { dot: '#EF4444', dotGlow: '0 0 5px #EF4444', label: 'Out of balance', labelColor: '#414B62', value: '3 entities', valueColor: '#B91C1C', valueBold: true },
    ],
    bar: { width: '88%', background: 'linear-gradient(90deg,#F87171,#EF4444)' },
    footLeft: 'Blocked · 3 to clear',
    footLeftStyle: { fontSize: '10.5px', fontWeight: 700, color: '#B91C1C' },
    footRight: 'Resolve ›',
    footRightColor: '#B91C1C',
  },
];

function StageCard({ s, onClick }: { s: Stage; onClick: () => void }) {
  return (
    <HoverButton
      onClick={onClick}
      style={{
        ...RESET,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        padding: '16px',
        background: s.bg,
        border: s.border,
        boxShadow: '7px 7px 18px rgba(166,175,195,.5),-7px -7px 18px rgba(255,255,255,.95)',
      }}
      hoverStyle={{ borderColor: s.hoverBorder }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <span
          style={{
            flex: 'none',
            display: 'inline-flex',
            flexDirection: 'column',
            gap: '3px',
            padding: '4px',
            borderRadius: '6px',
            background: '#232C42',
            boxShadow: 'inset 1px 1px 3px rgba(0,0,0,.55)',
            ...(s.ledDim ? { opacity: 0.72 } : null),
          }}
        >
          {s.leds.map((l, i) => (
            <span
              key={i}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: l.color,
                ...(l.glow ? { boxShadow: l.glow } : null),
                ...(l.anim ? { animation: l.anim } : null),
              }}
            />
          ))}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '.6px',
            textTransform: 'uppercase',
            color: s.badge.color,
            background: s.badge.bg,
            border: s.badge.border,
            padding: '3px 8px',
            borderRadius: '999px',
          }}
        >
          {s.badge.lock && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          )}
          {s.badge.text}
        </span>
      </div>

      <div style={{ marginTop: '12px', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#9AA3BA' }}>
        {s.num}
      </div>
      <div style={{ marginTop: '2px', fontSize: '15px', fontWeight: 700, color: s.titleColor }}>{s.title}</div>
      <div style={{ marginTop: '3px', fontSize: '11px', fontStyle: 'italic', lineHeight: 1.45, color: s.descColor }}>
        {s.desc}
      </div>

      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {s.rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                flex: 'none',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: r.dot,
                ...(r.dotGlow ? { boxShadow: r.dotGlow } : null),
              }}
            />
            <span style={{ flex: 1, fontSize: '11.5px', color: r.labelColor }}>{r.label}</span>
            <span style={{ fontSize: '10.5px', color: r.valueColor, ...(r.valueBold ? { fontWeight: 700 } : null) }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: '13px',
          height: '5px',
          borderRadius: '999px',
          background: '#DDE1EB',
          boxShadow: 'inset 1px 1px 3px rgba(166,175,195,.6)',
          overflow: 'hidden',
        }}
      >
        <span style={{ display: 'block', height: '100%', width: s.bar.width, borderRadius: '999px', background: s.bar.background }} />
      </div>

      <div style={{ marginTop: '9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={s.footLeftStyle}>{s.footLeft}</span>
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: s.footRightColor }}>{s.footRight}</span>
      </div>
    </HoverButton>
  );
}

/* ---------- tiles (lines 1077–1153) ---------- */

type Tile = {
  key: string;
  route: RouteKey;
  hoverBorder: string;
  iconBg: string;
  iconShadow: string;
  svg: React.ReactNode;
  title: string;
  desc: string;
  descNoWrap?: boolean;
  badgeColor: string;
  dotColor: string;
  badge: string;
};

const TILE_BTN: React.CSSProperties = {
  ...RESET,
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: '9px',
  borderRadius: '15px',
  padding: '15px 11px 13px',
  background: '#ECEFF6',
  border: '1px solid rgba(255,255,255,.8)',
  boxShadow: '5px 5px 13px rgba(166,175,195,.45),-5px -5px 13px rgba(255,255,255,.95)',
};

function tileIcon(d: string | React.ReactNode) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {typeof d === 'string' ? <path d={d} /> : d}
    </svg>
  );
}

const DELIVERY_TILES: Tile[] = [
  {
    key: 'finrep',
    route: 'repanalytics',
    hoverBorder: '#3B5BDB',
    iconBg: 'linear-gradient(145deg,#3B82F6,#2563EB)',
    iconShadow: '0 4px 12px rgba(37,99,235,.35),inset 0 1px 0 rgba(255,255,255,.35)',
    svg: tileIcon('M6 3h9l4 4v14H6zM9 11h6M9 15h4M14 3v4h4'),
    title: 'Financial Reporting',
    desc: 'Statements, notes and disclosures',
    badgeColor: '#3B5BDB',
    dotColor: '#2563EB',
    badge: 'Q3 2026 draft',
  },
  {
    key: 'analytics',
    route: 'repanalytics',
    hoverBorder: '#15803D',
    iconBg: 'linear-gradient(145deg,#34D399,#16A34A)',
    iconShadow: '0 4px 12px rgba(22,163,74,.32),inset 0 1px 0 rgba(255,255,255,.35)',
    svg: tileIcon('M4 19h16M5 15l4.5-5L13 13l6-7'),
    title: 'Data Analytics',
    desc: 'KPIs, variance, ratios and trends',
    badgeColor: '#15803D',
    dotColor: '#16A34A',
    badge: 'Live',
  },
  {
    key: 'pmo',
    route: 'pmo',
    hoverBorder: '#4055C8',
    iconBg: 'linear-gradient(145deg,#818CF8,#4055C8)',
    iconShadow: '0 4px 12px rgba(64,85,200,.32),inset 0 1px 0 rgba(255,255,255,.35)',
    svg: tileIcon('M8 4h8v3H8zM8 4H5v17h14V4h-3M9 13l2 2 4-4'),
    title: 'Manage Assignments',
    desc: 'Assignments, actions and key dates',
    badgeColor: '#B45309',
    dotColor: '#F59E0B',
    badge: '3 open risks',
  },
  {
    key: 'sentinel',
    route: 'disclosure',
    hoverBorder: '#7C3AED',
    iconBg: 'linear-gradient(145deg,#A78BFA,#6D28D9)',
    iconShadow: '0 4px 12px rgba(109,40,217,.32),inset 0 1px 0 rgba(255,255,255,.35)',
    svg: tileIcon(
      <>
        <path d="M12 3l7 2.5v6c0 4.2-2.9 7.6-7 9.5-4.1-1.9-7-5.3-7-9.5v-6z" />
        <path d="M9 12l2.2 2.2L15.5 10" />
      </>,
    ),
    title: 'Disclosure Sentinel',
    desc: 'Gaps and evidence',
    descNoWrap: true,
    badgeColor: '#6D28D9',
    dotColor: '#7C3AED',
    badge: '6 gaps flagged',
  },
];

type ModKey = 'buscomb' | 'proforma' | 'gaap' | 'carve';

const MODULE_TILES: (Omit<Tile, 'badge'> & { key: ModKey })[] = [
  {
    key: 'buscomb',
    route: 'buscomb',
    hoverBorder: '#3B5BDB',
    iconBg: 'linear-gradient(145deg,#3B82F6,#2563EB)',
    iconShadow: '0 4px 12px rgba(37,99,235,.35),inset 0 1px 0 rgba(255,255,255,.35)',
    svg: tileIcon('M3 5h3.5l4.5 6.5M3 19h3.5L11 12.5M11 12h9M20 12l-3.2-3.2M20 12l-3.2 3.2'),
    title: 'PPA Accounting',
    desc: 'Purchase price allocation and goodwill',
    badgeColor: '#3B5BDB',
    dotColor: '#2563EB',
  },
  {
    key: 'proforma',
    route: 'proforma',
    hoverBorder: '#0F766E',
    iconBg: 'linear-gradient(145deg,#2DD4BF,#0F766E)',
    iconShadow: '0 4px 12px rgba(15,118,110,.32),inset 0 1px 0 rgba(255,255,255,.35)',
    svg: tileIcon('M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5'),
    title: 'Proformas',
    desc: 'As-if scenarios and deal impact',
    badgeColor: '#0F766E',
    dotColor: '#0F766E',
  },
  {
    key: 'gaap',
    route: 'gaap',
    hoverBorder: '#4055C8',
    iconBg: 'linear-gradient(145deg,#818CF8,#4055C8)',
    iconShadow: '0 4px 12px rgba(64,85,200,.32),inset 0 1px 0 rgba(255,255,255,.35)',
    svg: tileIcon('M8 3 4 7l4 4M4 7h16M16 13l4 4-4 4M20 17H4'),
    title: 'GAAP Conversion',
    desc: 'Local-to-group framework adjustments',
    badgeColor: '#4055C8',
    dotColor: '#4055C8',
  },
  {
    key: 'carve',
    route: 'carve',
    hoverBorder: '#B45309',
    iconBg: 'linear-gradient(145deg,#FBBF24,#B45309)',
    iconShadow: '0 4px 12px rgba(180,83,9,.3),inset 0 1px 0 rgba(255,255,255,.35)',
    svg: tileIcon('M4 4h9v16H4zM16 4h4v5h-4zM18 11.5v7.5M18 19l2.4-2.4M18 19l-2.4-2.4'),
    title: 'Divestiture',
    desc: 'Perimeter, allocations and sign-off',
    badgeColor: '#B45309',
    dotColor: '#B45309',
  },
];

function TileCard({ t, badge, onClick }: { t: Omit<Tile, 'badge'>; badge: string; onClick: () => void }) {
  return (
    <HoverButton onClick={onClick} style={TILE_BTN} hoverStyle={{ borderColor: t.hoverBorder }}>
      <span
        style={{
          flex: 'none',
          width: '50px',
          height: '50px',
          borderRadius: '14px',
          background: t.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: t.iconShadow,
        }}
      >
        {t.svg}
      </span>
      <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#232C42', lineHeight: 1.25 }}>{t.title}</span>
      <span
        style={{
          fontSize: '10px',
          fontStyle: 'italic',
          lineHeight: 1.4,
          color: '#7A84A0',
          ...(t.descNoWrap ? { whiteSpace: 'nowrap' } : null),
        }}
      >
        {t.desc}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '.5px',
          textTransform: 'uppercase',
          color: t.badgeColor,
        }}
      >
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: t.dotColor }} />
        {badge}
      </span>
    </HoverButton>
  );
}

/* ---------- screen ---------- */

export default function CommandCenter() {
  const { navTo, modOn, toggleModule, wsArchive, setWsArchive } = useApp();

  const modCount = MODULE_TILES.filter((m) => modOn[m.key]).length;
  const modEnabledLabel = `${modCount} of 4 enabled`;
  const archived = wsArchive !== null;

  return (
    <div style={{ padding: '24px 28px 26px' }}>
      {/* ---- read-only archive banner (design lines 942–950) ---- */}
      {archived && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
            padding: '10px 14px', borderRadius: '12px', background: '#E7EAF2',
            border: '1px solid #CBD2E0', boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.4)',
          }}
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A84A0"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}
          >
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#232C42' }}>
              Read-only archive · {wsArchive.name} — {wsArchive.period}
            </span>
            <span style={{ fontSize: '11px', color: '#7A84A0', marginLeft: '8px' }}>
              {wsArchive.lock} — figures, notes and sign-offs are viewable but not editable.
            </span>
          </div>
          <button
            type="button"
            className="fc-h fc-btn"
            onClick={() => setWsArchive(null)}
            style={{
              flex: 'none', height: '26px', padding: '0 12px', borderRadius: '8px',
              fontSize: '11px', fontWeight: 700, color: '#fff',
              background: 'linear-gradient(145deg,#3B82F6,#2563EB)',
              boxShadow: '0 2px 8px rgba(37,99,235,.35)',
            }}
          >
            Return to active period
          </button>
        </div>
      )}

      {/* ---- header ---- */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '22px', marginBottom: '24px' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: '#7A84A0' }}>
            Command Center
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: '26px', fontWeight: 700, letterSpacing: '.2px', color: '#232C42' }}>
            Good morning, Amara
          </h1>

          {/* archive chips — static grey, no live counts (design lines 1000–1003) */}
          {archived ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <div style={CHIP}>
                <span style={{ flex: 'none', width: '8px', height: '8px', borderRadius: '50%', background: '#7A84A0' }} />
                <span style={CHIP_TEXT}>
                  TB submitted <b style={{ color: '#232C42', fontWeight: 700 }}>30 / 30</b>
                </span>
              </div>
              <div style={CHIP}>
                <span style={{ flex: 'none', width: '8px', height: '8px', borderRadius: '50%', background: '#7A84A0' }} />
                <span style={CHIP_TEXT}>
                  Open blockers <b style={{ color: '#232C42', fontWeight: 700 }}>0</b>
                </span>
              </div>
              <div style={CHIP}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7A84A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <span style={CHIP_TEXT}>{wsArchive.lock}</span>
              </div>
            </div>
          ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <div style={CHIP}>
              <span
                style={{
                  flex: 'none',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#16A34A',
                  boxShadow: '0 0 7px #16A34A',
                  animation: 'fcPulse 2.4s ease-in-out infinite',
                }}
              />
              <span style={CHIP_TEXT}>
                TB submitted <b style={{ color: '#232C42', fontWeight: 700 }}>28 / 30</b>
              </span>
            </div>

            <div style={CHIP}>
              <span
                style={{
                  flex: 'none',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#EF4444',
                  boxShadow: '0 0 7px #EF4444',
                  animation: 'fcPulse 2s ease-in-out infinite',
                }}
              />
              <span style={CHIP_TEXT}>
                Blockers <b style={{ color: '#B91C1C', fontWeight: 700 }}>3</b>
              </span>
            </div>

            <HoverButton
              onClick={() => navTo('mytasks')}
              style={{ ...RESET, ...CHIP }}
              hoverStyle={{ background: '#E0E4EE' }}
            >
              <span
                style={{
                  flex: 'none',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#F59E0B',
                  boxShadow: '0 0 7px #F59E0B',
                  animation: 'fcPulse 2.2s ease-in-out infinite',
                }}
              />
              <span style={CHIP_TEXT}>
                Awaiting you <b style={{ color: '#B45309', fontWeight: 700 }}>2</b>
              </span>
            </HoverButton>

            <div style={CHIP}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7A84A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <span style={CHIP_TEXT}>
                Sign-off due <b style={{ color: '#232C42', fontWeight: 700 }}>Jul 28</b>
              </span>
            </div>
          </div>
          )}
        </div>

        {/* tenant card */}
        <div
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '14px 18px',
            borderRadius: '18px',
            border: '1px solid rgba(255,255,255,.75)',
            background: '#ECEFF6',
            boxShadow: '9px 9px 22px rgba(166,175,195,.5),-9px -9px 22px rgba(255,255,255,.95)',
          }}
        >
          <div
            style={{
              flex: 'none',
              width: '96px',
              height: '96px',
              borderRadius: '14px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,.6)',
              boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.45),inset -2px -2px 6px rgba(255,255,255,.9)',
            }}
          >
            <ImageSlot id="tenant-logo-clientco" placeholder="Client logo" fit="contain" />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#7A84A0' }}>
              {archived ? 'Archived Period' : 'Active Tenant'}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#232C42', marginTop: '4px' }}>
              {archived ? wsArchive.name : 'ClientCo Industries Group'}
            </div>
            <div style={{ fontSize: '11.5px', color: '#65708C', marginTop: '2px', fontStyle: 'italic' }}>
              {archived ? `30 entities · ${wsArchive.period} locked` : '30 entities · Q3 2026 open'}
            </div>
            <button
              className="fc-btn"
              onClick={() => navTo('workspace')}
              style={{ ...RESET, fontSize: '11.5px', color: '#3B5BDB', marginTop: '6px' }}
            >
              Switch tenant ›
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* ---- continue the close ---- */}
        <section style={SECTION}>
          <div style={SECTION_HEAD}>
            <span style={SECTION_LABEL}>{archived ? 'Closed stages' : 'Continue the close'}</span>
            <span style={SECTION_HINT}>
              {archived
                ? 'Every stage was signed off before the period was locked — open the reporting output to view it.'
                : 'Resume where you left off — status lights advance as each stage clears'}
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4,1fr)',
              gap: '14px',
              ...(archived ? { opacity: 0.55, pointerEvents: 'none', filter: 'saturate(.55)' } : null),
            }}
          >
            {STAGES.map((s) => (
              <StageCard key={s.num} s={s} onClick={() => navTo(s.route)} />
            ))}
          </div>
        </section>

        {/* ---- reporting & delivery ---- */}
        <section style={SECTION}>
          <div style={SECTION_HEAD}>
            <span style={SECTION_LABEL}>Reporting &amp; delivery</span>
            <span style={SECTION_HINT}>
              Financial statements, insights, the PMO and the AI disclosure checklist
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '14px', alignItems: 'start' }}>
            <div style={PANEL}>
              <div style={PANEL_HEAD}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, letterSpacing: '.3px', color: '#232C42' }}>
                  Reporting and Analytics
                </span>
                <span style={{ fontSize: '10px', fontStyle: 'italic', color: '#9AA3BA' }}>Q3 2026</span>
              </div>
              <div style={TILE_GRID}>
                {DELIVERY_TILES.map((t) => (
                  <TileCard key={t.key} t={t} badge={t.badge} onClick={() => navTo(t.route)} />
                ))}
              </div>
            </div>

            <div style={PANEL}>
              <div style={PANEL_HEAD}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, letterSpacing: '.3px', color: '#232C42' }}>
                  Module Integration
                </span>
                <span style={{ fontSize: '10px', fontStyle: 'italic', color: '#9AA3BA' }}>{modEnabledLabel}</span>
              </div>
              <div style={TILE_GRID}>
                {MODULE_TILES.map((t) => {
                  const on = modOn[t.key];
                  return (
                    <div key={t.key} style={{ position: 'relative', display: 'flex', minWidth: 0, borderRadius: '15px' }}>
                      <div
                        style={{
                          display: 'flex',
                          minWidth: 0,
                          flex: 1,
                          borderRadius: '15px',
                          transition: 'opacity .18s ease,filter .18s ease',
                          ...(on ? null : { opacity: 0.5, filter: 'grayscale(1)', pointerEvents: 'none' }),
                        }}
                      >
                        <TileCard t={t} badge={on ? 'Enabled' : 'Disabled'} onClick={() => navTo(t.route)} />
                      </div>

                      {/* module switch — sits above the dimming layer so a
                          disabled module can always be switched back on */}
                      <span
                        role="switch"
                        aria-checked={on}
                        aria-label={`${t.title} module`}
                        onClick={(e) => { e.stopPropagation(); toggleModule(t.key); }}
                        title={on ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                        style={{
                          position: 'absolute', top: '9px', right: '9px', zIndex: 2,
                          boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center',
                          width: '26px', height: '14px', padding: '2px', borderRadius: '999px', cursor: 'pointer',
                          transition: 'background .15s ease',
                          ...(on
                            ? { background: 'linear-gradient(145deg,#3B82F6,#2563EB)', boxShadow: 'inset 0 1px 2px rgba(29,78,216,.5)' }
                            : { background: '#D6DBE8', boxShadow: 'inset 1px 1px 2px rgba(166,175,195,.7)' }),
                        }}
                      >
                        <span
                          style={{
                            display: 'block', width: '10px', height: '10px', borderRadius: '50%', background: '#fff',
                            boxShadow: '0 1px 2px rgba(45,54,80,.35)', transition: 'transform .15s ease',
                            transform: on ? 'translateX(12px)' : 'translateX(0)',
                          }}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
