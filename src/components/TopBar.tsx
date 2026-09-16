import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { useApp } from '../state/AppContext';
import { routes, RouteKey } from '../routes';

export default function TopBar() {
  const { route, navTo, users, currentUser, setCurrentUserEmail } = useApp();
  const [openMenu, setOpenMenu] = useState<'bell' | 'presence' | 'account' | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const meta = routes[route];

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
      <header className="sticky top-0 z-20 h-[60px] bg-surface-card/85 backdrop-blur border-b border-surface-line flex items-center gap-3 px-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/40 border border-surface-line/70 shadow-neu-in-sm crumb-mask overflow-hidden text-sm">
          <button
            onClick={() => navTo('home')}
            className="flex items-center gap-1 px-2.5 h-7 rounded-full text-ink-500 hover:text-ink-900 hover:bg-white/60"
            title="Home"
          >
            <Icon path={routes.home.glyph} size={12} strokeWidth={2} />
            <span>Home</span>
          </button>
          <Icon path="M9 6l6 6-6 6" size={11} strokeWidth={2.6} className="text-ink-300 flex-none" />
          <span className="px-2.5 h-7 grid place-items-center text-ink-400">{meta.section}</span>
          <Icon path="M9 6l6 6-6 6" size={11} strokeWidth={2.6} className="text-ink-300 flex-none" />
          <span className="px-2.5 h-7 grid place-items-center rounded-full bg-white/70 text-ink-900 font-semibold">
            {meta.label}
          </span>
        </nav>

        {/* Search trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex-1 max-w-[380px] h-9 pl-3 pr-2 rounded-xl bg-white/50 border border-surface-line shadow-neu-in-sm flex items-center gap-2 text-left hover:border-ink-200 transition"
          title="Open command palette (⌘K)"
        >
          <Icon path="M11 4a7 7 0 105 12l4 4" size={14} className="text-ink-400" strokeWidth={2} />
          <span className="flex-1 text-[12.5px] text-ink-400 italic truncate">
            Search entity, report, or setting…
          </span>
          <kbd className="flex-none font-mono text-[10px] text-ink-500 border border-surface-line rounded px-1.5 py-0.5 bg-white/70">
            ⌘K
          </kbd>
        </button>

        <div className="flex-1" />

        {/* + New Project */}
        <button
          onClick={() => navTo('intake')}
          className="h-9 px-3.5 rounded-xl text-[12.5px] font-bold text-white flex items-center gap-1.5 shadow-primary"
          style={{ background: 'linear-gradient(145deg,#3B82F6,#2563EB)' }}
          title="Start a new engagement"
        >
          <Icon path="M12 5v14M5 12h14" size={13} strokeWidth={2.6} />
          New Project
        </button>

        {/* Bell */}
        <div className="relative">
          <button
            onClick={() => toggle('bell')}
            className="relative w-9 h-9 rounded-xl bg-white/50 border border-surface-line hover:border-ink-200 grid place-items-center text-ink-700"
            aria-label="Notifications"
          >
            <Icon path="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" size={16} strokeWidth={1.8} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-danger ring-2 ring-surface-card2" />
          </button>
          {openMenu === 'bell' && (
            <Popover onClose={close} width="w-[374px]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[14.5px] font-bold text-ink-900">Notifications</span>
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-brand-accent/12 text-brand-accent text-[10.5px] font-bold grid place-items-center">
                  4
                </span>
              </div>
              <ul className="divide-y divide-surface-line/60">
                {[
                  { t: 'FX rates refreshed',            d: 'USD, EUR, INR rates picked up from ECB/RBI feeds.', when: '2m' },
                  { t: 'IC mismatch — INR 2,000',       d: 'Pair IC-004 above tolerance; review recommended.',   when: '18m' },
                  { t: 'Working Note WN-014 reviewed',  d: 'Sarah K. approved. Ready for publish.',              when: '1h' },
                  { t: 'FSLI mapping updated',          d: '14 accounts pending mapping for FC-020 (Germany).',  when: '2h' },
                ].map((n) => (
                  <li key={n.t} className="py-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="flex-1 text-[13px] font-bold text-ink-900">{n.t}</span>
                      <span className="text-[11px] text-ink-400">{n.when}</span>
                    </div>
                    <div className="text-[12.5px] text-ink-500 mt-0.5">{n.d}</div>
                  </li>
                ))}
              </ul>
            </Popover>
          )}
        </div>

        {/* Comments */}
        <button
          className="w-9 h-9 rounded-xl bg-white/50 border border-surface-line hover:border-ink-200 grid place-items-center text-ink-700"
          aria-label="Comments"
          title="Comments — right-click anything to add one"
        >
          <Icon path="M20.5 12.4c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.6-.34L4.5 21l1.2-3.5A6.9 6.9 0 0 1 3.5 12.4c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2z" size={16} strokeWidth={1.8} />
        </button>

        {/* Presence */}
        <div className="relative">
          <button
            onClick={() => toggle('presence')}
            className="flex items-center gap-2 h-9 pl-1 pr-3 rounded-full bg-white/50 border border-surface-line hover:border-ink-200"
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

      {paletteOpen && (
        <CommandPalette onClose={() => setPaletteOpen(false)} onNavigate={navTo} />
      )}
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
