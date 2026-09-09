# Native libraries and approaches — companion to the 2026-09-09 refactoring review

**Reviewed:** 2026-09-09. **Branch:** current worktree. **HEAD:**
`9d9314001b53059dc8e567c2aba97d0febd3dc03`. **Companion:**
[refactoring-strategies](2026-09-09-refactoring-strategies.md) (A–G sequencing; inspected there at
`382507c`). **Requirements:** safer next development for remaining learner screens and native-device
gates (NAV-\*, AS-\*, N-04, ADR-0001/0002/0003/0005/0007/0011), not product completion.

**Disposition: document only.** This review does not implement refactors, does not install packages,
does not open a numbered plan, and does not claim device acceptance. It does not replace the
refactoring-strategies sequence. Device, bilingual, provider and remaining learner-screen work stay
with their owners in [plans/README.md](../../plans/README.md).

No earlier `docs/reviews/` file inventories native libraries against the current Expo SDK 54 tree.
[2026-09-08-readiness.md](2026-09-08-readiness.md) is a dated stack/APK snapshot and is stale on
persistence and the Rust bridge; it is not superseded here. Archived
[plan 47](../../plans/archive/2026-07-30/47-typography-motion-and-haptics.md) still has the right
haptic _shape_ (named events, never on failure); type/motion token generation has since landed.

---

## Context

The refactoring review is correct: the store, engine contract, handwritten SQL and generated Rust
bridges are already the right shape. Dual ownership of numbers, practice routes beside those
contracts, and stale architecture docs are the expensive debt. A second maths layer, a `features/`
rewrite, or abandoning Expo would make screens 9–23 harder.

This document answers a different question: **which Expo/React Native libraries and approaches
should the next screens and native gates use**, especially touches, switches, haptics, speech,
persistence, notifications and widgets — without installing a parallel UI kit or a second state
library.

The product constraints that every recommendation has to survive:

1. Recorded audio never leaves the device. PCM stays native; no JS API returns audio bytes
   ([ADR-0011](../architecture/adr/0011-analytics-and-privacy.md),
   [`Loro.dc.html:1281`](../../design/Language%20Learning%20by%20Phrases%20-%20V1.1/Loro.dc.html)).
2. Learner-facing numbers are measured or `null` — never estimated.
3. No screen, notification or widget shames a missed day
   ([copy-and-tone.md](../design/copy-and-tone.md),
   [widgets-notifications.md](../architecture/widgets-notifications.md)).
4. Rust owns FSRS, ranking, merge and DSP
   ([ADR-0002](../architecture/adr/0002-shared-rust-core.md)).
5. No client ORM; column-owned `ON CONFLICT` upserts
   ([ADR-0003 amendment](../architecture/adr/0003-offline-first-sqlite-sync.md#amendment--2026-07-30--handwritten-sql-on-the-client-no-orm)).
6. One device clock: [`apps/mobile/src/lib/clock.ts`](../../apps/mobile/src/lib/clock.ts).
7. Practice outcomes only through `applyDelta`.
8. Keep Expo ([ADR-0001](../architecture/adr/0001-cross-platform-react-native-expo.md)). GitHub
   Actions stay disabled; [`pnpm ci:local`](../process/ci-cd.md) is the gate. Browser Playwright
   cannot close native speech or touch.

---

## How this maps onto A–G vs native-device work

A–G from the refactoring review **landed in the working tree** (see that file's implementation
status). Native libraries do not substitute for them and, with one exception, do not share their
files.

| Sequence                                | What it is                                                                                                                                       | Native libraries?                                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A–D landed**                           | Seal TS/Rust Refrain numbers; import shared OpenAPI schemas; fix doc drift; `PRODUCTION_WAVES` + typed `setStreamCursor` / `beginRefrainSession` | Done in the working tree with no new package. Typed store actions (D) are the hole a future gesture must call; do not add RNGH/Reanimated in the same change.                                                                                           |
| **E–G landed**                          | Speak `plan()`; one phrase column map; API auth rename/JWKS                                                                                      | Still no new native library. F is in place before any new syncable field (including a future notification-opt-out if it syncs).                                                                                                                            |
| **As you touch**                        | Split oversized routes; extract only at two call sites                                                                                           | When a second Settings or sheet caller appears, promote into `src/ui/primitives` — do not import Tamagui/NativeBase to skip that rule.                                                                                                                      |
| **Must wait (refactoring review)**      | `StreamEngine.plan()`, `features/` rewrite, delete TS calendar, trip `SyncEntity` on the wire                                                    | Unchanged. Stream `plan()` still waits on [plan 62](../../plans/archive/2026-09-09/62-native-audio-playback.md) audio, not on `expo-av`. Calendar stays until [plan 70](../../plans/70-survival-widgets-and-notifications.md) widgets need UniFFI directly. |
| **Native-device (plan-owned, not A–G)** | Touch validation, recorded/background audio, onset, widgets, notifications, DSP labs                                                             | Use the matrix below. Can proceed **in parallel** with remaining as-you-touch work on different files. Do not mix a haptic or gesture-library PR into A–G files.                                                                                          |

A–D share no files with `usePullDown`, `loro-audio-speech`, or `notify.rs`. Calendar overlap is
allowed. Mixing a Reanimated warming-card rewrite into D would collide with Q-14 and with Refrain
E2E for no gain. A–G landed without those package installs.

---

## Current native stack (already in tree)

Pinned in [`apps/mobile/package.json`](../../apps/mobile/package.json); resolved from
`pnpm-lock.yaml`. Add further Expo modules with `npx expo install <pkg>` so they match SDK 54, not
npm latest ([mobile README](../../apps/mobile/README.md)).

| Package                                                                                                                          | Resolved                 | Role today                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expo`                                                                                                                           | 54.0.36                  | SDK. `newArchEnabled: true` in [`app.config.ts`](../../apps/mobile/app.config.ts) (Fabric / bridgeless already on — not a future migration).       |
| `react-native`                                                                                                                   | 0.81.5                   | Runtime (comment in package.json also names 0.81.6 as the SDK pair; lockfile is 0.81.5).                                                           |
| `react` / `react-dom`                                                                                                            | 19.1.0                   |                                                                                                                                                    |
| `expo-router`                                                                                                                    | 6.0.24                   | File routes, stack, `gestureEnabled: false` on practice screens.                                                                                   |
| `react-native-screens`                                                                                                           | 4.16.0                   | Native stack under the router.                                                                                                                     |
| `react-native-gesture-handler`                                                                                                   | 2.28.0                   | **Installed; no app-source import.** Peer of the router; powers iOS back-swipe.                                                                    |
| `react-native-reanimated`                                                                                                        | 4.1.7                    | **Installed; no app-source import.** Press scale is RN `Pressable` style, JS thread.                                                               |
| `react-native-worklets`                                                                                                          | **0.5.1 (pinned)**       | Reanimated 4 runtime. A newer Worklets release broke the Android APK ([local-apk.md](../process/local-apk.md)). Do not float this.                 |
| `react-native-safe-area-context`                                                                                                 | 5.6.2                    | Root provider; [`BelowSpine`](../../apps/mobile/app/_layout.tsx) zeros top inset under the spine.                                                  |
| `expo-status-bar`                                                                                                                | 3.0.9                    | Dark status bar.                                                                                                                                   |
| `expo-secure-store`                                                                                                              | 15.0.8                   | Native refresh vault; `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.                                                                                            |
| `@op-engineering/op-sqlite`                                                                                                      | 18.2.1                   | Device SQLite (JSI, WAL).                                                                                                                          |
| `sql.js`                                                                                                                         | 1.14.2                   | Browser SQLite + atomic localStorage snapshot.                                                                                                     |
| `zustand`                                                                                                                        | 5.0.14                   | UI/session store; not durable truth.                                                                                                               |
| `expo-network`                                                                                                                   | 8.0.8                    | Connectivity before refresh.                                                                                                                       |
| `expo-localization`                                                                                                              | 17.0.9                   | Device locale → native language detect.                                                                                                            |
| `i18next` + `i18next-icu` + `react-i18next`                                                                                      | 26.4.2 / 2.4.4 / 17.0.13 | Bundled UI copy.                                                                                                                                   |
| `expo-document-picker`                                                                                                           | 14.0.8                   | Import files (plan 65).                                                                                                                            |
| `expo-file-system` / `expo-crypto` / `expo-font` / `expo-splash-screen` / `expo-constants` / `expo-linking` / `expo-web-browser` | SDK-coupled              | Font is **declared, unused** (no `useFonts`). Splash exists. Web-browser is OAuth.                                                                 |
| Local `modules/loro-audio-speech`                                                                                                | Expo Module              | Foreground device TTS + on-device ASR. Web bridge is `null` on purpose ([`audioSpeechBridge.ts`](../../apps/mobile/src/lib/audioSpeechBridge.ts)). |
| Local `modules/loro-core`                                                                                                        | Expo Module              | UniFFI → Rust.                                                                                                                                     |
| `@loro/core-rs` `notify.rs`                                                                                                      | Rust                     | Pure notification **planner**. No OS scheduler.                                                                                                    |

Not in `package.json` (docs and ADR-0001 mention some of these as **targets**):
`expo-notifications`, `expo-haptics`, `expo-av` / `expo-audio` / `expo-speech`,
`@shopify/react-native-skia`, `@shopify/flash-list`, Maestro/Detox as a suite.

Playwright (`@playwright/test` 1.62.0) and axe cover Expo **web**. That is not native touch, speech,
VoiceOver/TalkBack, or airplane-mode SQLite.

---

## Native library / framework matrix

Legend: **keep** (in tree, use as-is or more deeply) · **adopt next** (when the named owner is
touched) · **do not adopt** · **wait** (named plan or gate).

Each row: why it helps screens 9–23 or A–G; cost; interaction with the refactoring review.

### Touch and gestures

| Item                                                                                    | Disposition                             | Why / why not                                                                                                                                                                                                                                                                                                                                | Cost                                                                                                                                      | vs A–G                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`Pressable`](../../apps/mobile/src/ui/primitives/Pressable.tsx) over RN `Pressable`    | **Keep / use more of**                  | Single press path: `MIN_TAP` 44, `HIT_SLOP` 8, dual `accessibilityState` + `aria-*`, press-scale tokens. Every new control (love, grade, settings row) goes through it.                                                                                                                                                                      | None.                                                                                                                                     | Independent of A–D.                                                                                                                                                                                                                     |
| [`usePullDown`](../../apps/mobile/src/ui/primitives/usePullDown.ts) + RN `PanResponder` | **Keep** until native validation fails  | Dedicated-handle pull-down (spine open, sheet dismiss). 4 px activate / 48 px commit / 2× vertical dominance. Matches [plan 93](../../plans/93-mobile-shell-gestures.md) and `Navigation.dc.html`. Browser E2E already runs **mouse and touch**, short/horizontal/cancel ([`navigation.spec.ts`](../../apps/mobile/e2e/navigation.spec.ts)). | Native touch on device is still a **release gate**. Playwright cannot prove finger vs Chrome touch, or a pointer leaving a narrow handle. | Do not rewrite during A–D.                                                                                                                                                                                                              |
| `react-native-gesture-handler` 2.28                                                     | **Keep installed; do not deepen yet**   | Already required by Expo Router for stack back-swipe. Practice routes set `gestureEnabled: false` in [`_layout.tsx`](../../apps/mobile/app/_layout.tsx). App code must not import `GestureDetector` in routes.                                                                                                                               | Config plugin already via Expo. Using RNGH for spine/sheet _as well_ as PanResponder risks two gesture systems fighting.                  | If native validation shows PanResponder missing simultaneous handlers or mouse-leave-handle, **replace the body of `usePullDown`** with `Gesture.Pan` — same primitive, same laws. That is plan 93 follow-up, not a second pull helper. |
| `react-native-reanimated` 4.1.7                                                         | **Use more of, as you touch animation** | ADR-0001 and [motion.md](../design/motion.md) require UI-thread animation while audio plays. Warming card is still a React render + solid band ([mobile README](../../apps/mobile/README.md)). Press scale is JS-thread today.                                                                                                               | Worklets **must stay 0.5.1**. Babel comes from `babel-preset-expo` 54.0.12. Bundle + native rebuild. Browser E2E will not prove 60 fps.   | **Do not** fold into A–D or into extracting `WarmingCard` (must-wait: Q-14 / second call site).                                                                                                                                         |
| `@gorhom/bottom-sheet`, `react-native-modal`, RNGH `GestureDetector` per route          | **Do not adopt**                        | [`Sheet`](../../apps/mobile/src/ui/primitives/Sheet.tsx) already owns scrim-as-button, dedicated handle, `MIN_TAP`, and copy-driven dismiss. A kit would fork Navigation.dc.html laws.                                                                                                                                                       | Extra native surface; E2E locators break.                                                                                                 | Conflicts with “extract at two call sites”.                                                                                                                                                                                             |
| Long-press                                                                              | **Wait / compose**                      | No `onLongPress` in the app today. If a later screen needs it, add an optional prop on `Pressable`, not a new library.                                                                                                                                                                                                                       | —                                                                                                                                         | —                                                                                                                                                                                                                                       |

**Pointer vs touch.** Plan 93 already treats them as separate: a mouse can leave a 28 px spine
before commit. Keep that in `usePullDown`; do not “fix” it with a web-only library.

### Switches, toggles, settings controls

| Item                                                                                                      | Disposition                                                                            | Why / why not                                                                                                                                                                                                                   | Cost                                                                   | vs A–G                                                                                              |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`Segmented`](../../apps/mobile/src/ui/primitives/Segmented.tsx) + `Chip` toggle + `Pressable` `selected` | **Keep / compose**                                                                     | Language mode, difficulty, tags, analytics consent already use radio/checkbox roles with both a11y forms. Settings [`ChoiceRow`](../../apps/mobile/app/settings.tsx) is route-local (one file) — correct until a second caller. | None.                                                                  | As-you-touch extract when plan 71 notification opt-outs or another settings surface shares the row. |
| RN `Switch` wrapped once in `src/ui/primitives`                                                           | **Adopt next** only if Settings grows true on/off rows that must look like OS switches | Map colours through tokens (`accentInk`, not `accent`); `MIN_TAP`; `accessibilityState.checked` + `aria-checked`; labels from `copy`. Never import a kit Switch.                                                                | Small. Web Switch styling is weak — keep `ChoiceRow` on web if needed. | Plan 71 / 70 opt-outs, not A–D.                                                                     |
| Tamagui, NativeBase, gluestack, NativeWind, restyle as a design system                                    | **Do not adopt**                                                                       | Tokens, no colour literals, copy ownership, and layer lint already _are_ the system. A kit would fight `scripts/a11yChecks.ts` and E2E string locators.                                                                         | Large bundle; Expo config; rewrite.                                    | Directly contradicts the refactoring non-goal of a `features/` / UI-kit rewrite.                    |

### Haptics, keyboard, safe area, status bar, appearance

| Item                                                      | Disposition                                                                     | Why / why not                                                                                                                                                                                                                                                                                                 | Cost                                               | vs A–G                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `expo-haptics` behind `src/lib/haptics.ts` named events   | **Adopt next** when the policy is written into [motion.md](../design/motion.md) | Plan 47’s table is still right: light impact on confirmed rep, success on lock-in/wave complete, `selectionAsync` on difficulty/tag, **none** on missed day / ASR miss / any failure. Call sites must not scatter `impactAsync`. Respect system haptic setting; do not assume Reduce Motion disables haptics. | Expo module + native rebuild. No Playwright proof. | Independent of A–G. Do not fire from `applyDelta` itself — presentation only, after a successful store action (D’s pattern). |
| `expo-status-bar` + `userInterfaceStyle: 'light'`         | **Keep**                                                                        | Dark theme is v1.1 ([app.config.ts](../../apps/mobile/app.config.ts)).                                                                                                                                                                                                                                        | —                                                  | —                                                                                                                            |
| `react-native-safe-area-context`                          | **Keep**                                                                        | Spine already consumes top inset.                                                                                                                                                                                                                                                                             | —                                                  | —                                                                                                                            |
| RN `KeyboardAvoidingView` (Account only)                  | **Keep until plan 56 input**                                                    | [Plan 56](../../plans/archive/2026-09-09/56-navigation-failure-and-input-shell.md) still owns keyboard-safe lists/fields.                                                                                                                                                                                     | Android KAV is unreliable on New Architecture.     |                                                                                                                              |
| `react-native-keyboard-controller` via `npx expo install` | **Adopt next** with plan 56 input work                                          | Fabric-friendly focused/avoiding views for Add import, Account, future chat composer. Wrap once; routes do not each pick a keyboard strategy.                                                                                                                                                                 | Config plugin, native rebuild. Web is a no-op.     | Not A–D.                                                                                                                     |
| Appearance / dark-mode kits                               | **Wait**                                                                        | Accent + reduced motion already live in [`ThemeProvider`](../../apps/mobile/src/ui/ThemeProvider.tsx) via `AccessibilityInfo`. Dark is a product milestone, not a library gap.                                                                                                                                | —                                                  | —                                                                                                                            |

### Speech

| Item                                                                                                        | Disposition                                                                                  | Why / why not                                                                                                                                                                | Cost                                              | vs A–G                                                                                                  |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `modules/loro-audio-speech` + [`AudioSpeechController`](../../apps/mobile/src/lib/audioSpeechController.ts) | **Keep / extend**                                                                            | One serialized native session; availability is real; reveal never claims spoken success; transcripts stay local; PCM does not cross to JS (Swift comment on the controller). | Device/model installation. Browser cannot run it. | Speak `plan()` (E) uses this controller; do not construct a second `SpeakEngine` _and_ a second player. |
| `expo-speech`                                                                                               | **Do not adopt**                                                                             | Would be a second TTS owner fighting `AVAudioSession` / Android audio focus ([ADR-0007](../architecture/adr/0007-audio-pipeline.md)).                                        | —                                                 | —                                                                                                       |
| Cloud ASR (Whisper API, Deepgram, Google STT)                                                               | **Do not adopt**                                                                             | Offline, privacy, and latency all fail ([ADR-0005](../architecture/adr/0005-on-device-asr-cloud-fallback.md)).                                                               | —                                                 | —                                                                                                       |
| Bundled `whisper.cpp` / ONNX Whisper                                                                        | **Do not adopt** (revisit only if platform ASR cannot meet the Speak partials + size budget) | ADR-0005 already rejected on bundle size, no streaming partials, thermals. Reveal mode is the floor.                                                                         | 40–75 MB vs install budget.                       | —                                                                                                       |
| Platform on-device ASR (already wrapped)                                                                    | **Keep**                                                                                     | `onDeviceOnly` is structural. Matching stays in Rust.                                                                                                                        | Per-language packs; plan 63/87 acceptance.        | Latency stays `null` until plan 63 emits monotonic prompt-end/onset — never estimate in JS.             |

### Audio playback and background / travelling audio

| Item                                                                                      | Disposition          | Why / why not                                                                                                                                                                                                                         | Cost                                                                                   | vs A–G                                                                                                               |
| ----------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Extend `loro-audio-speech` toward `loro-audio` (AVAudioEngine / Oboe, slots, lock screen) | **Wait for plan 62** | Hands-free stream, pitch-preserving rate, gapless slots, interruptions. One session owner. Plan 81 presents travelling chrome; 62 owns truth.                                                                                         | Hard native work; `UIBackgroundModes: ['audio']` and FGS permissions already reserved. | `StreamEngine.plan()` stays blocked here (refactoring must-wait). Typed cursor (D) is the Stream cleanup until then. |
| `expo-av`, `expo-audio`, `react-native-track-player`, `react-native-sound`                | **Do not adopt**     | Capture config, onset callback, and “no PCM in JS” are unreachable ([ADR-0007](../architecture/adr/0007-audio-pipeline.md)). Two audio-session owners break play↔record. Track Player is a _player_, not a capture/measurement graph. | —                                                                                      | —                                                                                                                    |
| JS `Audio` / `speechSynthesis` in learner routes                                          | **Do not adopt**     | Chat blueprint fixture only (`Loro Chat.dc.html:514`). Web speech may upload.                                                                                                                                                         | —                                                                                      | —                                                                                                                    |

### Persistence

| Item                                                                                         | Disposition            | Why / why not                                                                                                                                | Cost                                 | vs A–G                                                                       |
| -------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| OP-SQLite 18.2.1 + handwritten SQL in `@loro/core`                                           | **Keep**               | JSI, WAL, `BEGIN IMMEDIATE`, savepoints. Same statements as Node CI ([`driver.opsqlite.ts`](../../apps/mobile/src/data/driver.opsqlite.ts)). | Native rebuild; Expo Go unsupported. | Phrase column map (F) lives next to `FIELD_POLICY`, not in a new DB library. |
| `sql.js` browser driver                                                                      | **Keep**               | Durable file in localStorage; fail closed on corrupt.                                                                                        | Quota.                               | —                                                                            |
| `expo-sqlite`, WatermelonDB, Drizzle/Prisma/Kysely on the **client**, PowerSync, ElectricSQL | **Do not adopt**       | Column ownership and per-field merge classes are the point. ORM upserts caused `INSERT OR REPLACE` tombstone bugs historically.              | —                                    | Explicit refactoring non-goal.                                               |
| Server Drizzle (API Postgres)                                                                | **Keep (server only)** | ADR-0003 amendment: different runtime. Do not “unify” with SQLite.                                                                           | —                                    | G is auth naming, not schema unification.                                    |

### Secure storage and accounts

| Item                                                 | Disposition                                                                       | Why / why not                                                                                                                       | Cost                                                                    | vs A–G                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| `expo-secure-store`                                  | **Keep**                                                                          | [`vault.ts`](../../apps/mobile/src/lib/account/vault.ts). ESLint bans AsyncStorage for credentials.                                 | Keychain/Keystore; not available on web (in-memory sessions by design). | —                                      |
| `react-native-keychain`, `expo-auth-session` rewrite | **Do not adopt** unless SecureStore cannot express a required accessibility class | Current `WHEN_UNLOCKED_THIS_DEVICE_ONLY` matches “refresh lives on this phone”. OAuth already uses `expo-web-browser` + app scheme. | —                                                                       | G is API JWKS, not a new client vault. |

### Notifications and widgets

| Item                                                                            | Disposition                                                | Why / why not                                                                                                                                                                  | Cost                                                                        | vs A–G                                                                      |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Rust `plan_notifications` ([`notify.rs`](../../packages/core-rs/src/notify.rs)) | **Keep as the only policy**                                | Cap 3/day, quiet hours, opt-outs, no guilt copy keys. Platform adapter supplies timezone-resolved instants; Rust does not own DST.                                             | —                                                                           | Calendar TS mirror stays until widgets call UniFFI (refactoring must-wait). |
| `expo-notifications` for **OS local** schedule/cancel                           | **Wait for plan 70**                                       | Delivery must not depend on JS being awake. Adapter replaces/cancels by stable IDs from Rust. Copy through `copy.ts`. Permission after first completed session, not at launch. | Config plugin; `POST_NOTIFICATIONS` already declared. No remote push in v1. | Not A–G. A new syncable opt-out field needs F first.                        |
| OneSignal, FCM/APNs campaigns, `expo-task-manager` timers                       | **Do not adopt**                                           | N-04 and “server push only for what the device cannot know”. Background JS timers will miss airplane mode.                                                                     | —                                                                           | —                                                                           |
| WidgetKit / ActivityKit / Glance via a **local Expo module** (`loro-widgets`)   | **Wait for plan 70** (+ Q-07 for trip candidates)          | Snapshot after SQLite commit; widgets do not read SQLite or compute. Phrase-of-moment from `loro-core`. App Group already reserved.                                            | Duplicate native UI; plan 58 harness.                                       | Deleting TS calendar waits on this.                                         |
| `react-native-android-widget` as the Android strategy                           | **Do not adopt** unless Glance-in-module proves unworkable | Architecture already specifies Glance + shared snapshot. A JS widget kit would be a second snapshot language.                                                                  | —                                                                           | —                                                                           |

### Accessibility

| Item                                                        | Disposition                       | Why / why not                                                                                                                                       | Cost                                 | vs A–G                                                                      |
| ----------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| Dual a11y props on primitives; `check:lang`; text-scale E2E | **Keep**                          | RN-web still does not forward `accessibilityLanguage` or `accessibilityHint` ([primitives/index.ts](../../apps/mobile/src/ui/primitives/index.ts)). | Source scan, not a library.          | New screens: `states.ts` row in the same change (refactoring as-you-touch). |
| `react-native-a11y` extra kits                              | **Do not adopt**                  | Would duplicate Pressable’s dual-form contract.                                                                                                     | —                                    | —                                                                           |
| VoiceOver / TalkBack                                        | **Wait for device** (plans 58/93) | Playwright cannot prove it.                                                                                                                         | Manual + future local device runner. | —                                                                           |

### Navigation

| Item                          | Disposition      | Why / why not                                                                                                                            | Cost                         | vs A–G |
| ----------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------ |
| `expo-router` 6               | **Keep**         | Typed routes experiment on. `navigation.ts` is the declaration table — do not split it (refactoring review).                             | —                            | —      |
| Bare React Navigation rewrite | **Do not adopt** | Expo Router _is_ React Navigation + file routes. No named gap that a rewrite would close. Plan 56 extends metadata; plan 81 presents it. | Would thrash every E2E path. | —      |

### Lists, charts, fonts, OCR (adjacent)

| Item                                                       | Disposition                                                  | Why / why not                                                                                                                                                                                                                      | Cost                                     | vs A–G                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| `ScrollView` (current)                                     | **Keep** while catalogs are 31 phrases                       | No `FlatList`/`FlashList` in app source today.                                                                                                                                                                                     | —                                        | —                                                                      |
| `@shopify/flash-list`                                      | **Wait for plan 56** scalable lists                          | When owned libraries exceed starter size. Still token/Pressable rows.                                                                                                                                                              | Native.                                  | As-you-touch with Add/Phrasebook, not A–D.                             |
| `@shopify/react-native-skia`                               | **Wait for plan 77** labs                                    | ADR-0001 target for contours/waveforms. Progress uses [`bars.tsx`](../../apps/mobile/src/ui/primitives/bars.tsx) today; no `src/ui/charts/`. Do not add Skia to draw a 0-height bar that E2E already measures in `render.spec.ts`. | Heavy; lazy-import lab routes.           | Must-wait with DSP quality gate. Fake blueprint scores stay forbidden. |
| `expo-font` (already declared)                             | **Use more of** when loading Plus Jakarta / Instrument Serif | No `useFonts` today. Hold splash until load; degrade to system fonts; never block practice.                                                                                                                                        | Asset size.                              | Independent; do not mix with A–D.                                      |
| Camera / on-device OCR (Vision / ML Kit) in a local module | **Wait for plan 65**                                         | Import file path exists (`expo-document-picker`). Cloud OCR would ship image bytes off-device.                                                                                                                                     | Camera permission already in Info.plist. | —                                                                      |

### Native test runners

| Item                                                               | Disposition                                                                                      | Why / why not                                                                                                                                                                                                                                                                                                                 | Cost                                             | vs A–G                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------ |
| Playwright web E2E                                                 | **Keep** for learner-visible web behaviour                                                       | Cannot prove native speech, touch, SQLite process-death, widgets.                                                                                                                                                                                                                                                             | Already in `pnpm ci:local`.                      | New STATE rows as you touch screens. |
| [`pnpm native:evidence`](../../scripts/native-device-evidence.mjs) | **Keep / extend** (plan 58)                                                                      | Local, no GitHub Actions. Correlates retained APK bytes with a device screenshot/metadata. Does not itself drive gestures.                                                                                                                                                                                                    | Devices/Xcode.                                   | Parallel with A–G.                   |
| Maestro (local YAML flows)                                         | **Adopt next** only under plans 58/72, **local** `pnpm ci:local` — not a cloud farm, not Actions | [testing-strategy.md](../process/testing-strategy.md) already names Maestro as the candidate when native behaviour lands. `.gitignore` has `maestro-debug-output/` from an archived plan; there is **no suite**. First flows: plan 93 pull/dismiss/back-swipe disabled; Speak unavailable/reveal; airplane force-quit resume. | Maintained YAML; simulators. Browser tests stay. | Do not add Maestro to “prove” A–D.   |
| Detox, BrowserStack/Firebase Test Lab as **required**              | **Do not adopt**                                                                                 | Detox is heavier and usually assumes CI workers. Cloud farms violate the local-CI policy as a _required_ library. Optional later ops are plan 73, not a dependency of screens 9–23.                                                                                                                                           | —                                                | —                                    |
| React Native Testing Library                                       | **Optional, as you touch primitives**                                                            | Unit-test `Pressable`/`Segmented` checked state. Does not close device gates.                                                                                                                                                                                                                                                 | DevDependency only.                              | Fine during as-you-touch splits.     |

---

## Approaches for future screens (not only libraries)

These are the habits that make screens 9–23 cheaper **without** a rewrite. They extend the
refactoring review; they are not a second sequence.

1. **Compose the route; extract at two call sites.** Named local hooks/components stay in the route
   file. Domain-free → `src/ui/primitives`; domain types, never store/copy → `src/ui/components`.
   `ChoiceRow` stays in `settings.tsx` until a second surface needs it. Do not pre-create
   `features/`.
2. **Drive practice through `engine.plan()` where the UI already matches the plan.** Speak: export
   `speakEngine`, plan once, `record` against the handle (refactoring E). Stream: typed cursor only
   until recorded/hands-free audio exists; calling `plan()` now expands listen reps the rating UI
   does not show.
3. **One phrase column map next to `FIELD_POLICY`.** SQL names, wire camelCase, merge class. No
   generic upsert helper. A notification-opt-out or widget snapshot field that syncs is a new
   syncable field — F before the column.
4. **Gesture ownership is a primitive.** Laws come from `Navigation.dc.html` (dedicated handle,
   vertical intent, 48 pt commit, session back-swipe off, buttons/Escape/Android Back remain).
   `usePullDown` is the one implementation. Routes pass `onPull`; they do not fork PanResponder.
   Practice `gestureEnabled: false` stays in `_layout.tsx` with the other session laws.
5. **Store writes go through named actions.** A future swipe-to-open or sheet dismiss that mutates
   session state calls `beginRefrainSession` / `setStreamCursor` (D), never `useApp.setState`.
   Gestures are not a second store.
6. **One audio session, one clock, one delta path.** Screens subscribe to `audioSpeech`; they do not
   `new SpeakEngine()` plus a second player. Latency is native-measured or omitted. Outcomes go
   through `applyDelta` only.
7. **Reanimated vs PanResponder.** Stay on RN `Pressable` + `PanResponder` for **hit-testing and
   commit thresholds**. Move **animation** (warming card, press scale, sheet `translateY`, beat
   bars) to Reanimated worklets when that animation is the task — not as a blanket “enable RNGH
   everywhere” refactor. RNGH replaces PanResponder only inside `usePullDown` if devices prove the
   responder system insufficient.
8. **New Architecture.** Already on. Do not file a Fabric/bridgeless project. New native modules
   follow Expo Modules (like `loro-audio-speech`), not the old bridge.
9. **Test what Playwright cannot.** Same change as the behaviour: web E2E for buttons, keyboard,
   copy, 44 px, 310% text; `native:evidence` + later local Maestro for finger pull, disabled
   back-swipe, ASR permission, force-quit. Do not skip native proof because the web drag passed.
10. **Install with the SDK.** `npx expo install`. Pin Worklets. Custom modules ⇒ no Expo Go;
    prebuild. Generated UniFFI/tokens stay committed and drift-checked.

---

## Explicit non-goals / do-not-adopt

Unless a later device failure produces evidence against the ADRs, do **not**:

- Rewrite the app into `features/` / `domain/` / `platform/` folders, or abandon Expo for Flutter /
  SwiftUI+Compose.
- Replace Zustand with Redux, MobX, Jotai, Legend, Recoil, or TanStack Query **for learner state**.
  SQLite is durable truth; Zustand is the projection. Query caches would invent a third copy.
- Adopt Tamagui, NativeBase, gluestack, NativeWind, or Paper as the design system.
- Adopt a second FSRS (`ts-fsrs` in the app), a TS ranker, or a second merge.
- Put Drizzle/Prisma/Watermelon/PowerSync on the client; unify SQLite DDL with Postgres auth/sync
  DDL; unify mobile `clock.ts` with API `ServerClock`.
- Adopt cloud ASR, `expo-speech`, `expo-av`/`expo-audio` as the production graph, or any JS API that
  returns audio bytes/paths for upload.
- Schedule notifications with JS timers or guilt copy; use remote push for practice reminders.
- Make GitHub Actions or a cloud device farm a required library.
- Hand-edit `design-tokens/out/` or UniFFI bindings.
- Change learner-facing copy keys “while adding haptics”.

---

## Open questions

1. **Does PanResponder fail on physical iOS/Android for spine/sheet handles** (pointer leaves the 28
   px band; simultaneous scroll; predictive back)? If yes, RNGH goes _inside_ `usePullDown`. If no,
   leave the dependency as a router peer. Owner: plan 93 + 58 evidence.
2. **Haptic policy in `motion.md`.** Plan 47’s table is a proposal until design confirms lock-in /
   rep / select / never-on-failure. Do not sprinkle `expo-haptics` before that section exists.
3. **Maestro vs extending `native:evidence`.** testing-strategy wants a device runner when native
   behaviour lands; plan 58 already collects screenshots. Prefer Maestro _flows_ that produce
   artifacts the evidence script already knows how to retain, rather than two unrelated harnesses.
4. **Keyboard controller vs living with KAV** until the first broken Android field (Add import /
   chat). If plan 56’s first keyboard screen is Account-only, KAV may suffice; if composer + search
   land together, install `react-native-keyboard-controller` once.
5. **When calendar crosses UniFFI for JS** vs widget-native-only (refactoring open question 2).
   Library choice (none) depends on that: widgets should call the same Rust day key, not a third
   clock.

---

## Inspection limits

Package versions from `apps/mobile/package.json` and `pnpm-lock.yaml` at HEAD `9d9314`. Native
module bodies were sampled (Swift `LoroAudioSpeechModule` public API and the “no PCM to JS”
controller comment), not line-reviewed for interruption completeness — plans 58/62/63 own that. No
device was touched. No packages were installed. ADR/plan text that still says “Skia / Reanimated /
expo-notifications in the app” was treated as **target**, then checked against the lockfile.

This review does not re-do the A–G inventory. If those refactors land, keep this matrix; only bump
the “already in tree” rows when a package is actually imported from app source.
