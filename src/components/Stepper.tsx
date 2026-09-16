import React from 'react';
import { stepperDefs, stepperRoutes } from '../routes';
import { useApp } from '../state/AppContext';

export default function Stepper() {
  const { route } = useApp();
  if (!stepperRoutes.includes(route)) return null;

  return (
    <div className="px-6 py-3 bg-surface-card/60 border-b border-surface-line/60">
      <ol className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        {stepperDefs.map((s, i) => {
          const styles: Record<string, string> = {
            done:   'bg-good text-white',
            active: 'bg-brand-500 text-white shadow-primary',
            warn:   'bg-warn text-white',
            todo:   'bg-surface-card text-ink-500 shadow-neu-in-sm',
          };
          return (
            <li key={s.key} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-medium ${styles[s.status]}`}>
                <span className="w-4 h-4 rounded-full bg-white/25 grid place-items-center text-[10px]">
                  {i + 1}
                </span>
                <span>{s.label}</span>
              </div>
              {i < stepperDefs.length - 1 && <span className="w-4 h-px bg-surface-line" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
