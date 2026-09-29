# Loro — the app (Expo / React Native)

A listening-first phrase player: hear a phrase in your language, say it in the pause, hear it in the
language you're learning, then rate how it went. iOS, Android and the web from one Expo app
(plan [104](../../plans/104-prototype-react-native.md)).

**Status:** the shell, state, storage, speech, Rust core bridge, navigation, onboarding, Home and
the player are real. Explore, Library, the set page, the queue, Make a set and every sheet are still
stand-ins (files marked `STAND-IN`); the v2.0 web prototype they port from is in Git history
(`design/design-v2.0/rapid-ui-prototype`, removed after commit `52a0e3b`).

## Run

Node 22 (`nvm use 22`). From the repository root after `pnpm install`:

```bash
pnpm --filter @loro/mobile web        # Expo web: the Rust core runs as WASM
pnpm --filter @loro/mobile android    # development build (JDK 17, Android SDK/NDK, cargo-ndk)
pnpm --filter @loro/mobile ios        # development build (Xcode)
pnpm --filter @loro/mobile test       # unit tests (node:test via tsx)
pnpm --filter @loro/mobile lint       # this app's ESLint config + typecheck separately
pnpm --filter @loro/mobile bundle     # proves the iOS bundle compiles
```

Expo Go can't run it: the Rust core comes from `modules/loro-core`, a local Expo module
(`packages/core-rs/build.sh` builds its Android libraries).

## How it's built

- **Shared behaviour — `src/shared/`** (imported as `@shared/*`): content (JSON validated with zod
  in the tests), the pure state machine (`state/machine.ts`, `chart.ts`), the append-only learner
  log and its merge, selectors for every number shown, copy in English/Bulgarian/Russian, phrase
  notes, and the Make a set generator. `state/clock.ts` is the only module that reads the time.
  `core/fsrs.ts` schedules through the Rust core's `core_call`; there is no JavaScript FSRS.
- **The platform edge — `src/platform/`.** On iOS and Android, `metro.config.js` swaps four shared
  modules: storage (AsyncStorage), speech (expo-speech), cues (haptics) and the Rust core (the
  LoroCore module instead of WASM). On the web the originals run.
- **UI.** `app/` holds the routes (expo-router), `src/screens/` and `src/sheets/` the screens,
  `src/ui/` the primitives and tokens (`theme.ts`), `src/nav/Shell.tsx` navigation.
- `pnpm --filter @loro/mobile icons` rebuilds the Material Symbols subset (TrueType, outlined and
  filled) from `src/shared/ui/icons.ts`.
