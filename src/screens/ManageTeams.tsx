import React, { useMemo, useState } from 'react';

/**
 * Manage Teams — ported from docs/design/Fusion Close.dc.html,
 * block `<sc-if value="{{ is.access }}">` lines 3589–4015,
 * data/state lines 4040–4050, logic `buildGroups` 5011 and `buildTeams` 5145.
 *
 * Three tabs in the design's order: Members · Groups · Section access.
 */

/* ============================== data ============================== */

type Level = 'Super User' | 'Reviewer' | 'Client' | 'Editor/Preparer' | 'Viewer';
type Acl = 'edit' | 'view' | 'none';

type User = {
  name: string; email: string; role: Level; workspace: string;
  projects: string[]; status: 'Active' | 'Inactive'; lastActive: string;
  mfa: boolean; perms: Record<string, boolean>;
};

const USERS: User[] = [
  { name: 'Amara Mensah', email: 'amara.m@suvicorp.com', role: 'Super User', workspace: 'ClientCo Industries Group', projects: ['Q3-2026 group close', 'FY2025 audit support', 'India carve-out'], status: 'Active', lastActive: '2 minutes ago', mfa: true, perms: {} },
  { name: 'John D.', email: 'john.d@suvicorp.com', role: 'Editor/Preparer', workspace: 'ClientCo Industries Group', projects: ['Q3-2026 group close'], status: 'Active', lastActive: '1 hour ago', mfa: true, perms: {} },
  { name: 'Sarah K.', email: 'sarah.k@suvicorp.com', role: 'Reviewer', workspace: 'ClientCo Industries Group', projects: ['Q3-2026 group close', 'Disclosure refresh'], status: 'Active', lastActive: 'Yesterday, 18:40', mfa: true, perms: { publish_fs: true } },
  { name: 'Priya N.', email: 'priya.n@clientco.com', role: 'Client', workspace: 'Bharat Holdings Ltd', projects: ['India carve-out'], status: 'Active', lastActive: '3 days ago', mfa: false, perms: {} },
  { name: 'Lena T.', email: 'lena.t@clientco.com', role: 'Viewer', workspace: 'Bharat Holdings Ltd', projects: ['Q3-2026 group close'], status: 'Inactive', lastActive: '22 Jul 2026', mfa: false, perms: {} },
];

const LEVELS: Level[] = ['Super User', 'Reviewer', 'Client', 'Editor/Preparer', 'Viewer'];

type Group = { id: string; name: string; desc: string; role: Level; members: string[] };

const SEED_GROUPS: Group[] = [
  { id: 'g1', name: 'Controller Group', desc: 'Group controllers and reporting managers', role: 'Editor/Preparer', members: ['john.d@suvicorp.com', 'sarah.k@suvicorp.com'] },
  { id: 'g2', name: 'CFO Suite', desc: 'CFO and finance leadership', role: 'Reviewer', members: ['amara.m@suvicorp.com'] },
  { id: 'g3', name: 'Client Finance', desc: 'Client-side preparers at subsidiary level', role: 'Client', members: ['priya.n@clientco.com'] },
  { id: 'g4', name: 'External Audit', desc: 'Read-only audit access for the engagement window', role: 'Viewer', members: ['lena.t@clientco.com'] },
];

/** permission catalogue — design `tmGroups`, line 4941 */
const PERM_GROUPS = [
  { k: 'close', label: 'Close & consolidation', perms: [
    ['run_engines', 'Run translation and elimination engines'],
    ['post_je', 'Post top-side journal entries'],
    ['lock_period', 'Lock and unlock a reporting period'],
    ['approve_elim', 'Approve elimination results'],
  ] },
  { k: 'data', label: 'Data management', perms: [
    ['upload_data', 'Upload trial balances and journal files'],
    ['edit_master', 'Edit the legal entity master and FSLI mapping'],
    ['delete_rows', 'Delete submitted data'],
  ] },
  { k: 'team', label: 'Team management', perms: [
    ['invite_members', 'Invite other team members'],
    ['remove_members', 'Remove members from the engagement'],
    ['reassign_tasks', "Reassign other members' tasks"],
  ] },
  { k: 'report', label: 'Reporting & disclosure', perms: [
    ['edit_notes', 'Edit disclosure notes and policies'],
    ['publish_fs', 'Publish financial statements'],
    ['export_pack', 'Export to PowerPoint, PDF and Word'],
  ] },
] as const;

const ROLE_DEFAULTS: Record<Level, string[]> = {
  'Super User': ['run_engines', 'post_je', 'lock_period', 'approve_elim', 'upload_data', 'edit_master', 'delete_rows', 'invite_members', 'remove_members', 'reassign_tasks', 'edit_notes', 'publish_fs', 'export_pack'],
  Reviewer: ['approve_elim', 'lock_period', 'reassign_tasks', 'edit_notes', 'export_pack'],
  'Editor/Preparer': ['run_engines', 'post_je', 'upload_data', 'edit_master', 'edit_notes', 'export_pack'],
  Client: ['export_pack'],
  Viewer: [],
};

/** section-access items — the disclosure sections an ACL can restrict */
const SEC_ITEMS = {
  sosap: [
    { id: 'p4', title: 'Revenue recognition' },
    { id: 'p13', title: 'Income taxes' },
    { id: 'p18', title: 'Leases' },
  ],
  notes: [
    { id: 'x2', title: 'Note 2 — Revenue from contracts with customers' },
    { id: 'x5', title: 'Note 5 — Goodwill and intangible assets' },
    { id: 'x9', title: 'Note 9 — Income tax' },
  ],
} as const;

const SEED_ACL: Record<string, Record<string, Acl>> = {
  p4: { g3: 'none', g4: 'view' },
  p13: { g3: 'view', g4: 'none' },
  x2: { g4: 'none' },
  x5: { g3: 'none' },
};

const GROUP_COLORS = ['#3B5BDB', '#0F766E', '#B45309', '#7C3AED', '#BE185D'];

const roleDefaultAcl = (role: Level): Acl => (role === 'Viewer' || role === 'Client' ? 'view' : 'edit');

const ACL_TONE: Record<Acl, [string, string, string]> = {
  edit: ['Edit', '#15803D', 'rgba(34,197,94,.14)'],
  view: ['View', '#3B5BDB', 'rgba(59,91,219,.12)'],
  none: ['None', '#B42318', 'rgba(180,35,24,.1)'],
};

const LEVEL_TONE: Record<Level, [string, string]> = {
  'Super User': ['#3B5BDB', 'rgba(59,91,219,.12)'],
  Reviewer: ['#B45309', 'rgba(245,158,11,.15)'],
  'Editor/Preparer': ['#15803D', 'rgba(34,197,94,.14)'],
  Client: ['#0F766E', 'rgba(15,118,110,.12)'],
  Viewer: ['#65708C', 'rgba(148,163,184,.16)'],
};

/* ============================== styles ============================== */

const CARD: React.CSSProperties = {
  background: '#ECEFF6',
  border: '1px solid rgba(255,255,255,.75)',
  borderRadius: '18px',
  boxShadow: '9px 9px 22px rgba(166,175,195,.5),-9px -9px 22px rgba(255,255,255,.95)',
  padding: '22px',
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#65708C',
};

const INSET: React.CSSProperties = {
  background: '#E4E8F0', border: '1px solid #CBD2E0',
  boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.4)',
  borderRadius: '9px', color: '#333D55', font: 'inherit', outline: 'none',
};

const TH: React.CSSProperties = {
  padding: '9px 12px', textAlign: 'left', fontSize: '9.5px', letterSpacing: '.4px',
  textTransform: 'uppercase', fontWeight: 700, color: '#1B3A5C', background: '#E4E8F0',
  borderBottom: '1px solid #CBD2E0', borderTop: '2px solid #1B3A5C', whiteSpace: 'nowrap',
};

const KEY_STYLE: React.CSSProperties = {
  display: 'block', marginTop: '2px', fontFamily: 'ui-monospace,Menlo,monospace',
  fontSize: '8.5px', fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#8A93AB',
};

const TD: React.CSSProperties = {
  padding: '9px 12px', borderBottom: '1px solid #E7EAF2', fontSize: '11.5px', color: '#65708C', verticalAlign: 'top',
};

const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

/* ============================== screen ============================== */

export default function ManageTeams() {
  const [tab, setTab] = useState<'members' | 'groups' | 'sections'>('members');
  const [groups, setGroups] = useState<Group[]>(SEED_GROUPS);
  const [acl, setAcl] = useState(SEED_ACL);
  const [sel, setSel] = useState('g1');
  const [newGroup, setNewGroup] = useState('');
  const [query, setQuery] = useState('');
  const [perms, setPerms] = useState<Record<string, Record<string, boolean>>>(
    () => Object.fromEntries(USERS.map((u) => [u.email, { ...u.perms }])),
  );
  const [roles, setRoles] = useState<Record<string, Level>>(
    () => Object.fromEntries(USERS.map((u) => [u.email, u.role])),
  );
  const [secTab, setSecTab] = useState<'sosap' | 'notes'>('sosap');
  const [toast, setToast] = useState('');
  const [permFor, setPermFor] = useState<string | null>(null);

  const say = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2800); };

  const effAcl = (itemId: string, g: Group): Acl => acl[itemId]?.[g.id] ?? roleDefaultAcl(g.role);

  const cycleAcl = (itemId: string, g: Group) => {
    const order: Acl[] = ['edit', 'view', 'none'];
    const next = order[(order.indexOf(effAcl(itemId, g)) + 1) % 3];
    setAcl((a) => ({ ...a, [itemId]: { ...(a[itemId] ?? {}), [g.id]: next } }));
  };

  /** restrictions = anything tighter than the group's role default */
  const restrictionsOf = (g: Group) => {
    const out: { id: string; title: string; sec: string; eff: Acl }[] = [];
    (['sosap', 'notes'] as const).forEach((sec) =>
      SEC_ITEMS[sec].forEach((it) => {
        const eff = effAcl(it.id, g);
        const def = roleDefaultAcl(g.role);
        if (eff !== def && (eff === 'none' || (eff === 'view' && def === 'edit'))) out.push({ ...it, sec, eff });
      }),
    );
    return out;
  };
  const lockCount = groups.reduce((n, g) => n + restrictionsOf(g).length, 0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return USERS.filter((u) => !q || `${u.name} ${u.email} ${roles[u.email]}`.toLowerCase().includes(q));
  }, [query, roles]);

  const permCount = (email: string) =>
    Object.entries(perms[email] ?? {}).filter(([, v]) => v).length
    + ROLE_DEFAULTS[roles[email]].filter((k) => perms[email]?.[k] === undefined).length;

  const permOn = (email: string, key: string) =>
    perms[email]?.[key] ?? ROLE_DEFAULTS[roles[email]].includes(key);

  const TABS = [
    ['members', 'Members', USERS.length],
    ['groups', 'Groups', groups.length],
    ['sections', 'Section access', lockCount],
  ] as const;

  const selGroup = groups.find((g) => g.id === sel) ?? groups[0];

  return (
    <div style={{ padding: '24px 28px 26px', animation: 'fcFade .25s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ maxWidth: '760px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: '#7A84A0' }}>
            Administration
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: '24px', fontWeight: 700, color: '#232C42' }}>Manage Teams</h1>
          <div style={{ marginTop: '6px', fontSize: '12.5px', lineHeight: 1.6, color: '#65708C' }}>
            Access levels set what a member can do across the engagement. Groups grant a level to several people at once;
            section access can then tighten a group down to individual policies and notes.
          </div>
        </div>
      </div>

      {/* tabs */}
      <div
        style={{
          display: 'flex', gap: '6px', marginBottom: '16px', padding: '5px', borderRadius: '13px',
          background: '#E7EAF2', border: '1px solid rgba(255,255,255,.7)',
          boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.42),inset -2px -2px 6px rgba(255,255,255,.9)',
          width: 'fit-content',
        }}
      >
        {TABS.map(([k, label, count]) => {
          const on = tab === k;
          return (
            <button
              key={k} type="button" className="fc-h fc-btn" onClick={() => setTab(k)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px', height: '30px', padding: '0 14px',
                borderRadius: '9px', fontSize: '12px', fontWeight: 700,
                ...(on
                  ? { color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', boxShadow: '0 2px 6px rgba(37,99,235,.32)' }
                  : { color: '#65708C' }),
              }}
            >
              {label}
              <span
                style={{
                  minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px',
                  fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  ...(on ? { background: 'rgba(255,255,255,.22)', color: '#fff' } : { background: '#E4E8F0', color: '#7A84A0' }),
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {toast && (
        <div style={{ marginBottom: '12px', padding: '9px 14px', borderRadius: '10px', background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.28)', fontSize: '11.5px', color: '#2B3550' }}>
          {toast}
        </div>
      )}

      {/* ============ MEMBERS ============ */}
      {tab === 'members' && (
        <section style={CARD}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={SECTION_LABEL}>Team Members</div>
              <div style={{ marginTop: '3px', fontSize: '11.5px', color: '#7A84A0' }}>
                {rows.length} of {USERS.length} · {USERS.filter((u) => u.status === 'Active').length} active ·{' '}
                {USERS.filter((u) => !u.mfa).length} without MFA
              </div>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or role"
              style={{ ...INSET, flex: 'none', width: '230px', height: '32px', fontSize: '12px', padding: '0 11px' }}
            />
          </div>

          <div style={{ overflow: 'auto', borderRadius: '12px', border: '1px solid #D6DBE7', background: '#F6F7FB' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', font: 'inherit' }}>
              <thead>
                <tr>
                  {[['Member', 'user'], ['Access level', 'role'], ['Workspace', 'workspace'], ['Projects', 'projects'],
                    ['Permissions', 'permissions'], ['Status', 'status'], ['Last active', 'last_active']].map(([h, k]) => (
                    <th key={h} style={TH}>{h}<span style={KEY_STYLE}>{k}</span></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const role = roles[u.email];
                  const [rc, rbg] = LEVEL_TONE[role];
                  return (
                    <React.Fragment key={u.email}>
                      <tr style={u.status === 'Inactive' ? { opacity: 0.66 } : undefined}>
                        <td style={TD}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span
                              style={{
                                flex: 'none', width: '30px', height: '30px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10.5px', fontWeight: 700, color: '#fff',
                                background: 'linear-gradient(145deg,#5B8DEF,#2F5FD0)',
                              }}
                            >
                              {initials(u.name)}
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#232C42' }}>{u.name}</span>
                              <span style={{ display: 'block', fontSize: '10.5px', color: '#7A84A0' }}>{u.email}</span>
                            </span>
                          </span>
                        </td>
                        <td style={TD}>
                          <select
                            value={role}
                            onChange={(e) => { setRoles((r) => ({ ...r, [u.email]: e.target.value as Level })); say(`${u.name} is now ${e.target.value}.`); }}
                            style={{
                              height: '26px', borderRadius: '6px', border: `1px solid ${rc}44`, background: rbg,
                              color: rc, font: 'inherit', fontSize: '10.5px', fontWeight: 700, padding: '0 6px', cursor: 'pointer',
                            }}
                          >
                            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </td>
                        <td style={TD}>{u.workspace}</td>
                        <td style={{ ...TD, maxWidth: '210px' }}>
                          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {u.projects.map((p) => (
                              <span key={p} style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', color: '#0F766E', background: 'rgba(15,118,110,.11)' }}>
                                {p}
                              </span>
                            ))}
                          </span>
                        </td>
                        <td style={TD}>
                          <button
                            type="button" className="fc-btn"
                            onClick={() => setPermFor(permFor === u.email ? null : u.email)}
                            style={{ fontSize: '11px', fontWeight: 700, color: '#3B5BDB' }}
                          >
                            {permCount(u.email)} of 13 {permFor === u.email ? '▾' : '▸'}
                          </button>
                        </td>
                        <td style={TD}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: u.status === 'Active' ? '#15803D' : '#7A84A0' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: u.status === 'Active' ? '#16A34A' : '#9AA3BA' }} />
                            {u.status}
                          </span>
                          {!u.mfa && (
                            <span style={{ display: 'block', marginTop: '3px', fontSize: '9.5px', fontWeight: 700, color: '#B45309' }}>No MFA</span>
                          )}
                        </td>
                        <td style={{ ...TD, whiteSpace: 'nowrap' }}>{u.lastActive}</td>
                      </tr>

                      {permFor === u.email && (
                        <tr>
                          <td colSpan={7} style={{ padding: '0 12px 14px', background: 'rgba(228,232,240,.5)', borderBottom: '1px solid #E7EAF2' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '12px', paddingTop: '12px' }}>
                              {PERM_GROUPS.map((pg) => (
                                <div key={pg.k}>
                                  <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9AA3BA', marginBottom: '6px' }}>
                                    {pg.label}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {pg.perms.map(([key, label]) => {
                                      const on = permOn(u.email, key);
                                      const isDefault = ROLE_DEFAULTS[role].includes(key);
                                      return (
                                        <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '11px', color: '#414B62', cursor: 'pointer' }}>
                                          <input
                                            type="checkbox"
                                            checked={on}
                                            onChange={() => setPerms((p) => ({ ...p, [u.email]: { ...(p[u.email] ?? {}), [key]: !on } }))}
                                            style={{ marginTop: '2px', width: '13px', height: '13px', accentColor: '#3B5BDB', cursor: 'pointer' }}
                                          />
                                          <span style={{ flex: 1 }}>
                                            {label}
                                            {on !== isDefault && (
                                              <span style={{ marginLeft: '6px', fontSize: '9px', fontWeight: 700, color: '#B45309' }}>OVERRIDE</span>
                                            )}
                                          </span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ============ GROUPS ============ */}
      {tab === 'groups' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,330px) minmax(0,1fr)', gap: '16px', alignItems: 'start' }}>
          <section style={{ ...CARD, padding: '18px' }}>
            <div style={SECTION_LABEL}>Access groups</div>
            <div style={{ margin: '3px 0 13px', fontSize: '11.5px', color: '#7A84A0' }}>
              {groups.length} groups · {lockCount} restriction{lockCount === 1 ? '' : 's'}
            </div>
            {groups.map((g, i) => {
              const on = g.id === sel;
              const restr = restrictionsOf(g);
              const [rc, rbg] = LEVEL_TONE[g.role];
              return (
                <button
                  key={g.id} type="button" className="fc-h fc-btn" onClick={() => setSel(g.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', marginBottom: '8px',
                    padding: '11px 13px', borderRadius: '13px',
                    ...(on
                      ? { background: 'linear-gradient(155deg,rgba(59,130,246,.13),rgba(255,255,255,.5))', border: '1px solid #7C97E8' }
                      : { background: '#E4E8F0', border: '1px solid rgba(255,255,255,.6)', boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.3),inset -2px -2px 6px rgba(255,255,255,.85)' }),
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ flex: 'none', width: '9px', height: '9px', borderRadius: '50%', background: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: 700, color: '#232C42' }}>{g.name}</span>
                    <span style={{ flex: 'none', fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', color: rc, background: rbg }}>{g.role}</span>
                  </span>
                  <span style={{ display: 'block', marginTop: '5px', fontSize: '11px', color: '#7A84A0' }}>{g.desc}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '7px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#65708C' }}>
                      {g.members.length} member{g.members.length === 1 ? '' : 's'}
                    </span>
                    {restr.length > 0 && (
                      <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', color: '#B45309', background: 'rgba(245,158,11,.14)' }}>
                        {restr.length} restricted
                      </span>
                    )}
                  </span>
                </button>
              );
            })}

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #D9DEE9' }}>
              <input
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                placeholder="New group name"
                style={{ ...INSET, flex: 1, minWidth: 0, height: '34px', fontSize: '12px', padding: '0 11px' }}
              />
              <button
                type="button" className="fc-h fc-btn"
                onClick={() => {
                  const name = newGroup.trim();
                  if (!name) return;
                  const id = `g${groups.length + 1}${Date.now() % 1000}`;
                  setGroups((gs) => [...gs, { id, name, desc: 'New access group', role: 'Viewer', members: [] }]);
                  setSel(id);
                  setNewGroup('');
                  say(`“${name}” created at Viewer level.`);
                }}
                style={{ height: '34px', padding: '0 14px', borderRadius: '9px', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', fontSize: '12px', fontWeight: 700, color: '#fff' }}
              >
                Create
              </button>
            </div>
          </section>

          <section style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={SECTION_LABEL}>{selGroup.name}</div>
                <div style={{ marginTop: '3px', fontSize: '11.5px', color: '#7A84A0' }}>{selGroup.desc}</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', fontWeight: 700, color: '#65708C' }}>
                Access level
                <select
                  value={selGroup.role}
                  onChange={(e) => {
                    const role = e.target.value as Level;
                    setGroups((gs) => gs.map((g) => (g.id === selGroup.id ? { ...g, role } : g)));
                    say(`${selGroup.name} now grants ${role}.`);
                  }}
                  style={{ height: '30px', borderRadius: '8px', border: '1px solid #CBD2E0', background: '#fff', font: 'inherit', fontSize: '11.5px', fontWeight: 700, color: '#333D55', padding: '0 8px', cursor: 'pointer' }}
                >
                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
            </div>

            <div style={{ fontSize: '11.5px', color: '#65708C', lineHeight: 1.55, marginBottom: '14px' }}>
              Everyone in this group is granted the <b style={{ color: '#232C42' }}>{selGroup.role}</b> level.
              Changing it re-grants every member at once; individual overrides stay on the Members tab.
            </div>

            <div style={{ ...SECTION_LABEL, marginBottom: '8px' }}>Members</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {selGroup.members.map((email) => {
                const u = USERS.find((x) => x.email === email);
                if (!u) return null;
                return (
                  <div key={email} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 11px', borderRadius: '10px', background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.85)' }}>
                    <span style={{ flex: 'none', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9.5px', fontWeight: 700, color: '#fff', background: 'linear-gradient(145deg,#5B8DEF,#2F5FD0)' }}>
                      {initials(u.name)}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#232C42' }}>{u.name}</span>
                      <span style={{ display: 'block', fontSize: '10.5px', color: '#7A84A0' }}>{u.email}</span>
                    </span>
                    <button
                      type="button" className="fc-btn"
                      onClick={() => setGroups((gs) => gs.map((g) => (g.id === selGroup.id ? { ...g, members: g.members.filter((m) => m !== email) } : g)))}
                      title="Remove from group"
                      style={{ fontSize: '11px', fontWeight: 700, color: '#B42318' }}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
              {selGroup.members.length === 0 && (
                <div style={{ fontSize: '11.5px', color: '#9AA3BA', fontStyle: 'italic', padding: '8px 2px' }}>No members yet.</div>
              )}
            </div>

            <div style={{ ...SECTION_LABEL, marginBottom: '8px' }}>Add a member</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {USERS.filter((u) => !selGroup.members.includes(u.email)).map((u) => (
                <button
                  key={u.email} type="button" className="fc-h fc-btn"
                  onClick={() => setGroups((gs) => gs.map((g) => (g.id === selGroup.id ? { ...g, members: [...g.members, u.email] } : g)))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: '#3B5BDB', background: 'rgba(59,91,219,.09)', border: '1px solid rgba(59,91,219,.26)' }}
                >
                  + {u.name}
                </button>
              ))}
            </div>

            {restrictionsOf(selGroup).length > 0 && (
              <>
                <div style={{ ...SECTION_LABEL, margin: '16px 0 8px' }}>Section restrictions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {restrictionsOf(selGroup).map((r) => {
                    const [label, color, bg] = ACL_TONE[r.eff];
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '11.5px', color: '#65708C' }}>
                        <span style={{ flex: 1, minWidth: 0 }}>{r.title}</span>
                        <span style={{ flex: 'none', fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', color, background: bg }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* ============ SECTION ACCESS ============ */}
      {tab === 'sections' && (
        <section style={CARD}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={SECTION_LABEL}>Section access</div>
              <div style={{ marginTop: '3px', fontSize: '11.5px', color: '#7A84A0' }}>
                Click a cell to cycle Edit → View → None. Blank cells follow the group's access level.
              </div>
            </div>
            <div
              style={{
                display: 'flex', gap: '3px', padding: '3px', borderRadius: '9px', background: '#E4E8F0',
                boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.45),inset -2px -2px 5px rgba(255,255,255,.9)',
              }}
            >
              {([['sosap', 'Policies'], ['notes', 'Notes']] as const).map(([k, l]) => (
                <button
                  key={k} type="button" className="fc-btn" onClick={() => setSecTab(k)}
                  style={{
                    height: '26px', padding: '0 12px', borderRadius: '7px', fontSize: '11px', fontWeight: 700,
                    ...(secTab === k ? { background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff' } : { color: '#65708C' }),
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflow: 'auto', borderRadius: '12px', border: '1px solid #D6DBE7', background: '#F6F7FB' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', font: 'inherit' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, minWidth: '280px' }}>Section<span style={KEY_STYLE}>item</span></th>
                  {groups.map((g, i) => (
                    <th key={g.id} style={{ ...TH, textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                        {g.name}
                      </span>
                      <span style={KEY_STYLE}>{g.role}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SEC_ITEMS[secTab].map((it) => (
                  <tr key={it.id}>
                    <td style={{ ...TD, fontSize: '12px', color: '#333D55', fontWeight: 600 }}>{it.title}</td>
                    {groups.map((g) => {
                      const eff = effAcl(it.id, g);
                      const isOverride = acl[it.id]?.[g.id] !== undefined;
                      const [label, color, bg] = ACL_TONE[eff];
                      return (
                        <td key={g.id} style={{ ...TD, textAlign: 'center' }}>
                          <button
                            type="button" className="fc-h fc-btn"
                            onClick={() => cycleAcl(it.id, g)}
                            title={`${g.name} · ${it.title} — click to cycle`}
                            style={{
                              minWidth: '58px', height: '24px', borderRadius: '6px', fontSize: '10px',
                              fontWeight: 700, color, background: bg,
                              border: `1px solid ${isOverride ? `${color}66` : 'transparent'}`,
                              boxShadow: isOverride ? `0 0 0 1px ${color}22` : 'none',
                            }}
                          >
                            {label}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
