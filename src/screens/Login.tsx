import React, { useState } from 'react';
import Icon from '../components/Icon';
import { useApp } from '../state/AppContext';
import { useDismissOnClick } from '../hooks/useDismissOnClick';

/** Sign-in screen — shown until the user signs in, then the app opens on Home (the landing page). */
export default function Login() {
  const { login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  useDismissOnClick(!!error, () => setError(null));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(username, password)) {
      setError('Incorrect username or password.');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen w-full grid place-items-center p-4 animate-fcFade">
      <form
        onSubmit={submit}
        className="w-full max-w-[380px] p-8 rounded-3xl bg-surface-card shadow-neu flex flex-col"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-[70px] h-[70px] rounded-full bg-surface-card shadow-neu grid place-items-center">
            <span
              className="w-12 h-12 rounded-full grid place-items-center shadow-primary"
              style={{ background: 'linear-gradient(145deg,#3B82F6,#1E40AF)' }}
            >
              <Icon path="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" size={23} className="text-white" strokeWidth={1.9} />
            </span>
          </div>
          <div className="mt-4 text-xl font-bold text-ink-900">Welcome back</div>
          <div className="mt-1 text-[10.5px] uppercase tracking-[1px] text-ink-300">
            Fusion Close · Powered by <span className="text-brand-accent font-bold">SUVI Corp</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3.5">
          <label className="flex items-center gap-3 h-[50px] px-4 rounded-xl bg-surface-soft shadow-neu-in-sm">
            <Icon path="M9 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM3 20c0-3.4 2.7-5 6-5s6 1.6 6 5" size={16} className="text-ink-400" />
            <input
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(null); }}
              type="text"
              autoComplete="username"
              autoFocus
              placeholder="Username"
              aria-label="Username"
              className="flex-1 bg-transparent outline-none text-sm text-ink-900"
            />
          </label>
          <label className="flex items-center gap-3 h-[50px] px-4 rounded-xl bg-surface-soft shadow-neu-in-sm">
            <Icon path="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z" size={16} className="text-ink-400" />
            <input
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              aria-label="Password"
              className="flex-1 bg-transparent outline-none text-sm text-ink-900"
            />
          </label>

          {error && (
            <div role="alert" className="text-[12px] font-semibold text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!username || !password}
            className="h-[52px] rounded-xl text-white text-[14.5px] font-bold flex items-center justify-center gap-2 shadow-primary disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(145deg,#3B82F6,#2563EB)' }}
          >
            <Icon path="M10 17l5-5-5-5M15 12H3M14 4h5v16h-5" size={16} strokeWidth={1.9} />
            Sign in securely
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-[10.5px] text-ink-300">
          <Icon path="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z" size={12} className="text-good" strokeWidth={2} />
          256-bit encrypted · SOC 2 Type II
        </div>
      </form>
    </div>
  );
}
