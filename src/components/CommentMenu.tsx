import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { CmtPrio, PRIOS, PRIO_TONE } from './CommentsPanel';
import { routes } from '../routes';

/**
 * The application-wide right-click comment menu — ported from
 * docs/design/Fusion Close.dc.html: the document-level `contextmenu` hook at
 * line 5277, the menu markup at 3883–3895 and the draft composer at 3899–3931.
 *
 * This is deliberately generic. It is mounted once, listens on the document,
 * and works on any surface — statement faces, narratives, footnote tables,
 * dashboards — because the design treats commenting as a property of the
 * application rather than of one screen.
 *
 *  - with text selected, the comment is tagged to that selection
 *  - with nothing selected, it is tagged to the element under the cursor
 *  - the location is read from the nearest `data-fc-loc`, else the enclosing
 *    section heading, prefixed with the current route (design `cmtLocLabel`
 *    line 6948)
 *
 * Surfaces opt in to more through data attributes, so the menu stays generic:
 *  - `data-fc-menu`      the menu may open over a field inside it (footnote cells)
 *  - `data-fc-quote`     the text a comment quotes, when the element's own is wrong
 *  - `data-fc-cmt-local` the surface keeps its own comments — "Add comment…"
 *                        is handed back to it as an `fc:comment` event
 *  - `data-fc-linkable`  offers "Link a number…", raised as an `fc:link` event
 *                        carrying the caret the number should land at
 */

/** detail of the `fc:link` / `fc:comment` events a surface listens for */
export type FcMenuEvent = { x: number; y: number; quote: string; loc: string; range: Range | null };

type Menu = { x: number; y: number; quote: string; loc: string; copy: string; linkable: boolean };
type Draft = Menu & { text: string; prio: CmtPrio; assignee: string };

/** the caret under the pointer, for dropping a figure where the user right-clicked */
const caretAt = (x: number, y: number): Range | null => {
  const d = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (d.caretRangeFromPoint) return d.caretRangeFromPoint(x, y);
  const p = d.caretPositionFromPoint?.(x, y);
  if (!p) return null;
  const r = document.createRange();
  r.setStart(p.offsetNode, p.offset);
  r.collapse(true);
  return r;
};

/** the text an element stands for, when nothing is selected — design `cmtElQuote` */
const elQuote = (el: Element | null): string => {
  let n: Element | null = el;
  while (n && n !== document.body) {
    const t = (n as HTMLElement).innerText ?? n.textContent ?? '';
    const txt = t.replace(/\s+/g, ' ').trim();
    if (txt && txt.length <= 220) return txt;
    if (txt) return txt.slice(0, 220);
    n = n.parentElement;
  }
  return '';
};

/** design `cmtLocLabel()` line 6948 — nearest tagged location, else a heading */
const locLabel = (el: Element | null, routeLabel: string): string => {
  let n: Element | null = el;
  let tagged: string | null = null;
  while (n && n !== document.body) {
    const attr = n.getAttribute?.('data-fc-loc');
    if (!tagged && attr) tagged = attr;
    if (n.tagName === 'SECTION' || n.tagName === 'ASIDE') {
      const h = n.querySelector('h1,h2,h3,span');
      const txt = h?.textContent?.trim();
      if (txt) { tagged = tagged ?? txt.slice(0, 46); break; }
    }
    n = n.parentElement;
  }
  return tagged ? `${routeLabel} · ${tagged}` : routeLabel;
};

export default function CommentMenu() {
  const { route, comments, addComment, setRailOpen, setRailFocus, users, currentUser } = useApp();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [copied, setCopied] = useState(false);
  /** what was right-clicked, and the caret there — handed to the surface on link / local comment */
  const target = useRef<{ el: Element; range: Range | null } | null>(null);
  const routeLabel = useRef('');
  routeLabel.current = routes[route]?.label ?? 'Workspace';

  useEffect(() => {
    /*
     * What the right button went down on, and the caret there. Pressing it can
     * focus an editor, and focusing one checks the item out — its lock banner
     * then shifts the layout before `contextmenu` fires, so the event's own
     * target (and the point under the pointer) is no longer what was clicked.
     */
    let down: { el: Element; range: Range | null; at: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 2 || !(e.target instanceof Element)) return;
      down = { el: e.target, range: caretAt(e.clientX, e.clientY), at: Date.now() };
    };
    const onCtx = (e: MouseEvent) => {
      // a surface that handles its own right-click wins
      if (e.defaultPrevented) return;
      const fresh = down && down.el.isConnected && Date.now() - down.at < 1500 ? down : null;
      down = null;
      const tgt = fresh?.el ?? (e.target instanceof Element ? e.target : null);
      if (!tgt) return;
      // never hijack a field's own menu (unless its surface opts in), nor an editor outside the notes document
      const field = tgt.closest('input,textarea,select') as HTMLInputElement | null;
      if (field && !field.closest('[data-fc-menu]')) return;
      if (tgt.closest('[contenteditable="true"]') && !tgt.closest('[data-nd-doc]')) return;
      if (tgt.closest('[data-fc-no-cmt]')) return;

      const sel = window.getSelection();
      const picked = !field && sel && !sel.isCollapsed ? String(sel).replace(/\s+/g, ' ').trim() : '';
      const anchor = picked
        ? (sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement ?? null)
        : tgt;
      const quote = picked || tgt.closest('[data-fc-quote]')?.getAttribute('data-fc-quote') || elQuote(tgt);
      const linkable = !!tgt.closest('[data-fc-linkable]');
      if (!quote && !linkable) return;

      e.preventDefault();
      // a selection inside the editor is replaced by the figure; otherwise it lands at the pointer
      const range = picked && sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : field ? null : fresh?.range ?? caretAt(e.clientX, e.clientY);
      target.current = { el: tgt, range };
      setDraft(null);
      setMenu({
        x: Math.min(e.clientX, window.innerWidth - 250),
        y: Math.min(e.clientY, window.innerHeight - 250),
        quote: quote.slice(0, 220),
        loc: locLabel(anchor, routeLabel.current),
        copy: picked || (field ? field.value : '') || quote,
        linkable,
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenu(null); setDraft(null); }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('contextmenu', onCtx);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('contextmenu', onCtx);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  /** hand the action back to the surface that was right-clicked */
  const raise = (name: 'fc:link' | 'fc:comment', m: Menu) => {
    const t = target.current;
    if (!t?.el.isConnected) return;
    const detail: FcMenuEvent = { x: m.x, y: m.y, quote: m.quote, loc: m.loc, range: t.range };
    t.el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  };

  const link = () => {
    if (!menu) return;
    setMenu(null);
    raise('fc:link', menu);
  };

  const openDraft = () => {
    if (!menu) return;
    // a surface that keeps its own comments (footnote rows) raises them itself
    if (target.current?.el.closest('[data-fc-cmt-local]')) {
      setMenu(null);
      raise('fc:comment', menu);
      return;
    }
    setDraft({
      ...menu,
      y: Math.min(menu.y, Math.max(60, window.innerHeight - 430)),
      x: Math.min(menu.x, window.innerWidth - 400),
      text: '',
      prio: 'High',
      assignee: users.find((u) => u.name !== currentUser.name)?.name ?? currentUser.name,
    });
    setMenu(null);
  };

  const copy = () => {
    const q = menu?.copy ?? '';
    try { navigator.clipboard?.writeText(q); } catch { /* clipboard blocked */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
    setMenu(null);
  };

  const openRail = () => {
    setMenu(null);
    setRailFocus(null);
    setRailOpen(true);
  };

  const save = () => {
    if (!draft?.text.trim()) return;
    addComment({ route, loc: draft.loc, quote: draft.quote, text: draft.text.trim(), prio: draft.prio, assignee: draft.assignee });
    setDraft(null);
    setRailOpen(true);
  };

  const ITEM: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '9px', width: '100%', boxSizing: 'border-box',
    padding: '8px 9px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, color: '#333D55',
    textAlign: 'left',
  };

  return (
    <>
      {/* ---- the menu ---- */}
      {menu && (
        <div
          onClick={() => setMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1330 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', left: `${Math.max(8, menu.x)}px`, top: `${Math.max(8, menu.y)}px`, width: '238px',
              background: '#ECEFF6', border: '1px solid rgba(255,255,255,.8)', borderRadius: '13px',
              boxShadow: '0 18px 40px -12px rgba(40,50,80,.45),5px 5px 14px rgba(166,175,195,.45)', overflow: 'hidden',
            }}
          >
            <div style={{ padding: '10px 11px 8px', borderBottom: '1px solid #DCE0EB' }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: '#B45309' }}>
                {menu.loc}
              </div>
              {menu.quote && (
                <div style={{ marginTop: '3px', fontSize: '11.5px', color: '#414B62', fontStyle: 'italic', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  “{menu.quote}”
                </div>
              )}
            </div>
            <div style={{ padding: '6px' }}>
              <button type="button" className="fc-h fc-btn" onClick={openDraft} style={ITEM}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B5BDB" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                  <path d="M20.5 12.4c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.6-.34L4.5 21l1.2-3.5A6.9 6.9 0 0 1 3.5 12.4c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2z" /><path d="M12 9.4v6M9 12.4h6" />
                </svg>
                Add comment…
              </button>
              <button type="button" className="fc-h fc-btn" onClick={copy} style={ITEM}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#65708C" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                  <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
                </svg>
                Copy text
              </button>
              {menu.linkable && (
                <button type="button" className="fc-h fc-btn" onClick={link} style={ITEM}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
                  </svg>
                  Link a number…
                  <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, color: '#7A84A0' }}>Shift+L</span>
                </button>
              )}
              <button type="button" className="fc-h fc-btn" onClick={openRail} style={ITEM}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#65708C" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                  <path d="M4 5h16M4 12h16M4 19h10" />
                </svg>
                Open comments rail
                {comments.filter((c) => c.status === 'open').length > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, color: '#7A84A0', background: '#E0E4EE', padding: '1px 7px', borderRadius: '6px' }}>
                    {comments.filter((c) => c.status === 'open').length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- the composer — same one the footnote tables use ---- */}
      {draft && (
        <div
          onClick={() => setDraft(null)}
          onContextMenu={(e) => { e.preventDefault(); setDraft(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1340, background: 'rgba(35,44,66,.18)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', left: `${Math.max(12, draft.x)}px`, top: `${Math.max(12, draft.y)}px`,
              width: '384px', maxWidth: '94vw', background: '#ECEFF6', border: '1px solid rgba(255,255,255,.85)',
              borderRadius: '16px', boxShadow: '0 26px 60px -16px rgba(40,50,80,.5)', padding: '15px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <span style={{ flex: 'none', width: '26px', height: '26px', borderRadius: '8px', background: 'linear-gradient(145deg,#3B82F6,#2563EB)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 12.4c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.6-.34L4.5 21l1.2-3.5A6.9 6.9 0 0 1 3.5 12.4c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2z" /></svg>
              </span>
              <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 700, color: '#232C42' }}>New comment</span>
              <button
                type="button" className="fc-h fc-btn" onClick={() => setDraft(null)} title="Cancel (Esc)"
                style={{ flex: 'none', width: '24px', height: '24px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A84A0', background: '#E4E8F0' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>

            <div style={{ marginTop: '10px', padding: '9px 11px', borderRadius: '10px', background: 'rgba(245,158,11,.12)', borderLeft: '3px solid #D97706' }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: '#B45309' }}>{draft.loc}</div>
              <div style={{ marginTop: '3px', fontSize: '11.5px', color: '#414B62', fontStyle: 'italic', lineHeight: 1.5 }}>“{draft.quote}”</div>
            </div>

            <textarea
              value={draft.text} autoFocus
              onChange={(e) => setDraft((d) => (d ? { ...d, text: e.target.value } : d))}
              placeholder="Write your comment…"
              style={{ width: '100%', boxSizing: 'border-box', marginTop: '11px', minHeight: '78px', resize: 'vertical', background: '#E4E8F0', border: '1px solid #CBD2E0', boxShadow: 'inset 2px 2px 6px rgba(166,175,195,.4),inset -2px -2px 6px rgba(255,255,255,.9)', borderRadius: '10px', fontSize: '12.5px', lineHeight: 1.55, color: '#333D55', padding: '9px 11px', outline: 'none', fontFamily: 'inherit' }}
            />

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginTop: '11px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: '#9AA3BA', marginBottom: '5px' }}>Priority</div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {PRIOS.map((p) => {
                    const on = draft.prio === p;
                    const [fg, bg] = PRIO_TONE[p];
                    return (
                      <button
                        key={p} type="button" className="fc-h fc-btn" aria-pressed={on}
                        onClick={() => setDraft((d) => (d ? { ...d, prio: p } : d))}
                        style={{ height: '32px', padding: '0 11px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 700, ...(on ? { color: '#fff', background: fg } : { color: fg, background: bg }) }}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: '#9AA3BA', marginBottom: '5px' }}>Assign to</div>
                <select
                  value={draft.assignee}
                  onChange={(e) => setDraft((d) => (d ? { ...d, assignee: e.target.value } : d))}
                  style={{ width: '100%', height: '32px', padding: '0 9px', borderRadius: '9px', border: '1px solid #CBD2E0', background: '#E4E8F0', boxShadow: 'inset 2px 2px 5px rgba(166,175,195,.4),inset -2px -2px 5px rgba(255,255,255,.9)', fontSize: '12px', fontWeight: 700, color: '#333D55', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}
                >
                  {users.map((u) => (
                    <option key={u.email} value={u.name}>
                      {u.name === currentUser.name ? `${u.name} (you)` : u.name} — {u.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '13px' }}>
              <span style={{ flex: 1, fontSize: '10.5px', color: '#9AA3BA', fontStyle: 'italic' }}>
                Appears in the assignee’s My Tasks and notifies them.
              </span>
              <button
                type="button" className="fc-h fc-btn" onClick={() => setDraft(null)}
                style={{ flex: 'none', height: '34px', padding: '0 14px', borderRadius: '9px', border: '1px solid #CBD2E0', background: 'rgba(255,255,255,.6)', fontSize: '12px', fontWeight: 700, color: '#414B62' }}
              >
                Cancel
              </button>
              <button
                type="button" className="fc-h fc-btn" onClick={save} disabled={!draft.text.trim()}
                style={{ flex: 'none', height: '34px', padding: '0 18px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, color: '#fff', background: draft.text.trim() ? 'linear-gradient(145deg,#3B82F6,#2563EB)' : '#C2C9D8', boxShadow: draft.text.trim() ? '0 3px 12px rgba(37,99,235,.38)' : 'none', cursor: draft.text.trim() ? 'pointer' : 'not-allowed' }}
              >
                Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {copied && (
        <div style={{ position: 'fixed', left: '50%', bottom: '26px', transform: 'translateX(-50%)', zIndex: 1350, padding: '10px 18px', borderRadius: '11px', background: '#232C42', color: '#EEF2FA', fontSize: '12.5px', boxShadow: '0 12px 30px rgba(35,44,66,.36)' }}>
          Copied to the clipboard.
        </div>
      )}
    </>
  );
}
