import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.test.ts', 'hooks/**/*.test.ts'],
    exclude: ['server/dist/**', 'node_modules/**', 'dist/**'],
    environment: 'jsdom',
    globals: true,
  },
});
