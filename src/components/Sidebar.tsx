import Icon from './Icon';
import { useApp } from '../state/AppContext';
import {
  routes, sectionOrder, parentSections, sectionIcons, navHide, RouteKey,
} from '../routes';

const MODULE_KEYS: Record<string, 'buscomb' | 'gaap' | 'proforma' | 'carve'> = {
  buscomb: 'buscomb', gaap: 'gaap', proforma: 'proforma', carve: 'carve',
};

export default function Sidebar() {
  const {
    route, navTo, navCollapsed, toggleNav,
    openSecs, toggleSection, modOn, toggleModule,
    dark, toggleDark,
  } = useApp();

  const width = navCollapsed ? 'w-[68px]' : 'w-[220px]';

  return (
    <aside
      className={`${width} shrink-0 h-screen sticky top-0 flex flex-col bg-surface-card/80 backdrop-blur border-r border-surface-line/60 shadow-neu-sm transition-all duration-200`}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 px-3 py-4 border-b border-surface-line/60">
        <div className="w-9 h-9 rounded-xl bg-brand-500 text-white grid place-items-center shadow-primary font-bold">
          F
        </div>
        {!navCollapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink-900 truncate">Fusion Close</div>
            <div className="text-[10px] uppercase tracking-wide text-ink-400">by SUVI Corp</div>
          </div>
        )}
        <button
          onClick={toggleNav}
          className="w-7 h-7 rounded-lg bg-surface-card shadow-neu-in-sm hover:shadow-neu-sm grid place-items-center text-ink-500"
          aria-label="Toggle navigation"
        >
          <Icon path={navCollapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} size={14} />
        </button>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto scrollbar-none py-2">
        {sectionOrder.map((sec) => {
          const items = (Object.keys(routes) as RouteKey[]).filter(
            (k) => routes[k].section === sec && !navHide.includes(k),
          );
          if (!items.length) return null;
          const isParent = parentSections.includes(sec);
          const open = isParent || (openSecs[sec] ?? true);
          const isBottom = sec === 'Bottom';
          const isMod = sec === 'Module Integration';

          return (
            <div key={sec} className={`px-2 mb-2 ${isBottom ? 'mt-auto' : ''}`}>
              {!isParent && (
                <button
                  onClick={() => toggleSection(sec)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-ink-500 hover:text-ink-800"
                >
                  <Icon path={sectionIcons[sec] ?? ''} size={14} />
                  {!navCollapsed && (
                    <>
                      <span className="text-[11px] uppercase tracking-wider flex-1 text-left font-semibold">{sec}</span>
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand-accent text-white text-[10px] font-bold grid place-items-center">
                        {isMod ? items.filter((k) => modOn[MODULE_KEYS[k]]).length : items.length}
                      </span>
                      <Icon path={open ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} size={12} />
                    </>
                  )}
                </button>
              )}

              {open && (
                <ul className={`mt-1 space-y-0.5 ${!isParent ? 'p-1.5 rounded-xl bg-surface-card2 shadow-neu-in-sm' : ''}`}>
                  {items.map((k) => {
                    const active = route === k;
                    const meta = routes[k];
                    const modKey = isMod ? MODULE_KEYS[k] : null;
                    const enabled = modKey ? modOn[modKey] : true;
                    return (
                      <li key={k}>
                        <button
                          onClick={() => enabled && navTo(k)}
                          disabled={!enabled}
                          className={[
                            'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition',
                            active
                              ? 'bg-brand-500/15 border border-brand-500/35 text-ink-900 font-semibold'
                              : isParent
                                ? 'text-ink-800 hover:bg-surface-soft font-semibold'
                                : 'text-ink-600 hover:bg-surface-soft',
                            !enabled && 'opacity-50 cursor-not-allowed',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          title={navCollapsed ? meta.label : undefined}
                        >
                          <Icon path={meta.glyph} size={15} />
                          {!navCollapsed && (
                            <>
                              <span className="flex-1 truncate">{meta.label}</span>
                              {modKey && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleModule(modKey);
                                  }}
                                  className={`w-[22px] h-3 rounded-full relative cursor-pointer transition-colors ${
                                    modOn[modKey] ? 'bg-brand-500' : 'bg-surface-line'
                                  }`}
                                  title={modOn[modKey] ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                                >
                                  <span
                                    className={`absolute top-0.5 w-2 h-2 rounded-full bg-white shadow transition-all ${
                                      modOn[modKey] ? 'left-[11px]' : 'left-0.5'
                                    }`}
                                  />
                                </span>
                              )}
                            </>
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
      <div className="border-t border-surface-line/60 p-2 flex items-center gap-2">
        <button
          onClick={toggleDark}
          className="w-8 h-8 rounded-lg bg-surface-card shadow-neu-sm grid place-items-center text-ink-600"
          aria-label="Toggle theme"
        >
          <Icon path={dark ? 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 7a5 5 0 100 10 5 5 0 000-10z' : 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z'} size={14} />
        </button>
        <button
          onClick={() => navTo('settings')}
          className="flex-1 h-8 rounded-lg bg-surface-card shadow-neu-sm text-xs text-ink-700 hover:text-ink-900 flex items-center gap-2 px-2"
        >
          <Icon path={routes.settings.glyph} size={14} />
          {!navCollapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  );
}
