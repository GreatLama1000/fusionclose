import { useState } from 'react';
import Icon from '../components/Icon';

type Role = 'Super User' | 'Reviewer' | 'Client' | 'Editor/Preparer' | 'Viewer';

type Member = { name: string; email: string; initials: string; color: string };
type Group = {
  id: string;
  name: string;
  desc: string;
  role: Role;
  color: string;
  members: Member[];
  restrictions: { sec: string; title: string; level: string }[];
};

const ROLES: Role[] = ['Super User', 'Reviewer', 'Editor/Preparer', 'Client', 'Viewer'];

const roleTone: Record<Role, string> = {
  'Super User':      'bg-brand-500/12 text-brand-500 border-brand-500/30',
  'Reviewer':        'bg-warn/12 text-warn border-warn/30',
  'Editor/Preparer': 'bg-good/12 text-good border-good/30',
  'Client':          'bg-ink-500/10 text-ink-600 border-ink-200',
  'Viewer':          'bg-ink-300/15 text-ink-500 border-ink-200',
};

const SEED_GROUPS: Group[] = [
  {
    id: 'controller',
    name: 'Controller Group',
    desc: 'Sets policy, reviews and approves consolidated output for the group.',
    role: 'Reviewer',
    color: '#B45309',
    members: [
      { name: 'Amara Mensah', email: 'amara.m@suvicorp.com', initials: 'AM', color: '#2563EB' },
      { name: 'Sarah K.',     email: 'sarah.k@suvicorp.com', initials: 'SK', color: '#B45309' },
    ],
    restrictions: [
      { sec: 'IFRS 15', title: 'Revenue disclosures', level: 'Read & edit' },
    ],
  },
  {
    id: 'cfo',
    name: 'CFO Suite',
    desc: 'Executive access to final numbers, disclosures and audit trail.',
    role: 'Super User',
    color: '#2563EB',
    members: [
      { name: 'Priya N.', email: 'priya.n@suvicorp.com', initials: 'PN', color: '#7C3AED' },
    ],
    restrictions: [],
  },
  {
    id: 'preparer',
    name: 'Preparer Team',
    desc: 'Uploads TBs, prepares adjustments, drafts notes and disclosures.',
    role: 'Editor/Preparer',
    color: '#059669',
    members: [
      { name: 'John D.', email: 'john.d@suvicorp.com', initials: 'JD', color: '#059669' },
    ],
    restrictions: [],
  },
  {
    id: 'client',
    name: 'Client Read-Only',
    desc: 'External client stakeholders reviewing statement faces.',
    role: 'Viewer',
    color: '#9AA3BA',
    members: [
      { name: 'Lena T.', email: 'lena.t@clientco.com', initials: 'LT', color: '#DB2777' },
    ],
    restrictions: [
      { sec: 'IFRS 12', title: 'Interests in other entities', level: 'No access' },
    ],
  },
];

const TABS = [
  { k: 'groups',  label: 'Access Groups' },
  { k: 'members', label: 'Members' },
  { k: 'matrix',  label: 'Section access matrix' },
] as const;

export default function ManageTeams() {
  const [tab, setTab] = useState<'groups' | 'members' | 'matrix'>('groups');
  const [groups, setGroups] = useState<Group[]>(SEED_GROUPS);
  const [selId, setSelId] = useState<string>(SEED_GROUPS[0].id);
  const [newGroup, setNewGroup] = useState('');
  const [invite, setInvite] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const sel = groups.find((g) => g.id === selId) ?? groups[0];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const createGroup = () => {
    if (!newGroup.trim()) return;
    const id = newGroup.toLowerCase().replace(/\s+/g, '-');
    const g: Group = {
      id, name: newGroup, desc: 'What this group covers',
      role: 'Viewer', color: '#3B5BDB', members: [], restrictions: [],
    };
    setGroups((gs) => [...gs, g]);
    setSelId(id);
    setNewGroup('');
    showToast(`Group "${g.name}" created.`);
  };

  const updateSel = (patch: Partial<Group>) =>
    setGroups((gs) => gs.map((g) => (g.id === sel.id ? { ...g, ...patch } : g)));

  const removeMember = (email: string) => {
    updateSel({ members: sel.members.filter((m) => m.email !== email) });
    showToast('Removed from group.');
  };

  const inviteMembers = () => {
    if (!invite.trim()) return;
    const emails = invite.split(',').map((e) => e.trim()).filter(Boolean);
    const newOnes: Member[] = emails.map((e) => ({
      name: e.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      email: e,
      initials: e.slice(0, 2).toUpperCase(),
      color: '#65708C',
    }));
    updateSel({ members: [...sel.members, ...newOnes] });
    setInvite('');
    showToast(`Invited ${newOnes.length} member${newOnes.length === 1 ? '' : 's'}.`);
  };

  const deleteGroup = () => {
    const remaining = groups.filter((g) => g.id !== sel.id);
    setGroups(remaining);
    setSelId(remaining[0]?.id ?? '');
    showToast(`Group "${sel.name}" deleted.`);
  };

  const clearRestriction = (secTitle: string) => {
    updateSel({ restrictions: sel.restrictions.filter((r) => r.title !== secTitle) });
  };

  return (
    <div className="p-8 space-y-4 animate-fcFade">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <div className="text-[11px] font-bold tracking-[1.4px] uppercase text-ink-400">Administration</div>
          <h1 className="mt-1 text-2xl font-bold text-ink-900">Manage Teams</h1>
          <p className="mt-1.5 text-[12.5px] text-ink-500 leading-relaxed">
            Invite people, group them into access groups such as <b className="font-semibold text-ink-700">Controller Group</b> or{' '}
            <b className="font-semibold text-ink-700">CFO Suite</b> so a whole set of email IDs inherits the same rights at once, and control which accounting policies and notes each group may view or edit.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="inline-flex gap-1 p-1 rounded-xl bg-surface-soft shadow-neu-in-sm border border-white/70">
        {TABS.map((t) => {
          const active = tab === t.k;
          const count = t.k === 'groups' ? groups.length
                      : t.k === 'members' ? groups.reduce((n, g) => n + g.members.length, 0)
                      : groups.reduce((n, g) => n + g.restrictions.length, 0);
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`h-9 px-4 rounded-lg text-[12.5px] font-semibold flex items-center gap-2 transition ${
                active
                  ? 'bg-brand-500 text-white shadow-primary'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              {t.label}
              <span className={`px-1.5 h-[18px] min-w-[18px] grid place-items-center rounded-full text-[10px] font-bold ${
                active ? 'bg-white/25 text-white' : 'bg-white/70 text-ink-500'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {toast && (
        <div className="px-4 py-2.5 rounded-xl bg-brand-500/10 border border-brand-500/30 text-[11.5px] text-ink-800">
          {toast}
        </div>
      )}

      {tab === 'groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,330px)_1fr] gap-4 items-start">
          {/* Group list */}
          <section className="p-5 rounded-2xl bg-surface-card shadow-neu">
            <div className="text-[11px] font-bold tracking-wider uppercase text-ink-500">Access groups</div>
            <div className="mt-1 mb-3 text-[11.5px] text-ink-400">{groups.length} groups configured</div>

            <div className="flex flex-col gap-2">
              {groups.map((g) => {
                const active = g.id === sel?.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelId(g.id)}
                    className={`text-left p-3 rounded-xl border transition ${
                      active
                        ? 'bg-brand-500/8 border-brand-500/35'
                        : 'bg-white/60 border-white/80 hover:border-ink-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                      <span className="flex-1 min-w-0 text-[13px] font-bold text-ink-900 truncate">{g.name}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${roleTone[g.role]}`}>
                        {g.role}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[11px] text-ink-400 line-clamp-2">{g.desc}</div>
                    <div className="mt-1.5 flex items-center gap-2 text-[10.5px]">
                      <span className="font-semibold text-ink-500">{g.members.length} member{g.members.length === 1 ? '' : 's'}</span>
                      {g.restrictions.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-warn/12 text-warn font-semibold">
                          {g.restrictions.length} restriction{g.restrictions.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-surface-line flex gap-2">
              <input
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createGroup()}
                placeholder="New group name"
                className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-surface-bg border border-surface-line shadow-neu-in-sm text-[12px] text-ink-800 focus:outline-none"
              />
              <button
                onClick={createGroup}
                className="h-9 px-4 rounded-lg text-[12px] font-bold text-white shadow-primary"
                style={{ background: 'linear-gradient(145deg,#3B82F6,#2563EB)' }}
              >
                Create
              </button>
            </div>
          </section>

          {/* Group detail */}
          {sel && (
            <section className="p-6 rounded-2xl bg-surface-card shadow-neu">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <input
                    value={sel.name}
                    onChange={(e) => updateSel({ name: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-surface-bg border border-surface-line shadow-neu-in-sm text-[15px] font-bold text-ink-900 focus:outline-none"
                  />
                  <input
                    value={sel.desc}
                    onChange={(e) => updateSel({ desc: e.target.value })}
                    placeholder="What this group covers"
                    className="w-full h-8 mt-2 px-0.5 bg-transparent text-[11.5px] text-ink-400 focus:outline-none focus:text-ink-700"
                  />
                </div>
                <button
                  onClick={deleteGroup}
                  className="h-8 px-3 rounded-lg text-[11.5px] font-bold text-danger bg-danger/10 border border-danger/30"
                >
                  Delete group
                </button>
              </div>

              <div className="mt-4 grid gap-3.5 sm:grid-cols-2 items-end">
                <div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-ink-300 mb-1.5">
                    Group access level
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLES.map((r) => {
                      const active = sel.role === r;
                      return (
                        <button
                          key={r}
                          onClick={() => updateSel({ role: r })}
                          className={`h-8 px-3 rounded-lg text-[11.5px] font-semibold border transition ${
                            active
                              ? 'bg-brand-500 text-white border-brand-500 shadow-primary'
                              : 'bg-white/60 text-ink-600 border-white/80 hover:border-ink-200'
                          }`}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="text-[11.5px] text-ink-500 pb-2 leading-relaxed">
                  <b className="font-semibold text-ink-700">{sel.members.length} member{sel.members.length === 1 ? '' : 's'}</b> at{' '}
                  <b className="font-semibold text-ink-700">{sel.role}</b> level. Changing the level here re-grants every member at once; individual overrides stay in the Members tab.
                </div>
              </div>

              {/* Members */}
              <div className="mt-5 text-[10px] font-bold tracking-wider uppercase text-ink-300">Members</div>
              <div className="mt-2 flex flex-col gap-1.5">
                {sel.members.map((m) => (
                  <div key={m.email} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-surface-card2 border border-surface-line/70">
                    <span
                      className="flex-none w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.initials}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12px] font-bold text-ink-900 truncate">{m.name}</span>
                      <span className="block text-[10.5px] text-ink-400 truncate">{m.email}</span>
                    </span>
                    <button
                      onClick={() => removeMember(m.email)}
                      title="Remove from group"
                      className="w-6 h-6 rounded-md text-ink-300 bg-surface-soft hover:text-danger"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {sel.members.length === 0 && (
                  <div className="p-3.5 rounded-xl border border-dashed border-ink-200 text-[11.5px] italic text-ink-400">
                    No members yet. Add existing users or invite email IDs below.
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && inviteMembers()}
                  placeholder="Invite email IDs, comma separated"
                  className="flex-1 min-w-[240px] h-9 px-3 rounded-lg bg-surface-bg border border-surface-line shadow-neu-in-sm text-[12px] text-ink-800 focus:outline-none"
                />
                <button
                  onClick={inviteMembers}
                  className="h-9 px-4 rounded-lg text-[12px] font-bold text-white shadow-primary"
                  style={{ background: 'linear-gradient(145deg,#3B82F6,#2563EB)' }}
                >
                  Invite to group
                </button>
              </div>

              {/* Restrictions */}
              <div className="mt-6 flex items-center gap-2.5">
                <span className="text-[10px] font-bold tracking-wider uppercase text-ink-300">Section restrictions</span>
                <div className="flex-1 h-px bg-surface-line" />
                <button
                  onClick={() => setTab('matrix')}
                  className="text-[10.5px] font-bold text-brand-accent"
                >
                  Open matrix ›
                </button>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {sel.restrictions.map((r) => (
                  <div key={r.title} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-surface-card2 border border-surface-line/70">
                    <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold text-ink-700 bg-white/80 border border-ink-200">
                      {r.sec}
                    </span>
                    <span className="flex-1 min-w-0 text-[12px] text-ink-800">{r.title}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold border ${
                      r.level === 'No access'
                        ? 'bg-danger/10 text-danger border-danger/30'
                        : 'bg-good/10 text-good border-good/30'
                    }`}>
                      {r.level}
                    </span>
                    <button
                      onClick={() => clearRestriction(r.title)}
                      className="text-[10.5px] font-bold text-ink-400 hover:text-ink-700"
                      title="Restore default access"
                    >
                      Reset
                    </button>
                  </div>
                ))}
                {sel.restrictions.length === 0 && (
                  <div className="p-3 rounded-xl border border-dashed border-ink-200 text-[11.5px] italic text-ink-400">
                    This group can reach every policy and note at its access level. Restrict individual sections in the Section access matrix.
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'members' && (
        <section className="p-5 rounded-2xl bg-surface-card shadow-neu">
          <div className="text-[11px] font-bold tracking-wider uppercase text-ink-500 mb-3">All members across groups</div>
          <div className="overflow-hidden rounded-xl border border-surface-line/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-ink-400 bg-surface-card2">
                  <th className="text-left px-4 py-2">Member</th>
                  <th className="text-left px-4 py-2">Email</th>
                  <th className="text-left px-4 py-2">Groups</th>
                  <th className="text-left px-4 py-2">Effective role</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const map = new Map<string, { m: Member; groups: Group[] }>();
                  groups.forEach((g) => g.members.forEach((m) => {
                    const cur = map.get(m.email) ?? { m, groups: [] };
                    cur.groups.push(g);
                    map.set(m.email, cur);
                  }));
                  return Array.from(map.values()).map(({ m, groups: gs }) => {
                    const highest = gs[0]?.role ?? 'Viewer';
                    return (
                      <tr key={m.email} className="border-t border-surface-line/40">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold text-white"
                              style={{ backgroundColor: m.color }}
                            >
                              {m.initials}
                            </span>
                            <span className="font-medium text-ink-900">{m.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-ink-600">{m.email}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {gs.map((g) => (
                              <span key={g.id} className="px-2 py-0.5 rounded text-[10.5px] font-semibold text-ink-700 bg-surface-soft border border-ink-200">
                                {g.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold border ${roleTone[highest]}`}>
                            {highest}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'matrix' && (
        <section className="p-5 rounded-2xl bg-surface-card shadow-neu">
          <div className="flex items-center gap-2 mb-3">
            <Icon path="M4 6h16v4H4zM4 14h16v4H4z" size={14} className="text-ink-500" />
            <span className="text-[11px] font-bold tracking-wider uppercase text-ink-500">Section access matrix</span>
          </div>
          <p className="text-[11.5px] text-ink-500 mb-4 max-w-2xl">
            Fine-tune which policies and notes each group may view or edit. The default (blank) inherits the group's access level.
          </p>
          <div className="overflow-x-auto rounded-xl border border-surface-line/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-ink-400 bg-surface-card2">
                  <th className="text-left px-4 py-2 min-w-[220px]">Section</th>
                  {groups.map((g) => (
                    <th key={g.id} className="text-left px-4 py-2 whitespace-nowrap">{g.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { sec: 'IFRS 15', title: 'Revenue disclosures' },
                  { sec: 'IFRS 12', title: 'Interests in other entities' },
                  { sec: 'IAS 21',  title: 'Foreign currency translation' },
                  { sec: 'IAS 36',  title: 'Impairment of assets' },
                  { sec: 'IFRS 16', title: 'Leases' },
                ].map((r) => (
                  <tr key={r.title} className="border-t border-surface-line/40">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold text-ink-700 bg-white/80 border border-ink-200">
                          {r.sec}
                        </span>
                        <span className="text-ink-800">{r.title}</span>
                      </div>
                    </td>
                    {groups.map((g) => {
                      const override = g.restrictions.find((x) => x.title === r.title);
                      return (
                        <td key={g.id} className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold border ${
                            override
                              ? override.level === 'No access'
                                ? 'bg-danger/10 text-danger border-danger/30'
                                : 'bg-good/10 text-good border-good/30'
                              : 'bg-surface-soft text-ink-400 border-ink-200'
                          }`}>
                            {override ? override.level : 'Inherit'}
                          </span>
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
