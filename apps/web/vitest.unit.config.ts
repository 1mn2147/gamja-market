import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['app/**/*.unit.spec.ts?(x)'], globals: true, passWithNoTests: true } });
