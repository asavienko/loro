# Hygiene and reuse

Cross-cutting recipes for a new route, copy section, E2E state, primitive, and the writes ESLint
already owns. Product screens, audio, and accounts stay with their plans.
[Plan 100](../../../../plans/100-hygiene-reuse-and-tooling.md) is the execution owner.

Editor prefixes live in [`.vscode/loro.code-snippets`](../../../../.vscode/loro.code-snippets). The
Cursor rule is [`.cursor/rules/loro-hygiene.mdc`](../../../../.cursor/rules/loro-hygiene.mdc).

## Extract at two sites

One call site stays local to the route. Two or more and domain-free →
`apps/mobile/src/ui/primitives`. Two or more with domain types → `apps/mobile/src/ui/components`.
Shared UI never imports the store or `copy`.

| Shape                    | Use                                                                           | Do not                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Labelled text            | `Field` — optional `bordered`, `invalid`, `multiline`, `clearLabel`+`onClear` | Raw `TextInput` in `app/` or `src/`                                      |
| 48 / 13 / hairline row   | `ListRow` with a **gap prop**                                                 | NavigationMenu, listen-export consent, Stream play, Account method tiles |
| Language / audio / spine | Barrel `src/ui/components`                                                    | Path imports of `LanguageChoices`, `AudioControls`, `NavigationMenu`     |

`copyOwnership.test.ts` may import `TextInput` — it asserts the copy-ownership lint. Workbench token
search is a `Field`.

## Snippet prefixes

| Prefix           | Lands                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `loro-screen`    | Expo Router screen: `copy.*`, `useLocale()`, `Screen`, no `new Date()`, `states.ts` reminder |
| `loro-copy`      | `copy/*.ts` adapter; re-export from `copy.ts`                                                |
| `loro-i18n`      | One ICU key that must exist in **en + bg + ru**                                              |
| `loro-e2e-state` | `STATES` row using `click` / `fillField`                                                     |
| `loro-primitive` | Dual a11y, tokens, barrel + `PRODUCTION_COMPONENT_NAMES` + specimen                          |
| `loro-delta`     | `engine.record` then `applyDelta`                                                            |
| `loro-upsert`    | `ON CONFLICT … DO UPDATE`; never `INSERT OR REPLACE`                                         |
| `loro-zod`       | Edit `packages/core/src/api/*`, `pnpm contracts:generate`, then implement                    |
| `loro-locale`    | `useLocale()` in the component that reads `copy`                                             |

## Unused-dep allowlist

Installed, unused in app source — leave until the named owner. Do not delete from this plan.

| Package                                         | Owner                                                     |
| ----------------------------------------------- | --------------------------------------------------------- |
| `expo-font`                                     | Plan 57                                                   |
| `react-native-reanimated`                       | Plan 57 / motion                                          |
| `react-native-gesture-handler`                  | Router peer; plan 93 only if PanResponder fails on device |
| `expo-linking`                                  | Plan 56 deep links                                        |
| `expo-splash-screen`                            | Plan 57 fonts / splash hold                               |
| `loro-audio-cache` (`@loro/native-audio-cache`) | Plan 99 — keep                                            |

`$comment` in `package.json` is not the allowlist.

## Do not adopt from hygiene

Flutter/SwiftUI+Compose; Redux/MobX/Jotai/TanStack Query for learner state;
Tamagui/NativeBase/gluestack/NativeWind; client or cleanup-server Drizzle/Prisma/Watermelon;
`ts-fsrs`; `expo-speech` / `expo-av` as the production graph; cloud ASR; Style Dictionary;
Supabase/Firebase; Passport; Redis/BullMQ/CDN in this testing phase; GitHub Actions as a required
gate; Biome/oxlint as an ESLint replacement; React Native Testing Library as a **required** suite.
Optional primitive-only RNTL is allowed when a Vitest pin already exists (`controlStyle.test.ts`).

Do not hoist `useLocale` into `Screen`. Do not extract a padded `ScrollView`. Do not add
Knip/depcheck as a hard gate.

## Tool gates this plan owns

| Gate                                               | Fails when                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `Field` / `ListRow` + `controlStyle.test.ts`       | A pixel on those shapes rounds or a token colour is replaced by a literal                |
| ESLint `TextInput` ban + `scripts/check-reuse.mjs` | A new raw input, or a leftover **48/13/hairline** cluster (not every `ROW_PADDING = 13`) |
| `packages/core-rs` UniFFI `--check`                | Host `libloro_core` exists and generated Swift/Kotlin/H differ from `bindings/`          |
| `scripts/check-plan-index.mjs`                     | A top-level `plans/NN-*.md` has no README row, or “next is N” ≤ the highest ID           |
| `.husky/pre-commit`                                | Gitleaks missing/fails, or lint-staged eslint/prettier/rustfmt fails on the staged set   |
