import React, { useState } from 'react';
import ImageSlot from '../components/ImageSlot';
import { useApp } from '../state/AppContext';

/**
 * My Workspace — ported from docs/design/Fusion Close.dc.html,
 * block `<sc-if value="{{ is.workspace }}">` lines 3375–3441,
 * data `wsTenants()` line 6209, styles `buildWsCards()` line 6296
 * and `buildWsRadar()` line 6250.
 *
 * "On My Radar" is derived from pinned instances — it is not a fixed list,
 * and the whole section is hidden when nothing is pinned.
 */

type Period = { label: string; lock: string; note: string };
type Tenant = {
  key: string;
  name: string;
  logo: string;
  meta: string;
  active?: boolean;
  periods: Period[];
};

const TENANTS: Tenant[] = [
  {
    key: 'clientco',
    name: 'ClientCo Industries Group',
    logo: 'tenant-logo-clientco',
    meta: '30 entities · Q3 2026 open',
    active: true,
    periods: [
      { label: 'Q2 2026', lock: 'Locked 24 Apr 2026', note: 'Signed · IFRS · 30 entities' },
      { label: 'Q1 2026', lock: 'Locked 22 Jan 2026', note: 'Signed · IFRS · 29 entities' },
      { label: 'FY 2025', lock: 'Locked 18 Mar 2026', note: 'Audited · IFRS · 29 entities' },
      { label: 'Q3 2025', lock: 'Locked 19 Oct 2025', note: 'Signed · IFRS · 27 entities' },
    ],
  },
  {
    key: 'meridian',
    name: 'Meridian Capital Partners',
    logo: 'tenant-logo-meridian',
    meta: '12 entities · Q2 2026 locked',
    periods: [
      { label: 'Q1 2026', lock: 'Locked 23 Jan 2026', note: 'Signed · IFRS · 12 entities' },
      { label: 'FY 2025', lock: 'Locked 27 Feb 2026', note: 'Audited · IFRS · 11 entities' },
    ],
  },
  {
    key: 'halcyon',
    name: 'Halcyon Foods Holding',
    logo: 'tenant-logo-halcyon',
    meta: '8 entities · onboarding',
    periods: [],
  },
];

const SECTION: React.CSSProperties = {
  background: '#ECEFF6',
  border: '1px solid rgba(255,255,255,.75)',
  borderRadius: '18px',
  boxShadow: '9px 9px 22px rgba(166,175,195,.5),-9px -9px 22px rgba(255,255,255,.95)',
};

const STAR_PATH = 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7z';

/** wsStarStyle(), design line 6246. */
const starStyle = (on: boolean, size: number): React.CSSProperties => ({
  flex: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: `${size}px`,
  height: `${size}px`,
  borderRadius: '8px',
  ...(on
    ? { color: '#B45309', background: 'rgba(245,158,11,.16)', border: '1px solid rgba(245,158,11,.4)' }
    : { color: '#9AA3BA', background: 'rgba(255,255,255,.55)', border: '1px solid rgba(166,175,195,.4)' }),
});

function Star({ on, size = 13 }: { on: boolean; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={on ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
    >
      <path d={STAR_PATH} />
    </svg>
  );
}

export default function Workspace() {
  const { navTo, wsFav, toggleWsFav, setWsArchive } = useApp();
  const [openT, setOpenT] = useState<Record<string, boolean>>({});

  const favOn = (id: string) => wsFav[id] === true;

  const openActive = () => {
    setWsArchive(null);
    navTo('command');
  };
  const openPeriod = (t: Tenant, p: Period) => {
    setWsArchive({ name: t.name, period: p.label, lock: p.lock });
    navTo('command');
  };

  /* ---- radar: pinned tenants and pinned periods (buildWsRadar) ---- */
  const radar: { id: string; name: string; sub: string; kind: string; onOpen: () => void }[] = [];
  TENANTS.forEach((t) => {
    if (favOn(t.key)) {
      radar.push({
        id: t.key, name: t.name, sub: t.meta,
        kind: t.active ? 'Active engagement' : 'Tenant',
        onOpen: openActive,
      });
    }
    t.periods.forEach((p) => {
      const id = `${t.key}|${p.label}`;
      if (favOn(id)) {
        radar.push({
          id, name: `${t.name} · ${p.label}`, sub: `${p.lock} · ${p.note}`,
          kind: 'Closed period', onOpen: () => openPeriod(t, p),
        });
      }
    });
  });

  /* ---- cards: favourites first, then active first ---- */
  const cards = [...TENANTS].sort((a, b) => {
    const fa = favOn(a.key) ? 1 : 0;
    const fb = favOn(b.key) ? 1 : 0;
    if (fa !== fb) return fb - fa;
    return (b.active ? 1 : 0) - (a.active ? 1 : 0);
  });

  return (
    <div style={{ padding: '24px 28px 26px', animation: 'fcFade .25s ease' }}>
      <div style={{ marginBottom: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#232C42' }}>My Workspace</h1>
        <button
          className="fc-h fc-btn"
          type="button"
          onClick={() => navTo('intake')}
          style={{
            height: '36px',
            padding: '0 14px',
            borderRadius: '11px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            fontSize: '12.5px',
            fontWeight: 700,
            color: '#fff',
            background: 'linear-gradient(145deg,#3B82F6,#2563EB)',
            boxShadow: '0 8px 22px rgba(37,99,235,.45)',
          }}
          title="Start a new engagement"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Project
        </button>
      </div>

      {/* ---- On My Radar — only when something is pinned ---- */}
      {radar.length > 0 && (
        <section style={{ ...SECTION, padding: '18px 20px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '13px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#B45309">
              <path d={STAR_PATH} />
            </svg>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#65708C' }}>
              On My Radar
            </span>
            <span style={{ fontSize: '11px', color: '#9AA3BA' }}>
              {radar.length} {radar.length === 1 ? 'instance pinned' : 'instances pinned'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '11px' }}>
            {radar.map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '11px',
                  padding: '12px 13px', borderRadius: '12px',
                  background: 'linear-gradient(155deg,rgba(245,158,11,.10),rgba(255,255,255,.34))',
                  border: '1px solid rgba(245,158,11,.34)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#B45309' }}>
                    {r.kind}
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#232C42', marginTop: '3px' }}>{r.name}</div>
                  <div style={{ fontSize: '10.5px', color: '#7A84A0', marginTop: '2px' }}>{r.sub}</div>
                </div>
                <button
                  type="button" className="fc-h fc-btn" onClick={r.onOpen}
                  style={{ flex: 'none', fontSize: '11px', fontWeight: 700, color: '#3B5BDB' }}
                >
                  Open ›
                </button>
                <button
                  type="button" className="fc-h fc-btn" title="Remove from radar"
                  onClick={() => toggleWsFav(r.id)}
                  style={{
                    flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '24px', height: '24px', borderRadius: '7px',
                    color: '#B45309', background: 'rgba(245,158,11,.14)',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d={STAR_PATH} />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Client Tenants ---- */}
      <section style={{ ...SECTION, padding: '22px', marginBottom: '22px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#65708C', marginBottom: '14px' }}>
          Client Tenants
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
            gridAutoRows: '1fr',
            gap: '14px',
            alignItems: 'stretch',
          }}
        >
          {cards.map((t) => {
            const fav = favOn(t.key);
            const exp = openT[t.key] === true && t.periods.length > 0;
            const periods = [...t.periods].sort(
              (a, b) =>
                (favOn(`${t.key}|${b.label}`) ? 1 : 0) - (favOn(`${t.key}|${a.label}`) ? 1 : 0),
            );
            return (
              <div
                key={t.key}
                style={{
                  height: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '14px',
                  ...(t.active
                    ? {
                        background: 'linear-gradient(155deg,rgba(37,99,235,.10),rgba(255,255,255,.3))',
                        border: '1px solid #7C97E8',
                      }
                    : {
                        background: '#E4E8F0',
                        border: '1px solid rgba(255,255,255,.6)',
                        boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.35),inset -2px -2px 6px rgba(255,255,255,.9)',
                      }),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      flex: 'none',
                      width: '56px',
                      height: '56px',
                      borderRadius: '11px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,.6)',
                      background: t.active ? '#E4E8F0' : '#ECEFF6',
                    }}
                  >
                    <ImageSlot id={t.logo} placeholder="Logo" fit="contain" />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#232C42' }}>{t.name}</div>
                    <div style={{ fontSize: '11px', color: '#65708C', marginTop: '2px' }}>{t.meta}</div>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '.6px',
                        textTransform: 'uppercase',
                        color: t.active ? '#4055C8' : '#7A84A0',
                        marginTop: '5px',
                      }}
                    >
                      {t.active ? '● Active' : 'Switch ›'}
                    </div>
                    {t.active && (
                      <button
                        type="button"
                        className="fc-btn"
                        onClick={openActive}
                        style={{ fontSize: '11.5px', fontWeight: 700, color: '#3B5BDB', marginTop: '6px' }}
                      >
                        Open Command Center ›
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="fc-h fc-btn"
                    onClick={() => toggleWsFav(t.key)}
                    title={fav ? 'Pinned to radar — click to unpin' : 'Pin this instance to your radar'}
                    style={starStyle(fav, 26)}
                  >
                    <Star on={fav} />
                  </button>
                </div>

                {/* closed periods — pinned to the card foot */}
                <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(166,175,195,.4)', paddingTop: '10px' }}>
                  <button
                    type="button"
                    className="fc-btn"
                    onClick={() => {
                      if (!t.periods.length) return;
                      setOpenT((o) => ({ ...o, [t.key]: !(o[t.key] === true) }));
                    }}
                    title={t.periods.length ? 'Browse closed periods, read-only' : 'No periods have been closed for this tenant yet'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      height: '26px',
                      padding: '0 11px 0 9px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '.2px',
                      ...(t.periods.length
                        ? { cursor: 'pointer', color: '#3B5BDB', background: 'rgba(59,91,219,.09)', border: '1px solid rgba(59,91,219,.26)' }
                        : { cursor: 'default', color: '#9AA3BA', background: 'rgba(154,163,186,.1)', border: '1px solid rgba(154,163,186,.26)' }),
                    }}
                  >
                    <svg
                      width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"
                      style={{
                        flex: 'none',
                        opacity: t.periods.length ? 1 : 0.45,
                        transition: 'transform .18s',
                        transform: `rotate(${exp ? 90 : 0}deg)`,
                      }}
                    >
                      <path d="M7 5l7 7-7 7" />
                    </svg>
                    {`${exp ? 'Hide' : 'Closed Periods'} (${t.periods.length})`}
                  </button>

                  {exp && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '9px' }}>
                      {periods.map((p) => {
                        const pid = `${t.key}|${p.label}`;
                        const pf = favOn(pid);
                        return (
                          <div
                            key={p.label}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '8px 10px', borderRadius: '10px',
                              background: 'rgba(255,255,255,.62)',
                              border: '1px solid rgba(255,255,255,.8)',
                            }}
                          >
                            <svg
                              width="12" height="12" viewBox="0 0 24 24" fill="none"
                              stroke="#7A84A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                              style={{ flex: 'none' }}
                            >
                              <rect x="4" y="10" width="16" height="10" rx="2" />
                              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                            </svg>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#232C42' }}>{p.label}</div>
                              <div style={{ fontSize: '10px', color: '#7A84A0', marginTop: '1px' }}>
                                {p.lock} · {p.note}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="fc-h fc-btn"
                              onClick={() => toggleWsFav(pid)}
                              title={pf ? 'Pinned to radar — click to unpin' : 'Pin this period to your radar'}
                              style={starStyle(pf, 26)}
                            >
                              <Star on={pf} size={11} />
                            </button>
                            <button
                              type="button"
                              className="fc-h fc-btn"
                              onClick={() => openPeriod(t, p)}
                              title="Open this closed period read-only"
                              style={{ flex: 'none', fontSize: '10.5px', fontWeight: 700, color: '#3B5BDB' }}
                            >
                              Open ›
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
