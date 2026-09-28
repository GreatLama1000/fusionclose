import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Classic runtime so JSX compiles to React.createElement, which the dark
  // theme patches to remap inline-style colours (src/theme/dark.ts).
  plugins: [react({ jsxRuntime: 'classic' })],
});
