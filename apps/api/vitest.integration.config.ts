import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['test/**/*.integration.spec.ts'], globals: true, testTimeout: 30_000, fileParallelism: false } });
