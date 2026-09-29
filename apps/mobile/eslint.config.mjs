// @ts-check
// The app's own lint. The repository config (../../eslint.config.mjs) is type-aware and strict for
// the backend packages; the app keeps the rules its code was written against.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', '.expo', '.expo-export', 'dist-web', 'android', 'ios', 'modules/*/build', 'modules/*/android/build'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Only the clock module may read the wall clock or build a Date.
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: 'Use src/shared/state/clock.ts; it is the only module that builds a Date.' },
        { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: 'Use clock.now() from src/shared/state/clock.ts.' },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/shared/state/clock.ts', 'scripts/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
