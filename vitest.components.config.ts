/**
 * Vitest configuration — component tests.
 *
 * Separate from `vitest.config.ts` so the 383 fast pure-function unit
 * tests don't pay the jsdom startup cost on every run. Component tests
 * use jsdom and React Testing Library to render extracted features
 * with mock context providers.
 *
 * Run: npm run test:component
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/component/**/*.test.tsx'],
    globals: true,
    setupFiles: ['./tests/component/setup.ts'],
  },
});
