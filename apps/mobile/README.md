# Loro — the app (Expo / React Native)

A listening-first phrase player: hear a phrase in your language, say it in the pause, hear it in the
language you're learning, then rate how it went. iOS, Android and the web from one Expo app (plan
[104](../../plans/104-prototype-react-native.md)).

The app ships no phrase content. Courses, accounts, progress, sharing, AI generation and every sound
come from the API ([the library](../../docs/architecture/library.md), plan
[106](../../plans/106-connected-app.md)). Four tabs: Home, Explore, Create and Library. Every screen
of the v2.0 web prototype is ported; the prototype stays in Git history
(`design/design-v2.0/rapid-ui-prototype`, last present at `52a0e3b`) as the reference for its
behaviour.

## Run

Node 22 (`nvm use 22`). From the repository root after `pnpm install`:

```bash
pnpm --filter @loro/mobile web        # Expo web: the Rust core runs as WASM
pnpm --filter @loro/mobile android    # development build (JDK 17, Android SDK/NDK, cargo-ndk)
pnpm --filter @loro/mobile ios        # development build (full Xcode)
pnpm --filter @loro/mobile test       # unit tests (node:test via tsx)
pnpm --filter @loro/mobile lint       # ESLint with this app's own config
pnpm --filter @loro/mobile typecheck  # tsc
pnpm --filter @loro/mobile bundle     # proves the iOS bundle compiles
```

One test file, from `apps/mobile` (the tests need the content fixture installed first):

```bash
pnpm exec tsx --import ./src/shared/content/fixture.install.ts --test src/shared/state/machine.test.ts
```

Expo Go can't run the app: the Rust core comes from `modules/loro-core`, a local Expo module
([its README](modules/loro-core/README.md)), and the player on the lock screen from
`modules/loro-media` ([its README](modules/loro-media/README.md)).

### Configuration

The app reads `EXPO_PUBLIC_*` variables from `apps/mobile/.env` (gitignored) at build time:
`EXPO_PUBLIC_API_URL` (default `http://localhost:3000/v1`), the PostHog key and host, and the web
origin for share links. Defaults and effects:
[environments.md](../../docs/process/environments.md#the-app-build-time).

The app needs the API the first time it opens a course; after that the course opens offline, but
phrase clips still stream from the API. On the Android emulator run `adb reverse tcp:3000 tcp:3000`.
See [running it locally](../../docs/architecture/library.md#running-it-locally).

Analytics and session replay are on by default, with "Share usage data" in Settings to turn them
off; they never include sound
([ADR-0011](../../docs/architecture/adr/0011-analytics-and-privacy.md)).

## How it's built

- **Shared behaviour — `src/shared/`** (imported as `@shared/*`), platform-neutral:
  - `api/`: the API client, session and sign-in (email code, and Google or Apple when the server
    offers them), library calls, progress and the content cache;
  - `content/`: the registry the downloaded packs fill; the unit tests install the server's seed
    from `content/fixture.ts` and validate it with `content/validate.ts`;
  - `state/`: the pure state machine (`machine.ts`, `chart.ts`), the append-only learner log and its
    merge (`merge.ts`), and `selectors.ts`, which derives every number on screen. `clock.ts` is the
    only module that reads the time;
  - `core/fsrs.ts`: scheduling through the Rust core's `core_call`; there is no JavaScript FSRS;
  - `copy/` (English, Bulgarian, Russian), `generate/` (Make a set), `audio/`, `analytics/`, `nav/`
    and `ui/`.
- **The platform edge — `src/platform/`.** On iOS and Android, `metro.config.js` swaps nine
  shared modules by resolved path (its `NATIVE` map): saved progress and the key-value store
  (AsyncStorage), the refresh token (expo-secure-store), phrase clips (expo-audio), cues (haptics),
  touch feedback on the controls (expo-haptics; `src/ui/Press.tsx` and `Toggle.tsx` give it),
  the Rust core (the `LoroCore` module instead of WASM), the provider sign-in page (an
  expo-web-browser auth session returning to `loro://account`, or `loro-dev://` in a development
  build, with PKCE from expo-crypto) and notifications (expo-notifications, plan 113: a word when a
  song is ready, from the server through Expo's push service once the app has registered its token
  with `src/state/push.ts`, or from the app itself while it runs in the background; a tap opens the
  album; a push token needs `EAS_PROJECT_ID` when the app is built). On the web the originals run.
  `intl.native.ts` adds the Intl polyfills Hermes lacks.
- **The connected state — `src/state/`.** The React store around the machine, the account
  (`account.tsx`), the course's content (`content.tsx`) and progress sync (`progressSync.ts`).
  Songs play in `src/music/`; PostHog is set up in `src/analytics/`.
- **Playback — `src/audio/`.** The loop's driver (`driver.ts`) runs each player phase's sound, and
  the one player shows on the lock screen and in the notification shade with its grades
  (`lockScreen.ts`, P3-11), through the `LoroMedia` module. On iOS and Android the player plays on
  with the screen locked: the loop's silences are timed natively (`after` in `media.ts`), and calls,
  other apps and unplugged headphones pause it.
- **UI.** `app/` holds the routes (expo-router), `src/screens/` and `src/sheets/` the screens,
  `src/ui/` the primitives and tokens (`theme.ts`), and `src/nav/Shell.tsx` the navigation.
- **The keyboard.** The app is drawn edge to edge, so Android resizes no window for the keyboard,
  and a sheet is a window of its own (a `Modal`), whose keyboard React Native's `Keyboard` events
  and reanimated don't see. `react-native-keyboard-controller` (its `KeyboardProvider` in
  `app/_layout.tsx`) does: `src/ui/keyboard.ts` gives a sheet the keyboard's height, and forms on
  a page use its `KeyboardAvoidingView`. A new native module, so a new development build or APK.
- **Icons.** `pnpm --filter @loro/mobile icons` rebuilds the Material Symbols subset (two TrueType
  fonts, outlined and filled) and `src/ui/iconCodepoints.ts` from the names in
  `src/shared/ui/icons.ts`. It downloads from Google Fonts and needs `uv` (for
  `scripts/fix-cmap.py`); the fonts are bundled, never loaded at run time.
