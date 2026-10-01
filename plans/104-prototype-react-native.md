# v2.0 app in React Native (the main app)

- **Requirement IDs:** `P3-01` (continuous playback), `F-03` (offline-first), `AI-06` (make a set)
- **Milestone:** The main app since 2026-09-30, when it replaced the first app in `apps/mobile`
- **Status:** 🟡 Scope 1–4 done 2026-09-30: every screen and sheet of the web prototype is ported,
  checked on Expo web and on the Android emulator (Pixel 8, API 36). **Left:** scope 5, the full
  verification, including the gestures on a physical device; iOS needs Xcode. **Blocked by:**
  nothing but priority.
- **Depends on:** the Make a set logic in `src/shared/generate/` (plan 103, in Git history). The
  screens were ported from the web prototype in Git history
  (`git show 52a0e3b:design/design-v2.0/rapid-ui-prototype/src/...`). Uses
  `apps/mobile/modules/loro-core` for the Rust core on native.

## Outcome

The v2.0 prototype runs as an Expo (React Native) app on Android, iOS and the web, with the same
learner-facing behaviour: the listening loop (prompt → your turn → target → rating), browsing, the
Library, sets of your own, and Make a set with its swipe deck.

## Approach

- **One source of truth for behaviour.** The app is `apps/mobile`. Its platform-free modules —
  content and the phrase bank, the state machine, selectors, persistence, merge, copy, notes, the
  suggestion generator and the deck — live in `src/shared/` with their unit tests, and run on every
  platform.
- **Only the platform edge differs.** Metro swaps four leaf modules on iOS and Android: saved
  progress (`state/storage.ts` → AsyncStorage), phrase clips (`audio/speech.ts` → `expo-audio`),
  cues (`audio/cues.ts` → haptics) and the Rust core (`packages/core-rs/browser` → the `LoroCore`
  native module in `apps/mobile/modules/loro-core`). On the web the originals run.
- **Every number stays the core's.** FSRS runs in Rust on every platform (native module or WASM);
  there is no JavaScript fallback. The native module needs a development build; Expo Go cannot run
  it.
- **UI in React Native primitives** with the prototype's tokens (paper, ink, terracotta), its fonts
  (serif for content and the target language, sans for the interface, Cyrillic faces for Bulgarian
  and Russian) and the Material Symbols subset, expo-router for tabs, the set page and the
  full-screen overlays, gesture-handler and Reanimated for the swipe deck.

## Scope

1. Expo SDK 54 app (React Native 0.81, React 19.1, the versions the first app used), Metro wired to
   the shared modules, Hermes `Intl` polyfills the copy needs.
2. Native store and playback driver (AppState replaces page visibility).
3. Primitives: text, icons, buttons, chips, sheets, toasts, set covers, phrase rows, tab bar,
   mini-player.
4. Screens: onboarding, Home, Explore, Library, set page, Now Playing with rating, queue, Make a
   set, phrase details, add phrase, new set, add to set, settings.
5. Verification: typecheck; the web build driven by Playwright; an Android development build on the
   emulator.

## Acceptance

- A learner can onboard, play a set through the loop and rate, browse Explore, see Library progress,
  make their own set by hand and with Make a set, on the web and on Android.
- Progress survives a restart on Android.
- No scheduling number is computed outside the Rust core.

## Out of scope

iOS device verification (this machine has no Xcode), background audio and the lock screen, the media
session, multi-tab merge (a web concern), store releases.
