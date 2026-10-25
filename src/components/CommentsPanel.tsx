import React, { useState } from 'react';
import { RouteKey, routes } from '../routes';

/**
 * Comments rail — ported from docs/design/Fusion Close.dc.html,
 * markup lines 3935–3983, data + styles `buildCmt()` lines 7088–7160,
 * seed `cmtSeed()` line 6933.
 *
 * A fixed right-hand rail, not a dropdown: the design anchors comments to the
 * page they were raised on, so the rail stays open while you navigate.
 */

export const ME = 'Amara Mensah';

export type Reply = { author: string; time: string; text: string };

export type CmtPrio = 'Low' | 'Medium' | 'High' | 'Critical';

/** priority tones — design `prioTone` line 7094, extended with Low */
export const PRIO_TONE: Record<CmtPrio, [string, string]> = {
  Low: ['#0F766E', 'rgba(15,118,110,.12)'],
  Medium: ['#3B5BDB', 'rgba(59,91,219,.1)'],
  High: ['#B45309', 'rgba(245,158,11,.15)'],
  Critical: ['#B42318', 'rgba(180,35,24,.1)'],
};
export const PRIOS: CmtPrio[] = ['Low', 'Medium', 'High', 'Critical'];

/** an unsaved comment being composed — design `cmtDraft` line 7028 */
export type CmtDraft = {
  x: number; y: number;
  loc: string; quote: string;
  text: string; prio: CmtPrio; assignee: string;
};
export type Comment = {
  id: string;
  route: RouteKey;
  loc: string;
  quote: string;
  text: string;
  prio: CmtPrio;
  assignee: string;
  author: string;
  time: string;
  status: 'open' | 'resolved';
  replies: Reply[];
};

export const COMMENT_SEED: Comment[] = [
  {
    id: 'c1', route: 'repanalytics', loc: 'Statement of Financial Position',
    quote: 'Goodwill & intangibles',
    text: 'Confirm the impairment test date matches the PPA measurement period. Support memo is not attached yet.',
    prio: 'Critical', assignee: 'Amara Mensah', author: 'Lena T.', time: 'Today 09:14',
    status: 'open', replies: [],
  },
  {
    id: 'c2', route: 'repanalytics', loc: 'Notes & Disclosures',
    quote: 'management fees',
    text: 'Note 14 wording still refers to the prior policy. Please align to the revised IFRS 18 presentation.',
    prio: 'High', assignee: 'Amara Mensah', author: 'Sarah K.', time: 'Today 08:02',
    status: 'open',
    replies: [{ author: 'John D.', time: 'Today 08:30', text: 'Draft rewording is in WN-07.' }],
  },
  {
    id: 'c3', route: 'pmo', loc: 'Action list',
    quote: 'JPY closing rate',
    text: 'Treasury sign-off received verbally — attach the email before we lock the period.',
    prio: 'Medium', assignee: 'John D.', author: 'Amara Mensah', time: 'Yesterday 17:41',
    status: 'open', replies: [],
  },
];

export const openForMe = (list: Comment[]) =>
  list.filter((c) => c.assignee === ME && c.status === 'open');

const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

const prioStyle = (p: Comment['prio']): React.CSSProperties => {
  const [color, background] = PRIO_TONE[p];
  return {
    flex: 'none', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.5px',
    textTransform: 'uppercase', padding: '2px 8px', borderRadius: '6px', color, background,
  };
};

const AVATAR: React.CSSProperties = {
  flex: 'none',
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '10.5px',
  fontWeight: 700,
  color: '#414B62',
  background: '#E0E4EE',
  boxShadow:
    'inset 1px 1px 3px rgba(166,175,195,.5),inset -1px -1px 3px rgba(255,255,255,.9),0 0 0 2px #E7EAF2',
};

const TABS = [
  ['mine', 'Assigned to me'],
  ['page', 'This page'],
  ['all', 'All'],
] as const;

type Tab = (typeof TABS)[number][0];

export default function CommentsPanel({
  comments,
  setComments,
  route,
  onClose,
  onNavigate,
}: {
  comments: Comment[];
  setComments: (next: Comment[]) => void;
  route: RouteKey;
  onClose: () => void;
  onNavigate: (r: RouteKey) => void;
}) {
  const [tab, setTab] = useState<Tab>('mine');
  const [focus, setFocus] = useState<string | null>(null);
  const [replyOn, setReplyOn] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const mine = openForMe(comments);
  const list =
    tab === 'mine'
      ? comments.filter((c) => c.assignee === ME)
      : tab === 'page'
        ? comments.filter((c) => c.route === route)
        : comments;

  const jump = (c: Comment) => {
    setFocus(c.id);
    if (c.route !== route) onNavigate(c.route);
  };

  const nextMine = () => {
    if (!mine.length) return;
    const i = mine.findIndex((c) => c.id === focus);
    jump(mine[(i + 1) % mine.length]);
  };

  const toggleResolve = (id: string) =>
    setComments(
      comments.map((x) =>
        x.id === id ? { ...x, status: x.status === 'resolved' ? 'open' : 'resolved' } : x,
      ),
    );

  const sendReply = (id: string) => {
    const text = replyText.trim();
    if (!text) return;
    setComments(
      comments.map((x) =>
        x.id === id ? { ...x, replies: [...x.replies, { author: ME, time: 'Just now', text }] } : x,
      ),
    );
    setReplyText('');
    setReplyOn(null);
  };

  return (
    <aside
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1300,
        width: '372px', maxWidth: '92vw',
        display: 'flex', flexDirection: 'column',
        background: '#E7EAF2', borderLeft: '1px solid #D2D8E6',
        boxShadow: '-18px 0 46px -20px rgba(50,60,90,.45)',
        animation: 'fcFade .18s ease',
      }}
    >
      <div style={{ flex: 'none', padding: '15px 16px 12px', borderBottom: '1px solid #DCE0EB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: '#232C42' }}>Comments</span>
          <span
            style={{
              flex: 'none', fontSize: '10px', fontWeight: 700, color: '#7A84A0',
              background: '#E0E4EE', padding: '2px 8px', borderRadius: '6px',
            }}
          >
            {mine.length} open for me
          </span>
          <button
            type="button" className="fc-h fc-btn" onClick={onClose} aria-label="Close comments"
            style={{
              flex: 'none', width: '24px', height: '24px', borderRadius: '7px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#7A84A0', background: '#E0E4EE',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '5px', marginTop: '11px' }}>
          {TABS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              className="fc-h fc-btn"
              onClick={() => setTab(k)}
              style={{
                flex: 1, textAlign: 'center', height: '28px', lineHeight: '28px',
                borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                ...(tab === k
                  ? { color: '#fff', background: 'linear-gradient(145deg,#3B82F6,#2563EB)' }
                  : { color: '#65708C', background: '#E0E4EE' }),
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="fc-h fc-btn"
          onClick={nextMine}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
            width: '100%', height: '34px', marginTop: '10px', borderRadius: '9px',
            background: 'linear-gradient(145deg,#3B82F6,#2563EB)',
            fontSize: '11.5px', fontWeight: 700, color: '#fff',
            boxShadow: '0 3px 10px rgba(37,99,235,.32)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 5l7 7-7 7M4 12h15" />
          </svg>
          {mine.length ? 'Next assigned to me (Alt+J)' : 'No open comments for you'}
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 13px 20px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
        {list.map((c) => {
          const isFocus = focus === c.id;
          return (
            <div
              key={c.id}
              style={{
                padding: '13px 14px',
                borderRadius: '14px',
                background: '#ECEFF6',
                border: `1px solid ${isFocus ? 'rgba(59,130,246,.5)' : 'rgba(255,255,255,.8)'}`,
                boxShadow: `${isFocus ? '0 0 0 3px rgba(59,130,246,.16),' : ''}5px 5px 13px rgba(166,175,195,.42),-5px -5px 13px rgba(255,255,255,.92)`,
                ...(c.status === 'resolved' ? { opacity: 0.62 } : null),
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={AVATAR}>{initials(c.author)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#232C42' }}>{c.author}</span>
                  <span style={{ display: 'block', fontSize: '10px', color: '#9AA3BA' }}>{c.time}</span>
                </span>
                <span style={prioStyle(c.prio)}>{c.prio}</span>
              </div>

              <button
                type="button"
                className="fc-h fc-btn"
                onClick={() => jump(c)}
                title={`Go to ${routes[c.route].label}`}
                style={{
                  display: 'block', width: '100%', marginTop: '9px',
                  padding: '7px 10px', borderRadius: '9px', textAlign: 'left',
                  background: 'rgba(245,158,11,.12)', borderLeft: '3px solid #D97706',
                }}
              >
                <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: '#B45309' }}>
                  {c.loc}
                </span>
                <span style={{ display: 'block', marginTop: '3px', fontSize: '11.5px', color: '#414B62', fontStyle: 'italic', lineHeight: 1.45 }}>
                  “{c.quote}”
                </span>
              </button>

              <div style={{ marginTop: '8px', fontSize: '12.5px', lineHeight: 1.55, color: '#333D55' }}>{c.text}</div>

              {c.replies.map((r, i) => (
                <div key={i} style={{ marginTop: '8px', paddingLeft: '10px', borderLeft: '2px solid #CBD2E0' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#414B62' }}>
                    {r.author} <span style={{ fontWeight: 400, color: '#9AA3BA' }}>{r.time}</span>
                  </div>
                  <div style={{ marginTop: '2px', fontSize: '12px', lineHeight: 1.5, color: '#65708C' }}>{r.text}</div>
                </div>
              ))}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    flex: 'none', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                    color: c.assignee === ME ? '#0B6F62' : '#65708C',
                    background: c.assignee === ME ? 'rgba(11,111,98,.11)' : 'rgba(148,163,184,.16)',
                  }}
                >
                  To {c.assignee}
                </span>
                <div style={{ flex: 1 }} />
                <button
                  type="button" className="fc-h fc-btn"
                  onClick={() => { setReplyOn(replyOn === c.id ? null : c.id); setReplyText(''); }}
                  style={{ fontSize: '11px', fontWeight: 700, color: '#3B5BDB' }}
                >
                  Reply
                </button>
                <button
                  type="button" className="fc-h fc-btn"
                  onClick={() => toggleResolve(c.id)}
                  style={{ fontSize: '11px', fontWeight: 700, color: c.status === 'resolved' ? '#B45309' : '#15803D' }}
                >
                  {c.status === 'resolved' ? 'Reopen' : 'Resolve'}
                </button>
              </div>

              {replyOn === c.id && (
                <div style={{ display: 'flex', gap: '7px', marginTop: '9px' }}>
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendReply(c.id); }}
                    placeholder="Reply…"
                    autoFocus
                    style={{
                      flex: 1, minWidth: 0, height: '32px', borderRadius: '9px',
                      border: '1px solid #CBD2E0', background: '#E4E8F0',
                      boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.35),inset -2px -2px 5px rgba(255,255,255,.9)',
                      font: 'inherit', fontSize: '12px', color: '#333D55', padding: '0 10px', outline: 'none',
                    }}
                  />
                  <button
                    type="button" className="fc-h fc-btn"
                    onClick={() => sendReply(c.id)}
                    style={{
                      flex: 'none', height: '32px', padding: '0 13px', borderRadius: '9px',
                      background: 'linear-gradient(145deg,#3B82F6,#2563EB)',
                      fontSize: '11.5px', fontWeight: 700, color: '#fff',
                    }}
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {list.length === 0 && (
          <div style={{ padding: '38px 14px', textAlign: 'center', fontSize: '12px', color: '#9AA3BA', fontStyle: 'italic', lineHeight: 1.6 }}>
            Nothing here. Highlight any figure, label or note anywhere in Fusion Close, right-click and add a comment.
          </div>
        )}
      </div>
    </aside>
  );
}
