import React from 'react';
import { stepperDefs, stepperRoutes, STEP_DONE_ICON, StepStatus } from '../routes';
import { useApp } from '../state/AppContext';

/**
 * Close-progress rail — ported verbatim from the design:
 * markup lines 876–885, styles lines 10014–10025.
 *
 * Pills are tinted outlines (1px coloured border over a faint wash), not
 * solid fills. The current route adds a blue ring on top of its status colour.
 */

const STEP_BASE: React.CSSProperties = {

  cursor: 'pointer',
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  padding: '5px 12px',
  borderRadius: '999px',
  fontSize: '11.5px',
  fontWeight: 700,
};

const STATUS: Record<StepStatus, React.CSSProperties> = {
  done: {
    color: '#15803D',
    background: 'rgba(34,197,94,.08)',
    border: '1px solid rgba(34,197,94,.3)',
  },
  warn: {
    color: '#B45309',
    background: 'rgba(245,158,11,.1)',
    border: '1px solid rgba(245,158,11,.45)',
  },
  todo: {
    color: '#7A84A0',
    background: 'rgba(122,132,160,.12)',
    border: '1px solid #D6DBE8',
  },
};

export default function Stepper() {
  const { route, navTo } = useApp();
  if (!stepperRoutes.includes(route)) return null;

  return (
    <div
      className="scrollbar-none"
      style={{
        position: 'relative',
        zIndex: 15,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 32px',
        borderBottom: '1px solid #D9DEE9',
        background: 'rgba(203,210,224,.6)',
        overflowX: 'auto',
      }}
    >
      <span
        style={{
          flex: 'none',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          color: '#9AA3BA',
          marginRight: '6px',
        }}
      >
        Close Progress
      </span>

      {stepperDefs.map((s, i) => {
        const active = route === s.key;
        return (
          <React.Fragment key={s.key}>
            <button
              className="fc-h fc-btn"
              onClick={() => navTo(s.key)}
              style={{
                ...STEP_BASE,
                ...STATUS[s.status],
                ...(active ? { boxShadow: '0 0 0 2px rgba(59,130,246,.45)' } : null),
              }}
            >
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                style={{ flex: 'none' }}
              >
                <path d={s.status === 'done' ? STEP_DONE_ICON : s.icon} />
              </svg>
              <span>{s.label}</span>
            </button>
            {i < stepperDefs.length - 1 && (
              <span style={{ flex: 'none', width: '16px', height: '1px', background: '#CBD2E0' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
