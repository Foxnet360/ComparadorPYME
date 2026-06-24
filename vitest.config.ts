import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'server/src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/*.test.ts',
      'hooks/**/*.test.ts',
      'tests/server/**/*.test.ts',
    ],
    exclude: ['server/dist/**', 'node_modules/**', 'dist/**'],
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['server/src/**/*.ts', 'src/**/*.ts', 'src/**/*.tsx', 'hooks/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.integration.test.ts',
        '**/__tests__/**',
        'server/src/scripts/**',
        'server/src/data/**',
        'server/src/types/**',
        '**/node_modules/**',
        '**/dist/**',
      ],
      reportOnFailure: true,
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 70,
      },
    },
  },
});
