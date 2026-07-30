// @ts-check
import tseslint from 'typescript-eslint'
import js from '@eslint/js'

/**
 * Loro ESLint config.
 *
 * The interesting parts are the last three blocks — they enforce architectural
 * rules that would otherwise rely on reviewer memory:
 *   1. Layer boundaries in the mobile app   (docs/architecture/mobile-app.md#layers)
 *   2. No colour literals                   (ADR-0013)
 *   3. No tokens in insecure storage        (docs/architecture/security-privacy.md)
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
            'packages/design-tokens/vitest.config.ts',
            'packages/content/vitest.config.ts',
            'apps/api/vitest.config.ts',
            'apps/mobile/vitest.config.ts',
            'apps/mobile/app.config.ts',
            'apps/mobile/index.js',
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

  // ── 1 · Layer boundaries (docs/architecture/mobile-app.md#layers) ──
  // A layer may only import from layers below it.
  {
    files: ['apps/mobile/src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/**', '**/engines/**', '**/domain/**', '**/data/**'],
              message:
                'src/ui must not import from above it. A component that knows what a phrase is belongs in src/ui/components with domain types only, or in src/features.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/mobile/src/engines/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/**', '**/ui/**', 'react', 'react-native'],
              message: 'Engines are headless. They must be unit-testable without a renderer.',
            },
            {
              group: ['**/platform/**'],
              message:
                'Engines receive capabilities through EngineContext, never by importing a platform module.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/mobile/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/**', '**/ui/**', '**/engines/**'],
              message: 'Domain services sit below features, ui, and engines.',
            },
          ],
        },
      ],
    },
  },

  // ── 2 · No colour literals (ADR-0013), and one clock (plans/01) ──
  // `app/**` too, not just `src/**`: the expo-router screens are where a literal is
  // most tempting and least visible in review.
  //
  // NOTE: `no-restricted-syntax` is replaced wholesale by the last config that matches
  // a file, not merged. The Math.random selector from the base block is repeated here
  // for that reason — dropping it would silently unrestrict `Math.random` across the
  // whole app.
  {
    files: ['apps/mobile/{app,src}/**/*.{ts,tsx}'],
    ignores: ['apps/mobile/src/ui/tokens/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message:
            'Use a design token, not a colour literal. Tokens encode the accessibility rules (accentInk for text, never accent).',
        },
        {
          // Hex was the only form this rule caught, so `rgba(191,87,34,0.07)` — which is
          // exactly `accent.tint` — sat hardcoded in five screens and the sheet scrim in a
          // sixth, invisible to the gate. Every one was a SELECTED state, so under F-05 all
          // four accent themes would have changed and those six would have stayed coral.
          // See plans/48 §3 and plans/52.
          selector: 'Literal[value=/^(?:rgb|rgba|hsl|hsla)\\(/]',
          message:
            'Use a design token, not a colour literal. The accent alpha overlays are accent.tint / tint2 / tintBorder, and the sheet backdrop is surface.scrim.',
        },
        {
          // `transparent` is deliberately absent: it is the absence of a colour, not a
          // value that could drift from the palette.
          selector:
            'Literal[value=/^(?:white|black|red|green|blue|gray|grey|yellow|orange|purple|pink|brown|cyan|magenta|silver|gold|teal|navy|olive|maroon|lime|aqua|fuchsia)$/i]',
          message:
            'Use a design token, not a named CSS colour. `transparent` is the one permitted keyword.',
        },
        {
          selector: 'MemberExpression[object.name="Math"][property.name="random"]',
          message: 'Use an injected, seeded RNG. Engines and core logic must be deterministic.',
        },
        {
          // The exact bug: `toISOString()` is UTC, so slicing it yields a UTC date for
          // a value the Clock contract says is LOCAL. Off by up to 14 hours, and
          // invisible in a CI container running UTC.
          selector:
            'CallExpression[callee.property.name="slice"][callee.object.callee.property.name="toISOString"]',
          message:
            'toISOString() is UTC. For a learner-facing day use clock.localDay() (or clock.streakDay()) — see apps/mobile/src/lib/clock.ts.',
        },
        {
          // One place constructs a Date, so there is one place to get timezones wrong.
          // src/lib/clock.ts is exempted by the block below.
          selector: 'NewExpression[callee.name="Date"]',
          message:
            'Construct dates only in src/lib/clock.ts. Read the day from clock.localDay() / clock.streakDay(), and the time from clock.now().',
        },
      ],
    },
  },
  {
    // The exemption, and the reason this file is worth keeping small.
    files: ['apps/mobile/src/lib/clock.ts', 'apps/mobile/src/lib/clock.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message:
            'Use a design token, not a colour literal. Tokens encode the accessibility rules (accentInk for text, never accent).',
        },
        {
          selector: 'Literal[value=/^(?:rgb|rgba|hsl|hsla)\\(/]',
          message:
            'Use a design token, not a colour literal. The accent alpha overlays are accent.tint / tint2 / tintBorder, and the sheet backdrop is surface.scrim.',
        },
        {
          selector:
            'Literal[value=/^(?:white|black|red|green|blue|gray|grey|yellow|orange|purple|pink|brown|cyan|magenta|silver|gold|teal|navy|olive|maroon|lime|aqua|fuchsia)$/i]',
          message:
            'Use a design token, not a named CSS colour. `transparent` is the one permitted keyword.',
        },
        {
          selector: 'MemberExpression[object.name="Math"][property.name="random"]',
          message: 'Use an injected, seeded RNG. Engines and core logic must be deterministic.',
        },
      ],
    },
  },

  // ── 3 · No tokens in insecure storage (docs/architecture/security-privacy.md) ──
  {
    files: ['apps/mobile/{app,src}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@react-native-async-storage/async-storage',
              message:
                'Never store tokens or credentials here. Use expo-secure-store (Keychain / Keystore).',
            },
          ],
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
    files: ['**/scripts/**', '**/src/validate.ts', '**/src/generate.ts', '**/src/checkContrast.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // ── Build and tool configs ──
  // They're linted against the default project, which has no strictNullChecks, so
  // the type-aware rules can't run. Syntax rules still apply.
  {
    files: ['**/*.config.{ts,mjs,js}', 'apps/mobile/index.js'],
    ...tseslint.configs.disableTypeChecked,
  },
)
