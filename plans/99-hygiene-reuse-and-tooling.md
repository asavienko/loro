# Hygiene, reuse and developer tooling

- **Requirement IDs:** `F-02`, `F-03`, `F-04` (foundation hygiene that keeps those invariants cheap
  to extend); NAV consistency only where a second call site already exists
- **Milestone:** M1 hygiene; runs in parallel with remaining product plans
- **Status:** — Plan recorded. Implementation slices have not started. Nothing external blocks the
  Field extract, list-row primitive, barrel consistency, snippets, or UniFFI `--check`.
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
regenerate-and-diff `--check` like WASM already has.

This plan owns **cross-cutting hygiene** that has no product owner. It does not implement screens
9–23, widgets, DSP, production audio, billing, live Claude, or device acceptance.

## Relationship to the 2026-09-09 reviews

Three reviews already answered “what to refactor / which libraries / which practices” as
**document-only** work. They remain the inventory. This plan is the missing **execution owner** for
what they left as as-you-touch leftovers **plus** findings that appeared after `706858c` (music,
Discover garnish, unused Field, duplicated list-row geometry, no editor snippets).

| Companion                                                                                | Still owns                                       | This plan does not redo                                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| [Refactoring strategies](../docs/reviews/2026-09-09-refactoring-strategies.md)           | A–G sequence and 2026-09-10 extracts (landed)    | Dual maths, `current.ts`, typed store actions, column map, JWKS rename       |
| [Whole-project assessment](../docs/reviews/2026-09-09-project-improvement-assessment.md) | Keep / adopt / avoid matrix and ADR amendments   | ADR-0012 / 0008 amendments (landed); installing new product libraries        |
| [Native libraries](../docs/reviews/2026-09-09-native-libraries-and-approaches.md)        | Expo/RN keep-vs-adopt for speech, touch, widgets | Haptics, Maestro, keyboard-controller, Skia, FlashList, `expo-notifications` |

**Do not redo A–G.** Rechecked at HEAD `70a8ecc`: `fakeRepository` uses `isActive` / `isDue`;
`fakeCore()` is fixture-sealed; production account/sync clients do not import `api/target` (tests
may); `PRODUCTION_WAVES` / `setStreamCursor` / `beginRefrainSession` exist; Speak plans through
`speakEngine` and documents the session as ephemeral; `syncableColumns` sits next to `FIELD_POLICY`;
legacy `/content` egress parses current `ManifestSchema` / `PackSchema`; ADR-0012 is write-through
projection; ADR-0008 is `pg` + SQL.

## Evidence at HEAD `70a8ecc` (2026-09-10)

Inspected: largest TS/Rust modules, `src/ui/{primitives,components}`, raw `TextInput` / list-row
call sites, package manifests vs app-source imports, `eslint.config.mjs`, `scripts/`,
`.agents/skills/`, `.cursor/`, `e2e/helpers`, `docs/architecture/mobile-app.md` route table. Not a
device run.

### Cleanliness — what is left

| Finding                                                       | Evidence                                                                                                                                                                                   | Owner                                                                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oversized routes/tests that survived the 2026-09-10 split     | `account.tsx` 881, `persistence.test.ts` 1170, `sync.service.test.ts` 806, `sync.test.ts` 787, `add.tsx` 758, `index.tsx` 662, `refrain.tsx` 653, `onboarding.tsx` 574, `progress.tsx` 508 | **As you touch**, except Field/ListRow below. `account.tsx` waits on plan 67 linking/export. Today `DayRow` / `NavRail` wait on 56/81. `WarmingCard` waits on Q-14 / a second engine. |
| UniFFI has no regenerate-and-diff `--check`                   | WASM `embed-wasm.mjs --check` exists; `packages/core-rs/build.sh` generates Swift/Kotlin and only strips trailing whitespace                                                               | **This plan** (tooling slice)                                                                                                                                                         |
| Speak session is React state                                  | `speak.tsx` comment: ephemeral until a named plan owns interruption resume                                                                                                                 | **Not this plan.** Do not invent resume.                                                                                                                                              |
| `core-rs` `merge.rs` / `select.rs` / `scheduler.rs` are large | 716 / 652 / 546                                                                                                                                                                            | **Not this plan.** Complexity in the right crate (ADR-0002).                                                                                                                          |
| Music uses `globalThis.Audio` for fixture playback            | `music.tsx` ~206                                                                                                                                                                           | **Plan 96.** One audio session is 62; do not “fix” garnish playback here.                                                                                                             |

### Consistency — what is left

| Finding                                             | Evidence                                                                                                                                                                                                | Owner                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Composites imported two ways                        | Barrel: `ActionBar`, `EmptyState`, `PhraseRow`, … Path imports: `LanguageChoices`, `AudioControls`, `NavigationMenu` (`languages.tsx`, `onboarding.tsx`, `speak.tsx`, `phrase/[id].tsx`, `_layout.tsx`) | **This plan**                                                                    |
| `mobile-app.md` route table omits shipped utilities | Table lists `/more` and `/settings` but not `/music` or `/dev/tokens`, which exist on disk                                                                                                              | **This plan** (docs slice, same class as leftover item C)                        |
| Raw `TextInput` in four production surfaces         | `account.tsx` email + code; `add.tsx` Discover search; `_add/ImportPhrases.tsx`; Workbench search                                                                                                       | **This plan** — second-call-site rule already broken                             |
| List-row geometry copied three times                | `MIN_ROW_HEIGHT = 48` + `ROW_PADDING = 13` + hairline bottom in `settings.tsx`, `more.tsx`, `music.tsx`                                                                                                 | **This plan**                                                                    |
| Tests still import `@loro/core/api/target`          | auth/sync/content tests and `contracts.e2e.test.ts`                                                                                                                                                     | **Keep.** Roadmap assertions. Production clients already use `account` / `sync`. |
| `LocaleSchema` is the legacy `es-ES` literal        | `LegacyLocaleSchema` alias already exists in `common.ts`                                                                                                                                                | **As you touch** a multilingual import of `common.ts`. Do not widen.             |

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

**Adopt next only with that owner:** `expo-haptics` after `motion.md` policy; keyboard-controller
with plan 56 input; Maestro under 58/72; `expo-notifications` with 70; Skia with 77; FlashList when
catalogs outgrow `ScrollView`. Install Expo modules with `npx expo install`. Pin Worklets at 0.5.1.

**Do not adopt:** Flutter/SwiftUI+Compose; Redux/MobX/Jotai/TanStack Query for learner state;
Tamagui/NativeBase/gluestack/NativeWind; client or “cleanup” server Drizzle/Prisma/Watermelon;
`ts-fsrs`; `expo-speech` / `expo-av` as the production graph; cloud ASR; Style Dictionary / Tokens
Studio; Supabase/Firebase; Passport; Redis/BullMQ/CDN in this testing phase; GitHub Actions as a
required gate; Biome/oxlint as an ESLint replacement (would drop layer/colour/clock rules).

### Reusable components — extract now vs wait

The rule in [`component-inventory.md`](../docs/design/component-inventory.md) is already correct:
one call site stays local; two or more and domain-free → `src/ui/primitives`; two or more with
domain types → `src/ui/components`. Store/copy stay out.

| Shape                                                          | Call sites today                                                                                                               | Action                                                                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authored `SearchField` / labelled field                        | Account email + code, Discover search, Import rows, Workbench search. Blueprint: `design/.../components/forms/SearchField.jsx` | **Extract `Field` (and a search variant)** in `src/ui/primitives`. Pass every string. 44 px target. Native + `aria-*`. Do not import a kit.                               |
| Selectable / navigable list row                                | Settings `ChoiceRow`, More `DestinationRow`, Music phrase + style rows. Shared 48 / 13 / hairline                              | **Extract `ListRow`** (domain-free: label slots, `selected`, role). Settings marker and Music bilingual lines stay as children. Do **not** promote `ChoiceRow` wholesale. |
| `LanguageChoices` / `AudioControls` / `NavigationMenu`         | 2+ each, imported by path                                                                                                      | Re-export from `src/ui/components/index.ts`; switch callers to the barrel                                                                                                 |
| `EmptyState` / `PracticeEmptyState`                            | Already shared                                                                                                                 | Keep. Refrain’s two-title empty is intentionally not `EmptyState`                                                                                                         |
| `ThemeGrid`, `TaggingSheet`, `WarmingCard`                     | One each                                                                                                                       | **Wait.** Second caller or Q-14                                                                                                                                           |
| Authored Spine / DayRow / NavRail / ExitSheet / TransportStrip | Partial / plan 81                                                                                                              | **Plan 81.** Do not pre-build the catalog                                                                                                                                 |
| Skia charts                                                    | None; Progress uses `bars.tsx`                                                                                                 | **Plan 77.** Pair with `ChartSummary` and real numbers                                                                                                                    |

### Reusable snippets — missing entirely

There is **no** `.vscode/` directory, no `*.code-snippets`, and no Cursor rule pack beyond
`.cursor/environment.json`. The only agent skill is
[`loro-development`](../.agents/skills/loro-development/SKILL.md), which points at references but
does not ship paste-ready recipes for the operations every new screen repeats.

This plan adds **checked-in** snippets and a skill reference that encode the enforced rules, not a
second style guide.

| Snippet / recipe               | Must include                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| New Expo Router screen         | `copy.*` only; `Screen` + primitives; no `new Date()`; `states.ts` row reminder; `navigation.ts` if it is a destination |
| New `copy/` section            | Barrel re-export; ICU resource keys; no literals in `app/`                                                              |
| New E2E `STATES` row           | `enter` / `click` helpers; coverage/a11y/text-scale come free                                                           |
| New primitive                  | Dual `accessibilityState` + `aria-*`; tokens not colour literals; export from `primitives/index.ts`; workbench specimen |
| `applyDelta` / `engine.record` | Progress only through `ProgressDelta`; named store action, not `useApp.setState`                                        |
| SQLite upsert                  | `ON CONFLICT … DO UPDATE` over owned columns; never `INSERT OR REPLACE`; never touch `field_hlc` / `deleted_at`         |
| Shared Zod change              | Edit `packages/core/src/api/*`, `pnpm contracts:generate`, then implement                                               |

### Useful tools — present vs missing

**Already healthy (do not replace):** `pnpm check` / `pnpm ci:local`; `check:copy`, `check:lang`,
`check:contrast`, `check:routes`; layer / colour / clock / AsyncStorage ESLint; `e2e/helpers`;
`context.mjs`; `archive-plan.mjs`; workbench specimen-contract drift; Gitleaks pre-commit;
`scripts/ci-local/*`.

**Add under this plan:**

| Tool                                                                                           | Why                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| UniFFI generate `--check` (or a porcelain diff after generate + whitespace normalize)          | WASM already fail-closed; bindings can drift silently                                                                      |
| ESLint (or `check:fields`) banning raw `TextInput` in `apps/mobile/app/**` once `Field` exists | Prevents the next screen from hand-rolling a fourth style                                                                  |
| Allowlisted “installed but unused until owner” note in `apps/mobile/package.json` `$comment`   | Stops a cleanup PR from deleting `expo-font` / Reanimated / RNGH                                                           |
| Skill reference `references/hygiene.md`                                                        | One place for extract-at-two-sites, Field/ListRow, snippet names, do-not-adopt                                             |
| Optional: `scripts/check-reuse.mjs`                                                            | Counts raw `TextInput` and duplicate `MIN_ROW_HEIGHT`/`ROW_PADDING` literals; fails if new copies appear after the extract |

**Do not add:** Knip/depcheck as a hard gate (false positives on Expo peer and plan-57 capacity);
Biome; a screen codegen CLI that fights Expo Router; coverage thresholds.

## Remaining work

1. [x] Land this plan, index row, CLAUDE “next is 100”, and review pointers.
2. [ ] Docs: add `/music` and `/dev/tokens` to `mobile-app.md` current-route table; point the
       September reviews at this plan as the execution owner. No product behaviour.
3. [ ] `Field` primitive (+ search variant matching authored `SearchField`) replacing raw
       `TextInput` in Account, Discover, Import and Workbench. Copy stays props. E2E locators stay
       accessible names. Workbench specimen + inventory row.
4. [ ] `ListRow` primitive replacing duplicated 48/13/hairline rows in Settings, More and Music.
       Children remain screen-specific. E2E names unchanged.
5. [ ] Barrel-export `LanguageChoices`, `AudioControls`, `NavigationMenu`; switch path imports. Keep
       the workbench source-drift test honest.
6. [ ] Editor snippets (`.vscode/loro.code-snippets`) and `loro-development` hygiene reference for
       the recipes in the snippet table. No new learner-facing strings.
7. [ ] UniFFI regenerate-and-diff `--check` wired into `pnpm check` / core-rs check, analogous to
       `embed-wasm.mjs --check`. Do not hand-edit bindings.
8. [ ] Lint or `check:fields` so new `app/` `TextInput` usage fails. Document unused Expo modules as
       capacity, not dead deps.
9. [ ] As-you-touch only: split `account.tsx` / persistence / sync tests / Today / onboarding /
       Progress when those files are already in the diff for their product owner. Extract at the
       second call site. Do not open a folder-only `features/` rewrite.

## Acceptance criteria

- A contributor can add a labelled text field or a 48 px list row without copying Account/More
  styles.
- `apps/mobile/app/**` has no raw `react-native` `TextInput` after slice 3+8 (Workbench may keep a
  specimen that _is_ `Field`).
- Settings, More and Music share `ListRow` geometry; visible copy and roles stay as they are today.
- Language/audio/navigation composites import from `src/ui/components` like the rest.
- `mobile-app.md` lists every built route that exists on disk, including garnish and workbench.
- Snippets and the hygiene reference name the same rules ESLint already enforces (copy, clock,
  tokens, `applyDelta`, dual a11y).
- `pnpm check` fails if UniFFI bindings were regenerated and not committed, the same way WASM embed
  already fails.
- `pnpm check` and focused mobile/E2E for the Field/ListRow slices stay green. Learner-visible
  strings and E2E locators are unchanged unless a bug is found.
- A–G behaviour is unchanged. No new product library. No simulated numbers. No PCM to JS.

## Commit sequence

1. `docs(docs): add 99 hygiene reuse and tooling (F-03)`
2. `docs(docs): point reviews and mobile-app routes at 99 (F-03)`
3. `feat(mobile): add Field primitive and replace raw TextInputs (F-03)`
4. `feat(mobile): add ListRow and share settings/more/music rows (F-03)`
5. `refactor(mobile): barrel-export remaining composites (F-03)`
6. `chore(docs): add loro snippets and hygiene skill reference (F-03)`
7. `chore(core-rs): add UniFFI generate --check (F-03)`
8. `chore(mobile): ban raw TextInput in app routes (F-03)`

Each commit leaves `pnpm check` green. Field/ListRow commits include the matching E2E (existing
locators) and a workbench specimen. Do not mix a product screen into these commits.

## Out of scope / do-not

Unless a later device or operational failure produces evidence against the ADRs, do **not**:

- Redo A–G or re-amend ADR-0012 / 0008.
- Rewrite the app into `features/` / `domain/` / `platform/`, or abandon Expo.
- Replace Zustand; add TanStack Query for learner rows; implement `useLiveQuery`.
- Install Drizzle, Redis, Tamagui, NativeWind, `expo-speech`, `expo-av`, cloud ASR, or a CMS as
  cleanup.
- Delete unused `expo-font` / Reanimated / RNGH, or float Worklets off 0.5.1.
- Wire `StreamEngine.plan()`, delete TS `calendar.ts`, put trips on the wire, unify `/me`, or
  promote `WarmingCard`.
- Checkpoint Speak, change wave lock, or touch music fixture playback.
- Change learner-facing copy keys or E2E locators “while extracting”.
- Hand-edit `design-tokens/out/` or UniFFI bindings.
- Register Anthropic, enable billing, or archive remaining-work plans because this file exists.
- Steal plan 56/57/67/70/71/77/81 product slices.

## Verification

| Slice              | Gate                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Plan + indexes     | Links resolve; plan 99 is the only new ID; CLAUDE “next is 100”                                                                      |
| Docs / route table | `git diff --check`; no behaviour tests                                                                                               |
| Field / ListRow    | `pnpm --filter @loro/mobile` lint/typecheck/unit; `pnpm test:e2e` for account, add, more, settings, music; `pnpm test:e2e:workbench` |
| Barrel exports     | Mobile typecheck + workbench specimen contract                                                                                       |
| Snippets / skill   | Skill helper tests if the helper changes; otherwise link + recipe review                                                             |
| UniFFI `--check`   | `pnpm --filter @loro/core-rs` check path; do not require `ci:local:native`                                                           |
| TextInput lint     | ESLint on a fixture that imports `TextInput` in `app/` must fail                                                                     |

Browser E2E does not prove native Field focus or TalkBack. That stays with plans 58/56.

## Open questions

1. **Search variant vs one `Field` with `leading` / `onClear`.** Recommendation: one primitive with
   optional clear and container border, so Discover’s accent-border Card can wrap it rather than
   forking geometry.
2. **ListRow vs promoting Settings `ChoiceRow`.** Recommendation: thin `ListRow` (Pressable +
   geometry + slots). Settings keeps its marker as a child. Music bilingual lines are children, not
   a `PhraseRow` (no emoji, no queue chrome — same reason Today does not use `PhraseRow`).
3. **UniFFI `--check` host library.** The generator needs `target/release/libloro_core.{so,dylib}`.
   The check should skip with an explicit message when the host lib is absent (docs-only CI hosts),
   and fail when the lib exists and bindings differ — same honesty as `LORO_SKIP_WASM`.
