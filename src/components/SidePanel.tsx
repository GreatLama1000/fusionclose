import React, { useEffect, useRef, useState } from 'react';

/**
 * The application's side panel — every upload (and any other task that runs
 * alongside the page) opens here rather than in a centred pop-up, so the table
 * it feeds stays in view.
 *
 *  - slides in from the right, full height; a light shade over the page closes
 *    it when clicked, as does Esc
 *  - fixed header (icon, title, subtitle, close) and footer; the body scrolls
 *  - drag the left edge to widen it — the width is remembered per panel
 */

const ICON_UPLOAD = 'M12 16V4M7 9l5-5 5 5M5 20h14';

/** content placed in the panel's fixed footer rather than the scrolling body */
export function PanelFooter({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SidePanel({
  id, title, subtitle, icon, onClose, footer, children, width = 500,
}: {
  /** names the remembered width, e.g. 'upload-tb' */
  id: string;
  title: string;
  subtitle?: React.ReactNode;
  /** svg path for the header badge — defaults to the upload arrow */
  icon?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
}) {
  const key = `fc-panel-w:${id}`;
  const [w, setW] = useState(() => {
    try { const v = Number(localStorage.getItem(key)); return v >= 360 ? v : width; } catch { return width; }
  });
  const [leaving, setLeaving] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  /* a <PanelFooter> child pins to the bottom; everything else scrolls */
  const parts = React.Children.toArray(children);
  const foot = parts.filter((c) => React.isValidElement(c) && c.type === PanelFooter);
  const bodyParts = parts.filter((c) => !(React.isValidElement(c) && c.type === PanelFooter));
  const footerContent = footer ?? (foot.length ? foot : null);

  /* close with a slide out, not a jump */
  const close = () => { setLeaving(true); window.setTimeout(onClose, 170); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', h);
    boxRef.current?.focus();
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { try { localStorage.setItem(key, String(Math.round(w))); } catch { /* storage blocked */ } }, [key, w]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = w;
    const mv = (ev: MouseEvent) => setW(Math.max(380, Math.min(window.innerWidth * 0.85, w0 + (x0 - ev.clientX))));
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); document.body.style.cursor = ''; };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 520 }} data-fc-no-cmt="">
      {/* the page stays visible; the shade only says "click to close" */}
      <div
        onClick={close}
        style={{ position: 'absolute', inset: 0, background: 'rgba(35,44,66,.18)', animation: leaving ? 'fcFadeOut .17s ease forwards' : 'fcFade .2s ease' }}
      />
      <aside
        ref={boxRef}
        role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: `${w}px`, maxWidth: '100vw',
          display: 'flex', flexDirection: 'column', background: '#ECEFF6', outline: 'none',
          borderLeft: '1px solid rgba(255,255,255,.9)', boxShadow: '-18px 0 44px rgba(35,44,66,.28)',
          animation: leaving ? 'fcSlideOut .17s ease forwards' : 'fcSlideIn .24s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {/* resize grip */}
        <span
          onMouseDown={startResize}
          onDoubleClick={() => setW(width)}
          title="Drag to widen · double-click to reset"
          style={{ position: 'absolute', top: 0, bottom: 0, left: '-4px', width: '8px', cursor: 'col-resize', zIndex: 2 }}
        >
          <span style={{ position: 'absolute', top: '50%', left: '2px', transform: 'translateY(-50%)', width: '4px', height: '44px', borderRadius: '4px', background: '#C3CADB' }} />
        </span>

        {/* header */}
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 20px 15px', borderBottom: '1px solid #D9DEE9', background: 'linear-gradient(180deg,#F1F3F9,#ECEFF6)' }}>
          <span style={{ flex: 'none', width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(150deg,#3B82F6,#2563EB)', display: 'grid', placeItems: 'center', color: '#fff', boxShadow: '0 4px 14px rgba(37,99,235,.4)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={icon ?? ICON_UPLOAD} /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#232C42' }}>{title}</div>
            {subtitle && <div style={{ fontSize: '11.5px', color: '#7A84A0', lineHeight: 1.45, marginTop: '1px' }}>{subtitle}</div>}
          </div>
          <button
            type="button" className="fc-h fc-btn" onClick={close} aria-label="Close panel" title="Close (Esc)"
            style={{ flex: 'none', width: '30px', height: '30px', borderRadius: '8px', display: 'grid', placeItems: 'center', color: '#7A84A0', background: '#E4E8F0' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 20px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {bodyParts}
        </div>

        {footerContent && (
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 20px 16px', borderTop: '1px solid #D9DEE9', background: '#E9ECF3' }}>
            {footerContent}
          </div>
        )}
      </aside>
    </div>
  );
}
