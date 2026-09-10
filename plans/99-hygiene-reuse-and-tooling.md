# Hygiene, reuse and developer tooling

- **Requirement IDs:** `F-02`, `F-03`, `F-04` (foundation hygiene that keeps those invariants cheap
  to extend); NAV consistency only where a second call site already exists
- **Milestone:** M1 hygiene; runs in parallel with remaining product plans
- **Status:** — Reviewed and extended 2026-09-10. Slices 1–2 (plan + route-table docs) landed.
  Field, ListRow, barrel, snippets and tool gates have not started. Nothing external blocks them.
  Product-owned extracts stay with their owners.
- **Depends on:** the 2026-09-09 reviews as inventory (do not redo A–G); does **not** wait on
  Q-gates or device acceptance
- **Number allocation:** 99 follows inspection of active, archived and concurrent plan files.
  Highest tracked ID was 98. The next new plan is 100.

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

| Item the first draft implied or left open                  | Why it leaves                                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Treat Stream `minHeight: 48` as a ListRow                  | `stream.tsx` 369–377 is the play **button**, not a hairline list row.                                                                       |
| Treat Account `methodButton` as a ListRow                  | `account.tsx` 850–857 is a bordered card (`MIN_TAP`, radius, fill). Different shape.                                                        |
| First-wave ListRow inside `NavigationMenu`                 | Same 13 / hairline, **no** 48 min-height; spine sheet E2E is load-bearing. Revisit only after ListRow exists and a specimen matches.        |
| Closable checkbox for “split account/Today as you touch”   | That is a working rule, not acceptance. It would stay unchecked forever.                                                                    |
| “Point the September reviews at plan 99” as remaining work | Landed in the plan-creation commit.                                                                                                         |
| Consolidate `useLocale()` into `Screen`                    | Breaks reactive copy. Document, do not extract.                                                                                             |
| Shared padded `ScrollView` primitive                       | Eight screens use `padding: space['5']` but differ by inset, gap and `flexGrow`. Not one shape.                                             |
| Knip/depcheck as a gate                                    | Unchanged. `expo-font` / Reanimated / RNGH are capacity.                                                                                    |
| Permanent Workbench `TextInput` exemption                  | It is a real search field (`Search tokens`). It becomes Field. Tests that _assert_ a raw `TextInput` (`copyOwnership.test.ts`) stay exempt. |
| `$comment` in `package.json` as the unused-dep allowlist   | Easy to ignore. Hygiene skill + Cursor rule + this plan’s library table are the allowlist.                                                  |

### Modify

| First draft                                      | Change                                                                                                                                                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Four production surfaces” for Field             | **Six call-site groups:** Account email, Account code, Discover search, TaggingSheet target + meaning, Import paste + per-line fields, Workbench token search. One `Field` with optional clear / container border. Discover’s accent `Card` wraps it. |
| ListRow = Settings + More + Music + maybe others | **Exactly those three** in the first extract (identical `MIN_ROW_HEIGHT = 48`, `ROW_PADDING = 13`, hairline). Music bilingual lines and Settings marker stay children.                                                                                |
| Ban raw `TextInput` in `app/**` only             | Ban in `apps/mobile/{app,src}/**` except `Field.tsx`, `copyOwnership.test.ts`, and `**/*.test.*`.                                                                                                                                                     |
| `check-reuse.mjs` optional                       | **Required after** Field/ListRow land. Counts raw `TextInput` and leftover `MIN_ROW_HEIGHT` / `ROW_PADDING` literals outside the token/primitive.                                                                                                     |
| Slice 2 = docs + review pointers                 | Review pointers done. Remainder is `/music` and `/dev/tokens` on the `mobile-app.md` route table — landed in this review commit.                                                                                                                      |
| Evidence HEAD `70a8ecc` only                     | Base inventory still `70a8ecc`; review addenda from `e1dc9ff` working tree.                                                                                                                                                                           |

## Relationship to the 2026-09-09 reviews

Three reviews already answered “what to refactor / which libraries / which practices” as
**document-only** work. They remain the inventory. This plan is the missing **execution owner** for
what they left as as-you-touch leftovers **plus** findings that appeared after `706858c` (music,
Discover garnish, unused Field, duplicated list-row geometry, no editor snippets, dead lint-staged).

| Companion                                                                                | Still owns                                       | This plan does not redo                                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| [Refactoring strategies](../docs/reviews/2026-09-09-refactoring-strategies.md)           | A–G sequence and 2026-09-10 extracts (landed)    | Dual maths, `current.ts`, typed store actions, column map, JWKS rename       |
| [Whole-project assessment](../docs/reviews/2026-09-09-project-improvement-assessment.md) | Keep / adopt / avoid matrix and ADR amendments   | ADR-0012 / 0008 amendments (landed); installing new product libraries        |
| [Native libraries](../docs/reviews/2026-09-09-native-libraries-and-approaches.md)        | Expo/RN keep-vs-adopt for speech, touch, widgets | Haptics, Maestro, keyboard-controller, Skia, FlashList, `expo-notifications` |

**Do not redo A–G.** Rechecked at `70a8ecc` / `e1dc9ff`: `fakeRepository` uses `isActive` / `isDue`;
`fakeCore()` is fixture-sealed; production account/sync clients do not import `api/target` (tests
may); `PRODUCTION_WAVES` / `setStreamCursor` / `beginRefrainSession` exist; Speak plans through
`speakEngine` and documents the session as ephemeral; `syncableColumns` sits next to `FIELD_POLICY`;
legacy `/content` egress parses current `ManifestSchema` / `PackSchema`; ADR-0012 is write-through
projection; ADR-0008 is `pg` + SQL.

## Evidence

Inspected: largest TS/Rust modules, `src/ui/{primitives,components}`, every `TextInput` and
`MIN_ROW_HEIGHT` / `ROW_PADDING` / `minHeight: 48` site, package manifests vs app-source imports,
`eslint.config.mjs`, `scripts/`, `.husky/pre-commit`, root `lint-staged`, `.prettierignore`,
`.agents/skills/`, `.cursor/`, `e2e/helpers` and textbox locators, `docs/architecture/mobile-app.md`
route table, `bootstrap.sh`. Not a device run.

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

### Consistency — what is left

| Finding                                      | Evidence                                                                                                                                                                                                | Owner                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Composites imported two ways                 | Barrel: `ActionBar`, `EmptyState`, `PhraseRow`, … Path imports: `LanguageChoices`, `AudioControls`, `NavigationMenu` (`languages.tsx`, `onboarding.tsx`, `speak.tsx`, `phrase/[id].tsx`, `_layout.tsx`) | **This plan**                                                                    |
| Raw `TextInput` in six call-site groups      | Account email + code; Discover search (`add.tsx` 305); TaggingSheet target + meaning (`add.tsx` 611, 623); Import paste + line fields; Workbench token search; `copyOwnership.test.ts` is a fixture     | **This plan** — second-call-site rule already broken                             |
| List-row geometry copied three times         | Identical `MIN_ROW_HEIGHT = 48` + `ROW_PADDING = 13` + hairline in `settings.tsx`, `more.tsx`, `music.tsx`. `NavigationMenu` shares 13/hairline only. Stream 48 is a play button. Account 13 is a card. | **This plan** (three identical rows only)                                        |
| Tests still import `@loro/core/api/target`   | auth/sync/content tests and `contracts.e2e.test.ts`                                                                                                                                                     | **Keep.** Roadmap assertions. Production clients already use `account` / `sync`. |
| `LocaleSchema` is the legacy `es-ES` literal | `LegacyLocaleSchema` alias already exists in `common.ts`                                                                                                                                                | **As you touch** a multilingual import of `common.ts`. Do not widen.             |
| `mobile-app.md` route table                  | `/music` and `/dev/tokens` added in this review commit                                                                                                                                                  | **Landed** (slice 2)                                                             |

### Library use — living policy (do not install from this plan)

**Keep:** Expo SDK 54 + RN 0.81, Zustand write-through, OP-SQLite + sql.js, NestJS 11 + `pg`,
Rust/`loro-core` via UniFFI and WASM, Zod 4, custom tokens, Ajv 2020-12, pnpm 9 + Turborepo, Vitest,
Playwright, `pnpm ci:local`, local Expo modules `loro-core` / `loro-audio-speech`, `Pressable` +
`usePullDown` + `Sheet`.

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

The rule in [`component-inventory.md`](../docs/design/component-inventory.md) is already correct:
one call site stays local; two or more and domain-free → `src/ui/primitives`; two or more with
domain types → `src/ui/components`. Store/copy stay out.

| Shape                                                          | Call sites today                                                                                                                                                      | Action                                                                                                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authored `SearchField` / labelled field                        | Account email + code; Discover search; TaggingSheet two fields; Import paste + line edits; Workbench search. Blueprint: `design/.../components/forms/SearchField.jsx` | **Extract `Field`** in `src/ui/primitives`. Optional clear and container border. Discover’s accent `Card` wraps it. Pass every string. 44 px (`MIN_TAP`). Native + `aria-*`. No kit.  |
| Selectable / navigable list row                                | Settings `ChoiceRow`, More `DestinationRow`, Music phrase + style rows. Shared 48 / 13 / hairline                                                                     | **Extract `ListRow`** + `listRow` token. Domain-free slots, `selected`, role. Settings marker and Music bilingual lines stay children. Not `PhraseRow`. Not NavigationMenu in wave 1. |
| `LanguageChoices` / `AudioControls` / `NavigationMenu`         | 2+ each, imported by path                                                                                                                                             | Re-export from `src/ui/components/index.ts`; switch callers to the barrel                                                                                                             |
| `EmptyState` / `PracticeEmptyState`                            | Already shared                                                                                                                                                        | Keep. Refrain’s two-title empty is intentionally not `EmptyState`                                                                                                                     |
| `ThemeGrid`, `TaggingSheet`, `WarmingCard`, `SignInFeedback`   | One each                                                                                                                                                              | **Wait.** Second caller or Q-14 / plan 67                                                                                                                                             |
| Authored Spine / DayRow / NavRail / ExitSheet / TransportStrip | Partial / plan 81                                                                                                                                                     | **Plan 81.** Do not pre-build the catalog                                                                                                                                             |
| Skia charts                                                    | None; Progress uses `bars.tsx`                                                                                                                                        | **Plan 77.** Pair with `ChartSummary` and real numbers                                                                                                                                |
| Padded screen `ScrollView`                                     | Many `padding: space['5']` with different insets                                                                                                                      | **Do not extract**                                                                                                                                                                    |

`specimenContract.ts` must gain `Field` and `ListRow` in the same change as the primitives (the
workbench drift test fails closed if an export is missing).

### Reusable snippets — missing entirely

There is **no** `.vscode/` directory, no `*.code-snippets`, and no Cursor rule pack beyond
`.cursor/environment.json`. The only agent skill is
[`loro-development`](../.agents/skills/loro-development/SKILL.md), which points at references but
does not ship paste-ready recipes for the operations every new screen repeats.

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

| Tool                                                                                            | Why                                                                                                       |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| UniFFI generate `--check` (or a porcelain diff after generate + whitespace normalize)           | WASM already fail-closed; bindings can drift silently                                                     |
| ESLint (or `check:fields`) banning raw `TextInput` in `app/` **and** `src/` once `Field` exists | Prevents the next screen — and Workbench — from hand-rolling another style                                |
| `scripts/check-reuse.mjs` **in `pnpm check` after extracts**                                    | Counts raw `TextInput` and leftover `MIN_ROW_HEIGHT` / `ROW_PADDING` literals outside the token/primitive |
| Wire `lint-staged` after Gitleaks in `.husky/pre-commit`                                        | The config already knows what to run; the hook never calls it                                             |
| `bootstrap.sh` + onboarding warn if `gitleaks` is missing                                       | Fail closed at setup, not at the first commit                                                             |
| Prettier-ignore (or lint-staged exclude) for the active-plan roadmap table                      | One cell change must not rewrite thirty-eight other rows                                                  |
| `scripts/check-plan-index.mjs`                                                                  | README highest ID, “next is N”, and a row per top-level `plans/NN-*.md` must agree                        |
| Skill reference `references/hygiene.md` + Cursor rule                                           | Extract-at-two-sites, Field/ListRow, snippet names, unused-dep allowlist, do-not-adopt                    |
| `fillField` E2E helper                                                                          | Textbox accessible name is the Field contract                                                             |

**Do not add:** Knip/depcheck as a hard gate; Biome; a screen codegen CLI that fights Expo Router;
coverage thresholds; a shared padded-Scroll primitive; hoisting `useLocale`.

## Remaining work

1. [x] Land this plan, index row, CLAUDE “next is 100”, and review pointers.
2. [x] Docs: add `/music` and `/dev/tokens` to `mobile-app.md` current-route table (this review).
3. [ ] `Field` primitive replacing every raw learner/dev `TextInput` listed above. `listRow` is a
       later slice. Copy stays props. Existing textbox accessible names stay. Workbench specimen,
       inventory row, `PRODUCTION_COMPONENT_NAMES`, Vitest pin, `fillField` helper.
4. [ ] `listRow` token + `ListRow` primitive for Settings, More and Music only. Children stay
       screen-specific. E2E names unchanged. Vitest pin like `controlStyle.test.ts`.
5. [ ] Barrel-export `LanguageChoices`, `AudioControls`, `NavigationMenu`; switch path imports. Keep
       the workbench source-drift test honest.
6. [ ] Editor snippets (`.vscode/loro.code-snippets`), Cursor hygiene rule, and `loro-development`
       `references/hygiene.md` for the recipe table. No new learner-facing strings.
7. [ ] UniFFI regenerate-and-diff `--check` wired into `pnpm check` / core-rs check, analogous to
       `embed-wasm.mjs --check`. Do not hand-edit bindings.
8. [ ] Ban raw `TextInput` in `apps/mobile/{app,src}/**` (exemptions above). `check-reuse.mjs` in
       `pnpm check`.
9. [ ] Pre-commit and setup: run `lint-staged` after Gitleaks; warn on missing Gitleaks in
       `bootstrap.sh` / onboarding; prettier-ignore the active-plan roadmap table.
10. [ ] `scripts/check-plan-index.mjs` + a `pnpm check` entry so ID / row / “next is N” cannot
        drift.

**Working rule (not a checkbox):** when a product owner already has `account.tsx`, persistence
tests, Today, onboarding or Progress in the diff, split along existing seams and extract only at the
second call site. Do not open a folder-only `features/` rewrite.

## Acceptance criteria

- A contributor can add a labelled text field or a 48 px list row without copying Account/More
  styles.
- `apps/mobile/{app,src}/**` has no raw `react-native` `TextInput` after slices 3+8 except the
  listed test fixtures. Workbench search is a `Field`.
- Settings, More and Music share `ListRow` + `listRow` token geometry; visible copy and roles stay
  as they are today. Stream play and Account provider tiles are unchanged.
- Language/audio/navigation composites import from `src/ui/components` like the rest.
- `mobile-app.md` lists every built route that exists on disk, including garnish and workbench.
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

1. `docs(docs): add 99 hygiene reuse and tooling (F-03)` — landed
2. `docs(docs): extend 99 and list music/workbench routes (F-03)` — this review
3. `feat(mobile): add Field primitive and replace raw TextInputs (F-03)`
4. `feat(mobile): add ListRow token and share settings/more/music rows (F-03)`
5. `refactor(mobile): barrel-export remaining composites (F-03)`
6. `chore(docs): add loro snippets, cursor rule and hygiene skill (F-03)`
7. `chore(core-rs): add UniFFI generate --check (F-03)`
8. `chore(mobile): ban raw TextInput and add check-reuse (F-03)`
9. `chore(ci): run lint-staged and warn on missing gitleaks (F-03)`
10. `chore(docs): add plan-index drift check (F-03)`

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
- Checkpoint Speak, change wave lock, or touch music fixture playback.
- Change learner-facing copy keys or E2E locators “while extracting”.
- Hand-edit `design-tokens/out/` or UniFFI bindings.
- Register Anthropic, enable billing, or archive remaining-work plans because this file exists.
- Steal plan 56/57/67/70/71/77/81 product slices.
- Hoist `useLocale`, extract a padded Scroll, or fold NavigationMenu / Stream play / Account method
  tiles into the first ListRow.

## Verification

| Slice              | Gate                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan + indexes     | Links resolve; plan 99 is the only new ID; CLAUDE “next is 100”                                                                                           |
| Docs / route table | `mobile-app.md` lists `/music` and `/dev/tokens`; `git diff --check`                                                                                      |
| Field / ListRow    | `pnpm --filter @loro/mobile` lint/typecheck/unit (including new pins); `pnpm test:e2e` for account, add, more, settings, music; `pnpm test:e2e:workbench` |
| Barrel exports     | Mobile typecheck + workbench specimen contract                                                                                                            |
| Snippets / skill   | Skill helper tests if the helper changes; otherwise link + recipe review                                                                                  |
| UniFFI `--check`   | `pnpm --filter @loro/core-rs` check path; do not require `ci:local:native`                                                                                |
| TextInput lint     | ESLint on a fixture that imports `TextInput` in `app/` or `src/dev-tools` must fail; `copyOwnership.test.ts` still passes                                 |
| lint-staged        | A throwaway dirty `.ts` in a test repo, or a documented dry-run, shows eslint/prettier invoked after Gitleaks                                             |
| Plan-index check   | Removing the 99 row from a copy of README fails the script                                                                                                |

Browser E2E does not prove native Field focus or TalkBack. That stays with plans 58/56.

## Open questions

1. **Search variant vs one `Field` with `leading` / `onClear`.** Recommendation unchanged: one
   primitive with optional clear and container border, so Discover’s accent-border Card can wrap it.
2. **ListRow vs promoting Settings `ChoiceRow`.** Recommendation unchanged: thin `ListRow`
   (Pressable + `listRow` token + slots). Settings keeps its marker as a child. Music bilingual
   lines are children, not a `PhraseRow`.
3. **UniFFI `--check` host library.** Unchanged: skip with an explicit message when
   `libloro_core.{so,dylib}` is absent; fail when it exists and bindings differ.
4. **lint-staged on `*.md` vs the roadmap table.** Recommendation: `<!-- prettier-ignore -->`
   immediately above the remaining-roadmap table (or a lint-staged glob that skips
   `plans/README.md`). Do not disable markdown Prettier repo-wide.
5. **NavigationMenu wave 2.** After ListRow + specimen exist, decide whether the sheet row should
   opt into the token without the 48 min-height. Not a blocker for wave 1.
