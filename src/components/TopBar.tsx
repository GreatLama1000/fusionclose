import React, { useState } from 'react';
import Icon from './Icon';
import { useApp } from '../state/AppContext';
import { routes } from '../routes';

export default function TopBar() {
  const { route, navTo, users, currentUser, setCurrentUserEmail } = useApp();
  const [openMenu, setOpenMenu] = useState<'bell' | 'presence' | 'account' | null>(null);
  const meta = routes[route];

  const close = () => setOpenMenu(null);
  const toggle = (m: typeof openMenu) => setOpenMenu((c) => (c === m ? null : m));

  return (
    <header className="sticky top-0 z-20 h-14 bg-surface-card/80 backdrop-blur border-b border-surface-line/60 flex items-center gap-4 px-4">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm crumb-mask overflow-hidden">
        <button onClick={() => navTo('home')} className="text-ink-500 hover:text-ink-900 flex items-center gap-1">
          <Icon path={routes.home.glyph} size={14} />
          <span>Home</span>
        </button>
        <span className="text-ink-300">/</span>
        <span className="text-ink-500">{meta.section}</span>
        <span className="text-ink-300">/</span>
        <span className="text-ink-900 font-medium">{meta.label}</span>
      </div>

      <div className="flex-1" />

      {/* Bell */}
      <div className="relative">
        <button
          onClick={() => toggle('bell')}
          className="w-9 h-9 rounded-xl bg-surface-card shadow-neu-sm grid place-items-center text-ink-600"
          aria-label="Notifications"
        >
          <Icon path="M6 8a6 6 0 1112 0v5l1.5 3h-15L6 13zM10 20a2 2 0 004 0" size={16} />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger animate-fcPulse" />
        </button>
        {openMenu === 'bell' && (
          <Popover onClose={close}>
            <div className="text-xs font-semibold text-ink-500 mb-2">Notifications</div>
            <ul className="space-y-2 text-sm">
              <li className="p-2 rounded-lg bg-surface-soft">FX rates refreshed for USD, EUR.</li>
              <li className="p-2 rounded-lg bg-surface-soft">3 intercompany mismatches pending.</li>
              <li className="p-2 rounded-lg bg-surface-soft">Working Note WN-014 reviewed.</li>
            </ul>
          </Popover>
        )}
      </div>

      {/* Comments */}
      <button
        className="w-9 h-9 rounded-xl bg-surface-card shadow-neu-sm grid place-items-center text-ink-600"
        aria-label="Comments"
      >
        <Icon path="M4 4h16v12H8l-4 4z" size={16} />
      </button>

      {/* Presence */}
      <div className="relative">
        <button
          onClick={() => toggle('presence')}
          className="flex items-center -space-x-2 pl-1 pr-2 h-9 rounded-xl bg-surface-card shadow-neu-sm"
        >
          {users.slice(0, 4).map((u) => (
            <span
              key={u.email}
              className="w-7 h-7 rounded-full ring-2 ring-surface-card grid place-items-center text-[10px] font-semibold text-white"
              style={{ backgroundColor: u.color }}
              title={u.name}
            >
              {u.initials}
            </span>
          ))}
        </button>
        {openMenu === 'presence' && (
          <Popover onClose={close}>
            <div className="text-xs font-semibold text-ink-500 mb-2">Presence</div>
            <ul className="space-y-1 text-sm">
              {users.map((u) => (
                <li key={u.email} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-soft">
                  <span
                    className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-semibold text-white"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.initials}
                  </span>
                  <div className="flex-1">
                    <div className="text-ink-900">{u.name}</div>
                    <div className="text-[11px] text-ink-400">{u.role}</div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-good" />
                </li>
              ))}
            </ul>
          </Popover>
        )}
      </div>

      {/* Account */}
      <div className="relative">
        <button
          onClick={() => toggle('account')}
          className="flex items-center gap-2 pl-1 pr-3 h-9 rounded-xl bg-surface-card shadow-neu-sm"
        >
          <span
            className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-semibold text-white"
            style={{ backgroundColor: currentUser.color }}
          >
            {currentUser.initials}
          </span>
          <div className="text-left leading-tight">
            <div className="text-xs font-medium text-ink-900">{currentUser.name}</div>
            <div className="text-[10px] text-ink-400">{currentUser.role}</div>
          </div>
          <Icon path="M6 9l6 6 6-6" size={12} />
        </button>
        {openMenu === 'account' && (
          <Popover onClose={close}>
            <div className="text-xs font-semibold text-ink-500 mb-2">Switch user</div>
            <ul className="space-y-1 text-sm mb-3">
              {users.map((u) => (
                <li key={u.email}>
                  <button
                    onClick={() => { setCurrentUserEmail(u.email); close(); }}
                    className={`w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-soft ${
                      u.email === currentUser.email ? 'bg-surface-soft' : ''
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-semibold text-white"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.initials}
                    </span>
                    <span className="flex-1 text-left">
                      <span className="block text-ink-900">{u.name}</span>
                      <span className="block text-[11px] text-ink-400">{u.role}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => { navTo('intake'); close(); }}
              className="w-full h-9 rounded-lg bg-brand-500 text-white text-sm shadow-primary"
            >
              + New Project
            </button>
          </Popover>
        )}
      </div>
    </header>
  );
}

function Popover({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-11 z-40 w-72 p-3 rounded-xl bg-surface-card shadow-neu border border-surface-line/60 animate-fcFade">
        {children}
      </div>
    </>
  );
}
