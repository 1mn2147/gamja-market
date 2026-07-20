import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { process: 'readonly', console: 'readonly', crypto: 'readonly' } }, ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/generated/**'] },
];
