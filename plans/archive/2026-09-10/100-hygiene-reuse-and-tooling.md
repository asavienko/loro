# Hygiene, reuse and developer tooling

- **Requirement IDs:** `F-02`, `F-03`, `F-04` (foundation hygiene that keeps those invariants cheap
  to extend); NAV consistency only where a second call site already exists
- **Milestone:** M1 hygiene; runs in parallel with remaining product plans
- **Status:** ✅ Slices 1–10 landed on `cursor/hygiene-reuse-plan-a2fa` (`142342c`). `pnpm check` is
  green. Focused Field/ListRow E2E passed (`account`, `add`, `navigation` More/Settings, `music`; 27
  tests) and `pnpm test:e2e:workbench` (5 tests). UniFFI `--check` matched committed `bindings/`
  with host `libloro_core.so` present. A throwaway raw `TextInput` under `src/dev-tools` fails
  ESLint; `copyOwnership.test.ts` still passes. Pre-commit runs lint-staged after Gitleaks. Browser
  walkthrough covered Discover/Tagging/Import Fields, More/Settings/Music ListRows, and Workbench
  Search tokens. Account email Field is covered by mocked E2E; this host hides it when sign-in is
  unavailable. Native Field focus / TalkBack stay with plans 58/56.
- **Depends on:** the 2026-09-09 reviews as inventory (do not redo A–G); does **not** wait on
  Q-gates or device acceptance
- **Number allocation:** 100. Main landed the listening companion as 99 (AS-07) while this plan was
  still on a branch under the same number. Hygiene takes the next free ID. Plan 101 is the
  phrase-relation graph; the next new plan is 102.

## Outcome

The next fifteen learner screens, and the remaining utilities, are cheaper to land **without** a
rewrite: inputs and list rows share one primitive each; composites are imported one way; leftover
doc drift from screens that landed after the September reviews is patched; agents and humans get the
same recipes for a new route, copy section, E2E state and `applyDelta` write; UniFFI bindings gain a
regenerate-and-diff `--check` like WASM already has; pre-commit actually runs the lint-staged config
that is already in `package.json`; bootstrap warns when Gitleaks is missing.

This plan owns **cross-cutting hygiene** that has no product owner. It does not implement screens
9–23, widgets, DSP, production audio, billing, live Claude, or device acceptance.

## Review — 2026-09-10 (extend)

Re-audited the working tree after the plan landed (`e1dc9ff` on `cursor/hygiene-reuse-plan-a2fa`,
base `70a8ecc`). The first draft was directionally right and too narrow on tools, too loose on
ListRow, and stale on slice 2.

### Add

| Item                                                          | Why it was missing                                                                                                                                                          | Slice |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Wire `lint-staged` into `.husky/pre-commit` after Gitleaks    | Config exists in root `package.json`; the hook is Gitleaks-only. Every commit we make skips eslint/prettier/rustfmt on the staged set.                                      | 10    |
| `bootstrap.sh` warns when `gitleaks` is missing               | Same class as the watchman warning. This checkout could not commit until Gitleaks was installed. `onboarding.md` never mentions it.                                         | 10    |
| Exclude the active-plan roadmap table from Prettier           | `prettier --write plans/README.md` reflows every row when one cell grows. Protect the table with a `prettier-ignore` (or omit that file from the lint-staged md glob).      | 10    |
| `scripts/check-plan-index.mjs` in `pnpm check`                | `context.mjs` reports the highest ID; nothing fails if README still says “next is N” or a top-level `plans/NN-*.md` has no row. Same shape as `check-routes.mjs`.           | 11    |
| Cursor rule `.cursor/rules/loro-hygiene.mdc`                  | Snippets help humans in the editor; agents load rules. Encode extract-at-two-sites, no raw `TextInput`, `useLocale` when reading `copy`, `applyDelta` only.                 | 6     |
| `listRow` token in `src/ui/tokens/control.ts`                 | 48 / 13 / hairline is already a third call site. `sizing.ts` says a value used twice gets a name. The primitive consumes the token; `controlStyle.test.ts` pins the pixels. | 4     |
| Field/ListRow unit tests in the Chip/Segmented style          | `controlStyle.test.ts` exists specifically so extracts cannot round 11→12. New primitives need the same pin.                                                                | 3–4   |
| `fillField(page, name, value)` in `e2e/helpers`               | Account, Add, Import and Workbench all `getByRole('textbox')`. One helper after Field so a11y name is the contract.                                                         | 3     |
| i18n triple-file snippet (`en.json` / `bg.json` / `ru.json`)  | Copy sections without the three resources fail F-08 at runtime for bg/ru.                                                                                                   | 6     |
| `useLocale()` recipe                                          | Not a refactor. Every component that reads `copy.*` must subscribe (`useTranslation`). Do not “hoist” it into `Screen` — children would go stale.                           | 6     |
| TaggingSheet target/meaning `TextInput`s in the Field extract | `add.tsx` 611 and 623 were omitted. Discover search is not the only Add input.                                                                                              | 3     |
| Workbench token search as a Field call site                   | `src/dev-tools/Workbench.tsx` 545. Not under `app/`, so an `app/**`-only ban would miss it.                                                                                 | 3, 8  |

### Remove / do not do

| Item the first draft implied or left open                    | Why it leaves                                                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Treat Stream `minHeight: 48` as a ListRow                    | `stream.tsx` 369–377 is the play **button**, not a hairline list row.                                                                       |
| Treat Account `methodButton` as a ListRow                    | `account.tsx` 850–857 is a bordered card (`MIN_TAP`, radius, fill). Different shape.                                                        |
| First-wave ListRow inside `NavigationMenu`                   | Same 13 / hairline, **no** 48 min-height; spine sheet E2E is load-bearing. Revisit only after ListRow exists and a specimen matches.        |
| Closable checkbox for “split account/Today as you touch”     | That is a working rule, not acceptance. It would stay unchecked forever.                                                                    |
| “Point the September reviews at this plan” as remaining work | Landed in the plan-creation commit (then numbered 99; now 100 after main’s listen companion).                                               |
| Consolidate `useLocale()` into `Screen`                      | Breaks reactive copy. Document, do not extract.                                                                                             |
| Shared padded `ScrollView` primitive                         | Eight screens use `padding: space['5']` but differ by inset, gap and `flexGrow`. Not one shape.                                             |
| Knip/depcheck as a gate                                      | Unchanged. `expo-font` / Reanimated / RNGH are capacity.                                                                                    |
| Permanent Workbench `TextInput` exemption                    | It is a real search field (`Search tokens`). It becomes Field. Tests that _assert_ a raw `TextInput` (`copyOwnership.test.ts`) stay exempt. |
| `$comment` in `package.json` as the unused-dep allowlist     | Easy to ignore. Hygiene skill + Cursor rule + this plan’s library table are the allowlist.                                                  |

### Modify

| First draft                                      | Change                                                                                                                                                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Four production surfaces” for Field             | **Six call-site groups:** Account email, Account code, Discover search, TaggingSheet target + meaning, Import paste + per-line fields, Workbench token search. One `Field` with optional clear / container border. Discover’s accent `Card` wraps it. |
| ListRow = Settings + More + Music + maybe others | **Exactly those three** in the first extract (48 / 13 / hairline). Gap is a prop (Settings `space['3']`, More/Music `space['2.5']`). Music bilingual lines and Settings marker stay children. Not listen-export.                                      |
| Ban raw `TextInput` in `app/**` only             | Ban in `apps/mobile/{app,src}/**` except `Field.tsx`, `copyOwnership.test.ts`, and `**/*.test.*`.                                                                                                                                                     |
| `check-reuse.mjs` optional                       | **Required after** Field/ListRow land. Counts raw `TextInput` and leftover **48/13/hairline** clusters (named or inlined), not every `ROW_PADDING = 13`.                                                                                              |
| Slice 2 = docs + review pointers                 | Review pointers done. Remainder is `/music` and `/dev/tokens` on the `mobile-app.md` route table — landed in this review commit.                                                                                                                      |
| Evidence HEAD `70a8ecc` only                     | Superseded by the listen-companion revision below (`266ddae` / `66bc7ad`).                                                                                                                                                                            |

## Review — 2026-09-10 (after main listen companion)

Re-audited `266ddae` on `cursor/hygiene-reuse-plan-a2fa` after merging `origin/main` (`66bc7ad`).
Main landed AS-07 as **plan 99** (`/listen-export`, `loro-audio-cache`, listening-class TTS). This
file stays **100**. Field call sites are unchanged. ListRow, `check-reuse`, the steal list and slice
9 were stale.

### Add

| Item                                                            | Why it was missing                                                                                                                                                          | Slice       |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Treat listen-export consent as **not** ListRow wave 1           | `listen-export.tsx` 442–454: `minHeight: MIN_TAP` (44) + `ROW_PADDING = 13` + hairline + checkbox. Plan 99. Same family as NavigationMenu, not the 48-px trio.              | 4 / do-not  |
| `check-reuse` matches the **48/13/hairline cluster**, not names | Settings inlined `minHeight: 48` / `paddingVertical: 13` (`settings.tsx` 206–212). A name-only scan misses Settings and flags listen-export / NavigationMenu `ROW_PADDING`. | 8           |
| ListRow `gap` is a **prop**, not a token                        | Settings uses `space['3']`; More and Music use `space['2.5']`. Token is only 48 / 13 / hairline. Do not snap gap.                                                           | 4           |
| `check-plan-index` allows **documented ID collisions**          | Two `96-*.md` files; 99 is listen; 100 is hygiene; next is 101. Fail if a top-level file has no row, or “next is N” is ≤ the highest ID.                                    | 11          |
| Keep `loro-audio-cache` (`@loro/native-audio-cache`)            | New local Expo module from plan 99. Not unused-dep cleanup.                                                                                                                 | library     |
| Record roadmap `prettier-ignore` as landed                      | `<!-- prettier-ignore -->` already sits above the remaining-roadmap table. Drop that sub-task from slice 9.                                                                 | 10 (landed) |

### Remove / do not do

| Item the earlier draft implied                        | Why it leaves                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Fold listen-export into ListRow wave 1                | 44 ≠ 48; consent checkbox; plan 99 owns the composer UX                                           |
| Split `listen-export.tsx` / `listenCompanion.ts` here | 468 / 407 lines; plan 99 as-you-touch, not a hygiene checkbox                                     |
| Touch listen generate/cache/`playFile`/Q-22 mux       | Plan 99 / 62. Hygiene does not change audio sessions                                              |
| Count any `ROW_PADDING = 13` as a ListRow leftover    | False positive on listen-export and NavigationMenu                                                |
| Re-list `/listen-export` as remaining slice-2 work    | Already on the `mobile-app.md` route table. `+not-found` stays omitted (`check-routes` skips `+`) |

### Modify

| Earlier claim                                        | Change                                                                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings uses named `MIN_ROW_HEIGHT` / `ROW_PADDING` | Settings inlined 48 / 13; still a wave-1 call site. More/Music still name the constants.                                                              |
| ListRow trio is “identical” including gap            | Shared shape is 48 / 13 / hairline only. Preserve each screen’s gap.                                                                                  |
| Slice 9 = prettier-ignore + lint-staged + gitleaks   | prettier-ignore done. Remaining: wire `lint-staged` after Gitleaks; warn in `bootstrap.sh` / `onboarding.md` (watchman is warned; Gitleaks is not).   |
| Steal 56/57/67/70/71/77/81                           | Also 96 (music fixture `globalThis.Audio`) and 99 (listen companion).                                                                                 |
| “thirty-eight other rows”                            | Active roadmap now has **40** remaining-work rows.                                                                                                    |
| Field “six call-site groups” after listen            | Rechecked: no listen `TextInput`. Lines unchanged — Account 585/651; Discover `add.tsx` 305; TaggingSheet 611/623; Import 227/297/308; Workbench 545. |
| Evidence HEAD `e1dc9ff` / `70a8ecc`                  | Inventory now `266ddae` after `origin/main` `66bc7ad`.                                                                                                |

## Relationship to the 2026-09-09 reviews

Three reviews already answered “what to refactor / which libraries / which practices” as
**document-only** work. They remain the inventory. This plan is the missing **execution owner** for
what they left as as-you-touch leftovers **plus** findings that appeared after `706858c` (music,
Discover garnish, unused Field, duplicated list-row geometry, no editor snippets, dead lint-staged).
The listen companion that landed on main is plan 99, not this plan.

| Companion                                                                                      | Still owns                                       | This plan does not redo                                                      |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| [Refactoring strategies](../../../docs/reviews/2026-09-09-refactoring-strategies.md)           | A–G sequence and 2026-09-10 extracts (landed)    | Dual maths, `current.ts`, typed store actions, column map, JWKS rename       |
| [Whole-project assessment](../../../docs/reviews/2026-09-09-project-improvement-assessment.md) | Keep / adopt / avoid matrix and ADR amendments   | ADR-0012 / 0008 amendments (landed); installing new product libraries        |
| [Native libraries](../../../docs/reviews/2026-09-09-native-libraries-and-approaches.md)        | Expo/RN keep-vs-adopt for speech, touch, widgets | Haptics, Maestro, keyboard-controller, Skia, FlashList, `expo-notifications` |

**Do not redo A–G.** Rechecked at `266ddae` (still true after the listen merge): `fakeRepository`
uses `isActive` / `isDue`; `fakeCore()` is fixture-sealed; production account/sync clients do not
import `api/target` (tests may); `PRODUCTION_WAVES` / `setStreamCursor` / `beginRefrainSession`
exist; Speak plans through `speakEngine` and documents the session as ephemeral; `syncableColumns`
sits next to `FIELD_POLICY`; legacy `/content` egress parses current `ManifestSchema` /
`PackSchema`; ADR-0012 is write-through projection; ADR-0008 is `pg` + SQL.

## Evidence

Inspected: largest TS/Rust modules, `src/ui/{primitives,components}`, every `TextInput` and
`MIN_ROW_HEIGHT` / `ROW_PADDING` / `minHeight: 48` site, package manifests vs app-source imports,
`eslint.config.mjs`, `scripts/`, `.husky/pre-commit`, root `lint-staged`, `.prettierignore`,
`.agents/skills/`, `.cursor/`, `e2e/helpers` and textbox locators, `docs/architecture/mobile-app.md`
route table, `bootstrap.sh`, `listen-export.tsx`, `listenCompanion.ts`. Not a device run.

### Cleanliness — what is left

| Finding                                                       | Evidence                                                                                                                                                                                   | Owner                                                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Oversized routes/tests that survived the 2026-09-10 split     | `account.tsx` 881, `persistence.test.ts` 1170, `sync.service.test.ts` 806, `sync.test.ts` 787, `add.tsx` 758, `index.tsx` 662, `refrain.tsx` 653, `onboarding.tsx` 574, `progress.tsx` 508 | **Working rule**, not a checkbox. `account.tsx` waits on plan 67. Today `DayRow` / `NavRail` wait on 56/81. `WarmingCard` waits on Q-14. |
| UniFFI has no regenerate-and-diff `--check`                   | WASM `embed-wasm.mjs --check` exists; `packages/core-rs/build.sh` generates Swift/Kotlin and only strips trailing whitespace                                                               | **This plan** (slice 7)                                                                                                                  |
| `lint-staged` never runs                                      | Root `package.json` 76–90; `.husky/pre-commit` is Gitleaks only. Assessment already recorded this.                                                                                         | **This plan** (slice 10)                                                                                                                 |
| Gitleaks absent from bootstrap / onboarding                   | `bootstrap.sh` warns for watchman, not Gitleaks. Pre-commit hard-fails without it.                                                                                                         | **This plan** (slice 10)                                                                                                                 |
| Speak session is React state                                  | `speak.tsx` comment: ephemeral until a named plan owns interruption resume                                                                                                                 | **Not this plan.** Do not invent resume.                                                                                                 |
| `core-rs` `merge.rs` / `select.rs` / `scheduler.rs` are large | 716 / 652 / 546                                                                                                                                                                            | **Not this plan.** Complexity in the right crate (ADR-0002).                                                                             |
| Music uses `globalThis.Audio` for fixture playback            | `music.tsx` ~206                                                                                                                                                                           | **Plan 96.** One audio session is 62; do not “fix” garnish playback here.                                                                |
| Listen companion route and composer are large                 | `listen-export.tsx` 468, `listenCompanion.ts` 407                                                                                                                                          | **Plan 99.** Do not split or restyle from this plan.                                                                                     |

### Consistency — what is left

| Finding                                      | Evidence                                                                                                                                                                                                                                                                                                              | Owner                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Composites imported two ways                 | Barrel: `ActionBar`, `EmptyState`, `PhraseRow`, … Path imports: `LanguageChoices`, `AudioControls`, `NavigationMenu` (`languages.tsx`, `onboarding.tsx`, `speak.tsx`, `phrase/[id].tsx`, `_layout.tsx`)                                                                                                               | **This plan**                                                                    |
| Raw `TextInput` in six call-site groups      | Account email + code; Discover search (`add.tsx` 305); TaggingSheet target + meaning (`add.tsx` 611, 623); Import paste + line fields; Workbench token search; `copyOwnership.test.ts` is a fixture                                                                                                                   | **This plan** — second-call-site rule already broken                             |
| List-row geometry copied three times         | Settings inlines `minHeight: 48` + `paddingVertical: 13` + hairline (`settings.tsx` 206–212, gap `space['3']`). More/Music name `MIN_ROW_HEIGHT`/`ROW_PADDING` and use gap `space['2.5']`. NavigationMenu and listen-export consent share 13/hairline only (44 px). Stream 48 is a play button. Account 13 is a card. | **This plan** (the 48-px trio only; gap stays a prop)                            |
| Tests still import `@loro/core/api/target`   | auth/sync/content tests and `contracts.e2e.test.ts`                                                                                                                                                                                                                                                                   | **Keep.** Roadmap assertions. Production clients already use `account` / `sync`. |
| `LocaleSchema` is the legacy `es-ES` literal | `LegacyLocaleSchema` alias already exists in `common.ts`                                                                                                                                                                                                                                                              | **As you touch** a multilingual import of `common.ts`. Do not widen.             |
| `mobile-app.md` route table                  | `/music`, `/listen-export` and `/dev/tokens` listed. `+not-found` omitted on purpose (`check-routes` skips `+`)                                                                                                                                                                                                       | **Landed** (slice 2)                                                             |

### Library use — living policy (do not install from this plan)

**Keep:** Expo SDK 54 + RN 0.81, Zustand write-through, OP-SQLite + sql.js, NestJS 11 + `pg`,
Rust/`loro-core` via UniFFI and WASM, Zod 4, custom tokens, Ajv 2020-12, pnpm 9 + Turborepo, Vitest,
Playwright, `pnpm ci:local`, local Expo modules `loro-core` / `loro-audio-speech` /
`loro-audio-cache`, `Pressable` + `usePullDown` + `Sheet`.

**Installed, unused in app source — leave until the named owner:**

| Package                        | App-source imports                                   | Owner                                        |
| ------------------------------ | ---------------------------------------------------- | -------------------------------------------- |
| `expo-font`                    | none (`useFonts` absent)                             | Plan 57                                      |
| `react-native-reanimated`      | none                                                 | Plan 57 / motion work                        |
| `react-native-gesture-handler` | none (router peer; practice `gestureEnabled: false`) | Plan 93 only if PanResponder fails on device |
| `expo-linking`                 | none in `app/` / `src/` (Router / config plugin)     | Plan 56 deep links                           |
| `expo-splash-screen`           | plugin in `app.config.ts` only                       | Plan 57 fonts / splash hold                  |

**Adopt next only with that owner:** `expo-haptics` after `motion.md` policy; keyboard-controller
with plan 56 input; Maestro under 58/72; `expo-notifications` with 70; Skia with 77; FlashList when
catalogs outgrow `ScrollView`. Install Expo modules with `npx expo install`. Pin Worklets at 0.5.1.

**Do not adopt:** Flutter/SwiftUI+Compose; Redux/MobX/Jotai/TanStack Query for learner state;
Tamagui/NativeBase/gluestack/NativeWind; client or “cleanup” server Drizzle/Prisma/Watermelon;
`ts-fsrs`; `expo-speech` / `expo-av` as the production graph; cloud ASR; Style Dictionary / Tokens
Studio; Supabase/Firebase; Passport; Redis/BullMQ/CDN in this testing phase; GitHub Actions as a
required gate; Biome/oxlint as an ESLint replacement (would drop layer/colour/clock rules); React
Native Testing Library as a **required** suite — optional, primitives only, when Field/ListRow land
(pin geometry in Vitest like `controlStyle.test.ts`).

### Reusable components — extract now vs wait

The rule in [`component-inventory.md`](../../../docs/design/component-inventory.md) is already
correct: one call site stays local; two or more and domain-free → `src/ui/primitives`; two or more
with domain types → `src/ui/components`. Store/copy stay out.

| Shape                                                          | Call sites today                                                                                                                                                      | Action                                                                                                                                                                                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authored `SearchField` / labelled field                        | Account email + code; Discover search; TaggingSheet two fields; Import paste + line edits; Workbench search. Blueprint: `design/.../components/forms/SearchField.jsx` | **Extract `Field`** in `src/ui/primitives`. Optional clear and container border. Discover’s accent `Card` wraps it. Pass every string. 44 px (`MIN_TAP`). Native + `aria-*`. No kit.                                         |
| Selectable / navigable list row                                | Settings `ChoiceRow`, More `DestinationRow`, Music phrase + style rows. Shared 48 / 13 / hairline; gap differs (`space['3']` vs `space['2.5']`)                       | **Extract `ListRow`** + `listRow` token. Domain-free slots, `selected`, role, **gap prop**. Settings marker and Music bilingual lines stay children. Not `PhraseRow`. Not NavigationMenu or listen-export consent in wave 1. |
| `LanguageChoices` / `AudioControls` / `NavigationMenu`         | 2+ each, imported by path                                                                                                                                             | Re-export from `src/ui/components/index.ts`; switch callers to the barrel                                                                                                                                                    |
| `EmptyState` / `PracticeEmptyState`                            | Already shared                                                                                                                                                        | Keep. Refrain’s two-title empty is intentionally not `EmptyState`                                                                                                                                                            |
| `ThemeGrid`, `TaggingSheet`, `WarmingCard`, `SignInFeedback`   | One each                                                                                                                                                              | **Wait.** Second caller or Q-14 / plan 67                                                                                                                                                                                    |
| Authored Spine / DayRow / NavRail / ExitSheet / TransportStrip | Partial / plan 81                                                                                                                                                     | **Plan 81.** Do not pre-build the catalog                                                                                                                                                                                    |
| Skia charts                                                    | None; Progress uses `bars.tsx`                                                                                                                                        | **Plan 77.** Pair with `ChartSummary` and real numbers                                                                                                                                                                       |
| Padded screen `ScrollView`                                     | Many `padding: space['5']` with different insets                                                                                                                      | **Do not extract**                                                                                                                                                                                                           |

`specimenContract.ts` must gain `Field` and `ListRow` in the same change as the primitives (the
workbench drift test fails closed if an export is missing).

### Reusable snippets — missing entirely

There is **no** `.vscode/` directory, no `*.code-snippets`, and no Cursor rule pack beyond
`.cursor/environment.json`. The only agent skill is
[`loro-development`](../../../.agents/skills/loro-development/SKILL.md), which points at references
but does not ship paste-ready recipes for the operations every new screen repeats.

This plan adds **checked-in** snippets, a Cursor rule, and a skill reference that encode the
enforced rules, not a second style guide.

| Snippet / recipe               | Must include                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New Expo Router screen         | `copy.*` only; `useLocale()`; `Screen` + primitives; no `new Date()`; `states.ts` row reminder; `navigation.ts` if it is a destination                 |
| New `copy/` section            | Barrel re-export; ICU keys in **en + bg + ru**; no literals in `app/`                                                                                  |
| New E2E `STATES` row           | `enter` / `click` / later `fillField`; coverage/a11y/text-scale come free                                                                              |
| New primitive                  | Dual `accessibilityState` + `aria-*`; tokens not colour literals; export from `primitives/index.ts`; workbench specimen + `PRODUCTION_COMPONENT_NAMES` |
| `applyDelta` / `engine.record` | Progress only through `ProgressDelta`; named store action, not `useApp.setState`                                                                       |
| SQLite upsert                  | `ON CONFLICT … DO UPDATE` over owned columns; never `INSERT OR REPLACE`; never touch `field_hlc` / `deleted_at`                                        |
| Shared Zod change              | Edit `packages/core/src/api/*`, `pnpm contracts:generate`, then implement                                                                              |
| Read `copy` in a component     | Call `useLocale()` in that component. Do not hoist.                                                                                                    |

### Useful tools — present vs missing

**Already healthy (do not replace):** `pnpm check` / `pnpm ci:local`; `check:copy`, `check:lang`,
`check:contrast`, `check:routes`; layer / colour / clock / AsyncStorage ESLint; `e2e/helpers`;
`context.mjs`; `archive-plan.mjs`; workbench specimen-contract drift; Gitleaks pre-commit;
`scripts/ci-local/*`; `controlStyle.test.ts` as the extract-pin pattern.

**Add under this plan:**

| Tool                                                                                            | Why                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UniFFI generate `--check` (or a porcelain diff after generate + whitespace normalize)           | WASM already fail-closed; bindings can drift silently                                                                                                                 |
| ESLint (or `check:fields`) banning raw `TextInput` in `app/` **and** `src/` once `Field` exists | Prevents the next screen — and Workbench — from hand-rolling another style                                                                                            |
| `scripts/check-reuse.mjs` **in `pnpm check` after extracts**                                    | Counts raw `TextInput` and leftover **48/13/hairline** list-row clusters (named or inlined). Ignore 13/hairline-only rows (NavigationMenu, listen-export)             |
| Wire `lint-staged` after Gitleaks in `.husky/pre-commit`                                        | The config already knows what to run; the hook never calls it                                                                                                         |
| `bootstrap.sh` + onboarding warn if `gitleaks` is missing                                       | Fail closed at setup, not at the first commit                                                                                                                         |
| Prettier-ignore for the active-plan roadmap table                                               | **Landed.** One cell change must not rewrite the other 39 remaining-work rows                                                                                         |
| `scripts/check-plan-index.mjs`                                                                  | README highest ID, “next is N” (must be highest+1), and a row per top-level `plans/NN-*.md`. Documented ID collisions (two 96s) are allowed when both files have rows |
| Skill reference `references/hygiene.md` + Cursor rule                                           | Extract-at-two-sites, Field/ListRow, snippet names, unused-dep allowlist, do-not-adopt                                                                                |
| `fillField` E2E helper                                                                          | Textbox accessible name is the Field contract                                                                                                                         |

**Do not add:** Knip/depcheck as a hard gate; Biome; a screen codegen CLI that fights Expo Router;
coverage thresholds; a shared padded-Scroll primitive; hoisting `useLocale`.

## Remaining work

1. [x] Land this plan, index row, CLAUDE “next is 101”, and review pointers.
2. [x] Docs: add `/music`, `/listen-export` and `/dev/tokens` to `mobile-app.md` current-route
       table.
3. [x] `Field` primitive replacing every raw learner/dev `TextInput` listed above. `listRow` is a
       later slice. Copy stays props. Existing textbox accessible names stay. Workbench specimen,
       inventory row, `PRODUCTION_COMPONENT_NAMES`, Vitest pin, `fillField` helper.
4. [x] `listRow` token + `ListRow` primitive for Settings, More and Music only (48 / 13 / hairline;
       gap is a prop). Children stay screen-specific. E2E names unchanged. Vitest pin like
       `controlStyle.test.ts`. Not NavigationMenu or listen-export consent.
5. [x] Barrel-export `LanguageChoices`, `AudioControls`, `NavigationMenu`; switch path imports. Keep
       the workbench source-drift test honest.
6. [x] Editor snippets (`.vscode/loro.code-snippets`), Cursor hygiene rule, and `loro-development`
       `references/hygiene.md` for the recipe table. No new learner-facing strings.
7. [x] UniFFI regenerate-and-diff `--check` wired into `pnpm check` / core-rs check, analogous to
       `embed-wasm.mjs --check`. Do not hand-edit bindings.
8. [x] Ban raw `TextInput` in `apps/mobile/{app,src}/**` (exemptions above). `check-reuse.mjs` in
       `pnpm check` (48/13/hairline cluster, not any `ROW_PADDING = 13`).
9. [x] Pre-commit and setup: run `lint-staged` after Gitleaks; warn on missing Gitleaks in
       `bootstrap.sh` / `onboarding.md`. Roadmap `prettier-ignore` already landed.
10. [x] `scripts/check-plan-index.mjs` + a `pnpm check` entry so ID / row / “next is N” cannot
        drift. Allow documented collisions (two 96s); require 99 listen + 100 hygiene; next is 101.

**Working rule (not a checkbox):** when a product owner already has `account.tsx`, persistence
tests, Today, onboarding, Progress, `listen-export.tsx` or `listenCompanion.ts` in the diff, split
along existing seams and extract only at the second call site. Do not open a folder-only `features/`
rewrite. Listen and music splits stay with 99 / 96.

## Acceptance criteria

- A contributor can add a labelled text field or a 48 px list row without copying Account/More
  styles.
- `apps/mobile/{app,src}/**` has no raw `react-native` `TextInput` after slices 3+8 except the
  listed test fixtures. Workbench search is a `Field`.
- Settings, More and Music share `ListRow` + `listRow` token geometry (48 / 13 / hairline); each
  keeps its current gap. Visible copy and roles stay as they are today. Stream play, Account
  provider tiles, NavigationMenu and the listen-export consent row are unchanged.
- Language/audio/navigation composites import from `src/ui/components` like the rest.
- `mobile-app.md` lists every built learner/utility route on disk, including garnish, listen
  companion and workbench. Expo `+` files (`+not-found`) stay omitted.
- Snippets, Cursor rule and the hygiene reference name the same rules ESLint already enforces (copy,
  `useLocale`, clock, tokens, `applyDelta`, dual a11y).
- `pnpm check` fails if UniFFI bindings were regenerated and not committed, the same way WASM embed
  already fails.
- `pnpm check` fails if a new top-level plan file has no README row, or the “next is N” sentence
  lags the highest ID.
- `git commit` of a dirty `.ts` file runs eslint/prettier via lint-staged after Gitleaks.
- `pnpm check` and focused mobile/E2E for the Field/ListRow slices stay green. Learner-visible
  strings and E2E locators are unchanged unless a bug is found.
- A–G behaviour is unchanged. No new product library. No simulated numbers. No PCM to JS.

## Commit sequence

1. `docs(docs): add 99 hygiene reuse and tooling (F-03)` — landed (file later became 100)
2. `docs(docs): extend 99 and list music/workbench routes (F-03)` — landed
3. `docs(docs): merge main listen companion; hygiene takes 100` — landed
4. `docs(docs): revise 100 after main listen companion (F-03)` — this review
5. `feat(mobile): add Field primitive and replace raw TextInputs (F-03)`
6. `feat(mobile): add ListRow token and share settings/more/music rows (F-03)`
7. `refactor(mobile): barrel-export remaining composites (F-03)`
8. `chore(docs): add loro snippets, cursor rule and hygiene skill (F-03)`
9. `chore(core-rs): add UniFFI generate --check (F-03)`
10. `chore(mobile): ban raw TextInput and add check-reuse (F-03)`
11. `chore(ci): run lint-staged and warn on missing gitleaks (F-03)`
12. `chore(docs): add plan-index drift check (F-03)`

Each commit leaves `pnpm check` green. Field/ListRow commits include the matching E2E (existing
locators), a workbench specimen and a Vitest pin. Do not mix a product screen into these commits.

## Out of scope / do-not

Unless a later device or operational failure produces evidence against the ADRs, do **not**:

- Redo A–G or re-amend ADR-0012 / 0008.
- Rewrite the app into `features/` / `domain/` / `platform/`, or abandon Expo.
- Replace Zustand; add TanStack Query for learner rows; implement `useLiveQuery`.
- Install Drizzle, Redis, Tamagui, NativeWind, `expo-speech`, `expo-av`, cloud ASR, or a CMS as
  cleanup.
- Delete unused `expo-font` / Reanimated / RNGH / `expo-linking` / `expo-splash-screen`, or float
  Worklets off 0.5.1.
- Wire `StreamEngine.plan()`, delete TS `calendar.ts`, put trips on the wire, unify `/me`, or
  promote `WarmingCard`.
- Checkpoint Speak, change wave lock, touch music fixture playback, or change listen generate /
  cache / `playFile` / Q-22 mux.
- Change learner-facing copy keys or E2E locators “while extracting”.
- Hand-edit `design-tokens/out/` or UniFFI bindings.
- Register Anthropic, enable billing, or archive remaining-work plans because this file exists.
- Steal plan 56/57/67/70/71/77/81/96/99 product slices.
- Hoist `useLocale`, extract a padded Scroll, or fold NavigationMenu / listen-export consent /
  Stream play / Account method tiles into the first ListRow.

## Verification

| Slice              | Gate                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan + indexes     | Links resolve; this file is plan 100; listen companion remains 99; CLAUDE “next is 101”                                                                                                              |
| Docs / route table | `mobile-app.md` lists `/music`, `/listen-export` and `/dev/tokens`; `git diff --check`                                                                                                               |
| Field / ListRow    | `pnpm --filter @loro/mobile` lint/typecheck/unit (including new pins); `pnpm test:e2e` for account, add, more, settings, music; `pnpm test:e2e:workbench`. Do not require listen-export E2E changes. |
| Barrel exports     | Mobile typecheck + workbench specimen contract                                                                                                                                                       |
| Snippets / skill   | Skill helper tests if the helper changes; otherwise link + recipe review                                                                                                                             |
| UniFFI `--check`   | `pnpm --filter @loro/core-rs` check path; do not require `ci:local:native`                                                                                                                           |
| TextInput lint     | ESLint on a fixture that imports `TextInput` in `app/` or `src/dev-tools` must fail; `copyOwnership.test.ts` still passes                                                                            |
| lint-staged        | A throwaway dirty `.ts` in a test repo, or a documented dry-run, shows eslint/prettier invoked after Gitleaks                                                                                        |
| Plan-index check   | Removing the 100 row from a copy of README fails; two 96 rows still pass; “next is 101” is required                                                                                                  |

Browser E2E does not prove native Field focus or TalkBack. That stays with plans 58/56.

## Open questions

1. **Search variant vs one `Field` with `leading` / `onClear`.** Recommendation unchanged: one
   primitive with optional clear and container border, so Discover’s accent-border Card can wrap it.
2. **ListRow vs promoting Settings `ChoiceRow`.** Recommendation unchanged: thin `ListRow`
   (Pressable + `listRow` token + slots). Settings keeps its marker as a child. Music bilingual
   lines are children, not a `PhraseRow`.
3. **UniFFI `--check` host library.** Unchanged: skip with an explicit message when
   `libloro_core.{so,dylib}` is absent; fail when it exists and bindings differ.
4. **lint-staged on `*.md` vs the roadmap table.** The `<!-- prettier-ignore -->` is already above
   the table. Keep it. Do not disable markdown Prettier repo-wide. Slice 9 no longer re-does this.
5. **NavigationMenu and listen-export consent, wave 2.** After ListRow + specimen exist, decide
   whether 13/hairline rows at `MIN_TAP` (44) should opt into the token without the 48 min-height.
   Not a blocker for wave 1. Plan 99 owns listen-export copy and behavior either way.
6. **`check-plan-index` vs ID collisions.** Recommendation: allow duplicate numeric prefixes only
   when the README collision note exists and **every** matching top-level file has a row. Do not
   invent a new number for archived account 96 or for listen 99.
