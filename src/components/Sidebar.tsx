import React from 'react';
import Icon from './Icon';
import { useApp } from '../state/AppContext';
import { routes, sectionOrder, parentSections, sectionIcons, navHide, RouteKey } from '../routes';

/**
 * Left rail — geometry from the design's `asideStyle` (line 10538) and nav
 * block (line 706): 208px expanded / 68px collapsed, 11.5px items, and the
 * nav column is `overflow:hidden` — it never scrolls.
 *
 * Module Integration is no longer listed here; modules are switched on from
 * their cards in the Command Center instead.
 */
export default function Sidebar() {
  const {
    route, navTo, navCollapsed, toggleNav,
    openSecs, toggleSection, dark, toggleDark,
  } = useApp();

  return (
    <aside
      className="shrink-0 h-screen sticky top-0 flex flex-col"
      style={{
        width: navCollapsed ? '68px' : '208px',
        flex: 'none',
        background: 'rgba(224,228,238,.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRight: '1px solid #D9DEE9',
        overflow: 'hidden',
        zIndex: 30,
        transition: 'width .22s ease',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 10px', borderBottom: '1px solid rgba(217,222,233,.8)' }}>
        <div
          style={{
            flex: 'none', width: '34px', height: '34px', borderRadius: '10px',
            background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff',
            display: 'grid', placeItems: 'center', boxShadow: '0 4px 12px rgba(37,99,235,.4)',
            fontSize: '12.5px', fontWeight: 700, letterSpacing: '.5px',
          }}
        >
          FC
        </div>
        {!navCollapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#232C42', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Fusion Close
            </div>
            <div style={{ fontSize: '9px', letterSpacing: '.6px', textTransform: 'uppercase', color: '#7A84A0' }}>
              by SUVI Corp
            </div>
          </div>
        )}
        <button
          onClick={toggleNav}
          className="fc-btn"
          aria-label="Toggle navigation"
          style={{
            flex: 'none', width: '24px', height: '24px', borderRadius: '7px', display: 'grid', placeItems: 'center',
            color: '#65708C', background: '#E4E8F0',
            boxShadow: 'inset 1px 1px 3px rgba(166,175,195,.5),inset -1px -1px 3px rgba(255,255,255,.9)',
          }}
        >
          <Icon path={navCollapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} size={13} />
        </button>
      </div>

      {/* Sections — fixed column, no scrollbar */}
      <nav
        style={{
          flex: 1, minHeight: 0, overflow: 'hidden', padding: '6px 9px',
          display: 'flex', flexDirection: 'column', gap: '7px',
        }}
      >
        {sectionOrder.map((sec, si) => {
          const items = (Object.keys(routes) as RouteKey[]).filter(
            (k) => routes[k].section === sec && !navHide.includes(k),
          );
          if (!items.length) return null;
          const isParent = parentSections.includes(sec);
          const open = isParent || (openSecs[sec] ?? true);
          const isBottom = sec === 'Bottom';

          return (
            <div
              key={sec}
              style={{
                display: 'flex', flexDirection: 'column', gap: '6px',
                ...(si > 0 ? { borderTop: '1px solid rgba(155,163,186,.28)', paddingTop: '7px' } : null),
                ...(isBottom ? { marginTop: 'auto' } : null),
              }}
            >
              {!isParent && !navCollapsed && (
                <button
                  onClick={() => toggleSection(sec)}
                  className="fc-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px', width: '100%',
                    padding: '2px 4px 2px 6px', color: '#7A84A0',
                  }}
                >
                  <Icon path={sectionIcons[sec] ?? ''} size={13} />
                  <span style={{ flex: 1, textAlign: 'left', fontSize: '9.5px', letterSpacing: '.6px', textTransform: 'uppercase', fontWeight: 700 }}>
                    {sec}
                  </span>
                  <span
                    style={{
                      minWidth: '16px', height: '16px', padding: '0 4px', borderRadius: '999px',
                      background: '#3B5BDB', color: '#fff', fontSize: '9px', fontWeight: 700,
                      display: 'grid', placeItems: 'center',
                    }}
                  >
                    {items.length}
                  </span>
                  <Icon path={open ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} size={11} />
                </button>
              )}

              {open && (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: 0, padding: 0, listStyle: 'none' }}>
                  {items.map((k) => {
                    const active = route === k;
                    const meta = routes[k];
                    return (
                      <li key={k}>
                        <button
                          onClick={() => navTo(k)}
                          className="fc-btn"
                          title={navCollapsed ? meta.label : undefined}
                          style={{
                            display: 'flex', alignItems: 'center', width: '100%', borderRadius: '8px',
                            fontSize: '11.5px',
                            ...(navCollapsed
                              ? { justifyContent: 'center', padding: '5px 0' }
                              : { gap: '8px', padding: isParent ? '3px 8px 3px 8px' : '3px 8px 3px 16px' }),
                            ...(active
                              ? { background: 'rgba(59,130,246,.14)', border: '1px solid rgba(59,130,246,.35)', color: '#232C42', fontWeight: 700 }
                              : { border: '1px solid transparent', color: isParent ? '#333D55' : '#65708C', fontWeight: isParent ? 700 : 400 }),
                          }}
                        >
                          <Icon path={meta.glyph} size={14} className="flex-none" />
                          {!navCollapsed && (
                            <span style={{ flex: 1, minWidth: 0, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {meta.label}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(217,222,233,.8)', padding: '7px 9px', display: 'flex', alignItems: 'center', gap: '7px' }}>
        <button
          onClick={toggleDark}
          className="fc-btn"
          aria-label="Toggle theme"
          title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          style={{
            flex: 'none', width: '28px', height: '28px', borderRadius: '8px', display: 'grid', placeItems: 'center',
            color: '#65708C', background: '#E4E8F0',
            boxShadow: '1px 1px 3px rgba(166,175,195,.5),-1px -1px 3px rgba(255,255,255,.9)',
          }}
        >
          <Icon
            path={dark
              ? 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 7a5 5 0 100 10 5 5 0 000-10z'
              : 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z'}
            size={13}
          />
        </button>
        <button
          onClick={() => navTo('settings')}
          className="fc-btn"
          style={{
            flex: 1, height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '7px',
            padding: '0 8px', fontSize: '11px', fontWeight: 700, color: '#65708C', background: '#E4E8F0',
            boxShadow: '1px 1px 3px rgba(166,175,195,.5),-1px -1px 3px rgba(255,255,255,.9)',
          }}
        >
          <Icon path={routes.settings.glyph} size={13} />
          {!navCollapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  );
}
