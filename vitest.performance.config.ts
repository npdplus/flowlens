import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/performance/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 120_000,
  },
});
