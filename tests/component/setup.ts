/**
 * Component-test setup — extends jest-dom matchers and configures
 * cleanup. Loaded automatically by vitest before each test file.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
