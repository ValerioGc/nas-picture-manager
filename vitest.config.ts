import { defineConfig } from 'vitest/config';
import { commonConfig } from './vite.config.common.ts';

export default defineConfig({
  ...commonConfig,
  test: {
    environmentOptions: { jsdom: { pretendToBeVisual: true } },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: ['src/tests/setup.ts'],
          include: ['src/tests/unit/**/*.unit.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          setupFiles: ['src/tests/setup.ts'],
          environment: 'jsdom',
          include: ['src/tests/component/**/*.component.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'conventions',
          environment: 'node',
          include: ['src/tests/scripts/**/*.spec.{ts,mjs}'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/tests/**', 'src/main.ts', 'src/types/**', 'src/**/*.d.ts'],
      thresholds: { lines: 80, perFile: true },
    },
  },
});
