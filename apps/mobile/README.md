# Loro — the app (Expo / React Native)

A listening-first phrase player: hear a phrase in your language, say it in the pause, hear it in the
language you're learning, then rate how it went. iOS, Android and the web from one Expo app
(plan [104](../../plans/104-prototype-react-native.md)).

**Status:** every screen and sheet of the v2.0 web prototype is ported, and the app is connected
(plan [106](../../plans/106-connected-app.md)): its content, accounts, progress, sharing and AI
generation come from the API ([library.md](../../docs/architecture/library.md)), and so does every
sound: phrases play the clips of the server's voices (plan [108](../../plans/archive/2026-10-01/108-backend-only.md)).
Four tabs: Home, Explore, Create and Library; songs live in their sets and play in the one player,
albums are in Library. The prototype stays in Git history (`design/design-v2.0/rapid-ui-prototype`,
removed after commit `52a0e3b`) as the reference for its behaviour.

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

The app needs the API (`EXPO_PUBLIC_API_URL` in `.env`, default `http://localhost:3000/v1`) the first
time it opens a course; after that it works offline. Analytics and session replay are sent only when
`EXPO_PUBLIC_POSTHOG_KEY` (a public PostHog project key) is set; `EXPO_PUBLIC_POSTHOG_HOST` defaults to
`https://eu.i.posthog.com` (ADR-0011). On the Android emulator run
`adb reverse tcp:3000 tcp:3000`. See [library.md](../../docs/architecture/library.md#running-it-locally).

Expo Go can't run it: the Rust core comes from `modules/loro-core`, a local Expo module
(`packages/core-rs/build.sh` builds its Android libraries).

## How it's built

- **Shared behaviour — `src/shared/`** (imported as `@shared/*`): the API client, session, library
  calls and content cache (`api/`), the content registry the downloaded packs fill (`content/`;
  the tests install the server's seed from `content/fixture.ts`), the pure state machine (`state/machine.ts`, `chart.ts`), the append-only learner
  log and its merge, selectors for every number shown, copy in English/Bulgarian/Russian, phrase
  notes, and the Make a set generator. `state/clock.ts` is the only module that reads the time.
  `core/fsrs.ts` schedules through the Rust core's `core_call`; there is no JavaScript FSRS.
- **The platform edge — `src/platform/`.** On iOS and Android, `metro.config.js` swaps seven shared
  modules: storage and the key-value store (AsyncStorage), the refresh token (expo-secure-store),
  phrase clips (expo-audio), cues (haptics), the Rust core (the LoroCore module instead of WASM) and
  the provider sign-in page (an expo-web-browser auth session returning to `loro://account`, with PKCE
  from expo-crypto, instead of leaving the tab). On the web the originals run.
- **The connected state — `src/state/`.** The store, the account (`account.tsx`), the course's
  content (`content.tsx`) and progress sync (`progressSync.ts`); songs play in `src/music/`.
- **UI.** `app/` holds the routes (expo-router), `src/screens/` and `src/sheets/` the screens,
  `src/ui/` the primitives and tokens (`theme.ts`), `src/nav/Shell.tsx` navigation.
- `pnpm --filter @loro/mobile icons` rebuilds the Material Symbols subset (TrueType, outlined and
  filled) from `src/shared/ui/icons.ts`.
