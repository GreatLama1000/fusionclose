import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { useApp } from '../state/AppContext';
import { routes, RouteKey } from '../routes';
import CommentsPanel, { openForMe } from './CommentsPanel';

/**
 * Breadcrumb pill styles, verbatim from the design (pillStyle, line 10493).
 * The trail is navigation history — not route.section — so it reflects how
 * the user actually got here.
 */
const CRUMB_BASE: React.CSSProperties = {

  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  height: '24px',
  padding: '0 9px',
  borderRadius: '999px',
  fontSize: '11px',
  letterSpacing: '.1px',
  whiteSpace: 'nowrap',
  flex: 'none',
};

const CRUMB_LAST: React.CSSProperties = {
  cursor: 'default',
  background: 'linear-gradient(145deg,#3B82F6,#2563EB)',
  color: '#fff',
  fontWeight: 700,
  boxShadow: '0 2px 7px rgba(37,99,235,.32)',
};

const CRUMB_LINK: React.CSSProperties = {
  cursor: 'pointer',
  background: 'rgba(59,130,246,.09)',
  border: '1px solid rgba(59,130,246,.26)',
  color: '#3B5BDB',
  fontWeight: 600,
};

export default function TopBar() {
  const { route, navStack, navTo, navToStack, users, currentUser, setCurrentUserEmail, comments, setComments, railOpen, setRailOpen } = useApp();
  const [openMenu, setOpenMenu] = useState<'bell' | 'presence' | 'account' | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const crumbRef = useRef<HTMLElement>(null);

  const cmtMine = openForMe(comments);

  // chain = [...navStack, route], 'home' forced first, de-duped keeping the
  // LAST occurrence of each route (design logic, lines 10485–10490).
  const crumbs = useMemo(() => {
    let chain: RouteKey[] = [...navStack, route];
    if (chain[0] !== 'home') chain = ['home', ...chain];
    const seen: Partial<Record<RouteKey, boolean>> = {};
    const kept: (RouteKey | null)[] = [...chain];
    for (let i = kept.length - 1; i >= 0; i--) {
      const k = kept[i] as RouteKey;
      if (seen[k]) kept[i] = null;
      else seen[k] = true;
    }
    return kept.filter(Boolean) as RouteKey[];
  }, [navStack, route]);

  // keep the newest crumb in view as the trail grows past the rail
  useEffect(() => {
    const el = crumbRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [crumbs]);

  // ⌘K / Ctrl+K opens the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = () => setOpenMenu(null);
  const toggle = (m: typeof openMenu) => setOpenMenu((c) => (c === m ? null : m));

  return (
    <>
      <header
        className="sticky top-0 z-20 flex items-center"
        style={{
          height: '60px',
          flex: 'none',
          gap: '14px',
          padding: '0 26px',
          background: 'rgba(232,236,244,.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #D9DEE9',
        }}
      >
        {/* Breadcrumb trail — full history, scrolls horizontally, never collapses */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <nav
            ref={crumbRef}
            className="crumb-mask scrollbar-none"
            style={{
              display: 'flex',
              flex: '0 1 auto',
              minWidth: 0,
              alignItems: 'center',
              gap: '2px',
              padding: '3px 5px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,.4)',
              border: '1px solid rgba(203,210,224,.65)',
              boxShadow: 'inset 1px 1px 3px rgba(166,175,195,.3),inset -1px -1px 3px rgba(255,255,255,.8)',
              maxWidth: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
            }}
          >
            {crumbs.map((k, i) => {
              const last = i === crumbs.length - 1;
              return (
                <React.Fragment key={k}>
                  {i > 0 && (
                    <svg
                      width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="#A7AFC4" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                      style={{ flex: 'none', margin: '0 1px' }}
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  )}
                  <button
                    className="fc-h fc-btn"
                    title={routes[k].label}
                    onClick={last ? undefined : () => navToStack(k, crumbs.slice(0, i))}
                    style={{ ...CRUMB_BASE, ...(last ? CRUMB_LAST : CRUMB_LINK) }}
                  >
                    {k === 'home' && (
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ flex: 'none' }}
                      >
                        <path d="M4 11 12 4l8 7M6 9.8V20h4.5v-5h3v5H18V9.8" />
                      </svg>
                    )}
                    <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {routes[k].label}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Bell */}
        <div style={{ position: 'relative' }}>
          <IconButton onClick={() => toggle('bell')} label="Notifications">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#414B62" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            <span
              style={{
                position: 'absolute',
                top: '8px',
                right: '9px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#EF4444',
                boxShadow: '0 0 0 2px #E4E8F0',
              }}
            />
          </IconButton>
          {openMenu === 'bell' && <BellPanel onClose={close} onNavigate={navTo} />}
        </div>

        {/* Comments */}
        <IconButton
          label="Comments"
          title="Comments — right-click anything (text, table cell, figure) to add one"
          onClick={() => { setRailOpen(!railOpen); close(); }}
          active={railOpen}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#414B62" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.5 12.4c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.6-.34L4.5 21l1.2-3.5A6.9 6.9 0 0 1 3.5 12.4c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2z" />
            <path d="M8.6 11.6h6.8M8.6 14.6h4" />
          </svg>
          {cmtMine.length > 0 && (
            <span
              style={{
                position: 'absolute', top: '-5px', right: '-5px',
                minWidth: '17px', height: '17px', padding: '0 4px', borderRadius: '9px',
                background: '#D97706', color: '#fff', fontSize: '9.5px', fontWeight: 700,
                lineHeight: '17px', textAlign: 'center', boxShadow: '0 0 0 2px #E4E8F0',
              }}
            >
              {cmtMine.length}
            </span>
          )}
        </IconButton>

        {/* Presence */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => toggle('presence')}
            className="fc-h fc-btn"
            style={{

              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '36px',
              padding: '0 11px 0 8px',
              borderRadius: '999px',
              border: '1px solid #CBD2E0',
              background: 'rgba(255,255,255,.5)',
            }}
            title="Who is in this engagement right now"
          >
            <span className="flex items-center -space-x-1.5">
              {users.slice(0, 4).map((u) => (
                <span
                  key={u.email}
                  className="w-7 h-7 rounded-full ring-2 ring-surface-card grid place-items-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: u.color }}
                  title={u.name}
                >
                  {u.initials}
                </span>
              ))}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-700">
              <span className="w-1.5 h-1.5 rounded-full bg-good ring-2 ring-good/20" />
              {users.length}
            </span>
          </button>
          {openMenu === 'presence' && (
            <Popover onClose={close} width="w-[308px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex-1 text-[12.5px] font-bold text-ink-900">Active in this engagement</span>
                <span className="text-[10px] font-bold text-good bg-good/10 px-2 py-0.5 rounded">
                  {users.length} online
                </span>
              </div>
              <ul className="space-y-1">
                {users.map((u) => (
                  <li key={u.email} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-brand-500/8">
                    <span
                      className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.initials}
                    </span>
                    <div className="flex-1">
                      <div className="text-[12.5px] font-bold text-ink-900">{u.name}</div>
                      <div className="text-[10.5px] italic text-ink-400">{u.role} · Command Center</div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-good" />
                  </li>
                ))}
              </ul>
              <div className="mt-2 pt-2 border-t border-surface-line/60 text-[10.5px] italic text-ink-400">
                Select a colleague to open the page they are on.
              </div>
            </Popover>
          )}
        </div>

        {/* Account */}
        <div className="relative">
          <button
            onClick={() => toggle('account')}
            className="flex items-center gap-2 h-[38px] pl-1 pr-3.5 rounded-full bg-white/60 border border-surface-line shadow-neu-in-sm"
            title="Switch signed-in user"
          >
            <span
              className="w-8 h-8 rounded-full grid place-items-center text-[10.5px] font-bold text-white"
              style={{ backgroundColor: currentUser.color }}
            >
              {currentUser.initials}
            </span>
            <span className="flex flex-col leading-tight text-left">
              <span className="text-[12px] font-bold text-ink-900">{currentUser.name}</span>
              <span className="text-[10px] italic text-ink-400">{currentUser.role}</span>
            </span>
            <Icon path="M6 9l6 6 6-6" size={11} strokeWidth={2.4} className="text-ink-400" />
          </button>
          {openMenu === 'account' && (
            <Popover onClose={close} width="w-[274px]">
              <div className="pb-2 border-b border-surface-line/60 text-[10.5px] font-bold tracking-[1.2px] uppercase text-ink-400">
                Signed in as
              </div>
              <ul className="pt-2 space-y-0.5">
                {users.map((u) => (
                  <li key={u.email}>
                    <button
                      onClick={() => { setCurrentUserEmail(u.email); close(); }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-brand-500/8"
                    >
                      <span
                        className="w-7 h-7 rounded-full grid place-items-center text-[10.5px] font-bold text-white"
                        style={{ backgroundColor: u.color }}
                      >
                        {u.initials}
                      </span>
                      <span className="flex-1 text-left">
                        <span className="block text-[12.5px] font-bold text-ink-900">{u.name}</span>
                        <span className="block text-[10.5px] italic text-ink-400">{u.role}</span>
                      </span>
                      <span className="w-3 text-[11px] font-bold text-brand-accent">
                        {u.email === currentUser.email ? '✓' : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => { navTo('intake'); close(); }}
                className="mt-2 pt-2.5 w-full flex items-center gap-2 border-t border-surface-line/60 text-[11.5px] font-bold text-brand-accent"
              >
                <Icon path="M12 5v14M5 12h14" size={12} strokeWidth={2.6} />
                New Project
              </button>
            </Popover>
          )}
        </div>
      </header>

      {railOpen && (
        <CommentsPanel
          comments={comments}
          setComments={setComments}
          route={route}
          onClose={() => setRailOpen(false)}
          onNavigate={navTo}
        />
      )}

      {paletteOpen && (
        <CommandPalette onClose={() => setPaletteOpen(false)} onNavigate={navTo} />
      )}
    </>
  );
}

/** 36px square control in the top bar — design geometry (line 765). */
function IconButton({
  children,
  onClick,
  label,
  title,
  active = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  label: string;
  title?: string;
  /** design: an open panel tints the button blue (cmtBtnStyle, line 7128) */
  active?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      className="fc-h fc-btn"
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={title ?? label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: 'pointer',
        position: 'relative',
        width: '36px',
        height: '36px',
        borderRadius: '9px',
        border: `1px solid ${active ? '#3B82F6' : hover ? '#9AA3BA' : '#CBD2E0'}`,
        background: active ? 'rgba(59,130,246,.12)' : 'rgba(255,255,255,.5)',
        color: '#414B62',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

/* ---------- notifications panel (design markup 769–804, data 6058–6092) ---------- */

const avStyle = (a: string, b: string): React.CSSProperties => ({
  flex: 'none',
  width: '34px',
  height: '34px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '11px',
  fontWeight: 700,
  color: '#fff',
  background: `linear-gradient(145deg,${a},${b})`,
});

const icoStyle = (bg: string, col: string): React.CSSProperties => ({
  flex: 'none',
  width: '34px',
  height: '34px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: col,
  background: bg,
});

const badgeStyle = (col: string, bg: string): React.CSSProperties => ({
  flex: 'none',
  fontSize: '9.5px',
  fontWeight: 700,
  letterSpacing: '.2px',
  padding: '2px 7px',
  borderRadius: '6px',
  color: col,
  background: bg,
});

type BellItem = {
  key: string;
  order: number;
  isNotif: boolean;
  title: string;
  desc: string;
  time: string;
  avInit?: string;
  av?: React.CSSProperties;
  ico?: React.CSSProperties;
  icoPath?: string;
  badge?: string;
  badgeSt?: React.CSSProperties;
  actPrimary?: string;
  actSecondary?: string;
  navTo?: RouteKey;
};

const ACTIVITY: BellItem[] = [
  { key: 'a1', order: 10, isNotif: false, avInit: 'JD', av: avStyle('#2563EB', '#1E40AF'), title: 'John D.', desc: 'Completed Consolidation for US Holdings.', time: '10m ago' },
  { key: 'a2', order: 60, isNotif: false, avInit: 'SK', av: avStyle('#7C3AED', '#5B21B6'), title: 'Sarah K.', desc: 'Modified the IFRS FSLI Map.', time: '1h ago' },
  { key: 'a3', order: 180, isNotif: false, avInit: 'MR', av: avStyle('#0D9488', '#0F766E'), title: 'Marco R.', desc: 'Uploaded a Trial Balance for France SAS.', time: '3h ago' },
  { key: 'a4', order: 1450, isNotif: false, avInit: 'LT', av: avStyle('#B45309', '#92400E'), title: 'Lena T.', desc: 'Locked the period for Q2 2026.', time: 'Yesterday' },
];

const NOTIFS: BellItem[] = [
  {
    key: 'n1', order: 20, isNotif: true,
    ico: icoStyle('rgba(245,158,11,.16)', '#B45309'),
    icoPath: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
    title: 'Intercompany (ICE)', badge: '3 out of balance', badgeSt: badgeStyle('#B45309', 'rgba(245,158,11,.16)'),
    desc: 'Three entities need review before consolidation can proceed.', time: 'Today',
    actSecondary: 'Dismiss', actPrimary: 'Review', navTo: 'ice',
  },
  {
    key: 'n2', order: 1440, isNotif: true,
    ico: icoStyle('rgba(59,130,246,.14)', '#2563EB'),
    icoPath: 'M12 16V4M7 9l5-5 5 5M5 20h14',
    title: 'France SAS', badge: 'Trial Balance', badgeSt: badgeStyle('#2563EB', 'rgba(59,130,246,.14)'),
    desc: 'Marco R. uploaded a new trial balance awaiting your review.', time: 'Yesterday',
    actSecondary: 'Decline', actPrimary: 'Approve', navTo: 'consol',
  },
  {
    key: 'n3', order: 1460, isNotif: true,
    ico: icoStyle('rgba(180,35,24,.12)', '#B42318'),
    icoPath: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16h.01',
    title: 'Validation Engine',
    desc: 'Two mapping exceptions flagged. Resolve before locking the period.', time: 'Yesterday',
  },
  {
    key: 'n4', order: 1470, isNotif: true,
    ico: icoStyle('rgba(148,163,184,.18)', '#65708C'),
    icoPath: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    title: 'Period Lock', badge: 'Q2 2026', badgeSt: badgeStyle('#65708C', 'rgba(148,163,184,.18)'),
    desc: 'Lena T. requested period lock approval.', time: 'Yesterday',
  },
];

const BELL_TABS = [
  ['all', 'All'],
  ['activity', 'Activity'],
  ['notif', 'Notifications'],
] as const;

function BellPanel({ onClose, onNavigate }: { onClose: () => void; onNavigate: (r: RouteKey) => void }) {
  const [tab, setTab] = useState<'all' | 'activity' | 'notif'>('all');
  const [dismissed, setDismissed] = useState<string[]>([]);

  const live = NOTIFS.filter((n) => !dismissed.includes(n.key));
  const items =
    tab === 'activity'
      ? ACTIVITY
      : tab === 'notif'
        ? live
        : [...ACTIVITY, ...live].sort((a, b) => a.order - b.order);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 25 }} onClick={onClose} />
      <div
        style={{
          position: 'absolute',
          top: '46px',
          right: 0,
          zIndex: 30,
          width: '374px',
          maxHeight: 'min(560px,80vh)',
          display: 'flex',
          flexDirection: 'column',
          background: '#ECEFF6',
          border: '1px solid rgba(255,255,255,.8)',
          borderRadius: '16px',
          boxShadow:
            '0 20px 46px -12px rgba(50,60,90,.4),6px 6px 18px rgba(166,175,195,.5),-6px -6px 18px rgba(255,255,255,.9)',
          overflow: 'hidden',
          animation: 'fcFade .18s ease',
        }}
      >
        <div style={{ flex: 'none', padding: '16px 18px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#232C42' }}>Notifications</span>
            <span
              style={{
                flex: 'none',
                fontSize: '10.5px',
                fontWeight: 700,
                color: '#3B5BDB',
                background: 'rgba(59,91,219,.12)',
                borderRadius: '999px',
                minWidth: '20px',
                height: '20px',
                padding: '0 6px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {ACTIVITY.length + live.length}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '5px',
              padding: '4px',
              borderRadius: '11px',
              background: '#E4E8F0',
              boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.4),inset -2px -2px 5px rgba(255,255,255,.9)',
              margin: '13px 0 2px',
            }}
          >
            {BELL_TABS.map(([k, label]) => {
              const on = tab === k;
              return (
                <button
                  key={k}
                  className="fc-h fc-btn"
                  onClick={() => setTab(k)}
                  style={{

                    cursor: 'pointer',
                    flex: 1,
                    textAlign: 'center',
                    height: '28px',
                    lineHeight: '28px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    ...(on
                      ? {
                          background: '#F3F5FA',
                          color: '#3B5BDB',
                          boxShadow: '1px 1px 3px rgba(166,175,195,.5),-1px -1px 3px rgba(255,255,255,.9)',
                        }
                      : { color: '#7A84A0' }),
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '2px 18px 8px' }}>
          {items.map((it) => (
            <div key={it.key} style={{ display: 'flex', gap: '11px', padding: '13px 2px', borderBottom: '1px solid #DCE0EB' }}>
              {it.isNotif ? (
                <span style={it.ico}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={it.icoPath} />
                  </svg>
                </span>
              ) : (
                <span style={it.av}>{it.avInit}</span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#232C42' }}>{it.title}</span>
                    {it.badge && <span style={it.badgeSt}>{it.badge}</span>}
                  </span>
                  <span style={{ flex: 'none', fontSize: '11px', color: '#7A84A0' }}>{it.time}</span>
                </div>
                <div style={{ fontSize: '12.5px', lineHeight: 1.45, color: '#65708C', marginTop: '2px' }}>{it.desc}</div>
                {it.actPrimary && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '9px' }}>
                    <button
                      className="fc-h fc-btn"
                      onClick={() => setDismissed((d) => [...d, it.key])}
                      style={{
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                        height: '30px', padding: '0 13px', borderRadius: '8px', border: '1px solid #CBD2E0',
                        background: 'rgba(255,255,255,.6)', fontSize: '12px', fontWeight: 700, color: '#414B62',
                      }}
                    >
                      {it.actSecondary}
                    </button>
                    <button
                      className="fc-h fc-btn"
                      onClick={() => { onClose(); if (it.navTo) onNavigate(it.navTo); }}
                      style={{
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                        height: '30px', padding: '0 15px', borderRadius: '8px',
                        background: 'linear-gradient(145deg,#3B82F6,#2563EB)',
                        fontSize: '12px', fontWeight: 700, color: '#fff',
                        boxShadow: '0 2px 8px rgba(37,99,235,.35)',
                      }}
                    >
                      {it.actPrimary}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div style={{ padding: '34px 10px', textAlign: 'center', fontSize: '12px', color: '#9AA3BA', fontStyle: 'italic' }}>
              You're all caught up.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Popover({ children, onClose, width }: { children: React.ReactNode; onClose: () => void; width: string }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className={`absolute right-0 top-[46px] z-40 ${width} p-3 rounded-2xl bg-surface-card shadow-neu border border-surface-line/60 animate-fcFade`}>
        {children}
      </div>
    </>
  );
}

function CommandPalette({ onClose, onNavigate }: { onClose: () => void; onNavigate: (r: RouteKey) => void }) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const all = (Object.keys(routes) as RouteKey[]).map((k) => ({
      key: k, label: routes[k].label, section: routes[k].section, glyph: routes[k].glyph,
    }));
    if (!query) return all.slice(0, 12);
    return all
      .filter((r) => (r.label + ' ' + r.section).toLowerCase().includes(query))
      .slice(0, 20);
  }, [q]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4 animate-fcFade"
      style={{ background: 'rgba(90,100,125,.35)', backdropFilter: 'blur(3px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] rounded-2xl bg-surface-card2 border border-surface-line overflow-hidden"
        style={{ boxShadow: '0 30px 80px -20px rgba(140,150,175,.5)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-line">
          <Icon path="M11 4a7 7 0 105 12l4 4" size={17} className="text-ink-400" strokeWidth={2} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search entity, report, or setting…"
            className="flex-1 bg-transparent outline-none text-[15px] text-ink-900"
          />
          <kbd className="font-mono text-[10.5px] text-ink-400 border border-surface-line rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="p-7 text-center text-[13px] text-ink-400">No matches for "{q}"</div>
          ) : (
            results.map((r) => (
              <button
                key={r.key}
                onClick={() => { onNavigate(r.key); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-soft text-left"
              >
                <span className="w-8 h-8 rounded-lg bg-surface-bg border border-white/60 shadow-neu-in-sm grid place-items-center text-brand-accent">
                  <Icon path={r.glyph} size={14} strokeWidth={1.8} />
                </span>
                <span className="flex-1">
                  <span className="block text-[13px] font-bold text-ink-800">{r.label}</span>
                  <span className="block text-[11px] text-ink-400">{r.section}</span>
                </span>
                <span className="text-ink-300">›</span>
              </button>
            ))
          )}
        </div>
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-surface-line text-[11px] text-ink-400">
          <span>↵ open</span>
          <span>esc close</span>
          <span className="ml-auto">{results.length} results</span>
        </div>
      </div>
    </div>
  );
}
