import React from 'react';
import Icon from '../components/Icon';
import { useApp } from '../state/AppContext';
import { routes } from '../routes';

export default function Placeholder() {
  const { route, navTo } = useApp();
  const meta = routes[route];

  return (
    <div className="p-10">
      <div className="max-w-2xl mx-auto text-center p-10 rounded-3xl bg-surface-card shadow-neu">
        <div className="w-16 h-16 rounded-2xl bg-surface-card shadow-neu-in mx-auto grid place-items-center text-ink-500">
          <Icon path={meta.glyph} size={28} />
        </div>
        <div className="text-[11px] uppercase tracking-wider text-ink-400 mt-4">{meta.section}</div>
        <h1 className="text-2xl font-semibold text-ink-900 mt-1">{meta.label}</h1>
        <p className="text-ink-500 mt-3">
          This workspace is scaffolded and will be ported in a follow-up turn.
        </p>
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => navTo('command')}
            className="h-10 px-4 rounded-xl bg-brand-500 text-white text-sm shadow-primary"
          >
            Back to Command Center
          </button>
          <button
            onClick={() => navTo('home')}
            className="h-10 px-4 rounded-xl bg-surface-card shadow-neu-sm text-sm text-ink-700"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
