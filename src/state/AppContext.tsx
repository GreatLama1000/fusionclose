import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { RouteKey } from '../routes';
import { Comment, COMMENT_SEED } from '../components/CommentsPanel';

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

/** A closed period opened read-only from My Workspace (design: `wsArchive`). */
export type WsArchive = { name: string; period: string; lock: string } | null;

type Ctx = {
  route: RouteKey;
  navStack: RouteKey[];
  navTo: (r: RouteKey) => void;
  /** Jump to a crumb: sets the route and truncates the trail behind it. */
  navToStack: (r: RouteKey, stack: RouteKey[]) => void;
  back: () => void;
  navCollapsed: boolean;
  toggleNav: () => void;
  openSecs: Record<string, boolean>;
  toggleSection: (s: string) => void;
  modOn: Record<ModuleKey, boolean>;
  toggleModule: (m: ModuleKey) => void;
  dark: boolean;
  toggleDark: () => void;
  /** Pinned tenants and periods — keys are `tenantKey` or `tenantKey|periodLabel`. */
  wsFav: Record<string, boolean>;
  toggleWsFav: (id: string) => void;
  wsArchive: WsArchive;
  setWsArchive: (a: WsArchive) => void;
  loginUser: string;
  setLoginUser: (v: string) => void;
  loginPass: string;
  setLoginPass: (v: string) => void;
  users: User[];
  currentUser: User;
  setCurrentUserEmail: (email: string) => void;
  /**
   * One comment store for the whole application — the design keeps a single
   * `cmts` list (`cmtAll()` line 6946) that every surface writes into and the
   * rail reads back, so a right-click anywhere lands in the same place.
   */
  comments: Comment[];
  setComments: (next: Comment[]) => void;
  addComment: (c: Omit<Comment, 'id' | 'author' | 'time' | 'status' | 'replies'>) => void;
  railOpen: boolean;
  setRailOpen: (v: boolean) => void;
  /** the comment the rail should scroll to and flash */
  railFocus: string | null;
  setRailFocus: (id: string | null) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // route + history live in one state object so a navigation is a single,
  // StrictMode-safe update (the design keeps `route` and `navStack` together too).
  const [nav, setNav] = useState<{ route: RouteKey; stack: RouteKey[] }>({
    route: 'home',
    stack: [],
  });
  const { route, stack: navStack } = nav;
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [openSecs, setOpenSecs] = useState<Record<string, boolean>>({
    Top: true,
    Teams: true,
    'Module Integration': true,
    'Disclosure insights': true,
    Bottom: true,
  });
  const [modOn, setModOn] = useState<Record<ModuleKey, boolean>>({
    buscomb: true, gaap: true, proforma: true, carve: true,
  });
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('fc_theme') === 'dark'; } catch { return false; }
  });

  // the createElement patch reads this attribute (see src/theme/dark.ts)
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.fcTheme = dark ? 'dark' : 'light';
  }
  const [wsFav, setWsFav] = useState<Record<string, boolean>>({});
  const [wsArchive, setWsArchive] = useState<WsArchive>(null);
  const [loginUser, setLoginUser] = useState('amara@fusionclose.io');
  const [loginPass, setLoginPass] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState(seedUsers[0].email);

  const currentUser = useMemo(
    () => seedUsers.find((u) => u.email === currentUserEmail) ?? seedUsers[0],
    [currentUserEmail],
  );

  const [comments, setComments] = useState<Comment[]>(COMMENT_SEED);
  const [railOpen, setRailOpen] = useState(false);
  const [railFocus, setRailFocus] = useState<string | null>(null);

  const addComment = useCallback<Ctx['addComment']>((c) => {
    setComments((list) => [
      {
        ...c,
        id: `c${Date.now().toString(36)}`,
        author: currentUser.name,
        time: `Today ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        status: 'open',
        replies: [],
      },
      ...list,
    ]);
  }, [currentUser.name]);

  const value: Ctx = {
    route,
    navStack,
    navTo: useCallback((r: RouteKey) => {
      setNav((n) => (n.route === r ? n : { route: r, stack: [...n.stack, n.route] }));
      window.scrollTo(0, 0);
    }, []),
    navToStack: useCallback((r: RouteKey, stack: RouteKey[]) => {
      setNav({ route: r, stack });
      window.scrollTo(0, 0);
    }, []),
    back: useCallback(() => {
      setNav((n) => {
        const s = [...n.stack];
        const prev = s.pop();
        return { route: prev ?? 'home', stack: s };
      });
      window.scrollTo(0, 0);
    }, []),
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
    toggleDark: useCallback(() => setDark((v) => {
      const next = !v;
      try { localStorage.setItem('fc_theme', next ? 'dark' : 'light'); } catch { /* blocked storage */ }
      return next;
    }), []),
    wsFav,
    toggleWsFav: useCallback((id: string) => {
      setWsFav((f) => {
        const next = { ...f };
        if (next[id]) delete next[id];
        else next[id] = true;
        return next;
      });
    }, []),
    wsArchive,
    setWsArchive,
    loginUser, setLoginUser,
    loginPass, setLoginPass,
    users: seedUsers,
    currentUser,
    setCurrentUserEmail,
    comments, setComments,
    addComment,
    railOpen, setRailOpen,
    railFocus, setRailFocus,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
