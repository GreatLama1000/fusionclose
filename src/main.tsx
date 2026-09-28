import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './state/AppContext';
import { installDarkTheme } from './theme/dark';
import './index.css';

/**
 * Dark mode reads a flag off the document rather than React state: the patch
 * runs inside createElement, below the component tree, so it cannot use a hook.
 * AppContext keeps the attribute in sync.
 */
installDarkTheme(
  React as unknown as { createElement: (...args: unknown[]) => unknown },
  () => document.documentElement.dataset.fcTheme === 'dark',
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);
