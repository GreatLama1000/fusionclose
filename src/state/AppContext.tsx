import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { RouteKey } from '../routes';

export type User = {
  email: string;
  name: string;
  initials: string;
  role: 'Super User' | 'Reviewer' | 'Client' | 'Editor/Preparer' | 'Viewer';
  color: string;
};

export const seedUsers: User[] = [
  { email: 'amara@fusionclose.io', name: 'Amara Mensah', initials: 'AM', role: 'Super User',      color: '#2563EB' },
  { email: 'john@fusionclose.io',  name: 'John D.',      initials: 'JD', role: 'Editor/Preparer', color: '#059669' },
  { email: 'sarah@fusionclose.io', name: 'Sarah K.',     initials: 'SK', role: 'Reviewer',        color: '#B45309' },
  { email: 'priya@fusionclose.io', name: 'Priya N.',     initials: 'PN', role: 'Client',          color: '#7C3AED' },
  { email: 'lena@fusionclose.io',  name: 'Lena T.',      initials: 'LT', role: 'Viewer',          color: '#DB2777' },
];

type ModuleKey = 'buscomb' | 'gaap' | 'proforma' | 'carve';

type Ctx = {
  route: RouteKey;
  navTo: (r: RouteKey) => void;
  navCollapsed: boolean;
  toggleNav: () => void;
  openSecs: Record<string, boolean>;
  toggleSection: (s: string) => void;
  modOn: Record<ModuleKey, boolean>;
  toggleModule: (m: ModuleKey) => void;
  dark: boolean;
  toggleDark: () => void;
  loginUser: string;
  setLoginUser: (v: string) => void;
  loginPass: string;
  setLoginPass: (v: string) => void;
  users: User[];
  currentUser: User;
  setCurrentUserEmail: (email: string) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<RouteKey>('home');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [openSecs, setOpenSecs] = useState<Record<string, boolean>>({
    Top: true,
    Teams: true,
    'Module Integration': true,
    'Disclosure insights': true,
    Bottom: true,
  });
  const [modOn, setModOn] = useState<Record<ModuleKey, boolean>>({
    buscomb: true, gaap: true, proforma: false, carve: false,
  });
  const [dark, setDark] = useState(false);
  const [loginUser, setLoginUser] = useState('amara@fusionclose.io');
  const [loginPass, setLoginPass] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState(seedUsers[0].email);

  const currentUser = useMemo(
    () => seedUsers.find((u) => u.email === currentUserEmail) ?? seedUsers[0],
    [currentUserEmail],
  );

  const value: Ctx = {
    route,
    navTo: useCallback((r: RouteKey) => setRoute(r), []),
    navCollapsed,
    toggleNav: useCallback(() => setNavCollapsed((v) => !v), []),
    openSecs,
    toggleSection: useCallback(
      (s: string) => setOpenSecs((o) => ({ ...o, [s]: !o[s] })),
      [],
    ),
    modOn,
    toggleModule: useCallback(
      (m: ModuleKey) => setModOn((o) => ({ ...o, [m]: !o[m] })),
      [],
    ),
    dark,
    toggleDark: useCallback(() => setDark((v) => !v), []),
    loginUser, setLoginUser,
    loginPass, setLoginPass,
    users: seedUsers,
    currentUser,
    setCurrentUserEmail,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
