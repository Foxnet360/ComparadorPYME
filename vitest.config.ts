import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit-backend',
          include: [
            'server/src/**/*.test.ts',
            'tests/server/**/*.test.ts',
          ],
          exclude: [
            'server/dist/**',
            'node_modules/**',
            'dist/**',
            '**/*.integration.test.ts',
            '**/*.e2e.test.ts',
            '**/*.pdf.test.ts',
            '**/*.quality.test.ts',
            '**/*.evaluation.test.ts',
            '**/*.performance.test.ts',
            '**/*.load.test.ts',
          ],
          environment: 'node',
          globals: true,
          testTimeout: 10000,
        },
      },
      {
        extends: true,
        test: {
          name: 'unit-frontend',
          include: [
            'src/**/*.test.tsx',
            'src/**/*.test.ts',
            'hooks/**/*.test.ts',
          ],
          exclude: [
            'node_modules/**',
            'dist/**',
          ],
          environment: 'jsdom',
          globals: true,
          testTimeout: 10000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: [
            'server/src/**/*.integration.test.ts',
            'server/src/**/*.e2e.test.ts',
            'server/src/**/*.pdf.test.ts',
            'server/src/**/*.quality.test.ts',
            'server/src/**/*.evaluation.test.ts',
            'server/src/**/*.performance.test.ts',
            'server/src/**/*.load.test.ts',
            'tests/server/**/*-integration.test.ts',
            'tests/server/**/*-e2e.test.ts',
          ],
          exclude: ['server/dist/**', 'node_modules/**', 'dist/**'],
          environment: 'node',
          globals: true,
          testTimeout: 300000, // 5 minutes for integration tests
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['server/src/**/*.ts', 'src/**/*.ts', 'src/**/*.tsx', 'hooks/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.integration.test.ts',
        '**/*.e2e.test.ts',
        '**/*.pdf.test.ts',
        '**/*.quality.test.ts',
        '**/*.evaluation.test.ts',
        '**/*.performance.test.ts',
        '**/*.load.test.ts',
        '**/__tests__/**',
        'server/src/scripts/**',
        'server/src/data/**',
        'server/src/types/**',
        '**/node_modules/**',
        '**/dist/**',
      ],
      reportOnFailure: true,
      thresholds: {
        lines: 20,
        statements: 20,
        functions: 20,
        branches: 15,
      },
    },
  },
});
