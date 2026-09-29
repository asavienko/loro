// @ts-check
import tseslint from 'typescript-eslint'
import js from '@eslint/js'

/**
 * Loro ESLint config.
 *
 * The repository gate for the backend packages and scripts. The app (apps/mobile) has its
 * own config, apps/mobile/eslint.config.mjs, and its own `lint` script.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/target/**',
      '**/.expo/**',
      '**/bindings/**',
      '**/browser/loro_core.js',
      'apps/mobile/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Tool configs sit outside the package tsconfigs. Lint them against the
          // default project rather than widening every tsconfig's `include`.
          // Note: allowDefaultProject rejects '**', so these are enumerated.
          allowDefaultProject: [
            'eslint.config.mjs',
            'packages/core/vitest.config.ts',
            'packages/content/vitest.config.ts',
            'apps/api/vitest.config.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      // `process.env['PORT']`, `row.fields['reps']` — these are index-signature
      // lookups, not declared fields. Bracket notation says so at a glance, and pairs
      // with `noUncheckedIndexedAccess`: the result is `T | undefined` and the code
      // has to handle that. Dot notation would make them read like real properties.
      '@typescript-eslint/dot-notation': ['error', { allowIndexSignaturePropertyAccess: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // `${count} phrases` is idiomatic and safe. The default (strings only) is noise.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: false, allowNullish: false, allowAny: false },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-restricted-syntax': [
        'error',
        {
          // Tests and engines must be deterministic. See practice-engines.md#conformance.
          selector: 'MemberExpression[object.name="Math"][property.name="random"]',
          message: 'Use an injected, seeded RNG. Engines and core logic must be deterministic.',
        },
      ],
    },
  },

  // ── Tests may relax a few rules ──
  {
    files: ['**/*.test.{ts,tsx}', '**/testing/**', '**/e2e/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      'no-console': 'off',
    },
  },

  // ── CLIs: stdout IS the output ──
  {
    files: [
      '**/scripts/**',
      '**/src/validate.ts',
      '**/src/generate.ts',
      '**/src/checkContrast.ts',
      '**/src/renderCli.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },

  // ── Build and tool configs ──
  // They're linted against the default project, which has no strictNullChecks, so
  // the type-aware rules can't run. Syntax rules still apply.
  {
    files: ['**/*.config.{ts,mjs,js}'],
    ...tseslint.configs.disableTypeChecked,
  },
)
